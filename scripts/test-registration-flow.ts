import './testEnv.js';
import http from 'http';
import assert from 'assert';

process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin_reg_test@shopit.ng';
process.env.ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'AdminRegPass123!';

async function runTests() {
  const { app } = await import('../api/index.js');
  const { query, runMigration } = await import('../server/db/postgres.js');
  const { issueSignupVerificationToken } = await import('../server/db/otpStore.js');

  console.log('=== Testing End-to-End Registration, PostgreSQL Persistence & Admin Panel Users Query ===');

  await runMigration();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const timestamp = Date.now();
    const testEmail = `newuser_${timestamp}@test.edu.ng`;
    const testPassword = 'Password123!';
    const testName = 'Ada Lovelace';

    // 0. Login as bootstrapped ADMIN_EMAIL, complete mandatory initial password change, and confirm subRole is superadmin
    console.log('0. Verifying bootstrapped ADMIN_EMAIL login + initial password change...');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_INITIAL_PASSWORD,
      }),
    });
    const adminLoginData: any = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200, `Admin login failed: ${adminLoginData.message}`);
    assert.strictEqual(adminLoginData.user.role, 'admin');
    assert.strictEqual(adminLoginData.user.subRole, 'superadmin');
    assert.strictEqual(adminLoginData.mustChangePassword, true);

    // Before changing password, protected admin routes must enforce PASSWORD_CHANGE_REQUIRED (403)
    const blockedBeforePwChange = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminLoginData.sessionToken}` },
    });
    assert.strictEqual(blockedBeforePwChange.status, 403);

    const changePwRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLoginData.sessionToken}`,
      },
      body: JSON.stringify({ newPassword: 'AdminChangedPass123!' }),
    });
    const changePwData: any = await changePwRes.json();
    assert.strictEqual(changePwRes.status, 200, `Admin password change failed: ${changePwData.message}`);
    const adminToken = changePwData.sessionToken;
    console.log('   ✓ Bootstrapped admin changed initial password & unlocked superadmin session');

    // 1. Register new buyer with OTP verification proof token
    console.log(`1. Testing POST /api/auth/register for buyer ${testEmail}...`);
    const buyerOtpProof = await issueSignupVerificationToken(testEmail);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
        role: 'buyer',
        age: 22,
        hasGuardianConsent: true,
        signupVerificationToken: buyerOtpProof,
      }),
    });
    const regData: any = await regRes.json();
    assert.strictEqual(regRes.status, 201, `Buyer registration failed: ${regData.message}`);
    assert.ok(regData.status && regData.user?.id && regData.sessionToken);
    assert.strictEqual(regData.user.password_hash, undefined);
    assert.strictEqual(regData.user.password, undefined);
    const createdUserId = regData.user.id;
    const buyerToken = regData.sessionToken;
    console.log(`   ✓ Created buyer ID: ${createdUserId}`);

    // 1b. Duplicate registration attempt must fail cleanly with 409
    const dupOtpProof = await issueSignupVerificationToken(testEmail);
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
        role: 'buyer',
        age: 22,
        signupVerificationToken: dupOtpProof,
      }),
    });
    assert.strictEqual(dupRes.status, 409, `Expected 409 for duplicate email, got ${dupRes.status}`);
    console.log('   ✓ Duplicate email rejected with HTTP 409');

    // 2. Verify RBAC on GET /api/admin/users (401 unauth, 403 buyer, 200 admin)
    console.log('2. Verifying RBAC and querying GET /api/admin/users...');
    const unauthUsersRes = await fetch(`${baseUrl}/api/admin/users`);
    assert.strictEqual(unauthUsersRes.status, 401);

    const buyerUsersRes = await fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    assert.strictEqual(buyerUsersRes.status, 403);

    const usersRes = await fetch(
      `${baseUrl}/api/admin/users?q=${encodeURIComponent(testEmail)}&role=buyer&page=1&limit=15`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const usersData: any = await usersRes.json();
    assert.strictEqual(usersRes.status, 200);
    assert.ok(usersData.status && usersData.total >= 1);
    const foundBuyer = usersData.users.find((u: any) => u.email === testEmail);
    assert.ok(foundBuyer, `New buyer ${testEmail} missing from GET /api/admin/users`);
    assert.strictEqual(foundBuyer.password_hash, undefined);
    assert.strictEqual(foundBuyer.password, undefined);
    assert.strictEqual(foundBuyer.token_version, undefined);
    console.log('   ✓ Buyer retrieved via GET /api/admin/users with zero sensitive fields leaked');

    // 2b. Validation on GET /api/admin/users (invalid page/limit/role => 400)
    const badPageRes = await fetch(`${baseUrl}/api/admin/users?page=notanumber`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(badPageRes.status, 400);
    const badRoleRes = await fetch(`${baseUrl}/api/admin/users?role=superhacker`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(badRoleRes.status, 400);
    console.log('   ✓ Invalid pagination & role filter return HTTP 400');

    // 3. Test Login with newly created credentials
    console.log('3. Testing POST /api/auth/login with new buyer account...');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });
    const loginData: any = await loginRes.json();
    assert.strictEqual(loginRes.status, 200, `Login failed: ${loginData.message}`);
    assert.ok(loginData.status && loginData.sessionToken);
    console.log('   ✓ Successfully authenticated with newly registered buyer');

    // 4. Test Seller Registration (including under-18 youth guardian persistence)
    const sellerEmail = `artisan_${timestamp}@test.edu.ng`;
    console.log(`4. Testing POST /api/auth/register for youth seller ${sellerEmail}...`);
    const sellerOtpProof = await issueSignupVerificationToken(sellerEmail);
    const sellerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password: testPassword,
        name: 'Chidi Crafts',
        role: 'seller',
        age: 16,
        hasGuardianConsent: true,
        guardianName: 'Mrs. Ngozi Crafts',
        shopName: 'Chidi Heritage Beads',
        bio: 'Authentic handmade Nigerian beads',
        campus: 'UNILAG (Akoka)',
        signupVerificationToken: sellerOtpProof,
      }),
    });
    const sellerRegData: any = await sellerRegRes.json();
    assert.strictEqual(sellerRegRes.status, 201, `Seller registration failed: ${sellerRegData.message}`);
    console.log(`   ✓ Created seller user ID: ${sellerRegData.user.id}`);

    // 5. Verify seller appears in GET /api/admin/users?role=seller, GET /api/sellers, GET /api/admin/metrics
    const adminSellerRes = await fetch(
      `${baseUrl}/api/admin/users?q=${encodeURIComponent(sellerEmail)}&role=seller`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const adminSellerData: any = await adminSellerRes.json();
    assert.strictEqual(adminSellerRes.status, 200);
    const foundSeller = adminSellerData.users.find((u: any) => u.email === sellerEmail);
    assert.ok(foundSeller, 'Seller must appear in GET /api/admin/users?role=seller');
    assert.strictEqual(foundSeller.shopName, 'Chidi Heritage Beads');
    assert.strictEqual(foundSeller.guardianName, 'Mrs. Ngozi Crafts');

    const sellersRes = await fetch(`${baseUrl}/api/sellers`);
    const sellersData: any = await sellersRes.json();
    const publicSeller = sellersData.sellers?.find((s: any) => s.id === sellerRegData.user.id);
    assert.ok(sellersData.status && publicSeller);
    assert.strictEqual(publicSeller.shopName, 'Chidi Heritage Beads');
    assert.strictEqual(publicSeller.email, undefined);

    const metricsRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const metricsData: any = await metricsRes.json();
    assert.strictEqual(metricsRes.status, 200);
    assert.ok(metricsData.metrics.totalUsers >= 3);
    assert.ok(metricsData.latestUsers.some((u: any) => u.email === sellerEmail));
    console.log('   ✓ Seller visible in GET /api/admin/users, GET /api/sellers, and GET /api/admin/metrics');

    // 6. Test GET /api/verification/admin/queue with admin auth
    const queueRes = await fetch(`${baseUrl}/api/verification/admin/queue`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(queueRes.status, 200);
    console.log('   ✓ Admin verification queue returned HTTP 200');

    // Clean up sanity check against raw DB table row count
    const rawCheck = await query('SELECT COUNT(*) as total FROM shopit_users');
    assert.ok(Number(rawCheck.rows[0].total) >= 3);

    console.log('\n=== ALL USER REGISTRATION, DB PERSISTENCE & ADMIN USER LISTING TESTS PASSED (100%) ===');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
