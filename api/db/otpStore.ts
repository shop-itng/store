import crypto from 'crypto';
import { getPool, withTransaction } from './postgres.js';

export interface StoredOtpRecord {
  email: string;
  purpose: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
  attemptsRemaining: number;
  metadata?: Record<string, any>;
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_EMAIL_REQUESTS = 5; // 5 per email per 15 mins
const MAX_DEVICE_REQUESTS = 10; // 10 per device per 15 mins
const SIGNUP_PROOF_TTL_MS = 30 * 60 * 1000; // 30 minutes

const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const ENV_OTP_SALT = (process.env.OTP_HASH_SALT || '').trim();
if (IS_PROD && !ENV_OTP_SALT) {
  console.error('[SECURITY CRITICAL] OTP_HASH_SALT environment variable is missing in production.');
}
// In non-production dev/test environments, generate a random per-process salt (never a hardcoded string)
const EPHEMERAL_DEV_SALT = crypto.randomBytes(32).toString('hex');

function getOtpSalt(): string {
  if (ENV_OTP_SALT) return ENV_OTP_SALT;
  if (IS_PROD) {
    throw new Error('OTP_HASH_SALT must be configured in production.');
  }
  return EPHEMERAL_DEV_SALT;
}

export function hashOtp(code: string): string {
  const salt = getOtpSalt();
  return crypto.createHash('sha256').update(`${code.trim()}:${salt}`).digest('hex');
}

export function verifyOtpHash(enteredCode: string, storedHash: string): boolean {
  try {
    const computed = hashOtp(enteredCode);
    if (!storedHash || computed.length !== storedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const commandPayload = [
      command.toUpperCase(),
      ...args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
    ];
    const url = KV_URL.replace(/\/$/, '');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandPayload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json: any = await res.json();
    return json.result;
  } catch {
    return null;
  }
}

/**
 * Generic shared rate limit checker & recorder using Redis + PostgreSQL (zero in-memory Maps).
 */
export async function checkAndRecordRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = Date.now();
  const cleanKey = `rl:${bucketKey}`;

  if (KV_URL && KV_TOKEN) {
    try {
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
      const countRaw = await runKvCommand('INCR', cleanKey);
      if (countRaw !== null) {
        const count = Number(countRaw);
        if (count === 1) {
          await runKvCommand('EXPIRE', cleanKey, windowSec);
        }
        if (count > maxRequests) {
          return { allowed: false, retryAfterSeconds: windowSec };
        }
        return { allowed: true };
      }
    } catch {}
  }

  return withTransaction(async client => {
    const res = await client.query(
      'SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE',
      [cleanKey]
    );
    const recent: number[] = (res.rows[0]?.timestamps || []).filter(
      (t: number) => now - t < windowMs
    );
    if (recent.length >= maxRequests) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, retryAfterSeconds };
    }
    recent.push(now);
    await client.query(
      'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
      [cleanKey, JSON.stringify(recent)]
    );
    return { allowed: true };
  });
}

/**
 * Checks email (5 / 15m) and device (10 / 15m) rate limits strictly on the database / Redis.
 */
export async function checkRateLimit(
  email: string,
  deviceId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDevice = (deviceId || 'dev_unknown').trim();
  const now = Date.now();

  const emailKey = `shopit_rl_email_${cleanEmail}`;
  const devKey = `shopit_rl_dev_${cleanDevice}`;

  if (KV_URL && KV_TOKEN) {
    try {
      const emailRaw = await runKvCommand('GET', emailKey);
      const emailTimes: number[] = (emailRaw ? JSON.parse(emailRaw) : []).filter(
        (t: number) => now - t < RATE_LIMIT_WINDOW_MS
      );
      if (emailTimes.length >= MAX_EMAIL_REQUESTS) {
        return {
          allowed: false,
          reason: 'Too many OTP requests for this email. Please wait before trying again.',
        };
      }

      if (cleanDevice !== 'dev_unknown') {
        const devRaw = await runKvCommand('GET', devKey);
        const devTimes: number[] = (devRaw ? JSON.parse(devRaw) : []).filter(
          (t: number) => now - t < RATE_LIMIT_WINDOW_MS
        );
        if (devTimes.length >= MAX_DEVICE_REQUESTS) {
          return {
            allowed: false,
            reason: 'Too many OTP requests from this device. Please wait before trying again.',
          };
        }
      }
      return { allowed: true };
    } catch {}
  }

  const pool = await getPool();
  const res = await pool.query('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [emailKey]);
  const emailTimes: number[] = (res.rows[0]?.timestamps || []).filter(
    (t: number) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (emailTimes.length >= MAX_EMAIL_REQUESTS) {
    return {
      allowed: false,
      reason: 'Too many OTP requests for this email. Please wait before trying again.',
    };
  }

  if (cleanDevice !== 'dev_unknown') {
    const dRes = await pool.query('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [devKey]);
    const devTimes: number[] = (dRes.rows[0]?.timestamps || []).filter(
      (t: number) => now - t < RATE_LIMIT_WINDOW_MS
    );
    if (devTimes.length >= MAX_DEVICE_REQUESTS) {
      return {
        allowed: false,
        reason: 'Too many OTP requests from this device. Please wait before trying again.',
      };
    }
  }
  return { allowed: true };
}

export async function recordRateLimit(email: string, deviceId?: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDevice = (deviceId || 'dev_unknown').trim();
  const now = Date.now();

  const emailKey = `shopit_rl_email_${cleanEmail}`;
  const devKey = `shopit_rl_dev_${cleanDevice}`;

  if (KV_URL && KV_TOKEN) {
    try {
      const emailRaw = await runKvCommand('GET', emailKey);
      const emailTimes: number[] = (emailRaw ? JSON.parse(emailRaw) : []).filter(
        (t: number) => now - t < RATE_LIMIT_WINDOW_MS
      );
      emailTimes.push(now);
      await runKvCommand('SET', emailKey, JSON.stringify(emailTimes));

      if (cleanDevice !== 'dev_unknown') {
        const devRaw = await runKvCommand('GET', devKey);
        const devTimes: number[] = (devRaw ? JSON.parse(devRaw) : []).filter(
          (t: number) => now - t < RATE_LIMIT_WINDOW_MS
        );
        devTimes.push(now);
        await runKvCommand('SET', devKey, JSON.stringify(devTimes));
      }
      return;
    } catch {}
  }

  await withTransaction(async client => {
    const res = await client.query(
      'SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE',
      [emailKey]
    );
    const emailTimes: number[] = (res.rows[0]?.timestamps || []).filter(
      (t: number) => now - t < RATE_LIMIT_WINDOW_MS
    );
    emailTimes.push(now);
    await client.query(
      'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
      [emailKey, JSON.stringify(emailTimes)]
    );

    if (cleanDevice !== 'dev_unknown') {
      const dRes = await client.query(
        'SELECT timestamps FROM shopit_rate_limits WHERE key = $1 FOR UPDATE',
        [devKey]
      );
      const devTimes: number[] = (dRes.rows[0]?.timestamps || []).filter(
        (t: number) => now - t < RATE_LIMIT_WINDOW_MS
      );
      devTimes.push(now);
      await client.query(
        'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
        [devKey, JSON.stringify(devTimes)]
      );
    }
  });
}

export async function checkResendCooldown(
  email: string,
  purpose: string
): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const record = await getOtpRecord(email, purpose);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (now < record.resendAvailableAt) {
    const waitSeconds = Math.ceil((record.resendAvailableAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true };
}

/**
 * Saves hashed OTP into PostgreSQL shopit_otps (with row-level lockable consistency across instances).
 */
export async function saveHashedOtp(
  email: string,
  purpose: string,
  codeHash: string,
  metadata?: Record<string, any>
): Promise<StoredOtpRecord> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const now = Date.now();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;

  const record: StoredOtpRecord = {
    email: cleanEmail,
    purpose: cleanPurpose,
    codeHash,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    attemptsRemaining: 3,
    metadata,
  };

  const pool = await getPool();
  await pool.query(
    'INSERT INTO shopit_otps (key, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET data = $2, expires_at = $3',
    [key, JSON.stringify(record), record.expiresAt]
  );
  return record;
}

export async function getOtpRecord(email: string, purpose: string): Promise<StoredOtpRecord | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;

  const pool = await getPool();
  const res = await pool.query('SELECT data, expires_at FROM shopit_otps WHERE key = $1', [key]);
  if (res.rows[0]) {
    const data = res.rows[0].data;
    return typeof data === 'string' ? JSON.parse(data) : (data as StoredOtpRecord);
  }
  return null;
}

export async function updateOtpRecord(record: StoredOtpRecord): Promise<void> {
  const key = `shopit_otp_${record.email}_${record.purpose}`;
  const pool = await getPool();
  await pool.query(
    'INSERT INTO shopit_otps (key, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET data = $2, expires_at = $3',
    [key, JSON.stringify(record), record.expiresAt]
  );
}

export async function deleteOtpRecord(email: string, purpose: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;
  const pool = await getPool();
  await pool.query('DELETE FROM shopit_otps WHERE key = $1', [key]);
}

/**
 * Atomic OTP verification & consumption inside a PostgreSQL transaction (`SELECT ... FOR UPDATE`).
 * Prevents parallel brute-force race conditions on the 3-attempt limit.
 */
export async function verifyAndConsumeOtp(
  email: string,
  purpose: string,
  enteredCode: string
): Promise<{ success: boolean; error?: string; attemptsRemaining?: number; record?: StoredOtpRecord }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;

  if (!enteredCode || !/^\d{6}$/.test(enteredCode.trim())) {
    return { success: false, error: 'Please enter the 6-digit verification code.' };
  }

  return withTransaction(async client => {
    const res = await client.query(
      'SELECT data, expires_at FROM shopit_otps WHERE key = $1 FOR UPDATE',
      [key]
    );

    if (res.rows.length === 0) {
      return { success: false, error: 'No active verification code found. Please request a new code.' };
    }

    const record: StoredOtpRecord =
      typeof res.rows[0].data === 'string' ? JSON.parse(res.rows[0].data) : res.rows[0].data;

    if (Date.now() > Number(record.expiresAt)) {
      await client.query('DELETE FROM shopit_otps WHERE key = $1', [key]);
      return { success: false, error: 'Verification code has expired. Please request a new code.' };
    }

    if (verifyOtpHash(enteredCode.trim(), record.codeHash)) {
      await client.query('DELETE FROM shopit_otps WHERE key = $1', [key]);
      return { success: true, record };
    }

    const nextAttempts = Math.max(0, Number(record.attemptsRemaining) - 1);
    if (nextAttempts <= 0) {
      await client.query('DELETE FROM shopit_otps WHERE key = $1', [key]);
      return {
        success: false,
        attemptsRemaining: 0,
        error: 'Too many incorrect attempts. This verification code has been invalidated. Request a new code.',
      };
    }

    record.attemptsRemaining = nextAttempts;
    await client.query(
      'UPDATE shopit_otps SET data = $1 WHERE key = $2',
      [JSON.stringify(record), key]
    );

    return {
      success: false,
      attemptsRemaining: nextAttempts,
      error: `Invalid verification code. ${nextAttempts} attempt(s) remaining.`,
    };
  });
}

/**
 * Issues a single-use server token proving an email passed OTP verification for 'signup'.
 */
export async function issueSignupVerificationToken(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const rawToken = 'sproof_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(`${cleanEmail}:${rawToken}:${getOtpSalt()}`)
    .digest('hex');
  const expiresAt = Date.now() + SIGNUP_PROOF_TTL_MS;

  const pool = await getPool();
  await pool.query(
    `INSERT INTO shopit_verified_signups (email, token_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET token_hash = $2, expires_at = $3`,
    [cleanEmail, tokenHash, expiresAt]
  );
  return rawToken;
}

/**
 * Atomically consumes and validates a signup verification token before creating a user account.
 */
export async function consumeSignupVerificationToken(email: string, rawToken: string): Promise<boolean> {
  const cleanEmail = email.trim().toLowerCase();
  if (!rawToken || typeof rawToken !== 'string') return false;

  const expectedHash = crypto
    .createHash('sha256')
    .update(`${cleanEmail}:${rawToken.trim()}:${getOtpSalt()}`)
    .digest('hex');

  return withTransaction(async client => {
    const res = await client.query(
      'SELECT token_hash, expires_at FROM shopit_verified_signups WHERE email = $1 FOR UPDATE',
      [cleanEmail]
    );
    if (res.rows.length === 0) return false;

    const row = res.rows[0];
    if (Date.now() > Number(row.expires_at)) {
      await client.query('DELETE FROM shopit_verified_signups WHERE email = $1', [cleanEmail]);
      return false;
    }

    const storedBuf = Buffer.from(String(row.token_hash));
    const expectedBuf = Buffer.from(expectedHash);
    if (storedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(storedBuf, expectedBuf)) {
      return false;
    }

    await client.query('DELETE FROM shopit_verified_signups WHERE email = $1', [cleanEmail]);
    return true;
  });
}

// -------------------------------------------------------------
// Payment Records Store (PostgreSQL Authoritative)
// -------------------------------------------------------------

export interface PaymentRecord {
  reference: string;
  orderId: string;
  amountKobo: number;
  amountNaira: number;
  currency: string;
  channel: string;
  status: 'pending' | 'pending_payment' | 'paid' | 'failed' | 'refunded';
  webhookReceived: boolean;
  customerEmail: string;
  data?: any;
  createdAt: string;
  updatedAt: string;
}

export async function savePaymentRecord(record: PaymentRecord): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO shopit_payments (
      reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, data, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (reference) DO UPDATE SET
      status = $7,
      webhook_received = $8,
      channel = COALESCE($6, shopit_payments.channel),
      updated_at = NOW(),
      data = $10`,
    [
      record.reference,
      record.orderId,
      record.amountKobo,
      record.amountNaira,
      record.currency || 'NGN',
      record.channel?.trim() || null,
      record.status,
      record.webhookReceived,
      record.customerEmail,
      JSON.stringify(record.data || {}),
    ]
  );
}

export async function getPaymentRecord(reference: string): Promise<PaymentRecord | null> {
  const pool = await getPool();
  const res = await pool.query('SELECT * FROM shopit_payments WHERE reference = $1', [reference]);
  if (res.rows.length > 0) {
    const row = res.rows[0];
    return {
      reference: row.reference,
      orderId: row.order_id,
      amountKobo: Number(row.amount_kobo),
      amountNaira: Number(row.amount_naira),
      currency: row.currency,
      channel: row.channel,
      status: row.status,
      webhookReceived: Boolean(row.webhook_received),
      customerEmail: row.customer_email,
      data: row.data,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };
  }
  return null;
}

export async function getAllPaymentRecords(): Promise<PaymentRecord[]> {
  const pool = await getPool();
  const res = await pool.query('SELECT * FROM shopit_payments ORDER BY created_at DESC LIMIT 200');
  return res.rows.map((row: any) => ({
    reference: row.reference,
    orderId: row.order_id,
    amountKobo: Number(row.amount_kobo),
    amountNaira: Number(row.amount_naira),
    currency: row.currency,
    channel: row.channel,
    status: row.status,
    webhookReceived: Boolean(row.webhook_received),
    customerEmail: row.customer_email,
    data: row.data,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }));
}

// -------------------------------------------------------------
// Report Records Store (PostgreSQL Authoritative)
// -------------------------------------------------------------

export interface ReportRecord {
  id: string;
  targetType: 'product' | 'seller' | 'review' | 'chat';
  targetId: string;
  targetTitle: string;
  reporterEmail?: string;
  reason: string;
  details: string;
  status: 'open' | 'reviewing' | 'resolved';
  actionLogs: Array<{ action: string; note: string; timestamp: string }>;
  createdAt: string;
}

export async function saveReportRecord(report: ReportRecord): Promise<void> {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO shopit_reports (id, target_type, target_id, target_title, reporter_email, reason, details, status, action_logs, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (id) DO UPDATE SET status = $8, action_logs = $9`,
    [
      report.id,
      report.targetType,
      report.targetId,
      report.targetTitle,
      report.reporterEmail || null,
      report.reason,
      report.details,
      report.status,
      JSON.stringify(report.actionLogs || []),
    ]
  );
}

export async function getAllReportRecords(): Promise<ReportRecord[]> {
  const pool = await getPool();
  const res = await pool.query('SELECT * FROM shopit_reports ORDER BY created_at DESC LIMIT 200');
  return res.rows.map((row: any) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetTitle: row.target_title,
    reporterEmail: row.reporter_email,
    reason: row.reason,
    details: row.details,
    status: row.status,
    actionLogs: row.action_logs || [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }));
}

export async function updateReportStatus(
  reportId: string,
  status: 'open' | 'reviewing' | 'resolved',
  actionNote?: string
): Promise<void> {
  const pool = await getPool();
  const existing = await pool.query('SELECT action_logs FROM shopit_reports WHERE id = $1', [reportId]);
  const logs = existing.rows[0]?.action_logs || [];
  if (actionNote) {
    logs.push({ action: `Status changed to ${status}`, note: actionNote, timestamp: new Date().toISOString() });
  }
  await pool.query('UPDATE shopit_reports SET status = $1, action_logs = $2 WHERE id = $3', [
    status,
    JSON.stringify(logs),
    reportId,
  ]);
}

export async function pingHealth(): Promise<{
  app: 'ok';
  database: 'connected' | 'not_configured' | 'error';
  redis: 'connected' | 'not_configured' | 'error';
  timestamp: string;
}> {
  let dbStatus: 'connected' | 'not_configured' | 'error' = 'not_configured';
  let redisStatus: 'connected' | 'not_configured' | 'error' = 'not_configured';

  try {
    const pool = await getPool();
    if (pool) {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    }
  } catch {
    dbStatus = 'error';
  }

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('PING');
      redisStatus = 'connected';
    } catch {
      redisStatus = 'error';
    }
  }

  return {
    app: 'ok',
    database: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  };
}
