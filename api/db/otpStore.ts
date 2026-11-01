import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
// Database Adapters: Vercel KV / Upstash Redis, PostgreSQL, and Persistent File Store
// -------------------------------------------------------------
const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const PG_URL = (process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim();

// File store path for local development & warm serverless fallback
const FILE_STORE_PATH = process.env.VERCEL
  ? '/tmp/shopit_otp_db.json'
  : path.resolve(process.cwd(), '.data', 'otp_db.json');

function ensureFileStoreDir() {
  try {
    const dir = path.dirname(FILE_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
}

function readFileStore(): { otps: Record<string, StoredOtpRecord>; rateLimits: Record<string, number[]> } {
  try {
    ensureFileStoreDir();
    if (fs.existsSync(FILE_STORE_PATH)) {
      const raw = fs.readFileSync(FILE_STORE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { otps: {}, rateLimits: {} };
}

function writeFileStore(data: { otps: Record<string, StoredOtpRecord>; rateLimits: Record<string, number[]> }) {
  try {
    ensureFileStoreDir();
    fs.writeFileSync(FILE_STORE_PATH, JSON.stringify(data), 'utf-8');
  } catch (err: any) {
    console.warn('[OTP Store] Persistent file write warning:', err.message);
  }
}

// KV / Redis REST command helper
async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  const url = `${KV_URL.replace(/\/$/, '')}/${command}/${args.map(a => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))).join('/')}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`KV command failed with status ${res.status}`);
  }
  const json: any = await res.json();
  return json.result;
}

// PostgreSQL Client Pool (lazy initialized if PG_URL is present)
let pgPool: any = null;
let pgTableInitialized = false;

async function getPgPool() {
  if (!PG_URL) return null;
  if (!pgPool) {
    try {
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

  // 3. Fallback: Persistent File Store
  const store = readFileStore();
  const emailTimes = (store.rateLimits[emailKey] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (emailTimes.length >= MAX_EMAIL_REQUESTS) {
    return {
      allowed: false,
      reason: 'Too many OTP requests for this email. Please wait before trying again.',
    };
  }

  if (cleanDevice !== 'dev_unknown') {
    const devTimes = (store.rateLimits[devKey] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
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

  // 3. Fallback
  const store = readFileStore();
  const emailTimes = (store.rateLimits[emailKey] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  emailTimes.push(now);
  store.rateLimits[emailKey] = emailTimes;

  if (cleanDevice !== 'dev_unknown') {
    const devTimes = (store.rateLimits[devKey] || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    devTimes.push(now);
    store.rateLimits[devKey] = devTimes;
  }
  writeFileStore(store);
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

  // 3. Fallback
  const store = readFileStore();
  store.otps[key] = record;
  writeFileStore(store);
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

  // 3. Fallback
  const store = readFileStore();
  return store.otps[key] || null;
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

  const store = readFileStore();
  store.otps[key] = record;
  writeFileStore(store);
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

  const store = readFileStore();
  delete store.otps[key];
  writeFileStore(store);
}
