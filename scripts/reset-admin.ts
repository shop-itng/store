import dotenv from 'dotenv';
import { getPool, hashPassword } from '../api/db/postgres.js';
import { clearLoginFailures } from '../api/auth/sessionStore.js';

dotenv.config({ override: true });

async function resetAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const newPassword = (args[1] || process.env.ADMIN_INITIAL_PASSWORD || '').trim();

  if (!email || !newPassword) {
    console.error('Usage: npx tsx scripts/reset-admin.ts <admin_email> <new_password>');
    console.error('Or set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in your environment / .env');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters.');
    process.exit(1);
  }

  console.log(`[Admin Recovery] Connecting to PostgreSQL to reset admin: ${email}...`);
  const pool = await getPool();

  const userRes = await pool.query(
    'SELECT id, email, role FROM shopit_users WHERE LOWER(email) = LOWER($1)',
    [email]
  );

  const passwordHash = hashPassword(newPassword);

  if (userRes.rows.length === 0) {
    // Insert new admin
    const adminId = 'admin_' + Date.now();
    await pool.query(
      `INSERT INTO shopit_users (
        id, email, name, password_hash, role, sub_role, is_verified_email, must_change_password, failed_login_attempts, locked_until, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'admin', 'superadmin', true, false, 0, NULL, NOW(), NOW())`,
      [adminId, email, 'Administrator', passwordHash]
    );
    console.log(`[Admin Recovery] Created new Administrator account: ${email}`);
  } else {
    // Update existing user to admin with new password and reset lockouts
    await pool.query(
      `UPDATE shopit_users 
       SET password_hash = $1, 
           role = 'admin', 
           sub_role = 'superadmin', 
           must_change_password = false,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW() 
       WHERE id = $2`,
      [passwordHash, userRes.rows[0].id]
    );
    console.log(`[Admin Recovery] Successfully updated admin account and unlocked: ${email}`);
  }

  // Clear any Redis lockouts
  await clearLoginFailures(email);

  console.log('[Admin Recovery] Lockouts cleared. You can now log in with the new password.');
  process.exit(0);
}

resetAdmin().catch(err => {
  console.error('[Admin Recovery Failed]:', err.message);
  process.exit(1);
});
