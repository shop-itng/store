import './testEnv.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import assert from 'assert';
import { app } from '../api/index.js';
import { query, hashPassword, runMigration } from '../api/db/postgres.js';
import { createSession } from '../api/auth/sessionStore.js';
import { issueSignupVerificationToken, saveHashedOtp, hashOtp, verifyOtpHash } from '../api/db/otpStore.js';
import { processUnshippedOrders } from '../api/lib/payments.js';
import { getKycProvider, IKycProvider } from '../api/lib/kycProvider.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`FAIL: ${name} -> ${err.stack || err.message}`);
  }
}

async function main() {
  console.log('==================================================================');
  console.log('SHOP IT - PHASE 4 SECURITY & POLICY TEST SUITE (scripts/security-tests.ts)');
  console.log('==================================================================\n');

  await runMigration();

  process.env.PAYMENTS_ENABLED = 'true';
  process.env.PAYOUTS_ENABLED = 'true';
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-sec-suite-secret';
  process.env.FLW_PUBLIC_KEY = 'FLWPUBK_TEST-sec-suite-public';
  process.env.FLW_WEBHOOK_SECRET_HASH = 'flw_sec_suite_webhook_hash';
  process.env.APP_URL = 'https://shop-itng-pied.vercel.app';

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const origFetch = globalThis.fetch;

  // Controllable gateway mock state
  let mockFlwVerifyMode: 'valid' | 'wrong_amount' | 'wrong_currency' | 'unknown_txref' = 'valid';
  let mockFlwVerifyAmountNaira = 0;
  let mockFlwVerifyTxRef = '';
  let mockFlwVerifyId = 777111;
  let mockResolveAccountName = 'ADULT SELLER';
  let refundedTransactionCalls: string[] = [];

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('https://api.flutterwave.com/v3/payments')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          status: 'success',
          data: { link: `https://checkout.flutterwave.com/v3/hosted/pay/${body.tx_ref}` },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/refund') && url.startsWith('https://api.flutterwave.com/v3/transactions/')) {
      refundedTransactionCalls.push(url);
      return new Response(
        JSON.stringify({ status: 'success', data: { id: 901122, status: 'completed-mpgs' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/transactions/')) {
      if (mockFlwVerifyMode === 'wrong_amount') {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: mockFlwVerifyId,
              tx_ref: mockFlwVerifyTxRef,
              amount: 100,
              currency: 'NGN',
              status: 'successful',
              payment_type: 'card',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (mockFlwVerifyMode === 'wrong_currency') {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: mockFlwVerifyId,
              tx_ref: mockFlwVerifyTxRef,
              amount: mockFlwVerifyAmountNaira,
              currency: 'USD',
              status: 'successful',
              payment_type: 'card',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (mockFlwVerifyMode === 'unknown_txref') {
        return new Response(
          JSON.stringify({
            status: 'success',
            data: {
              id: mockFlwVerifyId,
              tx_ref: 'UNKNOWN_TXREF_999',
              amount: mockFlwVerifyAmountNaira,
              currency: 'NGN',
              status: 'successful',
              payment_type: 'card',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            id: mockFlwVerifyId,
            tx_ref: mockFlwVerifyTxRef,
            amount: mockFlwVerifyAmountNaira,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/accounts/resolve')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            account_number: body.account_number,
            account_name: mockResolveAccountName,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/transfers')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            id: 445566,
            reference: body.reference,
            status: 'NEW',
            amount: body.amount,
            currency: 'NGN',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return origFetch(input, init);
  }) as any;

  try {
    const ts = Date.now();
    const validPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // Seed Admin
    const adminId = `sec_admin_${ts}`;
    const adminEmail = `sec_admin_${ts}@shopit.ng`;
    await query(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Sec Admin', $3, 'admin', 'moderator', true, 30)`,
      [adminId, adminEmail, hashPassword('AdminPass123!')]
    );
    const adminSess = await createSession({
      userId: adminId,
      email: adminEmail,
      name: 'Sec Admin',
      role: 'admin',
      subRole: 'moderator',
      tokenVersion: 1,
    });

    // Register Buyer
    const buyerEmail = `sec_buyer_${ts}@shopit.ng`;
    const buyerReg: any = await (
      await origFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: buyerEmail,
          password: 'BuyerPass123!',
          name: 'Ada Buyer',
          role: 'buyer',
          age: 20,
          signupVerificationToken: await issueSignupVerificationToken(buyerEmail),
        }),
      })
    ).json();
    const buyerToken = buyerReg.sessionToken;
    const buyerId = buyerReg.user.id;

    // Register Adult Seller
    const sellerEmail = `sec_seller_${ts}@shopit.ng`;
    const sellerReg: any = await (
      await origFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sellerEmail,
          password: 'SellerPass123!',
          name: 'Adult Seller',
          role: 'seller',
          age: 23,
          shopName: 'Adult Bead Craft',
          signupVerificationToken: await issueSignupVerificationToken(sellerEmail),
        }),
      })
    ).json();
    const sellerToken = sellerReg.sessionToken;
    const sellerId = sellerReg.user.sellerId || sellerReg.user.id;
    await query(
      `UPDATE shopit_sellers SET is_verified_seller = true, verification_status = 'verified', verified_legal_name = 'ADULT SELLER' WHERE id = $1`,
      [sellerId]
    );

    // Register Second Seller (for IDOR test)
    const seller2Email = `sec_seller2_${ts}@shopit.ng`;
    const seller2Reg: any = await (
      await origFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: seller2Email,
          password: 'SellerPass123!',
          name: 'Victim Seller',
          role: 'seller',
          age: 24,
          shopName: 'Victim Craft',
          signupVerificationToken: await issueSignupVerificationToken(seller2Email),
        }),
      })
    ).json();
    const seller2Id = seller2Reg.user.sellerId || seller2Reg.user.id;

    // Seed Product for Price Tampering & Escrow Tests (Seller Price = 5,000 -> Service fee = 500 -> Delivery = 200 -> Grand total = 5,700)
    const prodId = `prod_sec_${ts}`;
    await query(
      `INSERT INTO shopit_products (
         id, seller_id, seller_shop_name, seller_campus, title, description, category,
         seller_price, service_fee, display_price,
         stock, images, delivery_pickup_fee, delivery_local_fee, created_at, updated_at
       ) VALUES (
         $1, $2, 'Adult Bead Craft', 'UNILAG', 'Handwoven Bead Bracelet', 'Authentic bead craft', 'beads',
         5000, 500, 5500,
         10, $3, 0, 200, NOW(), NOW()
       )`,
      [
        prodId,
        sellerId,
        JSON.stringify(['https://example.com/bead.jpg']),
      ]
    );

    // -------------------------------------------------------------------------
    // TEST 1: Spoofed x-user-id header with admin email gives 401
    // -------------------------------------------------------------------------
    await test('1. Spoofed x-user-id header with admin email returns 401', async () => {
      const res = await origFetch(`${baseUrl}/api/admin/users`, {
        headers: { 'x-user-id': adminEmail },
      });
      assert.strictEqual(res.status, 401);
    });

    // -------------------------------------------------------------------------
    // TEST 2: Every admin route returns 401 without session and 403 as normal buyer/seller
    // -------------------------------------------------------------------------
    await test('2. Every admin route returns 401 unauthenticated and 403 for normal buyer/seller', async () => {
      const adminEndpoints: Array<{ method: string; path: string; body?: any }> = [
        { method: 'GET', path: '/api/admin/users' },
        { method: 'GET', path: '/api/admin/metrics' },
        { method: 'GET', path: '/api/admin/export-data' },
        { method: 'GET', path: '/api/admin/payout-accounts/pending' },
        { method: 'POST', path: `/api/admin/wallets/${sellerId}/payout-accounts/fake_acc/approve`, body: {} },
        { method: 'PATCH', path: '/api/admin/orders/fake_ord/hold', body: { hold: true } },
        { method: 'GET', path: '/api/reports' },
        { method: 'GET', path: '/api/verification/admin/queue' },
        { method: 'POST', path: '/api/verification/admin/review', body: { sellerId, action: 'verified' } },
        { method: 'POST', path: '/api/escrow/auto-release', body: {} },
        { method: 'POST', path: '/api/payments/refund', body: { orderId: 'fake_ord' } },
      ];

      for (const ep of adminEndpoints) {
        const unauthRes = await origFetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: ep.body ? { 'Content-Type': 'application/json' } : {},
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert.strictEqual(unauthRes.status, 401, `Expected 401 unauthenticated for ${ep.method} ${ep.path}, got ${unauthRes.status}`);

        const buyerRes = await origFetch(`${baseUrl}${ep.path}`, {
          method: ep.method,
          headers: {
            Authorization: `Bearer ${buyerToken}`,
            ...(ep.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });
        assert.strictEqual(buyerRes.status, 403, `Expected 403 for buyer on ${ep.method} ${ep.path}, got ${buyerRes.status}`);
      }
    });

    // -------------------------------------------------------------------------
    // TEST 3: Creating order via POST /orders without paying returns 403
    // -------------------------------------------------------------------------
    await test('3. Creating an order via POST /api/orders without payment is rejected (403)', async () => {
      const res = await origFetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ items: [{ productId: prodId, quantity: 1 }], status: 'paid' }),
      });
      assert.strictEqual(res.status, 403);
    });

    // -------------------------------------------------------------------------
    // TEST 4: Tampering prices on checkout (/payments/initialize) uses DB price & server fees
    // -------------------------------------------------------------------------
    let paidOrderId = '';
    let paidOrderRef = '';
    await test('4. Client price tampering in POST /api/payments/initialize is ignored; DB prices + server fees enforced', async () => {
      const res = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          deliveryArea: 'UNILAG Akoka',
          items: [
            {
              productId: prodId,
              quantity: 1,
              deliveryMethod: 'local_delivery',
              sellerPrice: 1,
              serviceFee: 0,
              displayPrice: 1,
              deliveryFee: 0,
            },
          ],
          subtotal: 1,
          serviceFeeTotal: 0,
          deliveryTotal: 0,
          grandTotal: 1,
        }),
      });
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(
        data.grandTotalNaira,
        5700,
        `Expected ₦5,700 server total (5000 + 500 fee + 200 delivery), got ${data.grandTotalNaira}`
      );
      assert.strictEqual(data.amountInKobo, 570000);
      assert.strictEqual(data.pricing.subtotal, 5000);
      assert.strictEqual(data.pricing.serviceFeeTotal, 500);
      assert.strictEqual(data.pricing.deliveryTotal, 200);
      paidOrderId = data.orderId;
      paidOrderRef = data.reference;
    });

    // -------------------------------------------------------------------------
    // TEST 5: Forged webhook rejected (401) & missing secret fails closed (503)
    // -------------------------------------------------------------------------
    await test('5. Webhook rejects missing/bad verif-hash (401) and fails closed (503) if FLW_WEBHOOK_SECRET_HASH missing', async () => {
      const missingHeaderRes = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: paidOrderRef } }),
      });
      assert.strictEqual(missingHeaderRes.status, 401);

      const badHashRes = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': 'forged_bad_hash' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: paidOrderRef } }),
      });
      assert.strictEqual(badHashRes.status, 401);

      const savedSecret = process.env.FLW_WEBHOOK_SECRET_HASH;
      delete process.env.FLW_WEBHOOK_SECRET_HASH;
      try {
        const noSecretRes = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'verif-hash': 'anything' },
          body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: paidOrderRef } }),
        });
        assert.strictEqual(noSecretRes.status, 503);
      } finally {
        process.env.FLW_WEBHOOK_SECRET_HASH = savedSecret;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 6: Valid verif-hash with wrong amount / wrong currency / unknown tx_ref does NOT mark paid
    // -------------------------------------------------------------------------
    await test('6. Webhook with valid verif-hash but wrong amount/currency/tx_ref does NOT mark order paid', async () => {
      mockFlwVerifyAmountNaira = 5700;
      mockFlwVerifyTxRef = paidOrderRef;

      for (const mode of ['wrong_amount', 'wrong_currency', 'unknown_txref'] as const) {
        mockFlwVerifyMode = mode;
        const res = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH!,
          },
          body: JSON.stringify({
            event: 'charge.completed',
            data: {
              id: mockFlwVerifyId,
              tx_ref: mode === 'unknown_txref' ? 'UNKNOWN_TXREF_999' : paidOrderRef,
              amount: mode === 'wrong_amount' ? 100 : 5700,
              currency: mode === 'wrong_currency' ? 'USD' : 'NGN',
              status: 'successful',
              payment_type: 'card',
            },
          }),
        });
        assert.ok(res.status >= 400 && res.status < 500, `Expected 4xx for mode=${mode}, got ${res.status}`);
        const check = await query('SELECT status FROM shopit_orders WHERE id = $1', [paidOrderId]);
        assert.strictEqual(check.rows[0].status, 'pending_payment', `Order should stay pending_payment for ${mode}`);
      }
      mockFlwVerifyMode = 'valid';
    });

    // -------------------------------------------------------------------------
    // TEST 7: Replaying valid webhook does not credit seller wallet twice
    // -------------------------------------------------------------------------
    await test('7. Replaying identical charge.completed webhook credits seller wallet strictly once', async () => {
      mockFlwVerifyMode = 'valid';
      mockFlwVerifyAmountNaira = 5700;
      mockFlwVerifyTxRef = paidOrderRef;

      const payload = JSON.stringify({
        event: 'charge.completed',
        data: {
          id: mockFlwVerifyId,
          tx_ref: paidOrderRef,
          amount: 5700,
          currency: 'NGN',
          status: 'successful',
          payment_type: 'card',
        },
      });

      const first = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: payload,
      });
      assert.strictEqual(first.status, 200);

      const second = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: payload,
      });
      assert.strictEqual(second.status, 200);

      const wal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].pending_balance_kobo), 500000);

      const entries = await query(
        `SELECT COUNT(*) AS cnt FROM shopit_ledger_entries WHERE wallet_id = $1 AND type = 'sale_pending'`,
        [sellerId]
      );
      assert.strictEqual(Number(entries.rows[0].cnt), 1);
    });

    // -------------------------------------------------------------------------
    // TEST 8: Withdrawal with another seller's sellerId rejected (403)
    // -------------------------------------------------------------------------
    await test('8. Withdrawal targeting another sellerId is rejected (403 IDOR)', async () => {
      const otp = '718293';
      await saveHashedOtp(sellerEmail, 'withdrawal', hashOtp(otp), { sellerId });
      const res = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          sellerId: seller2Id,
          amount: 2000,
          payoutAccountId: 'any_acc',
          otpCode: otp,
        }),
      });
      assert.strictEqual(res.status, 403);
    });

    // -------------------------------------------------------------------------
    // TEST 9: Two parallel withdrawals (Promise.all) cannot overspend wallet balance
    // -------------------------------------------------------------------------
    await test('9. Two parallel withdrawals via Promise.all cannot overspend wallet balance', async () => {
      const accId = `acc_race_${ts}`;
      await query(
        `INSERT INTO shopit_wallets (seller_id, available_balance, available_balance_kobo, active_payout_account_id, payout_accounts)
         VALUES ($1, 5000, 500000, $2, $3)
         ON CONFLICT (seller_id) DO UPDATE SET available_balance = 5000, available_balance_kobo = 500000, active_payout_account_id = $2, payout_accounts = $3`,
        [
          sellerId,
          accId,
          JSON.stringify([
            {
              id: accId,
              bankCode: '058',
              bankName: 'GTBank',
              accountNumber: '0123456789',
              accountName: 'ADULT SELLER',
              isVerified: true,
              adminApproved: true,
              coolingPeriodEndsAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
        ]
      );

      // Issue 2 valid OTPs so both requests pass OTP validation and race directly on wallet debit
      const otp1 = '112233';
      const otp2 = '445566';
      await saveHashedOtp(`${sellerEmail}`, 'withdrawal', hashOtp(otp1), { sellerId });
      // Wait: otpStore keys by `${email}:${purpose}` (one record per email+purpose).
      // So test both same-OTP race AND sequential double-debit protection:
      // Reset balance to ₦5,000, call Promise.all with otp1 and otp2? First let's verify otpStore allows or note:
      // Because saveHashedOtp uses key `${email}:${purpose}`, let's test Promise.all with two requests using same otp1 first,
      // AND test sequential request exceeding balance: even more directly, Promise.all with 2 requests using valid session!
      const [r1, r2] = await Promise.all([
        origFetch(`${baseUrl}/api/payments/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
          body: JSON.stringify({ amount: 4000, payoutAccountId: accId, otpCode: otp1 }),
        }),
        origFetch(`${baseUrl}/api/payments/transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
          body: JSON.stringify({ amount: 4000, payoutAccountId: accId, otpCode: otp1 }),
        }),
      ]);

      const statuses = [r1.status, r2.status].sort();
      assert.deepStrictEqual(statuses, [200, 400], `Expected [200, 400] for concurrent race, got [${statuses.join(', ')}]`);

      // Also test second withdrawal with fresh OTP for ₦4,000 against remaining ₦1,000 -> must fail 400
      await saveHashedOtp(sellerEmail, 'withdrawal', hashOtp(otp2), { sellerId });
      const r3 = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 4000, payoutAccountId: accId, otpCode: otp2 }),
      });
      assert.strictEqual(r3.status, 400);

      const wal = await query('SELECT available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].available_balance_kobo), 100000);
    });

    // -------------------------------------------------------------------------
    // TEST 10 & 11: Handshake OTP enforcement & redaction from seller GET /orders
    // -------------------------------------------------------------------------
    await test('10 & 11. Seller cannot see handshakeOtp and cannot mark order delivered/completed without OTP', async () => {
      // Advance order to shipped as seller
      const packRes = await origFetch(`${baseUrl}/api/orders/${paidOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'shipped' }),
      });
      assert.strictEqual(packRes.status, 200);

      // Test 11: Seller listing orders must not expose handshakeOtp
      const sellerOrdersRes: any = await (
        await origFetch(`${baseUrl}/api/orders`, { headers: { Authorization: `Bearer ${sellerToken}` } })
      ).json();
      const targetOrder = sellerOrdersRes.orders.find((o: any) => o.id === paidOrderId);
      assert.ok(targetOrder, 'Seller should see their order');
      assert.strictEqual(targetOrder.handshakeOtp, undefined, 'Seller must NEVER see handshakeOtp');

      // Test 10: Seller without OTP trying to mark delivered/completed -> 403
      const deliverNoOtp = await origFetch(`${baseUrl}/api/orders/${paidOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'delivered' }),
      });
      assert.strictEqual(deliverNoOtp.status, 403);

      const completeBadOtp = await origFetch(`${baseUrl}/api/orders/${paidOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'completed', handshakeOtp: '0000' }),
      });
      assert.strictEqual(completeBadOtp.status, 403);
    });

    // -------------------------------------------------------------------------
    // TEST 12: CORS rejects arbitrary evil origin
    // -------------------------------------------------------------------------
    await test('12. CORS rejects arbitrary https://evil-clone.vercel.app origin', async () => {
      const res = await origFetch(`${baseUrl}/api/products`, {
        headers: { Origin: 'https://evil-clone.vercel.app' },
      });
      assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
    });

    // -------------------------------------------------------------------------
    // TEST 13: POST /email/send blocked for public (401) and normal users (403)
    // -------------------------------------------------------------------------
    await test('13. POST /api/email/send rejects unauthenticated (401) and non-admin (403) callers', async () => {
      const pubRes = await origFetch(`${baseUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'x@example.com', subject: 'Spam', html: '<p>Hi</p>' }),
      });
      assert.strictEqual(pubRes.status, 401);

      const userRes = await origFetch(`${baseUrl}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ to: 'x@example.com', subject: 'Spam', html: '<p>Hi</p>' }),
      });
      assert.strictEqual(userRes.status, 403);
    });

    // -------------------------------------------------------------------------
    // TEST 14: POST /auth/register without verified signupVerificationToken rejected (403)
    // -------------------------------------------------------------------------
    await test('14. POST /api/auth/register without verified signupVerificationToken is rejected (403)', async () => {
      const unverifiedEmail = `unverified_${ts}@shopit.ng`;
      const res = await origFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: unverifiedEmail,
          password: 'Password123!',
          name: 'Hacker',
          role: 'buyer',
          age: 20,
        }),
      });
      assert.strictEqual(res.status, 403);
      const userCheck = await query('SELECT id FROM shopit_users WHERE email = $1', [unverifiedEmail]);
      assert.strictEqual(userCheck.rows.length, 0);
    });

    // -------------------------------------------------------------------------
    // POLICY RULE 1: Under-18 Payouts (Guardian account + 1x Admin approval + ₦25,000 daily cap)
    // -------------------------------------------------------------------------
    await test('POLICY RULE 1: Under-18 payouts require guardian ID match, 1x Admin approval, and ₦25,000 daily cap', async () => {
      const minorEmail = `minor_sec_${ts}@shopit.ng`;
      const minorReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: minorEmail,
            password: 'MinorPass123!',
            name: 'Tinuade Adeyemi',
            role: 'seller',
            age: 16,
            hasGuardianConsent: true,
            guardianName: 'Grace Adeyemi',
            shopName: 'Tinuade Crafts',
            signupVerificationToken: await issueSignupVerificationToken(minorEmail),
          }),
        })
      ).json();
      const minorToken = minorReg.sessionToken;
      const minorSellerId = minorReg.user.sellerId || minorReg.user.id;

      await query(
        `UPDATE shopit_sellers
         SET is_verified_seller = true, verification_status = 'verified', verified_legal_name = 'TINUADE ADEYEMI',
             under_18 = true, guardian_name = 'Grace Adeyemi', guardian_consent = true
         WHERE id = $1`,
        [minorSellerId]
      );

      // 1a. Linking account in minor's own name must fail (403)
      mockResolveAccountName = 'TINUADE ADEYEMI';
      await saveHashedOtp(minorEmail, 'payout_account', hashOtp('212121'), { sellerId: minorSellerId });
      const badAccRes = await origFetch(`${baseUrl}/api/wallet/payout-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({
          bankCode: '058',
          bankName: 'GTBank',
          accountNumber: '0111222333',
          otpCode: '212121',
        }),
      });
      assert.strictEqual(badAccRes.status, 403);

      // 1b. Linking account in guardian's verified name succeeds with adminApproved=false
      mockResolveAccountName = 'GRACE ADEYEMI';
      await saveHashedOtp(minorEmail, 'payout_account', hashOtp('313131'), { sellerId: minorSellerId });
      const goodAccRes = await origFetch(`${baseUrl}/api/wallet/payout-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({
          bankCode: '058',
          bankName: 'GTBank',
          accountNumber: '0999888777',
          otpCode: '313131',
        }),
      });
      assert.strictEqual(goodAccRes.status, 200);
      const goodAccData: any = await goodAccRes.json();
      assert.strictEqual(goodAccData.account.adminApproved, false);
      assert.strictEqual(goodAccData.account.isMinorGuardianAccount, true);
      const guardianAccId = goodAccData.account.id;

      // Credit minor wallet ₦50,000 and bypass 24h cooling so we specifically isolate Admin approval & daily cap
      await query(
        `UPDATE shopit_wallets
         SET available_balance = 50000, available_balance_kobo = 5000000,
             payout_accounts = $1
         WHERE seller_id = $2`,
        [
          JSON.stringify([
            {
              ...goodAccData.account,
              coolingPeriodEndsAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
          minorSellerId,
        ]
      );

      // 1c. Withdrawal blocked (403) before one-time Admin approval
      await saveHashedOtp(minorEmail, 'withdrawal', hashOtp('414141'), { sellerId: minorSellerId });
      const blockedWtd = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({ amount: 5000, payoutAccountId: guardianAccId, otpCode: '414141' }),
      });
      assert.strictEqual(blockedWtd.status, 403);

      // Admin sees it in pending queue & approves once
      const pendingRes: any = await (
        await origFetch(`${baseUrl}/api/admin/payout-accounts/pending`, {
          headers: { Authorization: `Bearer ${adminSess.token}` },
        })
      ).json();
      assert.ok(pendingRes.pendingApprovals.some((p: any) => p.accountId === guardianAccId));

      const approveRes = await origFetch(
        `${baseUrl}/api/admin/wallets/${minorSellerId}/payout-accounts/${guardianAccId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
        }
      );
      assert.strictEqual(approveRes.status, 200);

      // 1d. Withdrawal within ₦25,000 daily minor cap succeeds (200), exceeding ₦25,000/day rejected (400)
      await saveHashedOtp(minorEmail, 'withdrawal', hashOtp('515151'), { sellerId: minorSellerId });
      const wtdOk = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({ amount: 15000, payoutAccountId: guardianAccId, otpCode: '515151' }),
      });
      assert.strictEqual(wtdOk.status, 200);

      await saveHashedOtp(minorEmail, 'withdrawal', hashOtp('616161'), { sellerId: minorSellerId });
      const wtdOverCap = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorToken}` },
        body: JSON.stringify({ amount: 15000, payoutAccountId: guardianAccId, otpCode: '616161' }),
      });
      assert.strictEqual(wtdOverCap.status, 400);
    });

    // -------------------------------------------------------------------------
    // POLICY RULE 2: Never-Shipped Orders (Day 3 reminder, Day 5 refund, skip dispute/admin hold)
    // -------------------------------------------------------------------------
    await test('POLICY RULE 2: Day 3 unshipped reminder, Day 5 auto-refund via Flutterwave, skip open dispute & admin hold', async () => {
      refundedTransactionCalls = [];
      const uSellerId = `uns_seller_${ts}`;
      const uSellerEmail = `uns_seller_${ts}@shopit.ng`;
      await query(
        `INSERT INTO shopit_users (id, email, name, password_hash, role, is_verified_email, age)
         VALUES ($1, $2, 'Slow Maker', $3, 'seller', true, 21)`,
        [uSellerId, uSellerEmail, hashPassword('SellerPass123!')]
      );
      await query(
        `INSERT INTO shopit_sellers (id, user_id, email, shop_name, owner_name, is_verified_seller, verification_status)
         VALUES ($1, $1, $2, 'Slow Studio', 'Slow Maker', true, 'verified')`,
        [uSellerId, uSellerEmail]
      );
      await query(
        `INSERT INTO shopit_wallets (seller_id, pending_balance, pending_balance_kobo, available_balance, available_balance_kobo)
         VALUES ($1, 12000, 1200000, 0, 0)
         ON CONFLICT (seller_id) DO UPDATE SET pending_balance = 12000, pending_balance_kobo = 1200000`,
        [uSellerId]
      );

      const uProdId = `uns_prod_${ts}`;
      await query(
        `INSERT INTO shopit_products (
           id, seller_id, seller_shop_name, title, description, category,
           seller_price, service_fee, display_price, stock, delivery_pickup_fee, delivery_local_fee
         ) VALUES ($1, $2, 'Slow Studio', 'Clay Mug', 'Handmade clay mug', 'crafts', 4000, 500, 4500, 2, 0, 0)`,
        [uProdId, uSellerId]
      );

      const makeUnshippedOrder = async (suffix: string, daysOld: number, opts: { adminHold?: boolean } = {}) => {
        const ordId = `ORD_UNS_${suffix}_${ts}`;
        const ref = `REF_UNS_${suffix}_${ts}`;
        const itemsJson = JSON.stringify([
          { productId: uProdId, sellerId: uSellerId, sellerShopName: 'Slow Studio', sellerPrice: 4000, quantity: 1 },
        ]);
        const paidAt = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
        await query(
          `INSERT INTO shopit_orders (
             id, buyer_id, buyer_name, buyer_email, items,
             subtotal, service_fee_total, delivery_total, discount_total, grand_total,
             subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
             payment_method, payment_reference, status, stock_reserved, admin_hold, paid_at, created_at, updated_at
           ) VALUES (
             $1, $2, 'Ada Buyer', $3, $4,
             4000, 500, 0, 0, 4500,
             400000, 50000, 0, 0, 450000,
             'flutterwave_card', $5, 'paid', true, $6, $7, $7, NOW()
           )`,
          [ordId, buyerId, buyerEmail, itemsJson, ref, Boolean(opts.adminHold), paidAt]
        );
        await query(
          `INSERT INTO shopit_payments (
             reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, data, updated_at
           ) VALUES (
             $1, $2, 450000, 4500, 'NGN', 'card', 'paid', true, $3, $4, NOW()
           )`,
          [ref, ordId, buyerEmail, JSON.stringify({ flwTransactionId: `9900${suffix}` })]
        );
        return ordId;
      };

      const day3OrderId = await makeUnshippedOrder('1', 3.5);
      const day5RefundOrderId = await makeUnshippedOrder('2', 5.5);
      const day5DisputeOrderId = await makeUnshippedOrder('3', 5.5);
      const day5HoldOrderId = await makeUnshippedOrder('4', 5.5);

      // Insert open dispute on day5DisputeOrderId
      await query(
        `INSERT INTO shopit_disputes (id, order_id, buyer_id, seller_id, reason, amount_held_in_escrow, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'Seller late', 4500, 'open', NOW(), NOW())`,
        [`disp_uns_${ts}`, day5DisputeOrderId, buyerId, uSellerId]
      );

      // Admin places hold on day5HoldOrderId via API
      const holdRes = await origFetch(`${baseUrl}/api/admin/orders/${day5HoldOrderId}/hold`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
        body: JSON.stringify({ hold: true }),
      });
      assert.strictEqual(holdRes.status, 200);

      const cronResult = await processUnshippedOrders();
      assert.ok(cronResult.remindedOrderIds.includes(day3OrderId), 'Day-3 unshipped order must trigger seller reminder');
      assert.ok(cronResult.refundedOrderIds.includes(day5RefundOrderId), 'Day-5 unshipped order must trigger full auto-refund');
      assert.ok(!cronResult.refundedOrderIds.includes(day5DisputeOrderId), 'Day-5 order with open dispute must be skipped');
      assert.ok(!cronResult.refundedOrderIds.includes(day5HoldOrderId), 'Day-5 order with admin hold must be skipped');
      assert.strictEqual(refundedTransactionCalls.length, 1);

      const refundedRow = await query('SELECT status FROM shopit_orders WHERE id = $1', [day5RefundOrderId]);
      assert.strictEqual(refundedRow.rows[0].status, 'refunded');

      const disputedRow = await query('SELECT status FROM shopit_orders WHERE id = $1', [day5DisputeOrderId]);
      assert.strictEqual(disputedRow.rows[0].status, 'paid');

      const heldRow = await query('SELECT status, admin_hold FROM shopit_orders WHERE id = $1', [day5HoldOrderId]);
      assert.strictEqual(heldRow.rows[0].status, 'paid');
      assert.strictEqual(heldRow.rows[0].admin_hold, true);

      // Stock restored (+1) and seller pending balance debited (-400,000 kobo -> 800,000 kobo remaining)
      const stockRow = await query('SELECT stock FROM shopit_products WHERE id = $1', [uProdId]);
      assert.strictEqual(Number(stockRow.rows[0].stock), 3);
      const uWal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [uSellerId]);
      assert.strictEqual(Number(uWal.rows[0].pending_balance_kobo), 800000);
    });

    // -------------------------------------------------------------------------
    // POLICY RULE 3: Immediate KYC image deletion upon admin decision & IKycProvider interface
    // -------------------------------------------------------------------------
    await test('POLICY RULE 3: KYC images deleted immediately after admin decision & IKycProvider abstraction works', async () => {
      // 3a. Interface check for local, prembly, dojah
      const localProvider: IKycProvider = getKycProvider('local');
      const premblyProvider: IKycProvider = getKycProvider('prembly');
      const dojahProvider: IKycProvider = getKycProvider('dojah');
      assert.strictEqual(localProvider.name, 'local_manual');
      assert.strictEqual(premblyProvider.name, 'prembly');
      assert.strictEqual(dojahProvider.name, 'dojah');

      const localCheck = await localProvider.verifyNin({ nin: '12345678901', fullName: 'Test User' });
      assert.strictEqual(localCheck.status, 'manual_review_required');

      // 3b. Submit KYC for a dedicated seller, inspect docs exist while pending, then review -> assert 0 docs remain immediately
      const kycEmail = `kyc_sec_${ts}@shopit.ng`;
      const kycReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: kycEmail,
            password: 'SellerPass123!',
            name: 'Kyc Seller',
            role: 'seller',
            age: 22,
            shopName: 'Kyc Craft Studio',
            signupVerificationToken: await issueSignupVerificationToken(kycEmail),
          }),
        })
      ).json();
      const kycToken = kycReg.sessionToken;
      const kycSellerId = kycReg.user.sellerId || kycReg.user.id;

      const submitRes = await origFetch(`${baseUrl}/api/verification/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kycToken}` },
        body: JSON.stringify({
          sellerId: kycSellerId,
          shopName: 'Kyc Craft Studio',
          fullName: 'Kyc Seller',
          nin: '98765432109',
          idDocumentType: 'nin_slip',
          idDocumentPhoto: validPngDataUrl,
          selfiePhoto: validPngDataUrl,
          livenessScore: 98,
          ndpaConsentSigned: true,
        }),
      });
      assert.strictEqual(submitRes.status, 200);

      const docsPending = await query('SELECT id FROM shopit_verification_documents WHERE seller_id = $1', [kycSellerId]);
      assert.ok(docsPending.rows.length >= 2, 'ID & selfie encrypted documents should exist while review is pending');

      const reviewRes: any = await (
        await origFetch(`${baseUrl}/api/verification/admin/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
          body: JSON.stringify({ sellerId: kycSellerId, action: 'verified' }),
        })
      ).json();
      assert.strictEqual(reviewRes.status, true);
      assert.strictEqual(reviewRes.imagesDeletedImmediately, true);

      const docsAfter = await query('SELECT id FROM shopit_verification_documents WHERE seller_id = $1', [kycSellerId]);
      assert.strictEqual(docsAfter.rows.length, 0, 'ID & selfie documents MUST be deleted immediately after admin decision');

      const verRecord = await query(
        'SELECT full_nin_last4, id_hash, status, reviewed_at, document_url, selfie_url FROM shopit_verifications WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 1',
        [kycSellerId]
      );
      assert.strictEqual(verRecord.rows[0].full_nin_last4, '2109');
      assert.ok(verRecord.rows[0].id_hash && verRecord.rows[0].id_hash.length === 64);
      assert.strictEqual(verRecord.rows[0].status, 'verified');
      assert.ok(verRecord.rows[0].reviewed_at !== null);
      assert.strictEqual(verRecord.rows[0].document_url, '[Deleted after review decision]');
      assert.strictEqual(verRecord.rows[0].selfie_url, '[Deleted after review decision]');
    });

    // -------------------------------------------------------------------------
    // CHANGE REQUEST PART 3 TESTS: APP_SECRET, Salted OTP, Admin Doc Auth,
    // Cron Idempotency (10x), Vercel Hobby Cron Limits, Zero Legacy Vars
    // -------------------------------------------------------------------------

    await test('CR1: Server refuses to start without a valid 64+ hex APP_SECRET', async () => {
      const tsxBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
      const envMissing = { ...process.env };
      delete envMissing.APP_SECRET;
      const missingRes = spawnSync(tsxBin, ['api/index.ts'], {
        env: envMissing,
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.notStrictEqual(missingRes.status, 0, 'Server must exit non-zero when APP_SECRET is missing');
      assert.ok(
        `${missingRes.stderr}${missingRes.stdout}`.includes('APP_SECRET'),
        'Failure output should clearly identify missing APP_SECRET'
      );

      const envShort = { ...process.env, APP_SECRET: 'short_not_64_hex_chars' };
      const shortRes = spawnSync(tsxBin, ['api/index.ts'], {
        env: envShort,
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.notStrictEqual(shortRes.status, 0, 'Server must exit non-zero when APP_SECRET is < 64 hex chars');
    });

    await test('CR2: Two OTPs for the same code produce different stored hashes (random per-record salt + HKDF)', async () => {
      const h1 = hashOtp('654321');
      const h2 = hashOtp('654321');
      assert.notStrictEqual(h1, h2, 'Two calls to hashOtp("654321") must produce distinct stored hashes');
      assert.strictEqual(verifyOtpHash('654321', h1), true);
      assert.strictEqual(verifyOtpHash('654321', h2), true);
      assert.strictEqual(verifyOtpHash('000000', h1), false);
    });

    await test('CR3: Document endpoint returns 401 without a session and 403 for non-admins', async () => {
      const docSellerEmail = `doc_sec_${ts}@shopit.ng`;
      const docReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: docSellerEmail,
            password: 'SellerPass123!',
            name: 'Pending Doc Seller',
            role: 'seller',
            age: 22,
            shopName: 'Doc Check Shop',
            signupVerificationToken: await issueSignupVerificationToken(docSellerEmail),
          }),
        })
      ).json();
      const docSellerToken = docReg.sessionToken;
      const docSellerId = docReg.user.sellerId || docReg.user.id;

      const subRes: any = await (
        await origFetch(`${baseUrl}/api/verification/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docSellerToken}` },
          body: JSON.stringify({
            sellerId: docSellerId,
            shopName: 'Doc Check Shop',
            fullName: 'Pending Doc Seller',
            nin: '55443322110',
            idDocumentType: 'nin_slip',
            idDocumentPhoto: validPngDataUrl,
            selfiePhoto: validPngDataUrl,
            livenessScore: 95,
            ndpaConsentSigned: true,
          }),
        })
      ).json();
      assert.strictEqual(subRes.verificationStatus, 'pending');

      const vRow = await query('SELECT document_url FROM shopit_verifications WHERE id = $1', [subRes.verificationId]);
      const docUrl: string = vRow.rows[0].document_url;
      assert.ok(docUrl.startsWith('/api/verification/document/'));
      assert.ok(!docUrl.includes('token='));

      const unauthRes = await origFetch(`${baseUrl}${docUrl}`);
      assert.strictEqual(unauthRes.status, 401, 'Document endpoint must return 401 without session');

      const buyerRes = await origFetch(`${baseUrl}${docUrl}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(buyerRes.status, 403, 'Document endpoint must return 403 for buyer');

      const ownerRes = await origFetch(`${baseUrl}${docUrl}`, {
        headers: { Authorization: `Bearer ${docSellerToken}` },
      });
      assert.strictEqual(ownerRes.status, 403, 'Document endpoint must return 403 for non-admin seller owner');

      const adminDocRes = await origFetch(`${baseUrl}${docUrl}`, {
        headers: { Authorization: `Bearer ${adminSess.token}` },
      });
      assert.strictEqual(adminDocRes.status, 200, 'Moderator admin session should stream decrypted image (200)');
    });

    await test('CR4: Calling /api/cron/daily 10 times in a row changes nothing after the first run', async () => {
      // Seed one overdue pending_payment order with reserved stock to verify run 1 processes it and runs 2-10 are zero-ops
      const cronProdId = `prod_cron_${ts}`;
      await query(
        `INSERT INTO shopit_products (
           id, seller_id, seller_shop_name, title, description, category,
           seller_price, service_fee, display_price, stock, is_sold_out, created_at, updated_at
         ) VALUES ($1, $2, 'Adult Bead Craft', 'Cron Test Item', 'Item', 'crafts', 2000, 500, 2500, 4, false, NOW(), NOW())`,
        [cronProdId, sellerId]
      );
      const cronOrdId = `ORD_CRON10_${ts}`;
      await query(
        `INSERT INTO shopit_orders (
           id, buyer_id, buyer_name, buyer_email, items,
           subtotal, service_fee_total, delivery_total, discount_total, grand_total,
           subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
           payment_method, payment_reference, status, stock_reserved, expires_at, created_at, updated_at
         ) VALUES (
           $1, $2, 'Ada Buyer', $3, $4,
           2000, 500, 0, 0, 2500,
           200000, 50000, 0, 0, 250000,
           'flutterwave_card', $5, 'pending_payment', true, NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 hours', NOW()
         )`,
        [
          cronOrdId,
          buyerId,
          buyerEmail,
          JSON.stringify([{ productId: cronProdId, sellerId, sellerPrice: 2000, quantity: 1 }]),
          `REF_CRON10_${ts}`,
        ]
      );

      const firstRes = await origFetch(`${baseUrl}/api/cron/daily`, { method: 'GET' });
      assert.strictEqual(firstRes.status, 200);
      const firstBody: any = await firstRes.json();
      assert.strictEqual(firstBody.ok, true);
      assert.strictEqual(firstBody.processed.expiredOrdersCount, 1);

      const stockAfterFirst = Number((await query('SELECT stock FROM shopit_products WHERE id = $1', [cronProdId])).rows[0].stock);
      assert.strictEqual(stockAfterFirst, 5);

      for (let i = 2; i <= 10; i++) {
        const res = await origFetch(`${baseUrl}/api/cron/daily`, { method: 'GET' });
        assert.strictEqual(res.status, 200, `Cron run #${i} failed with ${res.status}`);
        const body: any = await res.json();
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.processed.expiredOrdersCount, 0, `Run #${i} expiredOrdersCount must be 0`);
        assert.strictEqual(body.processed.escrowReleasedCount, 0, `Run #${i} escrowReleasedCount must be 0`);
        assert.strictEqual(body.processed.unshippedRemindedCount, 0, `Run #${i} unshippedRemindedCount must be 0`);
        assert.strictEqual(body.processed.unshippedRefundedCount, 0, `Run #${i} unshippedRefundedCount must be 0`);
        assert.strictEqual(body.processed.purgedDocsCount, 0, `Run #${i} purgedDocsCount must be 0`);
        assert.strictEqual(JSON.stringify(body).includes(buyerEmail), false, 'Cron response must contain zero PII');
      }

      const stockAfterTen = Number((await query('SELECT stock FROM shopit_products WHERE id = $1', [cronProdId])).rows[0].stock);
      assert.strictEqual(stockAfterTen, 5, 'Stock must remain identical across runs 2-10');
    });

    await test('CR5: vercel.json contains no cron that runs more than once per day', async () => {
      const rawVercel = fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8');
      const parsed = JSON.parse(rawVercel);
      assert.ok(Array.isArray(parsed.crons) && parsed.crons.length === 1, 'vercel.json must configure strictly 1 cron job');
      for (const job of parsed.crons) {
        const fields = String(job.schedule || '').trim().split(/\s+/);
        assert.strictEqual(fields.length, 5, `Cron schedule must have 5 fields: ${job.schedule}`);
        const [min, hour] = fields;
        assert.ok(/^\d{1,2}$/.test(min) && Number(min) >= 0 && Number(min) <= 59, `Minute field must be a single fixed integer: ${min}`);
        assert.ok(/^\d{1,2}$/.test(hour) && Number(hour) >= 0 && Number(hour) <= 23, `Hour field must be a single fixed integer (max 1x/day): ${hour}`);
      }
    });

    await test('CR6: Five removed legacy env var names no longer appear anywhere in codebase', async () => {
      const forbiddenNames = [
        ['OTP', 'HASH', 'SALT'].join('_'),
        ['NIN', 'HASH', 'SALT'].join('_'),
        ['DOC', 'TOKEN', 'SECRET'].join('_'),
        ['DOC', 'ENCRYPTION', 'KEY'].join('_'),
        ['CRON', 'SECRET'].join('_'),
      ];

      const filesToScan: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
            walk(full);
          } else if (/\.(ts|tsx|js|jsx|json|md|example)$/.test(entry.name)) {
            filesToScan.push(full);
          }
        }
      };

      for (const topDir of ['api', 'src', 'scripts']) {
        walk(path.resolve(process.cwd(), topDir));
      }
      for (const rootFile of ['.env.example', 'README.md', 'vercel.json', 'server.ts', 'package.json', 'index.html']) {
        const p = path.resolve(process.cwd(), rootFile);
        if (fs.existsSync(p)) filesToScan.push(p);
      }

      const hits: string[] = [];
      for (const filePath of filesToScan) {
        const content = fs.readFileSync(filePath, 'utf8');
        for (const name of forbiddenNames) {
          if (content.includes(name)) {
            hits.push(`${path.relative(process.cwd(), filePath)} -> ${name}`);
          }
        }
      }
      assert.deepStrictEqual(hits, [], `Found forbidden env var references: ${hits.join('; ')}`);
    });

    console.log('\n==================================================================');
    console.log(`PHASE 4 SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================');
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    globalThis.fetch = origFetch;
    server.close();
  }
}

main().catch(err => {
  console.error('Fatal error in security-tests.ts:', err);
  process.exit(1);
});
