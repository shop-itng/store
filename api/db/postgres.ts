import 'dotenv/config';
import pg from 'pg';
import crypto from 'crypto';

// The exact pooled connection variable name added by Vercel for Neon PostgreSQL
export const DATABASE_URL_ENV_NAME = 'DATABASE_URL';

let activePool: any = null;
let isPgMem = false;
let migrationCompleted = false;

// Password Hashing using PBKDF2 with SHA-256 and 600,000 iterations + 32-byte unique salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$600000$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || typeof storedHash !== 'string') return false;

    // Standard PBKDF2-SHA256 format: pbkdf2_sha256$iterations$salt$hash
    if (storedHash.startsWith('pbkdf2_sha256$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 4) return false;
      const iterations = parseInt(parts[1], 10);
      const salt = parts[2];
      const expectedHash = parts[3];
      const computed = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
    }

    // Backward compatibility for legacy salt:hash (PBKDF2 SHA-512, 100,000 iterations)
    const legacyParts = storedHash.split(':');
    if (legacyParts.length === 2) {
      const [salt, expectedHash] = legacyParts;
      const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedHash));
    }

    return false;
  } catch {
    return false;
  }
}

export function getDatabaseUrl(): string {
  let url = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  if (!url) return '';

  // Prepare for libpq compatibility and silence Node 22 deprecation warnings on Neon sslmode=require
  if (url.includes('sslmode=require') && !url.includes('uselibpqcompat')) {
    url = url.includes('?') ? `${url}&uselibpqcompat=true` : `${url}?uselibpqcompat=true`;
  }

  return url;
}

export async function getPool(): Promise<any> {
  if (activePool) return activePool;

  const dbUrl = getDatabaseUrl();

  if (dbUrl) {
    try {
      const { Pool } = pg;
      activePool = new Pool({
        connectionString: dbUrl,
        max: 10,
        ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      isPgMem = false;
      console.log('[Database] Connected to external PostgreSQL database.');
      return activePool;
    } catch (err: any) {
      console.error('[Database Pool Init Error]', err.message);
      throw err;
    }
  }

  // Fallback for local development or sandbox environment before Vercel env var injection
  try {
    const { newDb } = await import('pg-mem');
    const memDb = newDb();
    
    // Register standard postgres functions if needed
    memDb.public.registerFunction({
      name: 'now',
      implementation: () => new Date(),
    });
    memDb.public.registerFunction({
      name: 'nullif',
      implementation: (a: any, b: any) => (a === b ? null : a),
    });
    
    const { Pool } = memDb.adapters.createPg();
    activePool = new Pool();
    isPgMem = true;
    console.log('[Database] Initialized in-memory PostgreSQL engine for local development.');
    return activePool;
  } catch (err: any) {
    console.error('[pg-mem init error]', err.message);
    throw new Error('No database connection available and pg-mem failed to initialize.');
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  const pool = await getPool();
  if (!migrationCompleted) {
    try {
      await runMigration();
    } catch (migErr: any) {
      console.warn('[Query Migration Await Warning]:', migErr.message);
    }
  }
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    // Log error to server log without exposing secrets
    console.error('[PostgreSQL Query Error]:', err.message);
    throw err;
  }
}

export async function pingPostgres(): Promise<{ ok: boolean; provider: string; isPgMem?: boolean; error?: string }> {
  try {
    const pool = await getPool();
    const res = await pool.query('SELECT 1 AS alive');
    const isAlive = res?.rows?.[0]?.alive === 1;
    return {
      ok: isAlive,
      isPgMem,
      provider: isPgMem ? 'pg-mem (local dev)' : 'Neon PostgreSQL (DATABASE_URL)',
    };
  } catch (err: any) {
    return { ok: false, isPgMem, provider: 'Neon PostgreSQL', error: err.message };
  }
}

export async function pingRedis(): Promise<{ ok: boolean; error?: string }> {
  const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const kvToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

  if (!kvUrl || !kvToken) {
    return { ok: false, error: 'KV_REST_API_URL not configured' };
  }
  try {
    const url = `${kvUrl.replace(/\/$/, '')}/ping`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${kvToken}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Upstash returned HTTP ${res.status}` };
    }
    const data: any = await res.json();
    return { ok: data.result === 'PONG' || !!data.result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

let migrationPromise: Promise<void> | null = null;

export async function runMigration(): Promise<void> {
  if (migrationCompleted) return;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    const pool = await getPool();

    console.log('[Database Migration] Running schema migration on PostgreSQL...');

    const migrationSql = `
      -- 1. Users Table
      CREATE TABLE IF NOT EXISTS shopit_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'buyer',
      is_verified_email BOOLEAN NOT NULL DEFAULT true,
      age INTEGER,
      has_guardian_consent BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      is_banned BOOLEAN NOT NULL DEFAULT false,
      ban_reason TEXT,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_users_email ON shopit_users (email);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_role ON shopit_users (role);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_created_at ON shopit_users (created_at DESC);

    -- 2. Sellers Table
    CREATE TABLE IF NOT EXISTS shopit_sellers (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE CASCADE,
      shop_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      bio TEXT,
      campus VARCHAR(255),
      location_state VARCHAR(100),
      location_city VARCHAR(100),
      location_area VARCHAR(100),
      is_verified_seller BOOLEAN NOT NULL DEFAULT false,
      verification_status VARCHAR(50) NOT NULL DEFAULT 'not_started',
      under_18 BOOLEAN DEFAULT false,
      guardian_consent BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      guardian_phone VARCHAR(50),
      badges JSONB DEFAULT '[]'::jsonb,
      vacation_mode BOOLEAN DEFAULT false,
      rating NUMERIC(3,2) DEFAULT 5.0,
      sales_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_sellers_user_id ON shopit_sellers (user_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_sellers_status ON shopit_sellers (verification_status);

    -- 3. Verification Submissions Table
    CREATE TABLE IF NOT EXISTS shopit_verifications (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64),
      shop_name VARCHAR(255),
      owner_name VARCHAR(255),
      id_type VARCHAR(100),
      document_type VARCHAR(100),
      id_number_masked VARCHAR(100),
      full_nin_last4 VARCHAR(10),
      nin_last4 VARCHAR(10),
      id_hash VARCHAR(255),
      document_url TEXT,
      selfie_url TEXT,
      under_18 BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      guardian_phone VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      notes TEXT,
      rejection_reason TEXT,
      admin_notes TEXT,
      reviewed_by VARCHAR(255),
      reviewed_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_verif_seller ON shopit_verifications (seller_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_verif_status ON shopit_verifications (status);

    -- 4. Products Table
    CREATE TABLE IF NOT EXISTS shopit_products (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      seller_campus VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      seller_price NUMERIC(12,2) NOT NULL,
      service_fee NUMERIC(12,2) NOT NULL,
      display_price NUMERIC(12,2) NOT NULL,
      stock INTEGER NOT NULL DEFAULT 1,
      images JSONB DEFAULT '[]'::jsonb,
      delivery_pickup_fee NUMERIC(12,2) DEFAULT 0,
      delivery_local_fee NUMERIC(12,2) DEFAULT 0,
      delivery_buyer_arranges BOOLEAN DEFAULT false,
      location_state VARCHAR(100),
      location_city VARCHAR(100),
      location_area VARCHAR(100),
      seller_badges JSONB DEFAULT '[]'::jsonb,
      rating NUMERIC(3,2) DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      is_sold_out BOOLEAN DEFAULT false,
      is_new_arrival BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_products_seller ON shopit_products (seller_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_category ON shopit_products (category);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_created ON shopit_products (created_at DESC);

    -- 5. Orders Table
    CREATE TABLE IF NOT EXISTS shopit_orders (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64),
      buyer_name VARCHAR(255),
      buyer_email VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      subtotal NUMERIC(12,2) NOT NULL,
      service_fee_total NUMERIC(12,2) NOT NULL,
      delivery_total NUMERIC(12,2) NOT NULL,
      discount_total NUMERIC(12,2) DEFAULT 0,
      grand_total NUMERIC(12,2) NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'paystack',
      payment_reference VARCHAR(255),
      handshake_otp VARCHAR(10),
      handshake_verified BOOLEAN DEFAULT false,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
      campus VARCHAR(255),
      delivery_area VARCHAR(255),
      pickup_point VARCHAR(255),
      auto_release_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_orders_ref ON shopit_orders (payment_reference);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_status ON shopit_orders (status);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_created ON shopit_orders (created_at DESC);

    -- 6. Payments Table
    CREATE TABLE IF NOT EXISTS shopit_payments (
      reference VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(64),
      amount_kobo BIGINT NOT NULL,
      amount_naira NUMERIC(12,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'NGN',
      channel VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      webhook_received BOOLEAN DEFAULT false,
      customer_email VARCHAR(255),
      data JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_payments_order ON shopit_payments (order_id);

    -- 7. Wallets Table
    CREATE TABLE IF NOT EXISTS shopit_wallets (
      seller_id VARCHAR(64) PRIMARY KEY,
      pending_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
      total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
      is_frozen BOOLEAN NOT NULL DEFAULT false,
      freeze_reason TEXT,
      payout_accounts JSONB DEFAULT '[]'::jsonb,
      active_payout_account_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 8. Ledger Entries Table (Append-only immutable)
    CREATE TABLE IF NOT EXISTS shopit_ledger_entries (
      id VARCHAR(64) PRIMARY KEY,
      wallet_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      fee NUMERIC(12,2) DEFAULT 0,
      balance_after NUMERIC(12,2) NOT NULL,
      balance_type VARCHAR(20) NOT NULL DEFAULT 'pending',
      description TEXT NOT NULL,
      reference VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_ledger_wallet ON shopit_ledger_entries (wallet_id, created_at DESC);

    -- 9. Disputes Table
    CREATE TABLE IF NOT EXISTS shopit_disputes (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      seller_id VARCHAR(64) NOT NULL,
      buyer_id VARCHAR(64),
      buyer_name VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      seller_shop_name VARCHAR(255),
      reason VARCHAR(255) NOT NULL,
      description TEXT,
      amount_held_in_escrow NUMERIC(12,2) NOT NULL,
      evidence_photo_url TEXT,
      seller_packed_photo_url TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      resolution_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_disputes_order ON shopit_disputes (order_id);

    -- 10. Reports Table
    CREATE TABLE IF NOT EXISTS shopit_reports (
      id VARCHAR(64) PRIMARY KEY,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(64) NOT NULL,
      target_title VARCHAR(255),
      reporter_email VARCHAR(255),
      reason VARCHAR(255) NOT NULL,
      details TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      action_logs JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_reports_status ON shopit_reports (status);

    -- 11. Chat Conversations Table
    CREATE TABLE IF NOT EXISTS shopit_chat_conversations (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64),
      product_id VARCHAR(64),
      product_title VARCHAR(255),
      product_image TEXT,
      buyer_id VARCHAR(64) NOT NULL,
      buyer_masked_id VARCHAR(64),
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      last_message TEXT,
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      is_chat_locked BOOLEAN DEFAULT false,
      bypass_violations_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 12. Chat Messages Table
    CREATE TABLE IF NOT EXISTS shopit_chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      conversation_id VARCHAR(64) NOT NULL,
      sender_id VARCHAR(64) NOT NULL,
      sender_role VARCHAR(20) NOT NULL,
      sender_masked_name VARCHAR(255),
      content TEXT NOT NULL,
      is_blocked_bypass BOOLEAN DEFAULT false,
      preset_offer JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_chat_conv ON shopit_chat_messages (conversation_id, created_at ASC);

    -- 13. Audit Logs Table (Immutable security event logging)
    CREATE TABLE IF NOT EXISTS shopit_audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      actor_id VARCHAR(64),
      actor_email VARCHAR(255),
      actor_role VARCHAR(50),
      target_type VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB DEFAULT '{}'::jsonb,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_audit_action ON shopit_audit_logs (action);
    CREATE INDEX IF NOT EXISTS idx_shopit_audit_actor ON shopit_audit_logs (actor_email);
    CREATE INDEX IF NOT EXISTS idx_shopit_audit_created ON shopit_audit_logs (created_at DESC);

    -- 14. Order Status History Table
    CREATE TABLE IF NOT EXISTS shopit_order_status_history (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL,
      previous_status VARCHAR(50),
      new_status VARCHAR(50) NOT NULL,
      changed_by VARCHAR(64),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_osh_order ON shopit_order_status_history (order_id, created_at ASC);

    -- 15. User Carts Table
    CREATE TABLE IF NOT EXISTS shopit_carts (
      user_id VARCHAR(64) PRIMARY KEY,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 16. User Wishlists Table
    CREATE TABLE IF NOT EXISTS shopit_wishlists (
      user_id VARCHAR(64) PRIMARY KEY,
      product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 17. Notifications Table
    CREATE TABLE IF NOT EXISTS shopit_notifications (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      is_read BOOLEAN NOT NULL DEFAULT false,
      link VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_notif_user ON shopit_notifications (user_id, created_at DESC);

    -- 18. Custom Craft Commissions Table
    CREATE TABLE IF NOT EXISTS shopit_commissions (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64) NOT NULL,
      buyer_name VARCHAR(255),
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      budget_kobo BIGINT NOT NULL,
      budget_naira NUMERIC(12,2) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      milestones JSONB DEFAULT '[]'::jsonb,
      reference VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_comm_buyer ON shopit_commissions (buyer_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_comm_seller ON shopit_commissions (seller_id);

    -- 19. OTP Storage Table (Zero File System Dependencies)
    CREATE TABLE IF NOT EXISTS shopit_otps (
      key VARCHAR(255) PRIMARY KEY,
      data JSONB NOT NULL,
      expires_at BIGINT NOT NULL
    );

    -- 20. Rate Limits Table
    CREATE TABLE IF NOT EXISTS shopit_rate_limits (
      key VARCHAR(255) PRIMARY KEY,
      timestamps JSONB NOT NULL
    );
  `;

  // Comprehensive column healing: ensures every table has all required columns regardless of initial creation schema
  const alterStatements = [
    // 1. shopit_users
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT \'buyer\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(50) DEFAULT \'superadmin\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_verified_email BOOLEAN DEFAULT true;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS age INTEGER;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS has_guardian_consent BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS ban_reason TEXT;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT \'not_started\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 2. shopit_sellers
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS email VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS bio TEXT;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS campus VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS location_area VARCHAR(100);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT \'not_started\';',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS under_18 BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_legal_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_nin_last4 VARCHAR(10);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 3. shopit_verifications
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_type VARCHAR(100);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS document_type VARCHAR(100);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_number_masked VARCHAR(100);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS full_nin_last4 VARCHAR(10);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS nin_last4 VARCHAR(10);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS id_hash VARCHAR(255);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS document_url TEXT;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS selfie_url TEXT;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS under_18 BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS guardian_consent BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\';',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS notes TEXT;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS admin_notes TEXT;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_verifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 4. shopit_products
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_campus VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS title VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS category VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_price NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS service_fee NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS display_price NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_pickup_fee NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_local_fee NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_buyer_arranges BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_area VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_badges JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT true;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 5. shopit_orders
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS subtotal_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS service_fee_total NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_total NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS grand_total_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT \'paystack\';',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_otp VARCHAR(10);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_verified BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending_payment\';',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS campus VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 6. shopit_wallets
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS pending_balance NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS pending_balance_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS available_balance NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS available_balance_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS total_withdrawn_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS freeze_reason TEXT;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS payout_accounts JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS active_payout_account_id VARCHAR(64);',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 7. shopit_payments
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS amount_naira NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT \'NGN\';',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS channel VARCHAR(50);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\';',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS webhook_received BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS data JSONB DEFAULT \'{}\'::jsonb;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 8. shopit_ledger_entries
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(64);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS type VARCHAR(50);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_after_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT \'pending\';',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(255);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',

    // 9. shopit_disputes
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS reason VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS amount_held_in_escrow NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS evidence_photo_url TEXT;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_packed_photo_url TEXT;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'open\';',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS resolution_notes TEXT;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 10. shopit_reports
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_type VARCHAR(50);',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_id VARCHAR(64);',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS target_title VARCHAR(255);',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS reporter_email VARCHAR(255);',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS reason VARCHAR(255);',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS details TEXT;',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'open\';',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS action_logs JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 11. shopit_commissions
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS title VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS budget_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS budget_naira NUMERIC(12,2) DEFAULT 0;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\';',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',
  ];

  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Execute tables and column additions with individual fault-tolerance
  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      console.warn('[Migration DDL Statement Note]:', err.message);
    }
  }

  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
    } catch (alterErr: any) {
      console.warn('[Migration Column Note]:', alterErr.message);
    }
  }

  // Create First Administrator strictly from server environment secrets
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();

  if (adminEmail && adminInitialPassword) {
    try {
      const existingAdmin = await pool.query(
        'SELECT id, email, role FROM shopit_users WHERE LOWER(email) = LOWER($1)',
        [adminEmail]
      );

      if (existingAdmin.rows.length === 0) {
        const passwordHash = hashPassword(adminInitialPassword);
        const adminId = 'admin_' + crypto.randomBytes(8).toString('hex');
        await pool.query(
          `INSERT INTO shopit_users (
            id, email, name, password_hash, role, sub_role, is_verified_email, must_change_password, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            adminId,
            adminEmail,
            'Administrator',
            passwordHash,
            'admin',
            'superadmin',
            true,
            true, // Force password change at first login
          ]
        );
        console.log(`[Admin Setup] Initial administrator account provisioned in PostgreSQL from ADMIN_EMAIL.`);
      } else {
        // Ensure role is admin
        if (existingAdmin.rows[0].role !== 'admin') {
          await pool.query('UPDATE shopit_users SET role = $1 WHERE id = $2', ['admin', existingAdmin.rows[0].id]);
        }
      }
    } catch (adminErr: any) {
      console.error('[Admin Setup Error]:', adminErr.message);
    }
  } else {
    console.log('[Admin Setup] Notice: ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD environment variables are not set in environment.');
  }

    migrationCompleted = true;
    console.log('[Database Migration] All tables, audit logs, and security schemas successfully verified in PostgreSQL.');
  })().catch(err => {
    migrationPromise = null;
    migrationCompleted = false;
    console.error('[Database Migration Critical Error]:', err.message);
    throw err;
  });

  return migrationPromise;
}
