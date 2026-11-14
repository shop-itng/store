import http from 'http';
import crypto from 'crypto';
import assert from 'assert';
import { app } from '../api/index.js';
import { query, hashPassword, runMigration } from '../api/db/postgres.js';
import { createSession } from '../api/auth/sessionStore.js';
import { issueSignupVerificationToken } from '../api/db/otpStore.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  await runMigration();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Seed an admin account directly in local DB for authorization tests
    const adminId = 'admin_test_super';
    const adminEmail = 'admin_test@shopit.ng';
    await query(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Test Superadmin', $3, 'admin', 'superadmin', true, 25)
       ON CONFLICT (id) DO NOTHING`,
      [adminId, adminEmail, hashPassword('AdminStrongPass123!')]
    );
    const adminSess = await createSession({
      userId: adminId,
      email: adminEmail,
      name: 'Test Superadmin',
      role: 'admin',
      subRole: 'superadmin',
      tokenVersion: 1,
    });

    // C11: Registration enforcement (OTP token, password >= 8, minor consent)
    await test('C11: POST /api/auth/register rejects without verified signupVerificationToken (403)', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nootp@shopit.ng',
          password: 'ValidPassword123',
          name: 'No OTP Buyer',
          role: 'buyer',
          age: 20,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    await test('C11: POST /api/auth/register rejects password shorter than 8 chars (400)', async () => {
      const token = await issueSignupVerificationToken('shortpass@shopit.ng');
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'shortpass@shopit.ng',
          password: '1234567',
          name: 'Short Pass',
          role: 'buyer',
          age: 20,
          signupVerificationToken: token,
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    await test('C11: POST /api/auth/register rejects minor (<18) without guardian consent/name (400)', async () => {
      const token = await issueSignupVerificationToken('minor@shopit.ng');
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'minor@shopit.ng',
          password: 'ValidPassword123',
          name: 'Minor User',
          role: 'buyer',
          age: 14,
          signupVerificationToken: token,
        }),
      });
      assert.strictEqual(res.status, 400);
    });

    // Register real Buyer + Seller
    let buyerToken = '';
    let buyerId = '';
    const buyerEmail = `buyer_${Date.now()}@shopit.ng`;
    await test('C11: POST /api/auth/register succeeds with verified OTP token & valid age', async () => {
      const token = await issueSignupVerificationToken(buyerEmail);
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: buyerEmail,
          password: 'BuyerPass1234',
          name: 'Test Buyer',
          role: 'buyer',
          age: 21,
          signupVerificationToken: token,
        }),
      });
      assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
      const data: any = await res.json();
      assert.ok(data.sessionToken);
      assert.ok(data.user?.id);
      assert.strictEqual(data.user?.subRole, undefined); // No superadmin default!
      buyerToken = data.sessionToken;
      buyerId = data.user.id;
    });

    let sellerToken = '';
    let sellerId = '';
    const sellerEmail = `seller_${Date.now()}@shopit.ng`;
    await test('C11: Seller registration succeeds with guardian consent & valid token', async () => {
      const token = await issueSignupVerificationToken(sellerEmail);
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sellerEmail,
          password: 'SellerPass1234',
          name: 'Young Maker',
          role: 'seller',
          age: 16,
          hasGuardianConsent: true,
          guardianName: 'Parent Maker',
          shopName: 'Maker Beads',
          bio: 'Handmade beaded jewelry',
          campus: 'UNILAG (Akoka)',
          signupVerificationToken: token,
        }),
      });
      assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
      const data: any = await res.json();
      assert.ok(data.sessionToken);
      sellerToken = data.sessionToken;
      sellerId = data.user.id;
    });

    // C1: x-user-id header bypass
    await test('C1: x-user-id with admin email returns 401 on /api/auth/me & /api/admin/users', async () => {
      const r1 = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'x-user-id': adminEmail },
      });
      assert.strictEqual(r1.status, 401);
      const r2 = await fetch(`${baseUrl}/api/admin/users`, {
        headers: { 'x-user-id': adminId },
      });
      assert.strictEqual(r2.status, 401);
    });

    // C2: Admin & sensitive routes auth checks
    await test('C2: Unauthenticated requests to admin/verification/reports/cron return 401', async () => {
      const targets = [
        ['GET', '/api/admin/users'],
        ['GET', '/api/admin/metrics'],
        ['GET', '/api/admin/export-data'],
        ['GET', '/api/reports'],
        ['GET', '/api/verification/admin/queue'],
        ['GET', `/api/verification/status/${sellerId}`],
        ['POST', '/api/verification/submit'],
        ['POST', '/api/escrow/auto-release'],
        ['POST', '/api/cron/escrow'],
        ['POST', '/api/cron/expire-orders'],
        ['POST', '/api/email/send'],
      ];
      for (const [method, path] of targets) {
        const res = await fetch(`${baseUrl}${path}`, { method });
        assert.strictEqual(res.status, 401, `${method} ${path} expected 401, got ${res.status}`);
      }
    });

    await test('C2: Buyer session receives 403 Forbidden on admin & moderator routes', async () => {
      const targets = [
        ['GET', '/api/admin/users'],
        ['GET', '/api/admin/metrics'],
        ['GET', '/api/admin/export-data'],
        ['GET', '/api/reports'],
        ['GET', '/api/verification/admin/queue'],
        ['POST', '/api/verification/admin/review'],
        ['POST', '/api/email/send'],
        ['POST', '/api/escrow/auto-release'],
      ];
      for (const [method, path] of targets) {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: { Authorization: `Bearer ${buyerToken}` },
        });
        assert.strictEqual(res.status, 403, `Buyer ${method} ${path} expected 403, got ${res.status}`);
      }
    });

    await test('C2: /api/auth/me?email= ignores query param and returns only caller session', async () => {
      const unauth = await fetch(`${baseUrl}/api/auth/me?email=${encodeURIComponent(adminEmail)}`);
      assert.strictEqual(unauth.status, 401);

      const asBuyer = await fetch(`${baseUrl}/api/auth/me?email=${encodeURIComponent(adminEmail)}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(asBuyer.status, 200);
      const data: any = await asBuyer.json();
      assert.strictEqual(data.user.email, buyerEmail);
    });

    // C11: Uniform login/reset-password errors & session revocation
    await test('C11: Login gives identical 401 Invalid email or password. for missing user vs wrong password', async () => {
      const rMissing = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'doesnotexist999@shopit.ng', password: 'WrongPassword1' }),
      });
      const rWrong = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buyerEmail, password: 'WrongPassword1' }),
      });
      assert.strictEqual(rMissing.status, 401);
      assert.strictEqual(rWrong.status, 401);
      const d1: any = await rMissing.json();
      const d2: any = await rWrong.json();
      assert.strictEqual(d1.message, d2.message);
    });

    await test('C11: password_reset send-otp gives identical 200 response for registered vs unregistered email', async () => {
      const r1 = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unregistered_abc_123@shopit.ng', purpose: 'password_reset' }),
      });
      const r2 = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buyerEmail, purpose: 'password_reset' }),
      });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
      const d1: any = await r1.json();
      const d2: any = await r2.json();
      assert.strictEqual(d1.message, d2.message);
    });

    await test('C11: POST /api/auth/change-password revokes old session token', async () => {
      const chRes = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${buyerToken}`,
        },
        body: JSON.stringify({ currentPassword: 'BuyerPass1234', newPassword: 'BuyerPassNew1234' }),
      });
      assert.strictEqual(chRes.status, 200);
      const chData: any = await chRes.json();
      assert.ok(chData.sessionToken && chData.sessionToken !== buyerToken);

      const oldTokenCheck = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(oldTokenCheck.status, 401);
      buyerToken = chData.sessionToken;
    });

    // C10: CORS check
    await test('C10: CORS blocks arbitrary *.vercel.app origin', async () => {
      const getRes = await fetch(`${baseUrl}/api/products`, {
        headers: { Origin: 'https://evil-shopit-clone.vercel.app' },
      });
      assert.strictEqual(getRes.headers.get('access-control-allow-origin'), null);

      const optRes = await fetch(`${baseUrl}/api/products`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil-shopit-clone.vercel.app' },
      });
      assert.strictEqual(optRes.status, 403);

      const postRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil-shopit-clone.vercel.app' },
        body: JSON.stringify({ email: buyerEmail, password: 'BuyerPassNew1234' }),
      });
      assert.strictEqual(postRes.status, 403);
    });

    // Phase 0 safety gate + C3 + C6 + C7
    await test('Phase 0: PAYMENTS_ENABLED=false returns 503 on payment/wallet endpoints', async () => {
      process.env.PAYMENTS_ENABLED = 'false';
      process.env.PAYOUTS_ENABLED = 'false';
      const r1 = await fetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ items: [{ productId: 'x', quantity: 1 }] }),
      });
      const r2 = await fetch(`${baseUrl}/api/wallet`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      const r3 = await fetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 1000 }),
      });
      assert.strictEqual(r1.status, 503);
      assert.strictEqual(r2.status, 503);
      assert.strictEqual(r3.status, 503);
    });

    await test('C3: POST /api/orders client creation disabled even when PAYMENTS_ENABLED=true (403)', async () => {
      process.env.PAYMENTS_ENABLED = 'true';
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ grandTotal: 1, items: [] }),
      });
      assert.strictEqual(res.status, 403);
    });

    await test('C6: Forged or unconfigured webhook never returns 200 or marks paid', async () => {
      process.env.PAYMENTS_ENABLED = 'true';
      const res = await fetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': 'deadbeef' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: 'fake_ref', amount: 100 } }),
      });
      assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    });

    // C8: Order visibility & state machine
    await test('C8: Seller GET /api/orders omits handshakeOtp; buyer cannot set packed; seller cannot mark completed without OTP', async () => {
      const ordId = `ORD-C8-${Date.now()}`;
      await query(
        `INSERT INTO shopit_orders (
           id, buyer_id, buyer_name, buyer_email, items,
           subtotal, subtotal_kobo, service_fee_total, service_fee_kobo,
           delivery_total, delivery_fee_kobo, discount_total, discount_total_kobo,
           grand_total, grand_total_kobo, status, payment_method, payment_reference, handshake_otp
         ) VALUES (
           $1, $2, 'Test Buyer', $3, $4,
           2000, 200000, 500, 50000,
           0, 0, 0, 0,
           2500, 250000, 'paid', 'card', $5, '4829'
         )`,
        [
          ordId,
          buyerId,
          buyerEmail,
          JSON.stringify([{ productId: 'p_c8', title: 'Item', sellerId, sellerPrice: 2000, serviceFee: 500, quantity: 1 }]),
          `ref_c8_${Date.now()}`,
        ]
      );

      // Seller GET /api/orders hides handshakeOtp
      const sellOrdersRes = await fetch(`${baseUrl}/api/orders`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(sellOrdersRes.status, 200);
      const sellOrdersData: any = await sellOrdersRes.json();
      const target = sellOrdersData.orders.find((o: any) => o.id === ordId);
      assert.ok(target, 'Seller should see their order');
      assert.strictEqual(target.handshakeOtp, undefined);

      // Buyer cannot set status to packed (403)
      const buyerPackRes = await fetch(`${baseUrl}/api/orders/${ordId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ status: 'packed' }),
      });
      assert.strictEqual(buyerPackRes.status, 403);

      // Seller cannot jump directly to completed without shipped + buyer/OTP (400 or 403)
      const sellerCompRes = await fetch(`${baseUrl}/api/orders/${ordId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'completed' }),
      });
      assert.ok([400, 403].includes(sellerCompRes.status));
    });

    // C7: Cross-seller IDOR, fail-closed unconfigured gateway, and 123456 OTP rejection
    await test('C7: Withdrawal blocks cross-seller IDOR (403), fails closed without gateway key (503), and rejects 123456 OTP (400)', async () => {
      process.env.PAYMENTS_ENABLED = 'true';
      process.env.PAYOUTS_ENABLED = 'true';
      const idorRes = await fetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 1500, sellerId: 'another_seller_123', payoutAccountId: 'pa_1', otpCode: '123456' }),
      });
      assert.strictEqual(idorRes.status, 403);

      const failClosedRes = await fetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 1500, payoutAccountId: 'nonexistent', otpCode: '123456' }),
      });
      assert.strictEqual(failClosedRes.status, 503);

      const otpRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sellerEmail, purpose: 'withdrawal', code: '123456' }),
      });
      assert.strictEqual(otpRes.status, 400);
    });

    // Cron secret guard check
    await test('C8: /api/cron/escrow & /api/cron/expire-orders accept valid CRON_SECRET Bearer', async () => {
      process.env.CRON_SECRET = 'test_cron_secret_12345';
      const r1 = await fetch(`${baseUrl}/api/cron/escrow`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const r2 = await fetch(`${baseUrl}/api/cron/expire-orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      assert.strictEqual(r1.status, 200);
      assert.strictEqual(r2.status, 200);
    });

    // C2: Admin token accesses /api/admin/metrics
    await test('C2: Valid Superadmin session accesses /api/admin/metrics (200)', async () => {
      const res = await fetch(`${baseUrl}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${adminSess.token}` },
      });
      assert.strictEqual(res.status, 200);
    });

    console.log(`\n=== PHASE 1 SECURITY TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 1 test suite failed:', err);
  process.exit(1);
});
