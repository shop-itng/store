import dotenv from 'dotenv';
import pg from 'pg';
import crypto from 'crypto';

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  dotenv.config({ override: false });
}

// The exact pooled connection variable name added by Vercel for Neon PostgreSQL
export const DATABASE_URL_ENV_NAME = 'DATABASE_URL';
export const EXPECTED_SCHEMA_VERSION = '20261121_01';

export interface MigrationQuarantineCounts {
  payments: number;
  wallets: number;
  ledgerEntries: number;
  disputes: number;
}

export interface MigrationResult {
  schemaVersion: string;
  quarantined: MigrationQuarantineCounts;
  orphanOrdersNullified: number;
  deletedOrphanProducts: number;
  deletedOrphanProductIds: string[];
}

let activePool: any = null;
let isPgMem = false;
let migrationCompleted = false;
let isMigrationRunner = false;
let prodSchemaVerified = false;
let lastMigrationResult: MigrationResult | null = null;

export function setMigrationRunnerMode(enabled: boolean): void {
  isMigrationRunner = enabled;
}

export function isProdRuntime(): boolean {
  return (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)) && !isMigrationRunner;
}

export function resetMigrationVerificationState(): void {
  migrationCompleted = false;
  migrationPromise = null;
  prodSchemaVerified = false;
  lastMigrationResult = null;
}

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

export const CORE_SCHEMA_TABLES = [
  'shopit_schema_migrations',
  'shopit_migration_quarantine',
  'shopit_users',
  'shopit_sellers',
  'shopit_verifications',
  'shopit_products',
  'shopit_orders',
  'shopit_payments',
  'shopit_wallets',
  'shopit_ledger_entries',
  'shopit_disputes',
  'shopit_reports',
  'shopit_chat_conversations',
  'shopit_chat_messages',
  'shopit_audit_logs',
  'shopit_order_status_history',
  'shopit_carts',
  'shopit_wishlists',
  'shopit_notifications',
  'shopit_restock_alerts',
  'shopit_commissions',
  'shopit_otps',
  'shopit_rate_limits',
  'shopit_sessions',
  'shopit_verified_signups',
  'shopit_coupons',
  'shopit_payouts',
  'shopit_verification_documents',
  'shopit_admin_alerts',
  'shopit_platform_settings',
  'shopit_follows',
  'shopit_blocks',
  'shopit_files',
  'shopit_mutes',
  'shopit_profile_slug_history',
] as const;

export function getDatabaseUrlSource(): string | null {
  const candidates = [
    'DATABASE_URL',
    'POSTGRES_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL_NON_POOLING',
    'NEON_DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
  ] as const;
  for (const key of candidates) {
    const val = (process.env[key] || '').trim().replace(/^["']|["']$/g, '');
    if (val) return key;
  }
  return null;
}

export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  )
    .trim()
    .replace(/^["']|["']$/g, '');
}

/**
 * Parses a PostgreSQL connection URL using the WHATWG URL API and returns explicit pg.PoolConfig fields.
 * Avoiding `connectionString` prevents pg-connection-string from calling deprecated `url.parse()` (DEP0169)
 * and prevents SSL mode alias deprecation warnings on Vercel/Node 22+.
 */
export function buildPgPoolConfig(dbUrl: string): pg.PoolConfig {
  const parsed = new URL(dbUrl);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`Invalid PostgreSQL URL protocol: "${parsed.protocol}" (expected postgres:// or postgresql://).`);
  }
  const host = parsed.hostname;
  if (!host) {
    throw new Error('Invalid PostgreSQL URL: missing hostname.');
  }
  const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
  const user = parsed.username ? decodeURIComponent(parsed.username) : undefined;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  const rawDb = parsed.pathname.replace(/^\/+/, '');
  const database = rawDb ? decodeURIComponent(rawDb) : undefined;
  const pgOptions = parsed.searchParams.get('options') || undefined;
  const sslMode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isVercel = Boolean(process.env.VERCEL);

  let ssl: pg.PoolConfig['ssl'];
  if (sslMode === 'disable' || (isLocalHost && !sslMode)) {
    ssl = false;
  } else if (sslMode === 'no-verify' || sslMode === 'allow' || sslMode === 'prefer' || (isLocalHost && sslMode === 'require')) {
    ssl = { rejectUnauthorized: false };
  } else {
    ssl = { rejectUnauthorized: true };
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ...(pgOptions ? { options: pgOptions } : {}),
    ssl,
    max: isVercel ? 5 : 10,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: isVercel,
  };
}

export async function getPool(): Promise<any> {
  if (activePool) return activePool;

  const dbUrl = getDatabaseUrl();
  const isProduction = (process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)) && !isMigrationRunner;

  if (dbUrl) {
    try {
      const { Pool } = pg;
      const poolConfig = buildPgPoolConfig(dbUrl);
      const pool = new Pool(poolConfig);
      pool.on('error', (err: any) => {
        console.error('[Database Pool Idle Error]:', err?.message || err);
      });
      activePool = pool;
      isPgMem = false;
      console.log('[Database] Connected to external PostgreSQL database.');
      return activePool;
    } catch (err: any) {
      console.error('[Database Pool Init Error]', err.message);
      throw err;
    }
  }

  // Fail closed in production / Vercel environments — never fall back to in-memory database
  if (isProduction) {
    throw new Error('CRITICAL: DATABASE_URL is not configured in production environment.');
  }

  // Local development / test fallback only
  try {
    const { newDb } = await import('pg-mem');
    const memDb = newDb();

    memDb.public.registerFunction({
      name: 'now',
      implementation: () => new Date(),
    });
    memDb.public.registerFunction({
      name: 'nullif',
      implementation: (a: any, b: any) => (a === b ? null : a),
    });
    memDb.public.registerFunction({
      name: 'round',
      implementation: (x: any) => Math.round(Number(x)),
    });

    const { Pool } = memDb.adapters.createPg();
    activePool = new Pool();
    isPgMem = true;
    console.log('[Database] Initialized in-memory PostgreSQL engine for local development/tests.');
    return activePool;
  } catch (err: any) {
    console.error('[pg-mem init error]', err.message);
    throw new Error('No database connection available and pg-mem failed to initialize.');
  }
}

async function ensureSchemaReady(): Promise<void> {
  if (isProdRuntime()) {
    if (prodSchemaVerified) return;
    const status = await verifyDatabaseSchema();
    if (!status.ok) {
      throw new Error(status.migrationError || 'Database schema is not at the expected version. Run "npm run migrate" at deploy time.');
    }
    prodSchemaVerified = true;
    return;
  }
  if (!migrationCompleted) {
    await runMigration();
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  const pool = await getPool();
  await ensureSchemaReady();
  try {
    return await pool.query(text, params);
  } catch (err: any) {
    if (err?.code === '42P01' && !isProdRuntime()) {
      console.warn('[PostgreSQL Query Recovery] Missing relation detected (42P01). Re-running migration in non-production runtime.');
      migrationCompleted = false;
      await runMigration();
      return await pool.query(text, params);
    }
    console.error('[PostgreSQL Query Error]:', err.message);
    throw err;
  }
}

export async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const pool = await getPool();
  await ensureSchemaReady();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    if (err?.code === '42P01' && !isProdRuntime()) {
      migrationCompleted = false;
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function verifyDatabaseSchema(): Promise<{
  ok: boolean;
  schemaVersion: string | null;
  expectedSchemaVersion: string;
  missingTables: string[];
  migrationError?: string;
  error?: string;
}> {
  try {
    const pool = await getPool();
    const missingTables: string[] = [];
    for (const table of CORE_SCHEMA_TABLES) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      } catch {
        missingTables.push(table);
      }
    }

    let schemaVersion: string | null = null;
    if (!missingTables.includes('shopit_schema_migrations')) {
      try {
        const verRes = await pool.query(
          `SELECT version FROM shopit_schema_migrations ORDER BY applied_at DESC LIMIT 1`
        );
        schemaVersion = verRes.rows[0]?.version ? String(verRes.rows[0].version) : null;
      } catch (verErr: any) {
        return {
          ok: false,
          schemaVersion: null,
          expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
          missingTables,
          migrationError: `Unable to read shopit_schema_migrations: ${verErr?.message || 'unknown error'}`,
          error: verErr?.message,
        };
      }
    }

    const versionMatches = schemaVersion === EXPECTED_SCHEMA_VERSION;
    const ok = missingTables.length === 0 && versionMatches;

    let migrationError: string | undefined;
    if (missingTables.length > 0) {
      migrationError = `Missing core schema table(s): ${missingTables.join(', ')}. Run "npm run migrate" during deploy.`;
    } else if (!versionMatches) {
      migrationError = `Schema version mismatch: database is at "${schemaVersion || 'unversioned'}", expected "${EXPECTED_SCHEMA_VERSION}". Run "npm run migrate".`;
    }

    if (ok) {
      prodSchemaVerified = true;
    }

    return {
      ok,
      schemaVersion,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      missingTables,
      ...(migrationError ? { migrationError, error: migrationError } : {}),
    };
  } catch (err: any) {
    return {
      ok: false,
      schemaVersion: null,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      missingTables: [...CORE_SCHEMA_TABLES],
      migrationError: err.message,
      error: err.message,
    };
  }
}

export async function pingPostgres(): Promise<{
  ok: boolean;
  provider: string;
  isPgMem?: boolean;
  schemaOk?: boolean;
  schemaVersion?: string | null;
  expectedSchemaVersion?: string;
  missingTables?: string[];
  migrationError?: string;
  error?: string;
}> {
  try {
    const pool = await getPool();
    const res = await pool.query('SELECT 1 AS alive');
    const isAlive = res?.rows?.[0]?.alive === 1;
    if (!isAlive) {
      return {
        ok: false,
        isPgMem,
        schemaOk: false,
        schemaVersion: null,
        expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
        provider: isPgMem ? 'pg-mem (local dev)' : `PostgreSQL (${getDatabaseUrlSource() || 'DATABASE_URL'})`,
        migrationError: 'Database heartbeat query (SELECT 1) failed',
        error: 'SELECT 1 check failed',
      };
    }

    // Never auto-run DDL in production on cold start or /api/health
    if (!isProdRuntime() && !migrationCompleted) {
      await runMigration();
    }

    const schemaCheck = await verifyDatabaseSchema();
    return {
      ok: schemaCheck.ok,
      schemaOk: schemaCheck.ok,
      schemaVersion: schemaCheck.schemaVersion,
      expectedSchemaVersion: schemaCheck.expectedSchemaVersion,
      ...(schemaCheck.missingTables.length > 0 ? { missingTables: schemaCheck.missingTables } : {}),
      ...(schemaCheck.migrationError ? { migrationError: schemaCheck.migrationError, error: schemaCheck.migrationError } : {}),
      isPgMem,
      provider: isPgMem ? 'pg-mem (local dev)' : `PostgreSQL (${getDatabaseUrlSource() || 'DATABASE_URL'})`,
    };
  } catch (err: any) {
    return {
      ok: false,
      schemaOk: false,
      schemaVersion: null,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      isPgMem,
      provider: isPgMem ? 'pg-mem (local dev)' : `PostgreSQL (${getDatabaseUrlSource() || 'DATABASE_URL'})`,
      migrationError: err.message,
      error: err.message,
    };
  }
}

export async function getDatabaseHealthStats(): Promise<{
  databaseHost: string;
  tableCount: number;
  databaseSizeBytes: number;
  databaseSizeMb: number;
  fileStorageBytes: number;
  fileStorageMb: number;
  fileCount: number;
}> {
  const dbUrl = getDatabaseUrl();
  let databaseHost = 'pg-mem';
  if (dbUrl) {
    try {
      databaseHost = new URL(dbUrl).hostname || 'postgres';
    } catch {
      databaseHost = 'postgres';
    }
  }

  let tableCount = 0;
  let databaseSizeBytes = 0;
  let fileStorageBytes = 0;
  let fileCount = 0;

  try {
    const pool = await getPool();
    if (!isProdRuntime() && !migrationCompleted) {
      await runMigration();
    }

    if (isPgMem) {
      databaseHost = 'pg-mem';
      tableCount = CORE_SCHEMA_TABLES.length;
    } else {
      const [tblRes, sizeRes] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS cnt FROM information_schema.tables WHERE table_schema = 'public'`
        ),
        pool.query(`SELECT pg_database_size(current_database())::bigint AS size_bytes`),
      ]);
      tableCount = Number(tblRes.rows[0]?.cnt || 0);
      databaseSizeBytes = Number(sizeRes.rows[0]?.size_bytes || 0);
    }

    const fileRes = await pool.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS used_bytes, COUNT(*)::int AS cnt FROM shopit_files`
    );
    fileStorageBytes = Number(fileRes.rows[0]?.used_bytes || 0);
    fileCount = Number(fileRes.rows[0]?.cnt || 0);
    if (isPgMem && databaseSizeBytes === 0) {
      databaseSizeBytes = Math.round(fileStorageBytes * 1.35);
    }
  } catch {}

  const databaseSizeMb = Math.round((databaseSizeBytes / (1024 * 1024)) * 100) / 100;
  const fileStorageMb = Math.round((fileStorageBytes / (1024 * 1024)) * 100) / 100;
  return {
    databaseHost,
    tableCount,
    databaseSizeBytes,
    databaseSizeMb,
    fileStorageBytes,
    fileStorageMb,
    fileCount,
  };
}

export async function pingRedis(): Promise<{ ok: boolean; error?: string }> {
  const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const kvToken = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

  if (!kvUrl || !kvToken) {
    return { ok: false, error: 'KV_REST_API_URL not configured' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `${kvUrl.replace(/\/$/, '')}/ping`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${kvToken}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, error: `Upstash returned HTTP ${res.status}` };
    }
    const data: any = await res.json();
    return { ok: data.result === 'PONG' || !!data.result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

let migrationPromise: Promise<MigrationResult> | null = null;

export async function runMigration(): Promise<MigrationResult> {
  if (migrationCompleted && lastMigrationResult) return lastMigrationResult;
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async (): Promise<MigrationResult> => {
    const pool = await getPool();

    console.log(`[Database Migration] Running schema migration (target version ${EXPECTED_SCHEMA_VERSION}) on PostgreSQL...`);

    const migrationSql = `
      -- 0. Schema Version Registry & Zero-Loss Orphan Quarantine
      CREATE TABLE IF NOT EXISTS shopit_schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        summary JSONB DEFAULT '{}',
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shopit_migration_quarantine (
        id VARCHAR(80) PRIMARY KEY,
        source_table VARCHAR(64) NOT NULL,
        source_pk VARCHAR(128) NOT NULL,
        reason TEXT NOT NULL,
        row_data JSONB NOT NULL DEFAULT '{}',
        quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        schema_version VARCHAR(64)
      );
      CREATE INDEX IF NOT EXISTS idx_shopit_quarantine_table ON shopit_migration_quarantine (source_table, quarantined_at DESC);

      -- 1. Users Table
      CREATE TABLE IF NOT EXISTS shopit_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'buyer',
      sub_role VARCHAR(50),
      token_version INTEGER NOT NULL DEFAULT 1,
      is_verified_email BOOLEAN NOT NULL DEFAULT false,
      age INTEGER,
      has_guardian_consent BOOLEAN DEFAULT false,
      guardian_name VARCHAR(255),
      is_banned BOOLEAN NOT NULL DEFAULT false,
      ban_reason TEXT,
      display_name VARCHAR(60),
      profile_slug VARCHAR(100),
      avatar_url TEXT,
      cover_url TEXT,
      tagline VARCHAR(80),
      bio VARCHAR(300),
      location_state VARCHAR(100),
      campus VARCHAR(120),
      location_area VARCHAR(120),
      interests JSONB DEFAULT '[]',
      languages JSONB DEFAULT '[]',
      notification_prefs JSONB DEFAULT '{"emailOrders":true,"emailMessages":true,"emailFollowers":true,"emailRestock":true}',
      privacy_settings JSONB DEFAULT '{"profileVisibility":"public","whoCanFollow":"everyone","whoCanMessage":"everyone","showFollowersList":true,"showFollowingList":true,"showLastSeen":true}',
      last_seen_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_users_email ON shopit_users (email);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_role ON shopit_users (role);
    CREATE INDEX IF NOT EXISTS idx_shopit_users_created_at ON shopit_users (created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_users_profile_slug ON shopit_users (profile_slug);

    -- 2. Sellers Table
    CREATE TABLE IF NOT EXISTS shopit_sellers (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE CASCADE,
      shop_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      bio TEXT,
      shop_story VARCHAR(600),
      craft_materials VARCHAR(300),
      processing_time VARCHAR(60),
      delivery_options JSONB DEFAULT '{}',
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
      badges JSONB DEFAULT '[]',
      vacation_mode BOOLEAN DEFAULT false,
      logo_url TEXT,
      banner_url TEXT,
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

    -- 4. Products Table (Kobo-only money columns + FK to shopit_sellers)
    CREATE TABLE IF NOT EXISTS shopit_products (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      seller_shop_name VARCHAR(255),
      seller_campus VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      seller_price_kobo BIGINT NOT NULL DEFAULT 0,
      service_fee_kobo BIGINT NOT NULL DEFAULT 0,
      display_price_kobo BIGINT NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 1,
      images JSONB DEFAULT '[]',
      delivery_pickup_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_local_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_buyer_arranges BOOLEAN DEFAULT false,
      location_state VARCHAR(100),
      location_city VARCHAR(100),
      location_area VARCHAR(100),
      seller_badges JSONB DEFAULT '[]',
      rating NUMERIC(3,2) DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      reviews JSONB DEFAULT '[]',
      is_sold_out BOOLEAN DEFAULT false,
      is_new_arrival BOOLEAN DEFAULT true,
      is_paused BOOLEAN DEFAULT false,
      is_draft BOOLEAN DEFAULT false,
      is_pinned BOOLEAN DEFAULT false,
      pinned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_products_seller ON shopit_products (seller_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_category ON shopit_products (category);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_created ON shopit_products (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_products_pinned ON shopit_products (seller_id, is_pinned DESC, pinned_at DESC);

    -- 5. Orders Table (Kobo-only money columns + FK to shopit_users)
    CREATE TABLE IF NOT EXISTS shopit_orders (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE SET NULL,
      buyer_name VARCHAR(255),
      buyer_email VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      items JSONB NOT NULL DEFAULT '[]',
      subtotal_kobo BIGINT NOT NULL DEFAULT 0,
      service_fee_kobo BIGINT NOT NULL DEFAULT 0,
      delivery_fee_kobo BIGINT NOT NULL DEFAULT 0,
      discount_total_kobo BIGINT NOT NULL DEFAULT 0,
      coupon_code VARCHAR(50),
      grand_total_kobo BIGINT NOT NULL DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'online',
      payment_reference VARCHAR(255) UNIQUE,
      handshake_otp VARCHAR(10),
      handshake_verified BOOLEAN DEFAULT false,
      status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
      campus VARCHAR(255),
      delivery_area VARCHAR(255),
      pickup_point VARCHAR(255),
      notes TEXT,
      packed_photo_url TEXT,
      admin_hold BOOLEAN DEFAULT false,
      unshipped_reminder_sent_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      stock_reserved BOOLEAN DEFAULT false,
      expires_at TIMESTAMPTZ,
      auto_release_at TIMESTAMPTZ,
      packed_at TIMESTAMPTZ,
      shipped_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      has_review BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_orders_ref ON shopit_orders (payment_reference);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_status ON shopit_orders (status);
    CREATE INDEX IF NOT EXISTS idx_shopit_orders_created ON shopit_orders (created_at DESC);

    -- 6. Payments Table (Kobo-only money columns + FK to shopit_orders)
    CREATE TABLE IF NOT EXISTS shopit_payments (
      reference VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(64) REFERENCES shopit_orders(id) ON DELETE CASCADE,
      amount_kobo BIGINT NOT NULL DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'NGN',
      channel VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      webhook_received BOOLEAN DEFAULT false,
      customer_email VARCHAR(255),
      data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_payments_order ON shopit_payments (order_id);

    -- 7. Wallets Table (Kobo-only money columns + FK to shopit_sellers)
    CREATE TABLE IF NOT EXISTS shopit_wallets (
      seller_id VARCHAR(64) PRIMARY KEY REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      pending_balance_kobo BIGINT NOT NULL DEFAULT 0,
      available_balance_kobo BIGINT NOT NULL DEFAULT 0,
      total_withdrawn_kobo BIGINT NOT NULL DEFAULT 0,
      is_frozen BOOLEAN NOT NULL DEFAULT false,
      freeze_reason TEXT,
      payout_accounts JSONB DEFAULT '[]',
      active_payout_account_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_shopit_wallet_non_negative CHECK (
        pending_balance_kobo >= 0 AND available_balance_kobo >= 0 AND total_withdrawn_kobo >= 0
      )
    );

    -- 8. Ledger Entries Table (Append-only immutable, Kobo-only + FKs to shopit_wallets & shopit_orders)
    CREATE TABLE IF NOT EXISTS shopit_ledger_entries (
      id VARCHAR(64) PRIMARY KEY,
      wallet_id VARCHAR(64) NOT NULL REFERENCES shopit_wallets(seller_id) ON DELETE CASCADE,
      order_id VARCHAR(64) REFERENCES shopit_orders(id) ON DELETE SET NULL,
      type VARCHAR(50) NOT NULL,
      amount_kobo BIGINT NOT NULL DEFAULT 0,
      fee_kobo BIGINT NOT NULL DEFAULT 0,
      balance_after_kobo BIGINT NOT NULL DEFAULT 0,
      balance_type VARCHAR(20) NOT NULL DEFAULT 'pending',
      status VARCHAR(50) DEFAULT 'completed',
      description TEXT NOT NULL,
      reference VARCHAR(255),
      idempotency_key VARCHAR(255) UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_ledger_wallet ON shopit_ledger_entries (wallet_id, created_at DESC);

    -- 9. Disputes Table (Kobo-only money column + FKs to orders, sellers, users)
    CREATE TABLE IF NOT EXISTS shopit_disputes (
      id VARCHAR(64) PRIMARY KEY,
      order_id VARCHAR(64) NOT NULL REFERENCES shopit_orders(id) ON DELETE CASCADE,
      seller_id VARCHAR(64) NOT NULL REFERENCES shopit_sellers(id) ON DELETE CASCADE,
      buyer_id VARCHAR(64) REFERENCES shopit_users(id) ON DELETE SET NULL,
      buyer_name VARCHAR(255),
      buyer_masked_id VARCHAR(64),
      seller_shop_name VARCHAR(255),
      reason VARCHAR(255) NOT NULL,
      description TEXT,
      amount_held_in_escrow_kobo BIGINT NOT NULL DEFAULT 0,
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
      action_logs JSONB DEFAULT '[]',
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
      buyer_last_read_at TIMESTAMPTZ,
      seller_last_read_at TIMESTAMPTZ,
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
      attachment JSONB,
      reply_to_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_chat_conv ON shopit_chat_messages (conversation_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_conv_created_id ON shopit_chat_messages (conversation_id, created_at ASC, id ASC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_convs_buyer ON shopit_chat_conversations (buyer_id, last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_chat_convs_seller ON shopit_chat_conversations (seller_id, last_message_at DESC);

    -- 13. Audit Logs Table (Immutable security event logging)
    CREATE TABLE IF NOT EXISTS shopit_audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      actor_id VARCHAR(64),
      actor_email VARCHAR(255),
      actor_role VARCHAR(50),
      target_type VARCHAR(100),
      target_id VARCHAR(255),
      details JSONB DEFAULT '{}',
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
      items JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 16. User Wishlists Table
    CREATE TABLE IF NOT EXISTS shopit_wishlists (
      user_id VARCHAR(64) PRIMARY KEY,
      product_ids JSONB NOT NULL DEFAULT '[]',
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

    -- 17b. Product Restock Alerts Table (Sold Out -> Notify Me)
    CREATE TABLE IF NOT EXISTS shopit_restock_alerts (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      email VARCHAR(255),
      notified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_shopit_restock_product ON shopit_restock_alerts (product_id, notified);

    -- 18. Custom Craft Commissions Table (Kobo-only)
    CREATE TABLE IF NOT EXISTS shopit_commissions (
      id VARCHAR(64) PRIMARY KEY,
      buyer_id VARCHAR(64) NOT NULL,
      buyer_name VARCHAR(255),
      seller_id VARCHAR(64) NOT NULL,
      seller_shop_name VARCHAR(255),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      budget_kobo BIGINT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      milestones JSONB DEFAULT '[]',
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

    -- 21. Persistent Sessions Table (Shared across Vercel serverless instances)
    CREATE TABLE IF NOT EXISTS shopit_sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      data JSONB NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_sessions_user ON shopit_sessions (user_id);

    -- 22. Verified Signup OTP Tokens (Server-side proof required by /auth/register)
    CREATE TABLE IF NOT EXISTS shopit_verified_signups (
      email VARCHAR(255) PRIMARY KEY,
      token_hash VARCHAR(255) NOT NULL,
      expires_at BIGINT NOT NULL
    );

    -- 23. Coupons Table (Database-authoritative discounts)
    CREATE TABLE IF NOT EXISTS shopit_coupons (
      code VARCHAR(50) PRIMARY KEY,
      discount_kobo BIGINT NOT NULL,
      min_subtotal_kobo BIGINT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      max_uses INTEGER,
      current_uses INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ
    );

    -- 24. Payouts Table
    CREATE TABLE IF NOT EXISTS shopit_payouts (
      id VARCHAR(64) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      amount_kobo BIGINT NOT NULL,
      fee_kobo BIGINT NOT NULL DEFAULT 0,
      total_deduction_kobo BIGINT NOT NULL,
      reference VARCHAR(255) UNIQUE NOT NULL,
      bank_name VARCHAR(255),
      bank_code VARCHAR(32),
      account_number VARCHAR(32),
      account_name VARCHAR(255),
      transfer_code VARCHAR(128),
      flw_transfer_id VARCHAR(64),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      provider_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_payouts_seller ON shopit_payouts (seller_id, created_at DESC);

    -- 25. Encrypted Identity Verification Documents
    CREATE TABLE IF NOT EXISTS shopit_verification_documents (
      id VARCHAR(128) PRIMARY KEY,
      seller_id VARCHAR(64) NOT NULL,
      doc_type VARCHAR(64) NOT NULL,
      encrypted_data TEXT NOT NULL,
      mime_type VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_verif_docs_seller ON shopit_verification_documents (seller_id);

    -- 26. Admin Alerts & Transactional Feed Table
    CREATE TABLE IF NOT EXISTS shopit_admin_alerts (
      alert_key VARCHAR(255) PRIMARY KEY,
      id VARCHAR(64),
      alert_type VARCHAR(50) NOT NULL DEFAULT 'new_user',
      user_id VARCHAR(64),
      user_email VARCHAR(255),
      user_name VARCHAR(255),
      user_role VARCHAR(32),
      title VARCHAR(255),
      message TEXT,
      is_read BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_created ON shopit_admin_alerts (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_type_read ON shopit_admin_alerts (alert_type, is_read);

    -- 27. Persistent Platform Settings Table (Broadcasts, Killswitches, Fee Policy)
    CREATE TABLE IF NOT EXISTS shopit_platform_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}',
      updated_by VARCHAR(255),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- 28. Follows Table (With status for Under-18 / Private approval workflows)
    CREATE TABLE IF NOT EXISTS shopit_follows (
      id VARCHAR(64) PRIMARY KEY,
      follower_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      following_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'accepted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (follower_id, following_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_follows_follower ON shopit_follows (follower_id, status);
    CREATE INDEX IF NOT EXISTS idx_shopit_follows_following ON shopit_follows (following_id, status);

    -- 29. Blocks Table
    CREATE TABLE IF NOT EXISTS shopit_blocks (
      id VARCHAR(64) PRIMARY KEY,
      blocker_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      blocked_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (blocker_id, blocked_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_blocks_blocker ON shopit_blocks (blocker_id);
    CREATE INDEX IF NOT EXISTS idx_shopit_blocks_blocked ON shopit_blocks (blocked_id);

    -- 30. Unified File Storage Table (PostgreSQL-backed, zero local disk dependencies)
    CREATE TABLE IF NOT EXISTS shopit_files (
      id VARCHAR(80) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      purpose VARCHAR(40) NOT NULL DEFAULT 'general',
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 VARCHAR(64) NOT NULL,
      data_base64 TEXT NOT NULL,
      is_public BOOLEAN NOT NULL DEFAULT true,
      conversation_id VARCHAR(64),
      order_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_files_owner ON shopit_files (owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shopit_files_conv ON shopit_files (conversation_id);

    -- 31. Mutes Table (Mute notifications/alerts from a user without blocking)
    CREATE TABLE IF NOT EXISTS shopit_mutes (
      id VARCHAR(64) PRIMARY KEY,
      muter_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      muted_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (muter_id, muted_id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_mutes_muter ON shopit_mutes (muter_id);

    -- 32. Profile Slug History Table (Old-slug redirects when display name changes)
    CREATE TABLE IF NOT EXISTS shopit_profile_slug_history (
      slug VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES shopit_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shopit_slug_history_user ON shopit_profile_slug_history (user_id);
  `;

  // Comprehensive column healing: ensures every table has all required columns regardless of initial creation schema
  const alterStatements = [
    // 1. shopit_users
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS email VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS name VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS role VARCHAR(32) DEFAULT \'buyer\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS sub_role VARCHAR(50);',
    'ALTER TABLE shopit_users ALTER COLUMN sub_role DROP DEFAULT;',
    'UPDATE shopit_users SET sub_role = NULL WHERE role != \'admin\' AND sub_role = \'superadmin\';',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 1;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS is_verified_email BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_users ALTER COLUMN is_verified_email SET DEFAULT false;',
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
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(60);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS profile_slug VARCHAR(100);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS avatar_url TEXT;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS cover_url TEXT;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS tagline VARCHAR(80);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS bio VARCHAR(300);',
    'ALTER TABLE shopit_users ALTER COLUMN bio TYPE VARCHAR(300);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS campus VARCHAR(120);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS location_area VARCHAR(120);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS notification_prefs JSONB;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS privacy_settings JSONB;',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_users_profile_slug_heal ON shopit_users (profile_slug);',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 2. shopit_sellers
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS shop_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS email VARCHAR(255);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS bio TEXT;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS shop_story VARCHAR(600);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS craft_materials VARCHAR(300);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS processing_time VARCHAR(60);',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS delivery_options JSONB DEFAULT \'{}\'::jsonb;',
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
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS logo_url TEXT;',
    'ALTER TABLE shopit_sellers ADD COLUMN IF NOT EXISTS banner_url TEXT;',
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

    // 4. shopit_products (kobo-only money columns)
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_campus VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS title VARCHAR(255);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS category VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_price_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS display_price_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 1;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_pickup_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_local_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS delivery_buyer_arranges BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_state VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_city VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS location_area VARCHAR(100);',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS seller_badges JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS reviews JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT true;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',
    'CREATE INDEX IF NOT EXISTS idx_shopit_products_pinned_heal ON shopit_products (seller_id, is_pinned DESC, pinned_at DESC);',

    // 5. shopit_orders (kobo-only money columns)
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS subtotal_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS service_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS discount_total_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS grand_total_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT \'online\';',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_otp VARCHAR(10);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS handshake_verified BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending_payment\';',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS campus VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivery_area VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS pickup_point VARCHAR(255);',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS notes TEXT;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS packed_photo_url TEXT;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS admin_hold BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS unshipped_reminder_sent_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS auto_release_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS has_review BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_orders_ref_unique ON shopit_orders (payment_reference);',
    'ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);',
    'ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS transfer_code VARCHAR(128);',
    'ALTER TABLE shopit_payouts ADD COLUMN IF NOT EXISTS flw_transfer_id VARCHAR(64);',

    // 6. shopit_wallets (kobo-only money columns)
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS pending_balance_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS available_balance_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS total_withdrawn_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS freeze_reason TEXT;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS payout_accounts JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS active_payout_account_id VARCHAR(64);',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_wallets ADD CONSTRAINT chk_shopit_wallet_non_negative CHECK (pending_balance_kobo >= 0 AND available_balance_kobo >= 0 AND total_withdrawn_kobo >= 0);',

    // 7. shopit_payments (kobo-only money column)
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT \'NGN\';',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS channel VARCHAR(50);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\';',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS webhook_received BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS data JSONB DEFAULT \'{}\'::jsonb;',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 8. shopit_ledger_entries (kobo-only money columns)
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS wallet_id VARCHAR(64);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS type VARCHAR(50);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS amount_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS fee_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_after_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT \'pending\';',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'completed\';',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS reference VARCHAR(255);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);',
    'ALTER TABLE shopit_ledger_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_shopit_ledger_idemp_unique ON shopit_ledger_entries (idempotency_key);',

    // 9. shopit_disputes (kobo-only money column)
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS order_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS buyer_masked_id VARCHAR(64);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS reason VARCHAR(255);',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_disputes ADD COLUMN IF NOT EXISTS amount_held_in_escrow_kobo BIGINT DEFAULT 0;',
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

    // 11. shopit_commissions (kobo-only)
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_id VARCHAR(64);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_id VARCHAR(64);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS seller_shop_name VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS title VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS description TEXT;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS budget_kobo BIGINT DEFAULT 0;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'pending\';',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT \'[]\'::jsonb;',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'ALTER TABLE shopit_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();',

    // 12. shopit_admin_alerts
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS id VARCHAR(64);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50) DEFAULT \'new_user\';',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_id VARCHAR(64);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS user_role VARCHAR(32);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS title VARCHAR(255);',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS message TEXT;',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\'::jsonb;',
    'ALTER TABLE shopit_admin_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();',
    'CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_created_heal ON shopit_admin_alerts (created_at DESC);',
    'CREATE INDEX IF NOT EXISTS idx_shopit_admin_alerts_type_read_heal ON shopit_admin_alerts (alert_type, is_read);',

    // 13. Chat Conversations & Messages read/attachment healing
    'ALTER TABLE shopit_chat_conversations ADD COLUMN IF NOT EXISTS buyer_last_read_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_chat_conversations ADD COLUMN IF NOT EXISTS seller_last_read_at TIMESTAMPTZ;',
    'ALTER TABLE shopit_chat_messages ADD COLUMN IF NOT EXISTS attachment JSONB;',
    'ALTER TABLE shopit_chat_messages ADD COLUMN IF NOT EXISTS reply_to_id VARCHAR(64);',
  ];

  const stripLeadingComments = (sql: string): string =>
    sql
      .split('\n')
      .map(line => line.replace(/^\s*--.*$/, ''))
      .join('\n')
      .trim();

  let processedMigrationSql = migrationSql;
  if (isPgMem) {
    processedMigrationSql = processedMigrationSql
      .replace(/\bJSONB\b/gi, 'TEXT')
      .replace(/\bJSON\b/gi, 'TEXT')
      .replace(/DEFAULT\s+'[^']*'/gi, '')
      .replace(/DEFAULT\s+"[^"]*"/gi, '');
  }

  const allStatements = processedMigrationSql
    .split(';')
    .map(stripLeadingComments)
    .filter(s => s.length > 0);

  // Separate table DDL, column healing ALTERs, and index DDL so indexes on newer columns never fail silently
  const tableStatements = allStatements.filter(s => /^CREATE\s+TABLE/i.test(s));
  const sqlIndexStatements = allStatements.filter(s => /^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));
  const otherSqlStatements = allStatements.filter(
    s => !/^CREATE\s+TABLE/i.test(s) && !/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s)
  );

  const alterOnlyStatements = alterStatements
    .map(stripLeadingComments)
    .filter(s => s.length > 0 && !/^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));
  const alterIndexStatements = alterStatements
    .map(stripLeadingComments)
    .filter(s => /^CREATE\s+(UNIQUE\s+)?INDEX/i.test(s));

  const isBenignDdlError = (stmt: string, err: any): boolean => {
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '');
    // Ignore already-exists errors (42P07 duplicate_table, 42710 duplicate_object, 42701 duplicate_column)
    if (code === '42P07' || code === '42710' || code === '42701' || msg.includes('already exists')) {
      return true;
    }
    // pg-mem omits a few Postgres syntax clauses like DROP DEFAULT / DROP CONSTRAINT IF EXISTS / ALTER COLUMN TYPE
    if (
      isPgMem &&
      (stmt.includes('DROP DEFAULT') ||
        stmt.includes('SET DEFAULT') ||
        stmt.includes('DROP CONSTRAINT') ||
        stmt.includes('ADD CONSTRAINT') ||
        stmt.includes('ALTER COLUMN bio TYPE'))
    ) {
      return true;
    }
    return false;
  };

  // Phase 1: Create all tables
  for (const statement of [...tableStatements, ...otherSqlStatements]) {
    try {
      await pool.query(statement);
    } catch (err: any) {
      if (isPgMem) {
        console.warn('[pg-mem Migration Note - Ignored AST/DDL Error]:', err?.message || err);
        continue;
      }
      if (!isBenignDdlError(statement, err)) {
        console.error('[Migration Table DDL Error]:', err.message);
        throw err;
      }
      console.warn('[Migration Table DDL Note]:', err.message);
    }
  }

  // Phase 2: Heal columns & constraints on existing tables
  for (const stmt of alterOnlyStatements) {
    try {
      await pool.query(stmt);
    } catch (alterErr: any) {
      if (!isBenignDdlError(stmt, alterErr)) {
        console.error('[Migration Column Error]:', alterErr.message);
        throw alterErr;
      }
      if (!isPgMem || !stmt.includes('chk_shopit_wallet_non_negative')) {
        console.warn('[Migration Column Note]:', alterErr.message);
      }
    }
  }

  // Phase 2b: Backfill *_kobo from legacy NUMERIC columns (if upgrading an existing DB) and drop duplicate NUMERIC columns
  const legacyColumnMigrations: Array<{
    table: string;
    legacyCol: string;
    koboCol: string;
  }> = [
    { table: 'shopit_products', legacyCol: 'seller_price', koboCol: 'seller_price_kobo' },
    { table: 'shopit_products', legacyCol: 'service_fee', koboCol: 'service_fee_kobo' },
    { table: 'shopit_products', legacyCol: 'display_price', koboCol: 'display_price_kobo' },
    { table: 'shopit_products', legacyCol: 'delivery_pickup_fee', koboCol: 'delivery_pickup_fee_kobo' },
    { table: 'shopit_products', legacyCol: 'delivery_local_fee', koboCol: 'delivery_local_fee_kobo' },
    { table: 'shopit_orders', legacyCol: 'subtotal', koboCol: 'subtotal_kobo' },
    { table: 'shopit_orders', legacyCol: 'service_fee_total', koboCol: 'service_fee_kobo' },
    { table: 'shopit_orders', legacyCol: 'delivery_total', koboCol: 'delivery_fee_kobo' },
    { table: 'shopit_orders', legacyCol: 'discount_total', koboCol: 'discount_total_kobo' },
    { table: 'shopit_orders', legacyCol: 'grand_total', koboCol: 'grand_total_kobo' },
    { table: 'shopit_payments', legacyCol: 'amount_naira', koboCol: 'amount_kobo' },
    { table: 'shopit_wallets', legacyCol: 'pending_balance', koboCol: 'pending_balance_kobo' },
    { table: 'shopit_wallets', legacyCol: 'available_balance', koboCol: 'available_balance_kobo' },
    { table: 'shopit_wallets', legacyCol: 'total_withdrawn', koboCol: 'total_withdrawn_kobo' },
    { table: 'shopit_ledger_entries', legacyCol: 'amount', koboCol: 'amount_kobo' },
    { table: 'shopit_ledger_entries', legacyCol: 'fee', koboCol: 'fee_kobo' },
    { table: 'shopit_ledger_entries', legacyCol: 'balance_after', koboCol: 'balance_after_kobo' },
    { table: 'shopit_disputes', legacyCol: 'amount_held_in_escrow', koboCol: 'amount_held_in_escrow_kobo' },
    { table: 'shopit_commissions', legacyCol: 'budget_naira', koboCol: 'budget_kobo' },
  ];

  for (const m of legacyColumnMigrations) {
    try {
      await pool.query(`SELECT ${m.legacyCol} FROM ${m.table} LIMIT 0`);
      await pool.query(
        `UPDATE ${m.table} SET ${m.koboCol} = CASE WHEN COALESCE(${m.koboCol}, 0) = 0 AND COALESCE(${m.legacyCol}, 0) <> 0 THEN CAST((${m.legacyCol} * 100) AS BIGINT) ELSE COALESCE(${m.koboCol}, 0) END`
      );
      try {
        await pool.query(`ALTER TABLE ${m.table} DROP COLUMN IF EXISTS ${m.legacyCol}`);
      } catch {}
    } catch {}
  }


  // Phase 2c: Zero-loss orphan quarantine & repair on pre-existing tables BEFORE enforcing FKs.
  // NEVER delete rows from shopit_payments, shopit_wallets, shopit_ledger_entries, shopit_orders, or shopit_disputes;
  // copy un-linkable orphans transactionally into shopit_migration_quarantine first and report exact counts.
  const quarantined: MigrationQuarantineCounts = {
    payments: 0,
    wallets: 0,
    ledgerEntries: 0,
    disputes: 0,
  };
  let orphanOrdersNullified = 0;
  let deletedOrphanProducts = 0;
  const deletedOrphanProductIds: string[] = [];

  if (!isPgMem) {
    const qClient = await pool.connect();
    try {
      await qClient.query('BEGIN');

      try {
        // 1. Orphaned products (missing seller) -> permitted to delete ONLY if explicitly logged
        const orphanProdRes = await qClient.query(
          `SELECT p.id FROM shopit_products p WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = p.seller_id)`
        );
        if (orphanProdRes.rows.length > 0) {
          for (const r of orphanProdRes.rows) {
            deletedOrphanProductIds.push(String(r.id));
          }
          await qClient.query(
            `DELETE FROM shopit_products WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_products.seller_id)`
          );
          deletedOrphanProducts = deletedOrphanProductIds.length;
          console.warn(
            `[Migration Cleanup] Deleted ${deletedOrphanProducts} orphaned product row(s) with missing shopit_sellers parent: ${deletedOrphanProductIds.join(', ')}`
          );
        }
      } catch (prodErr: any) {
        console.warn('[Migration Orphan Products Note]:', prodErr?.message);
      }

      try {
        // 2. Orders with missing buyer -> NEVER delete; preserve order and set buyer_id = NULL
        const orphanOrdRes = await qClient.query(
          `SELECT id FROM shopit_orders WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_orders.buyer_id)`
        );
        if (orphanOrdRes.rows.length > 0) {
          orphanOrdersNullified = orphanOrdRes.rows.length;
          await qClient.query(
            `UPDATE shopit_orders SET buyer_id = NULL WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_orders.buyer_id)`
          );
          console.warn(
            `[Migration Repair] Preserved ${orphanOrdersNullified} order(s) by clearing dangling buyer_id references.`
          );
        }
      } catch (ordErr: any) {
        console.warn('[Migration Orphan Orders Note]:', ordErr?.message);
      }

      // Helper to quarantine & extract rows safely without losing any record
      const insertQuarantineRow = async (
        sourceTable: string,
        sourcePk: string,
        reason: string,
        rowObj: Record<string, any>
      ) => {
        const qId = `q_${sourceTable}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await qClient.query(
          `INSERT INTO shopit_migration_quarantine (id, source_table, source_pk, reason, row_data, quarantined_at, schema_version)
           VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)`,
          [qId, sourceTable, sourcePk, reason, JSON.stringify(rowObj), EXPECTED_SCHEMA_VERSION]
        );
      };

      try {
        // 3. Orphaned payments (order_id points to non-existent order) -> quarantine then remove from active table
        const orphanPayRes = await qClient.query(
          `SELECT * FROM shopit_payments WHERE order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_payments.order_id)`
        );
        for (const row of orphanPayRes.rows) {
          const pk = String(row.reference || '');
          await insertQuarantineRow(
            'shopit_payments',
            pk,
            `Orphaned payment referencing missing order_id="${row.order_id}"`,
            row
          );
          await qClient.query(`DELETE FROM shopit_payments WHERE reference = $1`, [row.reference]);
          quarantined.payments++;
        }
      } catch (payErr: any) {
        console.warn('[Migration Orphan Payments Note]:', payErr?.message);
      }

      try {
        // 4. Preserve ledger entries with missing optional order_id by clearing order_id = NULL
        await qClient.query(
          `UPDATE shopit_ledger_entries SET order_id = NULL WHERE order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_ledger_entries.order_id)`
        );
      } catch (ledOrdErr: any) {
        console.warn('[Migration Ledger Order Clean Note]:', ledOrdErr?.message);
      }

      try {
        // 5. Identify orphaned wallets AND any ledger entries referencing missing or orphaned wallets
        const orphanWalletRes = await qClient.query(
          `SELECT * FROM shopit_wallets WHERE NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_wallets.seller_id)`
        );
        const orphanWalletIds = new Set<string>(orphanWalletRes.rows.map((w: any) => String(w.seller_id)));

        const allLedgerCandidates = await qClient.query(
          `SELECT * FROM shopit_ledger_entries WHERE NOT EXISTS (SELECT 1 FROM shopit_wallets w WHERE w.seller_id = shopit_ledger_entries.wallet_id)`
        );
        for (const lRow of allLedgerCandidates.rows) {
          await insertQuarantineRow(
            'shopit_ledger_entries',
            String(lRow.id),
            `Orphaned ledger entry referencing missing wallet_id="${lRow.wallet_id}"`,
            lRow
          );
          await qClient.query(`DELETE FROM shopit_ledger_entries WHERE id = $1`, [lRow.id]);
          quarantined.ledgerEntries++;
        }

        if (orphanWalletIds.size > 0) {
          for (const wId of orphanWalletIds) {
            const wLedgerRes = await qClient.query(`SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1`, [wId]);
            for (const lRow of wLedgerRes.rows) {
              await insertQuarantineRow(
                'shopit_ledger_entries',
                String(lRow.id),
                `Ledger entry attached to orphaned wallet_id="${wId}" (missing seller)`,
                lRow
              );
              await qClient.query(`DELETE FROM shopit_ledger_entries WHERE id = $1`, [lRow.id]);
              quarantined.ledgerEntries++;
            }
          }
        }

        for (const wRow of orphanWalletRes.rows) {
          await insertQuarantineRow(
            'shopit_wallets',
            String(wRow.seller_id),
            `Orphaned wallet referencing missing shopit_sellers.id="${wRow.seller_id}"`,
            wRow
          );
          await qClient.query(`DELETE FROM shopit_wallets WHERE seller_id = $1`, [wRow.seller_id]);
          quarantined.wallets++;
        }
      } catch (wallErr: any) {
        console.warn('[Migration Orphan Wallets Note]:', wallErr?.message);
      }

      try {
        // 6. Disputes: nullify dangling buyer_id first; quarantine disputes missing required order or seller
        await qClient.query(
          `UPDATE shopit_disputes SET buyer_id = NULL WHERE buyer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shopit_users u WHERE u.id = shopit_disputes.buyer_id)`
        );
        const orphanDisputeRes = await qClient.query(
          `SELECT * FROM shopit_disputes WHERE NOT EXISTS (SELECT 1 FROM shopit_orders o WHERE o.id = shopit_disputes.order_id) OR NOT EXISTS (SELECT 1 FROM shopit_sellers s WHERE s.id = shopit_disputes.seller_id)`
        );
        for (const dRow of orphanDisputeRes.rows) {
          await insertQuarantineRow(
            'shopit_disputes',
            String(dRow.id),
            `Orphaned dispute missing required order_id="${dRow.order_id}" or seller_id="${dRow.seller_id}"`,
            dRow
          );
          await qClient.query(`DELETE FROM shopit_disputes WHERE id = $1`, [dRow.id]);
          quarantined.disputes++;
        }
      } catch (dispErr: any) {
        console.warn('[Migration Orphan Disputes Note]:', dispErr?.message);
      }

      await qClient.query('COMMIT');
    } catch (qErr) {
      try {
        await qClient.query('ROLLBACK');
      } catch {}
      throw qErr;
    } finally {
      qClient.release();
    }
  }

  console.log(
    `[Database Migration] Quarantine summary: payments=${quarantined.payments}, wallets=${quarantined.wallets}, ledgerEntries=${quarantined.ledgerEntries}, disputes=${quarantined.disputes}, orphanOrdersNullified=${orphanOrdersNullified}, deletedOrphanProducts=${deletedOrphanProducts}`
  );

  if (!isPgMem) {
    const fkConstraints: Array<{ table: string; name: string; ddl: string }> = [
      { table: 'shopit_products', name: 'fk_shopit_products_seller', ddl: 'FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE' },
      { table: 'shopit_orders', name: 'fk_shopit_orders_buyer', ddl: 'FOREIGN KEY (buyer_id) REFERENCES shopit_users(id) ON DELETE SET NULL' },
      { table: 'shopit_payments', name: 'fk_shopit_payments_order', ddl: 'FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE CASCADE' },
      { table: 'shopit_wallets', name: 'fk_shopit_wallets_seller', ddl: 'FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE' },
      { table: 'shopit_ledger_entries', name: 'fk_shopit_ledger_wallet', ddl: 'FOREIGN KEY (wallet_id) REFERENCES shopit_wallets(seller_id) ON DELETE CASCADE' },
      { table: 'shopit_ledger_entries', name: 'fk_shopit_ledger_order', ddl: 'FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE SET NULL' },
      { table: 'shopit_disputes', name: 'fk_shopit_disputes_order', ddl: 'FOREIGN KEY (order_id) REFERENCES shopit_orders(id) ON DELETE CASCADE' },
      { table: 'shopit_disputes', name: 'fk_shopit_disputes_seller', ddl: 'FOREIGN KEY (seller_id) REFERENCES shopit_sellers(id) ON DELETE CASCADE' },
      { table: 'shopit_disputes', name: 'fk_shopit_disputes_buyer', ddl: 'FOREIGN KEY (buyer_id) REFERENCES shopit_users(id) ON DELETE SET NULL' },
    ];
    for (const fk of fkConstraints) {
      const exists = await pool.query(
        `SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`,
        [fk.name]
      );
      if (exists.rows.length === 0) {
        await pool.query(`ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.name} ${fk.ddl}`);
      }
    }
  }

  // Phase 3: Create indexes after all columns exist (fail loudly on any non-benign index error)
  const indexFailures = await applyMigrationIndexes(pool, [...sqlIndexStatements, ...alterIndexStatements], isBenignDdlError);
  if (indexFailures.length > 0) {
    throw new Error(`Migration index creation failed (${indexFailures.length}): ${indexFailures.join(' | ')}`);
  }

  // Phase 4: Verify all core tables actually exist before marking migrationCompleted = true
  const missingCoreTables: string[] = [];
  for (const coreTable of CORE_SCHEMA_TABLES) {
    try {
      await pool.query(`SELECT 1 FROM ${coreTable} LIMIT 0`);
    } catch (verifyErr: any) {
      missingCoreTables.push(`${coreTable} (${verifyErr?.message || 'missing'})`);
    }
  }
  if (missingCoreTables.length > 0) {
    throw new Error(`Migration schema verification failed. Missing core tables: ${missingCoreTables.join(', ')}`);
  }

  // Seed default platform settings (broadcast, emergency killswitches, fee policy)
  const defaultPlatformSettings: Array<{ key: string; value: Record<string, any> }> = [
    {
      key: 'broadcast',
      value: {
        id: 'broad_default',
        isActive: false,
        title: 'Campus Safety & Verified Handshake Advisory',
        message: 'All campus order pickups must be verified using the 4-digit Handshake OTP at daylight campus pickup spots.',
        tone: 'info',
        createdAt: new Date().toISOString(),
        author: 'Shop It Safety Desk',
      },
    },
    {
      key: 'emergency_controls',
      value: {
        maintenanceMode: false,
        pauseNewOrders: false,
        pauseSellerSignups: false,
      },
    },
    {
      key: 'fee_settings',
      value: {
        firstMonthPromoFree: false,
        tierLowFee: 200,
        tierMidFee: 500,
        tierHighPercentage: 0.05,
        minWithdrawal: 1000,
      },
    },
  ];
  for (const ps of defaultPlatformSettings) {
    try {
      await pool.query(
        `INSERT INTO shopit_platform_settings (key, value, updated_by, updated_at)
         VALUES ($1, $2, 'system', NOW())
         ON CONFLICT (key) DO NOTHING`,
        [ps.key, JSON.stringify(ps.value)]
      );
    } catch (seedErr: any) {
      console.error(`[Migration Seed Error] Failed seeding platform setting "${ps.key}":`, seedErr.message);
      throw seedErr;
    }
  }

  // Seed default coupons into PostgreSQL (DB-authoritative coupon validation)
  const seedCoupons = [
    { code: 'TEEDS', discountKobo: 50000, minSubtotalKobo: 250000 },
    { code: 'FIRSTORDER', discountKobo: 30000, minSubtotalKobo: 150000 },
    { code: 'CAMPUSLOVE', discountKobo: 50000, minSubtotalKobo: 300000 },
    { code: 'FIRSTCRAFT', discountKobo: 40000, minSubtotalKobo: 200000 },
  ];
  for (const c of seedCoupons) {
    try {
      await pool.query(
        `INSERT INTO shopit_coupons (code, discount_kobo, min_subtotal_kobo, is_active, current_uses)
         VALUES ($1, $2, $3, true, 0)
         ON CONFLICT (code) DO NOTHING`,
        [c.code, c.discountKobo, c.minSubtotalKobo]
      );
    } catch (couponErr: any) {
      console.error(`[Migration Seed Error] Failed seeding coupon "${c.code}":`, couponErr.message);
      throw couponErr;
    }
  }

  await ensureBootstrapAdminFromEnv(pool);

  // Zero-loss backfill: populate display_name, unique profile_slug, and default privacy/notification prefs for all users
  try {
    const usersToBackfill = await pool.query(
      `SELECT u.id, u.name, u.display_name, u.profile_slug, u.age, u.privacy_settings, u.notification_prefs, u.campus, u.location_area,
              s.campus AS seller_campus, s.location_area AS seller_area, s.under_18 AS seller_under_18
       FROM shopit_users u
       LEFT JOIN shopit_sellers s ON (u.id = s.user_id OR u.id = s.id)
       WHERE u.display_name IS NULL OR u.display_name = '' OR u.profile_slug IS NULL OR u.profile_slug = '' OR u.privacy_settings IS NULL OR u.notification_prefs IS NULL`
    );
    const {
      extractFirstName,
      generateUniqueProfileSlug,
      DEFAULT_NOTIFICATION_PREFS,
      DEFAULT_PRIVACY_SETTINGS,
      UNDER_18_PRIVACY_SETTINGS,
    } = await import('../lib/validation.js');

    for (const u of usersToBackfill.rows) {
      const displayName = u.display_name && String(u.display_name).trim()
        ? String(u.display_name).trim().slice(0, 40)
        : extractFirstName(u.name || 'Member');
      const profileSlug = u.profile_slug && String(u.profile_slug).trim()
        ? String(u.profile_slug).trim()
        : await generateUniqueProfileSlug((sql: string, p?: any[]) => pool.query(sql, p), displayName, u.id);
      const isMinor = (u.age !== null && u.age !== undefined && Number(u.age) < 18) || Boolean(u.seller_under_18);
      const nextPrivacy = u.privacy_settings || (isMinor ? UNDER_18_PRIVACY_SETTINGS : DEFAULT_PRIVACY_SETTINGS);
      const nextNotif = u.notification_prefs || DEFAULT_NOTIFICATION_PREFS;
      const nextCampus = u.campus || u.seller_campus || null;
      const nextArea = u.location_area || u.seller_area || null;

      await pool.query(
        `UPDATE shopit_users
         SET display_name = $1,
             profile_slug = $2,
             privacy_settings = COALESCE(privacy_settings, $3::jsonb),
             notification_prefs = COALESCE(notification_prefs, $4::jsonb),
             campus = COALESCE(campus, $5),
             location_area = COALESCE(location_area, $6)
         WHERE id = $7`,
        [
          displayName,
          profileSlug,
          JSON.stringify(nextPrivacy),
          JSON.stringify(nextNotif),
          nextCampus,
          nextArea,
          u.id,
        ]
      );
    }
  } catch (backfillErr: any) {
    console.warn('[Migration Profile Backfill Note]:', backfillErr?.message || backfillErr);
  }

  // Zero-loss backfill: ensure every existing user has an entry in shopit_admin_alerts for the Admin "New Users" feed
  try {
    const allUsersForAlerts = await pool.query(
      `SELECT id, email, name, display_name, role, created_at FROM shopit_users`
    );
    for (const u of allUsersForAlerts.rows) {
      const alertKey = `new_user_${u.id}`;
      const alertId = `alert_u_${u.id}`;
      const labelName = String(u.display_name || u.name || u.email || 'Member').trim();
      await pool.query(
        `INSERT INTO shopit_admin_alerts (
          alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
        ) VALUES ($1, $2, 'new_user', $3, $4, $5, $6, $7, $8, false, $9, COALESCE($10, NOW()))
        ON CONFLICT (alert_key) DO NOTHING`,
        [
          alertKey,
          alertId,
          u.id,
          u.email,
          labelName,
          u.role || 'buyer',
          `New ${u.role || 'buyer'} registered`,
          `${labelName} (${u.email}) registered as ${u.role || 'buyer'}`,
          JSON.stringify({ backfilled: true }),
          u.created_at || new Date(),
        ]
      );
    }
  } catch (alertBackfillErr: any) {
    console.warn('[Migration Admin Alert Backfill Note]:', alertBackfillErr?.message || alertBackfillErr);
  }

    const resultSummary: MigrationResult = {
      schemaVersion: EXPECTED_SCHEMA_VERSION,
      quarantined,
      orphanOrdersNullified,
      deletedOrphanProducts,
      deletedOrphanProductIds,
    };

    await pool.query(
      `INSERT INTO shopit_schema_migrations (version, summary, applied_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (version) DO UPDATE SET summary = $2::jsonb, applied_at = NOW()`,
      [EXPECTED_SCHEMA_VERSION, JSON.stringify(resultSummary)]
    );

    lastMigrationResult = resultSummary;
    migrationCompleted = true;
    prodSchemaVerified = true;
    console.log(
      `[Database Migration] Schema v${EXPECTED_SCHEMA_VERSION} verified. All tables, indexes, quarantine logs, and security schemas ready.`
    );
    return resultSummary;
  })().catch(err => {
    migrationPromise = null;
    migrationCompleted = false;
    prodSchemaVerified = false;
    console.error('[Database Migration Critical Error]:', err.message);
    throw err;
  });

  return migrationPromise;
}

export async function applyMigrationIndexes(
  pool: any,
  indexStatements: string[],
  isBenignErr?: (stmt: string, err: any) => boolean
): Promise<string[]> {
  const failures: string[] = [];
  const defaultBenignCheck = (_stmt: string, err: any) => {
    const msg = String(err?.message || '').toLowerCase();
    const code = String(err?.code || '');
    return code === '42P07' || code === '42710' || code === '42701' || msg.includes('already exists');
  };
  const checkBenign = isBenignErr || defaultBenignCheck;

  for (const idxStmt of indexStatements) {
    try {
      await pool.query(idxStmt);
    } catch (idxErr: any) {
      if (checkBenign(idxStmt, idxErr)) {
        console.warn('[Migration Index Note]:', idxErr.message);
      } else {
        const summary = `${idxStmt.slice(0, 80)} -> ${idxErr?.message || idxErr}`;
        console.error('[Migration Index Error]:', summary);
        failures.push(summary);
      }
    }
  }
  return failures;
}

export const DEFAULT_BROADCAST_SETTING = {
  id: 'broad_default',
  isActive: false,
  title: 'Campus Safety & Verified Handshake Advisory',
  message: 'All campus order pickups must be verified using the 4-digit Handshake OTP at daylight campus pickup spots.',
  tone: 'info',
  createdAt: new Date().toISOString(),
  author: 'Shop It Safety Desk',
};

export const DEFAULT_EMERGENCY_CONTROLS = {
  maintenanceMode: false,
  pauseNewOrders: false,
  pauseSellerSignups: false,
};

export const DEFAULT_FEE_SETTINGS_DB = {
  firstMonthPromoFree: false,
  tierLowFee: 200,
  tierMidFee: 500,
  tierHighPercentage: 0.05,
  minWithdrawal: 1000,
};

export async function getPlatformSetting<T = Record<string, any>>(key: string, fallback: T): Promise<T> {
  try {
    const res = await query('SELECT value FROM shopit_platform_settings WHERE key = $1', [key]);
    if (res.rows.length > 0 && res.rows[0].value && typeof res.rows[0].value === 'object') {
      return { ...fallback, ...res.rows[0].value };
    }
  } catch (err: any) {
    console.warn(`[Platform Setting Read Warning (${key})]:`, err?.message || err);
  }
  return fallback;
}

export async function setPlatformSetting<T = Record<string, any>>(
  key: string,
  value: T,
  updatedBy: string
): Promise<T> {
  await query(
    `INSERT INTO shopit_platform_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy]
  );
  return value;
}

export async function ensureBootstrapAdminFromEnv(poolArg?: any): Promise<void> {
  const pool = poolArg || (await getPool());
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();

  if (adminEmail && adminInitialPassword) {
    try {
      const existingAdmin = await pool.query(
        'SELECT id, email, role, sub_role, is_verified_email FROM shopit_users WHERE LOWER(email) = LOWER($1)',
        [adminEmail]
      );

      if (existingAdmin.rows.length === 0) {
        const passwordHash = hashPassword(adminInitialPassword);
        const adminId = 'admin_' + crypto.randomBytes(8).toString('hex');
        const alertId = 'alert_u_' + adminId;
        await pool.query(
          `INSERT INTO shopit_users (
            id, email, name, display_name, profile_slug, password_hash, role, sub_role, is_verified_email, must_change_password, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
          [
            adminId,
            adminEmail,
            'Administrator',
            'Administrator',
            'administrator',
            passwordHash,
            'admin',
            'superadmin',
            true,
            true, // Force password change at first login
          ]
        );
        await pool.query(
          `INSERT INTO shopit_admin_alerts (
            alert_key, id, alert_type, user_id, user_email, user_name, user_role, title, message, is_read, metadata, created_at
          ) VALUES ($1, $2, 'new_user', $3, $4, $5, 'admin', $6, $7, false, $8, NOW())
          ON CONFLICT (alert_key) DO NOTHING`,
          [
            `new_user_${adminId}`,
            alertId,
            adminId,
            adminEmail,
            'Administrator',
            'New admin registered',
            `Administrator (${adminEmail}) created as initial admin`,
            JSON.stringify({ source: 'bootstrap' }),
          ]
        );
        console.log(`[Admin Setup] Initial administrator account provisioned in PostgreSQL from ADMIN_EMAIL.`);
      } else {
        const row = existingAdmin.rows[0];
        if (row.role !== 'admin') {
          console.warn(
            `[Admin Setup Security] Account for ADMIN_EMAIL (${adminEmail}) already exists with role="${row.role}". Refusing automatic promotion of existing user.`
          );
        }
      }
    } catch (adminErr: any) {
      console.error('[Admin Setup Error]:', adminErr.message);
      throw adminErr;
    }
  } else {
    console.log('[Admin Setup] Notice: ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD environment variables are not set in environment.');
  }
}

export async function getAllPlatformConfig() {
  const [broadcastAnnouncement, emergencyControls, feeSettings] = await Promise.all([
    getPlatformSetting('broadcast', DEFAULT_BROADCAST_SETTING),
    getPlatformSetting('emergency_controls', DEFAULT_EMERGENCY_CONTROLS),
    getPlatformSetting('fee_settings', DEFAULT_FEE_SETTINGS_DB),
  ]);
  return { broadcastAnnouncement, emergencyControls, feeSettings };
}

