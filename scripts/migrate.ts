import dotenv from 'dotenv';
dotenv.config({ override: true });

import { runMigration, pingPostgres, query } from '../api/db/postgres.js';

async function main() {
  console.log('--- Shop It Database Migration Runner ---');
  console.log(`Checking connection using variable: DATABASE_URL`);

  const ping = await pingPostgres();
  console.log(`Database Status: ${ping.ok ? 'ONLINE' : 'OFFLINE'} (${ping.provider})`);
  if (!ping.ok) {
    console.error('Error connecting to database:', ping.error);
  }

  await runMigration();

  // Verify created tables
  const userCount = await query('SELECT COUNT(*) as count FROM shopit_users');
  const adminUser = await query('SELECT id, email, name, role, created_at FROM shopit_users WHERE role = $1', ['admin']);

  console.log('Verification:');
  console.log(`- Total users in database: ${userCount.rows[0].count}`);
  console.log(`- Admin account in database:`, adminUser.rows[0]);
  console.log('--- Migration Completed Successfully ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
