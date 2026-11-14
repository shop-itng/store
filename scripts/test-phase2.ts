import http from 'http';
import assert from 'assert';
import { app } from '../api/index.js';
import { query, hashPassword, runMigration } from '../api/db/postgres.js';
import { createSession } from '../api/auth/sessionStore.js';
import { issueSignupVerificationToken, saveHashedOtp, hashOtp } from '../api/db/otpStore.js';
import { expireStalePendingOrders } from '../api/lib/payments.js';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`[FAIL] ${name}: ${err.stack || err.message}`);
  }
}

async function main() {
  await runMigration();

  // Enable payment switches and set test Flutterwave keys in process.env ONLY for this test harness
  process.env.PAYMENTS_ENABLED = 'true';
  process.env.PAYOUTS_ENABLED = 'true';
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-mock-secret-phase2';
  process.env.FLW_PUBLIC_KEY = 'FLWPUBK_TEST-mock-public-phase2';
  process.env.FLW_WEBHOOK_SECRET_HASH = 'flw_webhook_hash_phase2_test';
  process.env.CRON_SECRET = 'cron_secret_phase2_test';
  process.env.APP_URL = 'https://shop-itng-pied.vercel.app';

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  // Intercept ONLY outbound calls to https://api.flutterwave.com/v3/* while passing local server requests straight through
  const origFetch = globalThis.fetch;
  let flwVerifyBehaviour: (url: string) => { status: number; body: any } = () => ({
    status: 200,
    body: { status: 'success', data: { status: 'successful', currency: 'NGN', amount: 0 } },
  });
  let flwInitBehaviour: (body: any) => Promise<{ status: number; body: any }> = async body => ({
    status: 200,
    body: {
      status: 'success',
      data: { link: `https://checkout.flutterwave.com/v3/hosted/pay/${body.tx_ref}` },
    },
  });
  let flwTransferBehaviour: (body: any) => { status: number; body: any } = body => ({
    status: 200,
    body: {
      status: 'success',
      data: {
        id: 778899,
        reference: body.reference,
        status: 'NEW',
        amount: body.amount,
        currency: 'NGN',
      },
    },
  });
  let flwRefundCalls = 0;

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('https://api.flutterwave.com/v3/banks/NG')) {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: [
            { id: 1, code: '058', name: 'Guaranty Trust Bank' },
            { id: 2, code: '044', name: 'Access Bank' },
            { id: 3, code: '057', name: 'Zenith Bank' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/accounts/resolve')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (body.account_number === '0000000000') {
        return new Response(
          JSON.stringify({ status: 'error', message: 'Sorry, recipient account could not be validated.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            account_number: body.account_number,
            account_name: 'PHASE TWO ARTISAN',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/payments')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const out = await flwInitBehaviour(body);
      return new Response(JSON.stringify(out.body), {
        status: out.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.includes('https://api.flutterwave.com/v3/transactions/') && url.endsWith('/refund')) {
      flwRefundCalls++;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'Transaction refund initiated',
          data: { id: 991122, amount_refunded: body.amount, status: 'completed-mpgs' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.flutterwave.com/v3/transactions/')) {
      const out = flwVerifyBehaviour(url);
      return new Response(JSON.stringify(out.body), {
        status: out.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('https://api.flutterwave.com/v3/transfers')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const out = flwTransferBehaviour(body);
      return new Response(JSON.stringify(out.body), {
        status: out.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return origFetch(input, init);
  }) as any;

  try {
    // Seed Admin, Buyer, Seller, and Product cleanly in PostgreSQL
    const ts = Date.now();
    const adminId = `admin_p2_${ts}`;
    const adminEmail = `admin_p2_${ts}@shopit.ng`;
    await query(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Phase2 Admin', $3, 'admin', 'superadmin', true, 26)
       ON CONFLICT (id) DO NOTHING`,
      [adminId, adminEmail, hashPassword('AdminPass123!')]
    );
    const adminSess = await createSession({
      userId: adminId,
      email: adminEmail,
      name: 'Phase2 Admin',
      role: 'admin',
      subRole: 'superadmin',
      tokenVersion: 1,
    });

    const buyerEmail = `buyer_p2_${ts}@shopit.ng`;
    const buyerRegToken = await issueSignupVerificationToken(buyerEmail);
    const buyerReg = await origFetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        password: 'BuyerPass123!',
        name: 'Phase Two Buyer',
        role: 'buyer',
        age: 21,
        signupVerificationToken: buyerRegToken,
      }),
    });
    const buyerRegData: any = await buyerReg.json();
    const buyerToken = buyerRegData.sessionToken;

    const sellerEmail = `seller_p2_${ts}@shopit.ng`;
    const sellerRegToken = await issueSignupVerificationToken(sellerEmail);
    const sellerReg = await origFetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password: 'SellerPass123!',
        name: 'Phase Two Artisan',
        role: 'seller',
        age: 22,
        shopName: 'Phase Two Studio',
        signupVerificationToken: sellerRegToken,
      }),
    });
    const sellerRegData: any = await sellerReg.json();
    const sellerToken = sellerRegData.sessionToken;
    const sellerId = sellerRegData.user.sellerId || sellerRegData.user.id;

    // Mark seller verified so products/payouts proceed
    await query(
      `UPDATE shopit_sellers SET verification_status = 'verified', verified_legal_name = 'PHASE TWO ARTISAN' WHERE id = $1`,
      [sellerId]
    );

    const productId = `prod_p2_${ts}`;
    const sellerPriceNaira = 5000;
    // Server fee tier at ₦5,000 is ₦500 + ₦200 delivery_pickup_fee
    await query(
      `INSERT INTO shopit_products (
         id, seller_id, seller_shop_name, seller_campus, title, category, description,
         seller_price, service_fee, display_price,
         stock, is_sold_out, delivery_pickup_fee, delivery_local_fee, delivery_buyer_arranges
       ) VALUES (
         $1, $2, 'Phase Two Studio', 'UNILAG (Akoka)', 'Handcrafted Bead Bag', 'Beads', 'Crafted for verification',
         $3, 500, 5500,
         10, false, 200, 500, false
       )`,
      [productId, sellerId, sellerPriceNaira]
    );

    // ------------------------------------------------------------------
    // Scenario 1: Card checkout -> Stock reservation + Server calculation + Valid verif-hash webhook + Double-check verify
    // ------------------------------------------------------------------
    let cardRef = '';
    let cardOrderId = '';
    await test('1. Card checkout initializes server total ignoring client tamper, reserves stock, and settles once via valid webhook', async () => {
      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 2, deliveryMethod: 'pickup', sellerPrice: 1 }], // tamper attempt: sellerPrice=1
          amount: 100, // tamper attempt: amount=100
          grandTotal: 1,
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      assert.strictEqual(initRes.status, 200);
      const initJson: any = await initRes.json();
      assert.strictEqual(initJson.status, true);
      cardRef = initJson.data.reference;
      cardOrderId = initJson.data.orderId;
      // 2x 5000 = 10,000 sellerPrice + 2x 500 = 1,000 serviceFee + 200 pickup = 11,200 Naira (1,120,000 kobo)
      assert.strictEqual(initJson.data.grandTotalNaira, 11200);
      assert.strictEqual(initJson.data.amountInKobo, 1120000);
      assert.ok(initJson.data.authorization_url.includes('checkout.flutterwave.com'));

      // Check stock decremented 10 -> 8
      const prodAfterInit = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      assert.strictEqual(Number(prodAfterInit.rows[0].stock), 8);

      flwVerifyBehaviour = () => ({
        status: 200,
        body: {
          status: 'success',
          data: {
            id: 100001,
            tx_ref: cardRef,
            amount: 11200,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
            customer: { email: buyerEmail },
            meta: { orderId: cardOrderId },
          },
        },
      });

      const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH!,
        },
        body: JSON.stringify({
          event: 'charge.completed',
          data: {
            id: 100001,
            tx_ref: cardRef,
            amount: 11200,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
          },
        }),
      });
      assert.strictEqual(whRes.status, 200);

      const ordCheck = await query('SELECT status, payment_method FROM shopit_orders WHERE id = $1', [cardOrderId]);
      assert.strictEqual(ordCheck.rows[0].status, 'paid');

      // Stock must NOT double-decrement (remains 8)
      const prodAfterPay = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      assert.strictEqual(Number(prodAfterPay.rows[0].stock), 8);

      // Seller wallet pending credited with 1,000,000 kobo (10,000 NGN)
      const wal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].pending_balance_kobo), 1000000);
    });

    // ------------------------------------------------------------------
    // Scenario 2: Card failure -> Order NOT marked paid, wallet unchanged
    // ------------------------------------------------------------------
    await test('2. Card failure webhook does NOT mark order paid and does NOT credit seller wallet', async () => {
      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 1, deliveryMethod: 'pickup' }],
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      const initJson: any = await initRes.json();
      const failRef = initJson.data.reference;
      const failOrderId = initJson.data.orderId;

      flwVerifyBehaviour = () => ({
        status: 200,
        body: {
          status: 'success',
          data: { id: 100002, tx_ref: failRef, amount: 5700, currency: 'NGN', status: 'failed' },
        },
      });

      const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 100002, tx_ref: failRef, amount: 5700, currency: 'NGN', status: 'failed' },
        }),
      });
      assert.strictEqual(whRes.status, 200);

      const ordCheck = await query('SELECT status FROM shopit_orders WHERE id = $1', [failOrderId]);
      assert.strictEqual(ordCheck.rows[0].status, 'pending_payment');

      const wal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].pending_balance_kobo), 1000000);
    });

    // ------------------------------------------------------------------
    // Scenario 3 & 4: Bank Transfer and USSD channels
    // ------------------------------------------------------------------
    await test('3 & 4. Bank transfer and USSD payments settle cleanly into escrow via Flutterwave', async () => {
      for (const chan of [
        { method: 'flutterwave_transfer', paymentType: 'bank_transfer', flwId: 100003 },
        { method: 'flutterwave_ussd', paymentType: 'ussd', flwId: 100004 },
      ]) {
        const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
          body: JSON.stringify({
            items: [{ productId, quantity: 1, deliveryMethod: 'pickup' }],
            campus: 'UNILAG (Akoka)',
            paymentMethod: chan.method,
          }),
        });
        assert.strictEqual(initRes.status, 200);
        const initJson: any = await initRes.json();
        const ref = initJson.data.reference;
        const oid = initJson.data.orderId;

        flwVerifyBehaviour = () => ({
          status: 200,
          body: {
            status: 'success',
            data: {
              id: chan.flwId,
              tx_ref: ref,
              amount: 5700,
              currency: 'NGN',
              status: 'successful',
              payment_type: chan.paymentType,
              customer: { email: buyerEmail },
            },
          },
        });

        const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
          body: JSON.stringify({
            event: 'charge.completed',
            data: { id: chan.flwId, tx_ref: ref, amount: 5700, currency: 'NGN', status: 'successful', payment_type: chan.paymentType },
          }),
        });
        assert.strictEqual(whRes.status, 200);
        const ordCheck = await query('SELECT status FROM shopit_orders WHERE id = $1', [oid]);
        assert.strictEqual(ordCheck.rows[0].status, 'paid');
      }
      // Pending wallet should now be 1,000,000 + 500,000 + 500,000 = 2,000,000 kobo
      const wal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].pending_balance_kobo), 2000000);
    });

    // ------------------------------------------------------------------
    // Scenario 5: Amount mismatch (underpayment) rejected & NOT marked paid
    // ------------------------------------------------------------------
    await test('5. Amount mismatch (underpayment: ₦100 for ₦5,700 order) rejected with 400 and NOT marked paid', async () => {
      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 1, deliveryMethod: 'pickup' }],
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      const initJson: any = await initRes.json();
      const underRef = initJson.data.reference;
      const underOid = initJson.data.orderId;

      flwVerifyBehaviour = () => ({
        status: 200,
        body: {
          status: 'success',
          data: { id: 100005, tx_ref: underRef, amount: 100, currency: 'NGN', status: 'successful' },
        },
      });

      const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 100005, tx_ref: underRef, amount: 100, currency: 'NGN', status: 'successful' },
        }),
      });
      assert.strictEqual(whRes.status, 400);

      const ordCheck = await query('SELECT status FROM shopit_orders WHERE id = $1', [underOid]);
      assert.strictEqual(ordCheck.rows[0].status, 'pending_payment');
    });

    // ------------------------------------------------------------------
    // Scenario 6: Replayed webhook processed idempotently (wallet credited strictly once)
    // ------------------------------------------------------------------
    await test('6. Replayed charge.completed webhook returns alreadyProcessed:true and does NOT double-credit wallet', async () => {
      flwVerifyBehaviour = () => ({
        status: 200,
        body: {
          status: 'success',
          data: {
            id: 100001,
            tx_ref: cardRef,
            amount: 11200,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
          },
        },
      });

      const replayRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 100001, tx_ref: cardRef, amount: 11200, currency: 'NGN', status: 'successful' },
        }),
      });
      assert.strictEqual(replayRes.status, 200);
      const replayJson: any = await replayRes.json();
      assert.strictEqual(replayJson.alreadyProcessed, true);

      const wal = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].pending_balance_kobo), 2000000);
    });

    // ------------------------------------------------------------------
    // Scenario 7: Forged signature rejected with 401; missing hash 401; missing secret 503
    // ------------------------------------------------------------------
    await test('7. Forged/missing verif-hash returns 401; missing FLW_WEBHOOK_SECRET_HASH fails closed 503', async () => {
      const forged = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': 'forged_hacker_hash' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: cardRef, amount: 11200 } }),
      });
      assert.strictEqual(forged.status, 401);

      const missingHeader = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: cardRef, amount: 11200 } }),
      });
      assert.strictEqual(missingHeader.status, 401);

      const savedHash = process.env.FLW_WEBHOOK_SECRET_HASH;
      process.env.FLW_WEBHOOK_SECRET_HASH = '';
      const noSecret = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': 'anything' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: cardRef, amount: 11200 } }),
      });
      process.env.FLW_WEBHOOK_SECRET_HASH = savedHash;
      assert.strictEqual(noSecret.status, 503);
    });

    // ------------------------------------------------------------------
    // Scenario 8: Wrong currency (USD instead of NGN) rejected 400
    // ------------------------------------------------------------------
    await test('8. Wrong currency (USD instead of NGN) rejected with 400 and NOT marked paid', async () => {
      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 1, deliveryMethod: 'pickup' }],
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      const initJson: any = await initRes.json();
      const usdRef = initJson.data.reference;
      const usdOid = initJson.data.orderId;

      flwVerifyBehaviour = () => ({
        status: 200,
        body: {
          status: 'success',
          data: { id: 100008, tx_ref: usdRef, amount: 5700, currency: 'USD', status: 'successful' },
        },
      });

      const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 100008, tx_ref: usdRef, amount: 5700, currency: 'USD', status: 'successful' },
        }),
      });
      assert.strictEqual(whRes.status, 400);
      const ordCheck = await query('SELECT status FROM shopit_orders WHERE id = $1', [usdOid]);
      assert.strictEqual(ordCheck.rows[0].status, 'pending_payment');
    });

    // ------------------------------------------------------------------
    // Scenario 9: Gateway timeout / Pending expiry / Late payment after expiry / Webhook-before-verify
    // ------------------------------------------------------------------
    await test('9a. Gateway outage during /payments/initialize cancels order and restores reserved stock', async () => {
      const beforeProd = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      const stockBefore = Number(beforeProd.rows[0].stock);

      flwInitBehaviour = async () => ({ status: 504, body: { status: 'error', message: 'Gateway timeout' } });
      const res = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 2, deliveryMethod: 'pickup' }],
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      assert.strictEqual(res.status, 502);

      // Reset init behavior
      flwInitBehaviour = async body => ({
        status: 200,
        body: { status: 'success', data: { link: `https://checkout.flutterwave.com/v3/hosted/pay/${body.tx_ref}` } },
      });

      const afterProd = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      assert.strictEqual(Number(afterProd.rows[0].stock), stockBefore);
    });

    await test('9b. 30-minute pending expiry restores reserved stock and rejects late payment with late_after_expiry', async () => {
      const prodSnap = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      const stockBeforeInit = Number(prodSnap.rows[0].stock);

      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId, quantity: 1, deliveryMethod: 'pickup' }],
          campus: 'UNILAG (Akoka)',
          paymentMethod: 'flutterwave_card',
        }),
      });
      const initJson: any = await initRes.json();
      const lateRef = initJson.data.reference;
      const lateOid = initJson.data.orderId;

      // Move expires_at to the past to simulate 30 minutes passing
      await query(`UPDATE shopit_orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [lateOid]);
      const expired = await expireStalePendingOrders();
      assert.ok(expired.orderIds.includes(lateOid));

      const prodAfterExpiry = await query('SELECT stock FROM shopit_products WHERE id = $1', [productId]);
      assert.strictEqual(Number(prodAfterExpiry.rows[0].stock), stockBeforeInit);

      // Late webhook arrives after expiry
      flwVerifyBehaviour = () => ({
        status: 200,
        body: { status: 'success', data: { id: 100099, tx_ref: lateRef, amount: 5700, currency: 'NGN', status: 'successful' } },
      });
      const lateWh = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 100099, tx_ref: lateRef, amount: 5700, currency: 'NGN', status: 'successful' },
        }),
      });
      assert.strictEqual(lateWh.status, 409);

      const payRow = await query('SELECT status FROM shopit_payments WHERE reference = $1', [lateRef]);
      assert.strictEqual(payRow.rows[0].status, 'late_after_expiry');
    });

    await test('9c. Webhook arrives before buyer return GET /payments/verify/:ref (idempotent confirm)', async () => {
      const verifyRes = await origFetch(`${baseUrl}/api/payments/verify/${encodeURIComponent(cardRef)}`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(verifyRes.status, 200);
      const verifyJson: any = await verifyRes.json();
      assert.strictEqual(verifyJson.isPaid, true);
      assert.strictEqual(verifyJson.orderId, cardOrderId);
    });

    // ------------------------------------------------------------------
    // Scenario 10: Banks, Account Resolve, Payout Account, Transfer & Failure Reversal, and Refund
    // ------------------------------------------------------------------
    await test('10. Live /payments/banks, /payments/resolve-account, transfer + FAILED webhook reversal, and idempotent /payments/refund', async () => {
      const banksRes = await origFetch(`${baseUrl}/api/payments/banks`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(banksRes.status, 200);
      const banksJson: any = await banksRes.json();
      assert.strictEqual(banksJson.banks.length, 3);

      const resolveRes = await origFetch(`${baseUrl}/api/payments/resolve-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ bankCode: '058', accountNumber: '0123456789' }),
      });
      assert.strictEqual(resolveRes.status, 200);
      const resolveJson: any = await resolveRes.json();
      assert.strictEqual(resolveJson.accountName, 'PHASE TWO ARTISAN');

      // Seed cooled payout account for transfer test and give seller ₦10,000 available balance
      const payoutAccId = `acc_p2_${ts}`;
      await query(
        `UPDATE shopit_wallets
         SET available_balance = 10000,
             available_balance_kobo = 1000000,
             active_payout_account_id = $1,
             payout_accounts = $2
         WHERE seller_id = $3`,
        [
          payoutAccId,
          JSON.stringify([
            {
              id: payoutAccId,
              bankCode: '058',
              bankName: 'Guaranty Trust Bank',
              accountNumber: '0123456789',
              accountName: 'PHASE TWO ARTISAN',
              isVerified: true,
              coolingPeriodEndsAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
          sellerId,
        ]
      );

      const transferOtp = '739104';
      await saveHashedOtp(sellerEmail, 'withdrawal', hashOtp(transferOtp), { sellerId });

      const transferRes = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 5000, payoutAccountId: payoutAccId, otpCode: transferOtp }),
      });
      assert.strictEqual(transferRes.status, 200);
      const transferJson: any = await transferRes.json();
      const txRef = transferJson.transfer_code;

      const walAfterTx = await query('SELECT available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(walAfterTx.rows[0].available_balance_kobo), 500000);

      // Flutterwave sends transfer.completed with FAILED -> available_balance_kobo must reverse back to 1,000,000!
      const failTransferWh = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'transfer.completed',
          data: {
            id: 778899,
            reference: txRef,
            status: 'FAILED',
            complete_message: 'Beneficiary bank rejected transfer',
          },
        }),
      });
      assert.strictEqual(failTransferWh.status, 200);

      const walAfterFail = await query('SELECT available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(walAfterFail.rows[0].available_balance_kobo), 1000000);

      // Admin issues refund for cardOrderId (₦11,200, qty=2 stock restore)
      const stockBeforeRefund = Number((await query('SELECT stock FROM shopit_products WHERE id = $1', [productId])).rows[0].stock);
      const refundRes1 = await origFetch(`${baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
        body: JSON.stringify({ reference: cardRef, reason: 'Phase 2 refund verification' }),
      });
      assert.strictEqual(refundRes1.status, 200);
      const refundJson1: any = await refundRes1.json();
      assert.strictEqual(refundJson1.status, true);

      // Idempotent second call must NOT hit Flutterwave /refund a second time!
      const refundRes2 = await origFetch(`${baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
        body: JSON.stringify({ reference: cardRef, reason: 'Duplicate refund call' }),
      });
      assert.strictEqual(refundRes2.status, 200);
      const refundJson2: any = await refundRes2.json();
      assert.strictEqual(refundJson2.alreadyRefunded, true);
      assert.strictEqual(flwRefundCalls, 1);

      const stockAfterRefund = Number((await query('SELECT stock FROM shopit_products WHERE id = $1', [productId])).rows[0].stock);
      assert.strictEqual(stockAfterRefund, stockBeforeRefund + 2);

      const refundedOrder = await query('SELECT status FROM shopit_orders WHERE id = $1', [cardOrderId]);
      assert.strictEqual(refundedOrder.rows[0].status, 'refunded');
    });

    console.log(`\n=== PHASE 2 FLUTTERWAVE VERIFICATION SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    globalThis.fetch = origFetch;
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 2 test suite failed:', err);
  process.exit(1);
});
