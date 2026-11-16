import './testEnv.js';
import http from 'http';
import assert from 'assert';
import pg from 'pg';

process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin_verify@shopit.ng';
process.env.ADMIN_INITIAL_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'VerifyAdmin123!';

async function runTests() {
  const capturedWarnings: string[] = [];
  const warningListener = (warning: Error) => {
    capturedWarnings.push(`${warning.name}: ${warning.message}`);
  };
  process.on('warning', warningListener);

  const { buildPgPoolConfig, runMigration, verifyDatabaseSchema } = await import('../api/db/postgres.js');

  console.log('1. Testing Neon PostgreSQL URL parsing & zero DEP0169 / SECURITY WARNING on pg.Pool...');
  const sampleNeonUrl =
    'postgresql://neondb_owner:npg_Secret123%40@ep-cool-sunset-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const poolConfig = buildPgPoolConfig(sampleNeonUrl);
  assert.strictEqual(poolConfig.host, 'ep-cool-sunset-123456-pooler.us-east-2.aws.neon.tech');
  assert.strictEqual(poolConfig.port, 5432);
  assert.strictEqual(poolConfig.user, 'neondb_owner');
  assert.strictEqual(poolConfig.password, 'npg_Secret123@');
  assert.strictEqual(poolConfig.database, 'neondb');
  assert.deepStrictEqual(poolConfig.ssl, { rejectUnauthorized: false });

  // Instantiate an actual pg.Pool using discrete config (without connecting over the network)
  const testPool = new pg.Pool(poolConfig);
  await testPool.end();

  // Yield a microtask/tick in case any Node DeprecationWarning emits asynchronously
  await new Promise(resolve => setTimeout(resolve, 50));
  const relevantWarnings = capturedWarnings.filter(
    w => w.includes('DEP0169') || w.includes('SECURITY WARNING') || w.includes('url.parse')
  );
  assert.strictEqual(
    relevantWarnings.length,
    0,
    `Expected zero DEP0169/SECURITY WARNINGs, got: ${relevantWarnings.join(' | ')}`
  );
  console.log('   ✓ Zero DEP0169 and zero pg-connection-string SSL warnings emitted');

  process.off('warning', warningListener);

  console.log('2. Running migration, schema verification & booting HTTP test server...');
  await runMigration();
  const schemaStatus = await verifyDatabaseSchema();
  assert.strictEqual(schemaStatus.ok, true, `Missing core tables: ${schemaStatus.missingTables.join(', ')}`);

  const { app } = await import('../api/index.js');
  const { issueSignupVerificationToken } = await import('../api/db/otpStore.js');

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Health & version checks
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData: any = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthData.status, 'OK');
    assert.strictEqual(healthData.schemaOk, true);
    console.log('   ✓ GET /api/health returns 200 OK with schemaOk=true');

    // Admin setup
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_INITIAL_PASSWORD,
      }),
    });
    const adminLogin: any = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);
    const pwRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.sessionToken}`,
      },
      body: JSON.stringify({ newPassword: 'VerifyAdminNewPass123!' }),
    });
    const pwData: any = await pwRes.json();
    assert.strictEqual(pwRes.status, 200);
    const adminToken = pwData.sessionToken;

    // 3. Test send-otp -> buyer registration -> POST /api/sellers/upgrade -> product CRUD -> vacationMode
    const ts = Date.now();
    const buyerEmail = `buyer_flow_${ts}@test.edu.ng`;
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        purpose: 'signup',
        metadata: { name: 'Temi Buyer' },
      }),
    });
    const sendOtpData: any = await sendOtpRes.json();
    assert.strictEqual(sendOtpRes.status, 200, `send-otp failed: ${sendOtpData.message}`);
    assert.ok(sendOtpData.status);

    const proof = await issueSignupVerificationToken(buyerEmail);
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        password: 'BuyerPass123!',
        name: 'Temi Buyer',
        role: 'buyer',
        age: 20,
        signupVerificationToken: proof,
      }),
    });
    const regData: any = await regRes.json();
    assert.strictEqual(regRes.status, 201, `register failed: ${regData.message}`);
    const userToken = regData.sessionToken;
    const userId = regData.user.id;
    console.log('   ✓ Buyer OTP & registration persisted cleanly');

    // Upgrade authenticated buyer to seller shop
    const upgradeRes = await fetch(`${baseUrl}/api/sellers/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        shopName: 'Temi Crochet Studio',
        bio: 'Handcrafted Lagos crochet bags',
        campus: 'UNILAG (Akoka)',
        location: { state: 'Lagos', city: 'Lagos Mainland', area: 'Akoka' },
        locationArea: 'Akoka',
        under18: false,
      }),
    });
    const upgradeData: any = await upgradeRes.json();
    assert.strictEqual(upgradeRes.status, 200, `seller upgrade failed: ${upgradeData.message}`);
    assert.strictEqual(upgradeData.user.role, 'seller');
    assert.strictEqual(upgradeData.user.sellerProfile.shopName, 'Temi Crochet Studio');
    console.log('   ✓ Authenticated buyer upgraded to seller via POST /api/sellers/upgrade');

    // Verify /auth/me reflects upgraded seller role and sellerProfile immediately
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData: any = await meRes.json();
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meData.user.role, 'seller');
    assert.strictEqual(meData.user.sellerProfile.shopName, 'Temi Crochet Studio');

    // Create, toggle stock, and delete product + toggle vacation mode
    const createProdRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Handmade Raffia Tote',
        description: 'Woven tote bag',
        category: 'bags',
        sellerPrice: 5000,
        stock: 3,
        images: ['/shopit-logo.png'],
      }),
    });
    const createProdData: any = await createProdRes.json();
    assert.strictEqual(createProdRes.status, 201, `create product failed: ${createProdData.message}`);
    const prodId = createProdData.productId;
    assert.ok(prodId && prodId.startsWith('prod_'));

    const putProdRes = await fetch(`${baseUrl}/api/products/${encodeURIComponent(prodId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ stock: 0, isSoldOut: true }),
    });
    assert.strictEqual(putProdRes.status, 200);

    const putSellerRes = await fetch(`${baseUrl}/api/sellers/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ vacationMode: true }),
    });
    assert.strictEqual(putSellerRes.status, 200);

    const sellerCheckRes = await fetch(`${baseUrl}/api/sellers/${encodeURIComponent(userId)}`);
    const sellerCheckData: any = await sellerCheckRes.json();
    assert.strictEqual(sellerCheckData.seller.vacationMode, true);

    const delProdRes = await fetch(`${baseUrl}/api/products/${encodeURIComponent(prodId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(delProdRes.status, 200);
    console.log('   ✓ Product CRUD, stock toggle, and vacation mode persisted in PostgreSQL');

    // Admin visibility check: user & activity must appear cleanly
    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users?q=${encodeURIComponent(buyerEmail)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsersData: any = await adminUsersRes.json();
    assert.strictEqual(adminUsersRes.status, 200);
    assert.strictEqual(adminUsersData.users.length, 1);
    assert.strictEqual(adminUsersData.users[0].shopName, 'Temi Crochet Studio');

    const activityRes = await fetch(
      `${baseUrl}/api/admin/activity?actorEmail=${encodeURIComponent(buyerEmail)}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const activityData: any = await activityRes.json();
    assert.strictEqual(activityRes.status, 200);
    assert.ok(Array.isArray(activityData.events) && activityData.events.length >= 4, 'Expected audit activity events for registration, upgrade, and product actions');
    console.log('   ✓ Admin panel users & activity endpoints show full user + action audit trail');

    console.log('\n=== VERIFY DB & FLOWS PASSED (100%) ===');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
