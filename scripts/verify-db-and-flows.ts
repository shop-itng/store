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

    // 4. Platform Config, Broadcast, Emergency Killswitches, Fee Policy, Wallet Freeze & Dispute Resolution
    const cfgInitRes = await fetch(`${baseUrl}/api/platform/config`);
    const cfgInitData: any = await cfgInitRes.json();
    assert.strictEqual(cfgInitRes.status, 200);
    assert.strictEqual(cfgInitData.status, true);
    assert.strictEqual(cfgInitData.emergencyControls.maintenanceMode, false);

    // Non-admin must receive 403 on PUT /api/admin/broadcast
    const unauthBroadRes = await fetch(`${baseUrl}/api/admin/broadcast`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ isActive: true, title: 'Hacked', message: 'Nope', tone: 'warning' }),
    });
    assert.strictEqual(unauthBroadRes.status, 403);

    // Admin sets live broadcast in PostgreSQL
    const adminBroadRes = await fetch(`${baseUrl}/api/admin/broadcast`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        isActive: true,
        title: 'Campus Safety Notice',
        message: 'Deliveries close at 6 PM today.',
        tone: 'warning',
      }),
    });
    const adminBroadData: any = await adminBroadRes.json();
    assert.strictEqual(adminBroadRes.status, 200);
    assert.strictEqual(adminBroadData.broadcastAnnouncement.isActive, true);

    const cfgAfterBroadRes = await fetch(`${baseUrl}/api/platform/config`);
    const cfgAfterBroadData: any = await cfgAfterBroadRes.json();
    assert.strictEqual(cfgAfterBroadData.broadcastAnnouncement.isActive, true);
    assert.strictEqual(cfgAfterBroadData.broadcastAnnouncement.title, 'Campus Safety Notice');
    console.log('   ✓ Live Broadcast saved to PostgreSQL & served via GET /api/platform/config');

    // Admin enables pauseSellerSignups & pauseNewOrders killswitches
    const ksRes = await fetch(`${baseUrl}/api/admin/emergency-controls`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ pauseSellerSignups: true, pauseNewOrders: true, maintenanceMode: false }),
    });
    assert.strictEqual(ksRes.status, 200);

    // Server-side enforcement: seller signup blocked (503 SELLER_SIGNUPS_PAUSED), buyer signup still allowed
    const pausedSellerEmail = `paused_seller_${ts}@test.edu.ng`;
    const pausedSellerProof = await issueSignupVerificationToken(pausedSellerEmail);
    const blockedSellerRegRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pausedSellerEmail,
        password: 'SellerPass123!',
        name: 'Paused Seller',
        role: 'seller',
        age: 21,
        shopName: 'Blocked Shop',
        campus: 'UNILAG (Akoka)',
        signupVerificationToken: pausedSellerProof,
      }),
    });
    const blockedSellerRegData: any = await blockedSellerRegRes.json();
    assert.strictEqual(blockedSellerRegRes.status, 503);
    assert.strictEqual(blockedSellerRegData.error, 'SELLER_SIGNUPS_PAUSED');

    // Server-side enforcement: buyer-to-seller upgrade also blocked when pauseSellerSignups=true
    const buyerEmail2 = `buyer_ks_${ts}@test.edu.ng`;
    const buyerProof2 = await issueSignupVerificationToken(buyerEmail2);
    const buyerReg2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail2,
        password: 'BuyerPass123!',
        name: 'Allowed Buyer',
        role: 'buyer',
        age: 20,
        signupVerificationToken: buyerProof2,
      }),
    });
    assert.strictEqual(buyerReg2Res.status, 201);
    const buyer2Token = ((await buyerReg2Res.json()) as any).sessionToken;

    const blockedUpgradeRes = await fetch(`${baseUrl}/api/sellers/upgrade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer2Token}`,
      },
      body: JSON.stringify({ shopName: 'Blocked Upgrade Shop', campus: 'UNILAG (Akoka)' }),
    });
    assert.strictEqual(blockedUpgradeRes.status, 503);

    // Server-side enforcement: new order & checkout initialization blocked when pauseNewOrders=true
    const prevPaymentsEnabled = process.env.PAYMENTS_ENABLED;
    process.env.PAYMENTS_ENABLED = 'true';
    try {
      const blockedOrderRes = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyer2Token}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'prod_dummy', title: 'Test', price: 1000, sellerPrice: 800, serviceFee: 200, quantity: 1, sellerId: userId, sellerShopName: 'Temi Crochet Studio' }],
          grandTotal: 1000,
        }),
      });
      const blockedOrderData: any = await blockedOrderRes.json();
      assert.strictEqual(blockedOrderRes.status, 503);
      assert.strictEqual(blockedOrderData.error, 'ORDERS_PAUSED');

      const blockedPayInitRes = await fetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyer2Token}`,
        },
        body: JSON.stringify({
          items: [{ productId: 'prod_dummy', quantity: 1 }],
        }),
      });
      const blockedPayInitData: any = await blockedPayInitRes.json();
      assert.strictEqual(blockedPayInitRes.status, 503);
      assert.strictEqual(blockedPayInitData.error, 'ORDERS_PAUSED');
    } finally {
      if (prevPaymentsEnabled === undefined) delete process.env.PAYMENTS_ENABLED;
      else process.env.PAYMENTS_ENABLED = prevPaymentsEnabled;
    }
    console.log('   ✓ Emergency Killswitches enforced server-side (503 SELLER_SIGNUPS_PAUSED & ORDERS_PAUSED)');

    // Reset emergency controls back to false
    const ksResetRes = await fetch(`${baseUrl}/api/admin/emergency-controls`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ pauseSellerSignups: false, pauseNewOrders: false, maintenanceMode: false }),
    });
    assert.strictEqual(ksResetRes.status, 200);

    // Fee settings persisted in PostgreSQL & honored on product creation
    const feeRes = await fetch(`${baseUrl}/api/admin/fee-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ firstMonthPromoFree: true }),
    });
    assert.strictEqual(feeRes.status, 200);

    const promoProdRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Promo Ceramic Mug',
        description: 'Zero-fee promo mug',
        category: 'home',
        sellerPrice: 4000,
        stock: 5,
        images: ['/shopit-logo.png'],
      }),
    });
    const promoProdData: any = await promoProdRes.json();
    assert.strictEqual(promoProdRes.status, 201);
    const getPromoProdRes = await fetch(`${baseUrl}/api/products/${encodeURIComponent(promoProdData.productId)}`);
    const getPromoProdData: any = await getPromoProdRes.json();
    assert.strictEqual(getPromoProdData.product.serviceFee, 0);
    assert.strictEqual(getPromoProdData.product.displayPrice, 4000);

    // Reset promo fee setting
    await fetch(`${baseUrl}/api/admin/fee-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ firstMonthPromoFree: false }),
    });
    console.log('   ✓ Fee policy persisted in PostgreSQL & applied dynamically during product creation');

    // Wallet freeze persistence
    const freezeRes = await fetch(`${baseUrl}/api/admin/wallets/${encodeURIComponent(userId)}/freeze`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isFrozen: true, reason: 'Verification freeze test' }),
    });
    assert.strictEqual(freezeRes.status, 200);

    const { query: dbQuery } = await import('../api/db/postgres.js');
    const walletRow = await dbQuery('SELECT is_frozen, freeze_reason FROM shopit_wallets WHERE seller_id = $1', [userId]);
    assert.strictEqual(walletRow.rows[0].is_frozen, true);
    assert.strictEqual(walletRow.rows[0].freeze_reason, 'Verification freeze test');

    // Transactional dispute resolution
    const orderIdDisp = `ORD-DISP-${ts}`;
    await dbQuery(
      `INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email, items,
        subtotal, service_fee_total, delivery_total, discount_total, grand_total,
        subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
        payment_method, payment_reference, status, stock_reserved, paid_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'Temi Buyer', $3, $4::jsonb,
        4000, 500, 0, 0, 4500,
        400000, 50000, 0, 0, 450000,
        'flutterwave_card', $5, 'paid', true, NOW(), NOW(), NOW()
      )`,
      [
        orderIdDisp,
        userId,
        buyerEmail,
        JSON.stringify([{ productId: promoProdData.productId, title: 'Promo Ceramic Mug', price: 4500, sellerPrice: 4000, serviceFee: 500, quantity: 1, sellerId: userId, sellerShopName: 'Temi Crochet Studio' }]),
        `REF-DISP-${ts}`,
      ]
    );
    await dbQuery(
      `UPDATE shopit_wallets SET pending_balance = 4000, pending_balance_kobo = 400000 WHERE seller_id = $1`,
      [userId]
    );
    const dispOpenRes = await fetch(`${baseUrl}/api/disputes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ orderId: orderIdDisp, reason: 'Item not delivered', description: 'Verification dispute test' }),
    });
    const dispOpenData: any = await dispOpenRes.json();
    assert.strictEqual(dispOpenRes.status, 201);

    const dispResolveRes = await fetch(`${baseUrl}/api/disputes/${encodeURIComponent(dispOpenData.disputeId)}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ resolution: 'release_seller', notes: 'Verified delivery proof' }),
    });
    const dispResolveData: any = await dispResolveRes.json();
    assert.strictEqual(dispResolveRes.status, 200);
    assert.strictEqual(dispResolveData.disputeStatus, 'resolved_released');
    assert.strictEqual(dispResolveData.orderStatus, 'completed');

    const walletAfterDisp = await dbQuery('SELECT available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [userId]);
    assert.ok(parseInt(walletAfterDisp.rows[0].available_balance_kobo, 10) >= 450000);
    console.log('   ✓ Wallet freeze & atomic escrow dispute resolution persisted in PostgreSQL');

    // Deactivate test broadcast so state stays clean
    await fetch(`${baseUrl}/api/admin/broadcast`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false, title: '', message: '' }),
    });

    console.log('\n=== VERIFY DB & FLOWS PASSED (100%) ===');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
