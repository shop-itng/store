import dotenv from 'dotenv';

// Safety rule: NEVER override existing environment variables and NEVER load local .env files in production/Vercel/CI.
export function loadLocalEnvSafely(env: NodeJS.ProcessEnv = process.env): boolean {
  const isProdLike = env.NODE_ENV === 'production' || Boolean(env.VERCEL) || Boolean(env.CI);
  if (isProdLike) {
    return false;
  }
  dotenv.config({ override: false });
  return true;
}

loadLocalEnvSafely();

import {
  CORE_SCHEMA_TABLES,
  getDatabaseUrl,
  getDatabaseUrlSource,
  pingPostgres,
  query,
  runMigration,
  verifyDatabaseSchema,
} from '../api/db/postgres.js';

function formatSafeDbTarget(): string {
  const dbUrl = getDatabaseUrl();
  const source = getDatabaseUrlSource();
  if (!dbUrl) {
    return 'pg-mem (no DATABASE_URL configured — development fallback only)';
  }
  try {
    const parsed = new URL(dbUrl);
    const dbName = parsed.pathname.replace(/^\/+/, '') || '(default)';
    return `${source || 'DATABASE_URL'} -> ${parsed.hostname}:${parsed.port || '5432'}/${dbName}`;
  } catch {
    return `${source || 'DATABASE_URL'} -> [invalid URL]`;
  }
}

async function main() {
  console.log('=== Shop It Database Migration & Table Verification ===');
  console.log(`Target Database: ${formatSafeDbTarget()}`);

  await runMigration();

  const ping = await pingPostgres();
  console.log(`Database Status: ${ping.ok ? 'ONLINE' : 'OFFLINE'} (${ping.provider})`);
  if (!ping.ok) {
    console.error('Error connecting or verifying schema:', ping.error);
    process.exit(1);
  }

  const schemaStatus = await verifyDatabaseSchema();
  if (!schemaStatus.ok) {
    console.error(`Missing core schema tables: ${schemaStatus.missingTables.join(', ')}`);
    process.exit(1);
  }

  let hasFailures = false;

  console.log(`\n--- Core Table Row Counts (${CORE_SCHEMA_TABLES.length} tables) ---`);
  for (const table of CORE_SCHEMA_TABLES) {
    try {
      const res = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ✓ ${table.padEnd(32)} : ${res.rows[0].count} rows`);
    } catch (err: any) {
      hasFailures = true;
      console.error(`  ✗ ${table.padEnd(32)} : ERROR - ${err.message}`);
    }
  }

  // Verify integer kobo schema columns
  console.log('\n--- Integer Kobo Schema Verification ---');
  const koboChecks = [
    { table: 'shopit_wallets', col: 'pending_balance_kobo' },
    { table: 'shopit_wallets', col: 'available_balance_kobo' },
    { table: 'shopit_wallets', col: 'total_withdrawn_kobo' },
    { table: 'shopit_ledger_entries', col: 'amount_kobo' },
    { table: 'shopit_ledger_entries', col: 'fee_kobo' },
    { table: 'shopit_ledger_entries', col: 'balance_after_kobo' },
    { table: 'shopit_orders', col: 'subtotal_kobo' },
    { table: 'shopit_orders', col: 'grand_total_kobo' },
    { table: 'shopit_commissions', col: 'budget_kobo' },
  ];

  for (const check of koboChecks) {
    try {
      await query(`SELECT ${check.col} FROM ${check.table} LIMIT 1`);
      console.log(`  ✓ ${check.table}.${check.col}`);
    } catch (err: any) {
      hasFailures = true;
      console.error(`  ✗ ${check.table}.${check.col} : ${err.message}`);
    }
  }

  if (hasFailures) {
    console.error('\n=== Database Migration Verification Failed ===');
    process.exit(1);
  }

  const userCount = await query('SELECT COUNT(*) as count FROM shopit_users');
  const adminUser = await query('SELECT id, email, name, role, created_at FROM shopit_users WHERE role = $1', ['admin']);

  console.log('\n--- Administrator Verification ---');
  console.log(`- Total registered users: ${userCount.rows[0].count}`);
  console.log(`- Admin account in database:`, adminUser.rows[0] || 'None provisioned (set ADMIN_EMAIL & ADMIN_INITIAL_PASSWORD)');
  console.log('\n=== Database Migration & Single Source of Truth Verified Successfully ===');
  process.exit(0);
}

const isDirectExec =
  process.argv[1] &&
  (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'));

if (isDirectExec) {
  main().catch(err => {
    console.error('Migration verification failed:', err);
    process.exit(1);
  });
}
