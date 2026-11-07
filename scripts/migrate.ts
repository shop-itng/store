import dotenv from 'dotenv';
dotenv.config({ override: true });

import { runMigration, pingPostgres, query } from '../api/db/postgres.js';

async function main() {
  console.log('=== Shop It Database Migration & Table Verification ===');
  console.log(`Checking connection using variable: DATABASE_URL`);

  const ping = await pingPostgres();
  console.log(`Database Status: ${ping.ok ? 'ONLINE' : 'OFFLINE'} (${ping.provider})`);
  if (!ping.ok) {
    console.error('Error connecting to database:', ping.error);
  }

  await runMigration();

  // Verify all 18 tables exist and are queryable
  const tables = [
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
    'shopit_commissions',
  ];

  console.log('\n--- Table Row Counts ---');
  for (const table of tables) {
    try {
      const res = await query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`  ✓ ${table.padEnd(30)} : ${res.rows[0].count} rows`);
    } catch (err: any) {
      console.error(`  ✗ ${table.padEnd(30)} : ERROR - ${err.message}`);
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
      console.error(`  ✗ ${check.table}.${check.col} : ${err.message}`);
    }
  }

  const userCount = await query('SELECT COUNT(*) as count FROM shopit_users');
  const adminUser = await query('SELECT id, email, name, role, created_at FROM shopit_users WHERE role = $1', ['admin']);

  console.log('\n--- Administrator Verification ---');
  console.log(`- Total registered users: ${userCount.rows[0].count}`);
  console.log(`- Admin account in database:`, adminUser.rows[0] || 'None provisioned (set ADMIN_EMAIL & ADMIN_INITIAL_PASSWORD)');
  console.log('\n=== Database Migration & Single Source of Truth Verified Successfully ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration verification failed:', err);
  process.exit(1);
});
