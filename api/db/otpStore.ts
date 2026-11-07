import crypto from 'crypto';

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

// Internal salt for hashing 6-digit codes
const OTP_HASH_SALT = process.env.OTP_HASH_SALT || 'shopit_brevo_otp_salt_2026';

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(`${code.trim()}:${OTP_HASH_SALT}`).digest('hex');
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

// -------------------------------------------------------------
// Database Adapters: Vercel KV / Upstash Redis and PostgreSQL (Zero File System Dependencies)
// -------------------------------------------------------------
const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const PG_URL = (process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim();

// In-memory ephemeral fallback maps for local development/test execution
const memoryOtps = new Map<string, StoredOtpRecord>();
const memoryRateLimits = new Map<string, number[]>();
const memoryPayments = new Map<string, any>();
const memoryReports = new Map<string, any>();

// KV / Redis REST command helper
async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url = `${KV_URL.replace(/\/$/, '')}/${command}/${args.map(a => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))).join('/')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Upstash Redis OTP] ${command} returned HTTP ${res.status}. Falling back gracefully.`);
      return null;
    }
    const json: any = await res.json();
    return json.result;
  } catch (err: any) {
    console.warn(`[Upstash Redis OTP Error] ${command}: ${err.message}. Safely falling back to memory/db.`);
    return null;
  }
}

// PostgreSQL Client Pool (lazy initialized if PG_URL is present)
let pgPool: any = null;
let pgTableInitialized = false;

async function getPgPool() {
  if (!PG_URL) return null;
  if (!pgPool) {
    try {
      // @ts-ignore
      const { Pool } = await import('pg');
      pgPool = new Pool({ connectionString: PG_URL, max: 5 });
    } catch {
      return null;
    }
  }
  if (!pgTableInitialized && pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS shopit_otps (
          key VARCHAR(255) PRIMARY KEY,
          data JSONB NOT NULL,
          expires_at BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS shopit_rate_limits (
          key VARCHAR(255) PRIMARY KEY,
          timestamps JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS shopit_payments (
          reference VARCHAR(255) PRIMARY KEY,
          order_id VARCHAR(255),
          amount_kobo BIGINT,
          amount_naira NUMERIC,
          currency VARCHAR(10) DEFAULT 'NGN',
          channel VARCHAR(50),
          status VARCHAR(50),
          webhook_received BOOLEAN DEFAULT FALSE,
          customer_email VARCHAR(255),
          data JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS shopit_reports (
          id VARCHAR(255) PRIMARY KEY,
          target_type VARCHAR(50) NOT NULL,
          target_id VARCHAR(255) NOT NULL,
          target_title VARCHAR(255),
          reporter_email VARCHAR(255),
          reason VARCHAR(255) NOT NULL,
          details TEXT,
          status VARCHAR(50) DEFAULT 'open',
          action_logs JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      pgTableInitialized = true;
    } catch (err: any) {
      console.warn('[Postgres] Table init warning:', err.message);
    }
  }
  return pgPool;
}

// -------------------------------------------------------------
// Core OTP Database API
// -------------------------------------------------------------

/**
 * Checks email (5 / 15m) and device (10 / 15m) rate limits strictly on the database.
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

  // 1. Check Vercel KV / Upstash
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
    } catch (err: any) {
      console.warn('[RateLimit KV Check Error]', err.message);
    }
  }

  // 2. Check PostgreSQL
  const pool = await getPgPool();
  if (pool) {
    try {
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
    } catch (err: any) {
      console.warn('[RateLimit PG Check Error]', err.message);
    }
  }

  // 3. Fallback: In-memory store for local dev
  const emailTimes = (memoryRateLimits.get(emailKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (emailTimes.length >= MAX_EMAIL_REQUESTS) {
    return {
      allowed: false,
      reason: 'Too many OTP requests for this email. Please wait before trying again.',
    };
  }

  if (cleanDevice !== 'dev_unknown') {
    const devTimes = (memoryRateLimits.get(devKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (devTimes.length >= MAX_DEVICE_REQUESTS) {
      return {
        allowed: false,
        reason: 'Too many OTP requests from this device. Please wait before trying again.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Records an OTP request timestamp in the database for rate limiting.
 */
export async function recordRateLimit(email: string, deviceId?: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanDevice = (deviceId || 'dev_unknown').trim();
  const now = Date.now();

  const emailKey = `shopit_rl_email_${cleanEmail}`;
  const devKey = `shopit_rl_dev_${cleanDevice}`;

  // 1. KV
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

  // 2. PG
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [emailKey]);
      const emailTimes: number[] = (res.rows[0]?.timestamps || []).filter(
        (t: number) => now - t < RATE_LIMIT_WINDOW_MS
      );
      emailTimes.push(now);
      await pool.query(
        'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
        [emailKey, JSON.stringify(emailTimes)]
      );

      if (cleanDevice !== 'dev_unknown') {
        const dRes = await pool.query('SELECT timestamps FROM shopit_rate_limits WHERE key = $1', [devKey]);
        const devTimes: number[] = (dRes.rows[0]?.timestamps || []).filter(
          (t: number) => now - t < RATE_LIMIT_WINDOW_MS
        );
        devTimes.push(now);
        await pool.query(
          'INSERT INTO shopit_rate_limits (key, timestamps) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET timestamps = $2',
          [devKey, JSON.stringify(devTimes)]
        );
      }
      return;
    } catch {}
  }

  // 3. Fallback: In-memory store
  const emailTimes = (memoryRateLimits.get(emailKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  emailTimes.push(now);
  memoryRateLimits.set(emailKey, emailTimes);

  if (cleanDevice !== 'dev_unknown') {
    const devTimes = (memoryRateLimits.get(devKey) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    devTimes.push(now);
    memoryRateLimits.set(devKey, devTimes);
  }
}

/**
 * Checks 60-second resend cooldown for an email and purpose.
 */
export async function checkResendCooldown(
  email: string,
  purpose: string
): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const record = await getOtpRecord(email, purpose);
  if (!record) return { allowed: true };

  const now = Date.now();
  if (now < record.resendAvailableAt) {
    const waitSeconds = Math.ceil((record.resendAvailableAt - now) / 1000);
    return {
      allowed: false,
      waitSeconds,
    };
  }
  return { allowed: true };
}

/**
 * Saves a hashed 6-digit OTP into the database with 10-minute expiry and 3 attempts.
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
    expiresAt: now + OTP_EXPIRY_MS, // 10 minutes
    resendAvailableAt: now + RESEND_COOLDOWN_MS, // 60 seconds
    attemptsRemaining: 3, // 3 wrong tries before cancellation
    metadata,
  };

  // 1. KV
  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('SET', key, JSON.stringify(record));
      return record;
    } catch (err: any) {
      console.warn('[Save OTP KV Error]', err.message);
    }
  }

  // 2. PG
  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO shopit_otps (key, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET data = $2, expires_at = $3',
        [key, JSON.stringify(record), record.expiresAt]
      );
      return record;
    } catch (err: any) {
      console.warn('[Save OTP PG Error]', err.message);
    }
  }

  // 3. Fallback: In-memory store
  memoryOtps.set(key, record);
  return record;
}

/**
 * Retrieves an active OTP record from the database.
 */
export async function getOtpRecord(email: string, purpose: string): Promise<StoredOtpRecord | null> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;

  // 1. KV
  if (KV_URL && KV_TOKEN) {
    try {
      const raw = await runKvCommand('GET', key);
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
      return null;
    } catch {}
  }

  // 2. PG
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT data, expires_at FROM shopit_otps WHERE key = $1', [key]);
      if (res.rows[0]) {
        return res.rows[0].data as StoredOtpRecord;
      }
      return null;
    } catch {}
  }

  // 3. Fallback: In-memory store
  return memoryOtps.get(key) || null;
}

/**
 * Updates an OTP record (e.g. decrementing remaining tries).
 */
export async function updateOtpRecord(record: StoredOtpRecord): Promise<void> {
  const key = `shopit_otp_${record.email}_${record.purpose}`;

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('SET', key, JSON.stringify(record));
      return;
    } catch {}
  }

  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO shopit_otps (key, data, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET data = $2, expires_at = $3',
        [key, JSON.stringify(record), record.expiresAt]
      );
      return;
    } catch {}
  }

  memoryOtps.set(key, record);
}

/**
 * Deletes/consumes an OTP record upon successful verification or cancellation.
 */
export async function deleteOtpRecord(email: string, purpose: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPurpose = purpose.trim();
  const key = `shopit_otp_${cleanEmail}_${cleanPurpose}`;

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('DEL', key);
    } catch {}
  }

  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM shopit_otps WHERE key = $1', [key]);
    } catch {}
  }

  memoryOtps.delete(key);
}

// -------------------------------------------------------------
// Payment Records Store (Server-Authoritative & Idempotent)
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
  const pool = await getPgPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, data, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (reference) DO UPDATE SET
          status = $7,
          webhook_received = $8,
          channel = COALESCE(NULLIF($6, ''), shopit_payments.channel),
          updated_at = NOW(),
          data = $10`,
        [
          record.reference,
          record.orderId,
          record.amountKobo,
          record.amountNaira,
          record.currency || 'NGN',
          record.channel || 'unknown',
          record.status,
          record.webhookReceived,
          record.customerEmail,
          JSON.stringify(record.data || {}),
        ]
      );
      return;
    } catch (err: any) {
      console.warn('[Payments PG Save Error]', err.message);
    }
  }

  if (KV_URL && KV_TOKEN) {
    try {
      await runKvCommand('SET', `shopit_payment_${record.reference}`, JSON.stringify(record));
    } catch {}
  }

  memoryPayments.set(record.reference, record);
}

export async function getPaymentRecord(reference: string): Promise<PaymentRecord | null> {
  const pool = await getPgPool();
  if (pool) {
    try {
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
    } catch {}
  }

  if (KV_URL && KV_TOKEN) {
    try {
      const raw = await runKvCommand('GET', `shopit_payment_${reference}`);
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {}
  }

  return memoryPayments.get(reference) || null;
}

export async function getAllPaymentRecords(): Promise<PaymentRecord[]> {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM shopit_payments ORDER BY created_at DESC LIMIT 200');
      if (res.rows.length > 0) {
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
    } catch {}
  }

  return Array.from(memoryPayments.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// -------------------------------------------------------------
// Report Records Store
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
  const pool = await getPgPool();
  if (pool) {
    try {
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
      return;
    } catch (err: any) {
      console.warn('[Reports PG Save Error]', err.message);
    }
  }

  memoryReports.set(report.id, report);
}

export async function getAllReportRecords(): Promise<ReportRecord[]> {
  const pool = await getPgPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM shopit_reports ORDER BY created_at DESC LIMIT 200');
      if (res.rows.length > 0) {
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
    } catch {}
  }

  return Array.from(memoryReports.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateReportStatus(
  reportId: string,
  status: 'open' | 'reviewing' | 'resolved',
  actionNote?: string
): Promise<void> {
  const pool = await getPgPool();
  if (pool) {
    try {
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
      return;
    } catch {}
  }

  const existingReport = memoryReports.get(reportId);
  if (existingReport) {
    existingReport.status = status;
    if (actionNote) {
      existingReport.actionLogs = existingReport.actionLogs || [];
      existingReport.actionLogs.push({
        action: `Status changed to ${status}`,
        note: actionNote,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// -------------------------------------------------------------
// Health Check Diagnostic Routine (Part 2 Item 2)
// -------------------------------------------------------------

export async function pingHealth(): Promise<{
  app: 'ok';
  database: 'connected' | 'not_configured' | 'error';
  redis: 'connected' | 'not_configured' | 'error';
  timestamp: string;
}> {
  let dbStatus: 'connected' | 'not_configured' | 'error' = 'not_configured';
  let redisStatus: 'connected' | 'not_configured' | 'error' = 'not_configured';

  if (PG_URL) {
    try {
      const pool = await getPgPool();
      if (pool) {
        await pool.query('SELECT 1');
        dbStatus = 'connected';
      }
    } catch {
      dbStatus = 'error';
    }
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
