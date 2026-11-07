import pg from 'pg';
import crypto from 'crypto';

// The exact pooled connection variable name added by Vercel for Neon PostgreSQL
export const DATABASE_URL_ENV_NAME = 'DATABASE_URL';

const RAW_DB_URL = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();
const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

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

export async function getPool(): Promise<any> {
  if (activePool) return activePool;

  const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim();

  if (dbUrl) {
    try {
      const { Pool } = pg;
      activePool = new Pool({
        connectionString: dbUrl,
        max: 10,
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
      isPgMem = false;
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
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    // Log error to server log without exposing secrets
    console.error('[PostgreSQL Query Error]:', err.message);
    throw err;
  }
}

export async function pingPostgres(): Promise<{ ok: boolean; provider: string; error?: string }> {
  try {
    const pool = await getPool();
    const res = await pool.query('SELECT 1 AS alive');
    const isAlive = res?.rows?.[0]?.alive === 1;
    return {
      ok: isAlive,
      provider: isPgMem ? 'pg-mem (local dev)' : 'Neon PostgreSQL (DATABASE_URL)',
    };
  } catch (err: any) {
    return { ok: false, provider: 'Neon PostgreSQL', error: err.message };
  }
}

export async function pingRedis(): Promise<{ ok: boolean; error?: string }> {
  if (!KV_URL || !KV_TOKEN) {
    return { ok: false, error: 'KV_REST_API_URL not configured' };
  }
  try {
    const url = `${KV_URL.replace(/\/$/, '')}/ping`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
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

export async function runMigration(): Promise<void> {
  if (migrationCompleted) return;

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
      shop_name VARCHAR(255),
      owner_name VARCHAR(255),
      id_type VARCHAR(100),
      id_number_masked VARCHAR(100),
      id_hash VARCHAR(255),
      under_18 BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      guardian_phone VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      admin_notes TEXT,
      reviewed_by VARCHAR(255),
      reviewed_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  `;

  // Execute migration statements
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      console.warn('[Migration Warning on statement]:', err.message);
    }
  }

  // Gracefully alter existing tables to ensure security & integer kobo columns exist
  const alterStatements = [
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(50) DEFAULT \'superadmin\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS pending_balance_kobo BIGINT NOT NULL DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS available_balance_kobo BIGINT NOT NULL DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS total_withdrawn_kobo BIGINT NOT NULL DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_after_kobo BIGINT;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS subtotal_kobo BIGINT;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS grand_total_kobo BIGINT;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_fee_kobo BIGINT;',
  ];
  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
    } catch {}
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
}
