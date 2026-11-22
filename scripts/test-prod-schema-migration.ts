import './testEnv.js';
import assert from 'assert';
import http from 'http';
import { getPool, runMigration, verifyDatabaseSchema, setMigrationRunnerMode, resetMigrationVerificationState, EXPECTED_SCHEMA_VERSION, hashPassword, query } from '../server/db/postgres.js';
import { issueSignupVerificationToken } from '../server/db/otpStore.js';

async function runProdSchemaMigrationTest() {
  console.log('[Test] Starting Fix 4: Schema migration & production runtime verification test...');

  process.env.ADMIN_EMAIL = 'admin@shopit.ng';
  process.env.ADMIN_INITIAL_PASSWORD = 'AdminSecure123!';
  setMigrationRunnerMode(true);
  resetMigrationVerificationState();

  const pool = await getPool();

  console.log('[Test] Executing runMigration()...');
  const migrationResult = await runMigration();
  console.log('[Test] Migration Result:', JSON.stringify(migrationResult, null, 2));

  assert.strictEqual(migrationResult.schemaVersion, EXPECTED_SCHEMA_VERSION, 'Migration schema version must match expected');

  // Switch to Production Runtime Mode (verifyDatabaseSchema read-only check)
  setMigrationRunnerMode(false);
  process.env.NODE_ENV = 'production';
  resetMigrationVerificationState();

  const schemaCheck = await verifyDatabaseSchema();
  console.log('[Test] Production schema verify result:', schemaCheck);
  assert.strictEqual(schemaCheck.ok, true, 'verifyDatabaseSchema must return ok: true in production runtime');
  assert.strictEqual(schemaCheck.schemaVersion, EXPECTED_SCHEMA_VERSION);

  // Test app start and HTTP endpoints (health, version, register, admin users)
  console.log('[Test] Importing app and testing HTTP endpoints...');
  const { app } = await serverAppImport();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // GET /api/health
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json() as any;
    console.log('[Test] GET /api/health response:', healthJson);
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthJson.schemaOk, true);
    assert.strictEqual(healthJson.schemaVersion, EXPECTED_SCHEMA_VERSION);
    assert.strictEqual(healthJson.migrationError, null);

    // GET /api/version
    const verRes = await fetch(`${baseUrl}/api/version`);
    const verJson = await verRes.json() as any;
    assert.strictEqual(verRes.status, 200);
    assert.ok(verJson.version || verJson.commit);

    // POST /api/auth/register (New buyer registration)
    const testBuyerEmail = `newbuyer_${Date.now()}@shopit.ng`;
    const signupVerificationToken = await issueSignupVerificationToken(testBuyerEmail);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testBuyerEmail,
        name: 'New Campus Buyer',
        password: 'Password123!',
        role: 'buyer',
        age: 21,
        signupVerificationToken,
      }),
    });
    const regJson = await regRes.json() as any;
    console.log('[Test] POST /api/auth/register response status:', regRes.status, regJson);
    assert.strictEqual(regRes.status, 201);
    assert.strictEqual(regJson.status, true);
    assert.ok(regJson.sessionToken);

    // Admin login & change password & GET /api/admin/users
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@shopit.ng';
    const adminPw = process.env.ADMIN_INITIAL_PASSWORD || 'AdminSecure123!';
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPw }),
    });
    const loginJson = await loginRes.json() as any;
    console.log('[Test] Admin login response status:', loginRes.status);
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginJson.mustChangePassword, true);

    const changeRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginJson.sessionToken}`,
        'x-session-token': loginJson.sessionToken,
      },
      body: JSON.stringify({ newPassword: 'NewAdminSecurePassword999!' }),
    });
    const changeJson = await changeRes.json() as any;
    assert.strictEqual(changeRes.status, 200);
    assert.strictEqual(changeJson.status, true);

    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: {
        Authorization: `Bearer ${changeJson.sessionToken || loginJson.sessionToken}`,
        'x-session-token': changeJson.sessionToken || loginJson.sessionToken,
      },
    });
    const adminUsersJson = await adminUsersRes.json() as any;
    console.log('[Test] GET /api/admin/users status:', adminUsersRes.status, 'count:', adminUsersJson.users?.length);
    assert.strictEqual(adminUsersRes.status, 200);
    assert.strictEqual(adminUsersJson.status, true);
    assert.ok(Array.isArray(adminUsersJson.users));

    console.log('[Test SUCCESS] Fix 4 verification and migration test passed successfully!');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

async function serverAppImport() {
  return await import('../server/app.js');
}

runProdSchemaMigrationTest().catch(err => {
  console.error('[Test CRITICAL FAILURE]:', err);
  process.exit(1);
});
