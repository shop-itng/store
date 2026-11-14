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

  process.env.PAYMENTS_ENABLED = 'true';
  process.env.PAYOUTS_ENABLED = 'true';
  process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-mock-secret-phase3-sweep';
  process.env.FLW_PUBLIC_KEY = 'FLWPUBK_TEST-mock-public-phase3-sweep';
  process.env.FLW_WEBHOOK_SECRET_HASH = 'flw_webhook_hash_phase3_sweep';
  process.env.DOC_ENCRYPTION_KEY = 'phase3-sweep-test-doc-encryption-key';
  process.env.CRON_SECRET = 'cron_secret_phase3_sweep';
  process.env.APP_URL = 'https://shop-itng-pied.vercel.app';

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const origFetch = globalThis.fetch;
  let verifyAmountNaira = 0;
  let verifyTxRef = '';

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

    if (url.startsWith('https://api.flutterwave.com/v3/transactions/')) {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            id: 551199,
            tx_ref: verifyTxRef,
            amount: verifyAmountNaira,
            currency: 'NGN',
            status: 'successful',
            payment_type: 'card',
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
            id: 882211,
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

    // Seed Superadmin, Moderator Admin, Finance Admin
    const modAdminId = `mod_p3s_${ts}`;
    const modEmail = `mod_p3s_${ts}@shopit.ng`;
    await query(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Mod Admin', $3, 'admin', 'moderator', true, 28)`,
      [modAdminId, modEmail, hashPassword('AdminPass123!')]
    );
    const modSess = await createSession({
      userId: modAdminId,
      email: modEmail,
      name: 'Mod Admin',
      role: 'admin',
      subRole: 'moderator',
      tokenVersion: 1,
    });

    const finAdminId = `fin_p3s_${ts}`;
    const finEmail = `fin_p3s_${ts}@shopit.ng`;
    await query(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Finance Admin', $3, 'admin', 'finance', true, 29)`,
      [finAdminId, finEmail, hashPassword('AdminPass123!')]
    );
    const finSess = await createSession({
      userId: finAdminId,
      email: finEmail,
      name: 'Finance Admin',
      role: 'admin',
      subRole: 'finance',
      tokenVersion: 1,
    });

    // Register Buyer, Seller, and Bystander
    const buyerEmail = `buyer_p3s_${ts}@shopit.ng`;
    const buyerReg = await origFetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: buyerEmail,
        password: 'BuyerPass123!',
        name: 'Sweep Buyer',
        role: 'buyer',
        age: 20,
        signupVerificationToken: await issueSignupVerificationToken(buyerEmail),
      }),
    });
    const buyerData: any = await buyerReg.json();
    const buyerToken = buyerData.sessionToken;
    const buyerId = buyerData.user.id;

    const sellerEmail = `seller_p3s_${ts}@shopit.ng`;
    const sellerReg = await origFetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: sellerEmail,
        password: 'SellerPass123!',
        name: 'Sweep Artisan',
        role: 'seller',
        age: 22,
        shopName: 'Sweep Studio',
        signupVerificationToken: await issueSignupVerificationToken(sellerEmail),
      }),
    });
    const sellerData: any = await sellerReg.json();
    const sellerToken = sellerData.sessionToken;
    const sellerId = sellerData.user.sellerId || sellerData.user.id;
    await query(
      `UPDATE shopit_sellers SET is_verified_seller = true, verification_status = 'verified', verified_legal_name = 'SWEEP ARTISAN' WHERE id = $1`,
      [sellerId]
    );

    const bystanderEmail = `other_p3s_${ts}@shopit.ng`;
    const bystanderReg = await origFetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: bystanderEmail,
        password: 'OtherPass123!',
        name: 'Bystander User',
        role: 'buyer',
        age: 21,
        signupVerificationToken: await issueSignupVerificationToken(bystanderEmail),
      }),
    });
    const bystanderData: any = await bystanderReg.json();
    const bystanderToken = bystanderData.sessionToken;

    // ------------------------------------------------------------------------
    // 1. Option 1 Withdrawal Fee = ₦0 even below ₦5,000
    // ------------------------------------------------------------------------
    await test('1. Option 1 payout fee is ₦0 for ₦2,000 withdrawal (wallet debited strictly 200,000 kobo)', async () => {
      const payoutAccId = `acc_p3s_${ts}`;
      await query(
        `INSERT INTO shopit_wallets (seller_id, available_balance, available_balance_kobo, active_payout_account_id, payout_accounts)
         VALUES ($1, 5000, 500000, $2, $3)
         ON CONFLICT (seller_id) DO UPDATE SET available_balance = 5000, available_balance_kobo = 500000, active_payout_account_id = $2, payout_accounts = $3`,
        [
          sellerId,
          payoutAccId,
          JSON.stringify([
            {
              id: payoutAccId,
              bankCode: '058',
              bankName: 'Guaranty Trust Bank',
              accountNumber: '0123456789',
              accountName: 'SWEEP ARTISAN',
              isVerified: true,
              coolingPeriodEndsAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ]),
        ]
      );

      const otp = '558291';
      await saveHashedOtp(sellerEmail, 'withdrawal', hashOtp(otp), { sellerId });

      const res = await origFetch(`${baseUrl}/api/payments/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ amount: 2000, payoutAccountId: payoutAccId, otpCode: otp }),
      });
      assert.strictEqual(res.status, 200);
      const data: any = await res.json();
      assert.strictEqual(data.fee, 0);

      const wal = await query('SELECT available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sellerId]);
      assert.strictEqual(Number(wal.rows[0].available_balance_kobo), 300000);
    });

    // ------------------------------------------------------------------------
    // 2. Product Creation & Image XSS / blob: Rejection + Ownership IDOR
    // ------------------------------------------------------------------------
    let createdProductId = '';
    await test('2. Product endpoints reject blank titles, javascript:, blob:, data:text/html, image/svg+xml & enforce ownership', async () => {
      const badPayloads = [
        { title: '   ', sellerPrice: 2000, images: ['https://example.com/a.jpg'] },
        { title: 'Bad JS URL', sellerPrice: 2000, images: ['javascript:alert(1)'] },
        { title: 'Bad Blob URL', sellerPrice: 2000, images: ['blob:https://shop-it.ng/1234'] },
        { title: 'Bad HTML Data', sellerPrice: 2000, images: ['data:text/html;base64,PHNjcmlwdD4='] },
        { title: 'Bad SVG Data', sellerPrice: 2000, images: ['data:image/svg+xml;base64,PHN2Zz4='] },
      ];
      for (const body of badPayloads) {
        const res = await origFetch(`${baseUrl}/api/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
          body: JSON.stringify(body),
        });
        assert.strictEqual(res.status, 400, `Expected 400 for payload ${body.title}`);
      }

      const goodRes = await origFetch(`${baseUrl}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          title: 'Handwoven Basket',
          description: 'Crafted cleanly',
          category: 'crafts',
          sellerPrice: 3000,
          stock: 5,
          images: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='],
          delivery: { pickupFee: 0, localDeliveryFee: 400 },
        }),
      });
      assert.strictEqual(goodRes.status, 201);
      const goodData: any = await goodRes.json();
      createdProductId = goodData.productId;

      const badPut = await origFetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ images: ['blob:https://evil.local/foo'] }),
      });
      assert.strictEqual(badPut.status, 400);

      const idorPut = await origFetch(`${baseUrl}/api/products/${createdProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bystanderToken}` },
        body: JSON.stringify({ title: 'Hacked Title' }),
      });
      assert.strictEqual(idorPut.status, 403);
    });

    // ------------------------------------------------------------------------
    // 3. Packing Photo Persistence & Handshake OTP Delivery State Machine
    // ------------------------------------------------------------------------
    let sweepOrderId = '';
    const validPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    await test('3. Packing photo saved, hidden Handshake OTP from seller, seller delivers strictly with matching 4-digit OTP', async () => {
      const initRes = await origFetch(`${baseUrl}/api/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          items: [{ productId: createdProductId, quantity: 1, deliveryMethod: 'pickup' }],
          campus: 'Lagos Mainland',
          paymentMethod: 'flutterwave_card',
        }),
      });
      assert.strictEqual(initRes.status, 200);
      const initJson: any = await initRes.json();
      sweepOrderId = initJson.data.orderId;
      verifyTxRef = initJson.data.reference;
      verifyAmountNaira = initJson.data.grandTotalNaira;

      const whRes = await origFetch(`${baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'verif-hash': process.env.FLW_WEBHOOK_SECRET_HASH! },
        body: JSON.stringify({
          event: 'charge.completed',
          data: { id: 551199, tx_ref: verifyTxRef, amount: verifyAmountNaira, currency: 'NGN', status: 'successful' },
        }),
      });
      assert.strictEqual(whRes.status, 200);

      // Seller GET /orders must NOT expose handshakeOtp
      const sellerOrdersRes = await origFetch(`${baseUrl}/api/orders`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      const sellerOrdersJson: any = await sellerOrdersRes.json();
      const sellerOrderView = sellerOrdersJson.orders.find((o: any) => o.id === sweepOrderId);
      assert.ok(sellerOrderView);
      assert.strictEqual(sellerOrderView.handshakeOtp, undefined);

      // Buyer GET /orders MUST see handshakeOtp
      const buyerOrdersRes = await origFetch(`${baseUrl}/api/orders`, {
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      const buyerOrdersJson: any = await buyerOrdersRes.json();
      const buyerOrderView = buyerOrdersJson.orders.find((o: any) => o.id === sweepOrderId);
      assert.ok(buyerOrderView && /^\d{4}$/.test(buyerOrderView.handshakeOtp));
      const realOtp = buyerOrderView.handshakeOtp;

      // Reject blob packing photo
      const badPack = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'packed', packedPhotoUrl: 'blob:https://temp/123' }),
      });
      assert.strictEqual(badPack.status, 400);

      // Valid packed photo saves to DB and returns in GET /orders
      const packRes = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'packed', packedPhotoUrl: validPngDataUrl }),
      });
      assert.strictEqual(packRes.status, 200);

      const buyerOrdersAfterPack: any = await (
        await origFetch(`${baseUrl}/api/orders`, { headers: { Authorization: `Bearer ${buyerToken}` } })
      ).json();
      assert.strictEqual(
        buyerOrdersAfterPack.orders.find((o: any) => o.id === sweepOrderId)?.packedPhotoUrl,
        validPngDataUrl
      );

      // Shipped
      const shipRes = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'shipped' }),
      });
      assert.strictEqual(shipRes.status, 200);

      // Seller without OTP cannot deliver
      const noOtpDeliver = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'delivered' }),
      });
      assert.strictEqual(noOtpDeliver.status, 403);

      // Seller with wrong OTP cannot deliver
      const wrongOtpDeliver = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'delivered', handshakeOtp: realOtp === '0000' ? '1111' : '0000' }),
      });
      assert.strictEqual(wrongOtpDeliver.status, 403);

      // Seller with matching OTP succeeds
      const rightOtpDeliver = await origFetch(`${baseUrl}/api/orders/${sweepOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ status: 'delivered', handshakeOtp: realOtp }),
      });
      assert.strictEqual(rightOtpDeliver.status, 200);
    });

    // ------------------------------------------------------------------------
    // 4. Coupons Endpoint (POST /api/coupons/validate)
    // ------------------------------------------------------------------------
    await test('4. POST /api/coupons/validate validates active, min-subtotal, expired, inactive, and max-uses rows in Postgres', async () => {
      await query(
        `INSERT INTO shopit_coupons (code, discount_kobo, min_subtotal_kobo, is_active, max_uses, current_uses, expires_at)
         VALUES
           ('SWEEP200', 20000, 100000, true, 10, 0, NOW() + INTERVAL '7 days'),
           ('EXP200', 20000, 0, true, 10, 0, NOW() - INTERVAL '1 day'),
           ('OFF200', 20000, 0, false, 10, 0, NOW() + INTERVAL '7 days'),
           ('MAX200', 20000, 0, true, 1, 1, NOW() + INTERVAL '7 days')
         ON CONFLICT (code) DO UPDATE SET
           discount_kobo = EXCLUDED.discount_kobo,
           min_subtotal_kobo = EXCLUDED.min_subtotal_kobo,
           is_active = EXCLUDED.is_active,
           max_uses = EXCLUDED.max_uses,
           current_uses = EXCLUDED.current_uses,
           expires_at = EXCLUDED.expires_at`
      );

      const okRes = await origFetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ code: 'sweep200', subtotal: 2500 }),
      });
      assert.strictEqual(okRes.status, 200);
      const okJson: any = await okRes.json();
      assert.strictEqual(okJson.coupon.discountAmount, 200);

      const lowRes = await origFetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ code: 'SWEEP200', subtotal: 500 }),
      });
      assert.strictEqual(lowRes.status, 400);

      for (const badCode of ['EXP200', 'OFF200', 'MAX200']) {
        const badRes = await origFetch(`${baseUrl}/api/coupons/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
          body: JSON.stringify({ code: badCode, subtotal: 5000 }),
        });
        assert.strictEqual(badRes.status, 400, `Expected 400 for coupon ${badCode}`);
      }

      const missingRes = await origFetch(`${baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ code: 'NO_SUCH_CODE', subtotal: 5000 }),
      });
      assert.strictEqual(missingRes.status, 404);
    });

    // ------------------------------------------------------------------------
    // 5. Disputes Authorization, Image Validation & Packing Photo Inheritance
    // ------------------------------------------------------------------------
    await test('5. Disputes enforce participant auth, reject unsafe evidence URLs, persist to DB, and inherit seller packed photo', async () => {
      const idorDispute = await origFetch(`${baseUrl}/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bystanderToken}` },
        body: JSON.stringify({ orderId: sweepOrderId, reason: 'Fake dispute' }),
      });
      assert.strictEqual(idorDispute.status, 403);

      const badImgDispute = await origFetch(`${baseUrl}/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          orderId: sweepOrderId,
          reason: 'Damaged Item',
          evidencePhotoUrl: 'javascript:alert(1)',
        }),
      });
      assert.strictEqual(badImgDispute.status, 400);

      const okDispute = await origFetch(`${baseUrl}/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({
          orderId: sweepOrderId,
          reason: 'Damaged Item',
          description: 'Bead clasp snapped on arrival',
          evidencePhotoUrl: validPngDataUrl,
        }),
      });
      assert.strictEqual(okDispute.status, 201);
      const okDisputeJson: any = await okDispute.json();
      assert.ok(okDisputeJson.disputeId);

      const dbDisp = await query('SELECT * FROM shopit_disputes WHERE id = $1', [okDisputeJson.disputeId]);
      assert.strictEqual(dbDisp.rows.length, 1);
      assert.strictEqual(dbDisp.rows[0].seller_packed_photo_url, validPngDataUrl);

      const bystanderList: any = await (
        await origFetch(`${baseUrl}/api/disputes`, { headers: { Authorization: `Bearer ${bystanderToken}` } })
      ).json();
      assert.strictEqual(
        bystanderList.disputes.some((d: any) => d.id === okDisputeJson.disputeId),
        false
      );
    });

    // ------------------------------------------------------------------------
    // 6. IDOR & Role Sweep: Notifications, KYC Documents, Legacy Verify, Commissions
    // ------------------------------------------------------------------------
    await test('6a. Non-owner PATCH /notifications/:id/read returns 404; owner succeeds', async () => {
      const notifId = `notif_p3s_${ts}`;
      await query(
        `INSERT INTO shopit_notifications (id, user_id, title, message, type, is_read)
         VALUES ($1, $2, 'Order Paid', 'Test notif', 'info', false)`,
        [notifId, buyerId]
      );

      const idorRead = await origFetch(`${baseUrl}/api/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${bystanderToken}` },
      });
      assert.strictEqual(idorRead.status, 404);

      const ownerRead = await origFetch(`${baseUrl}/api/notifications/${notifId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${buyerToken}` },
      });
      assert.strictEqual(ownerRead.status, 200);
    });

    let recentDocId = '';
    let recentDocUrl = '';
    await test('6b. GET /verification/document/:docId blocks finance-only admin & bystanders (403), allows owner & moderator (200)', async () => {
      const submitRes = await origFetch(`${baseUrl}/api/verification/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({
          sellerId,
          shopName: 'Sweep Studio',
          fullName: 'Sweep Artisan',
          nin: '12345678901',
          idDocumentType: 'nin_slip',
          idDocumentPhoto: validPngDataUrl,
          selfiePhoto: validPngDataUrl,
          livenessScore: 95,
          ndpaConsentSigned: true,
        }),
      });
      assert.strictEqual(submitRes.status, 200);
      const submitJson: any = await submitRes.json();

      const verRow = await query('SELECT document_url FROM shopit_verifications WHERE id = $1', [submitJson.verificationId]);
      recentDocUrl = verRow.rows[0].document_url;
      recentDocId = decodeURIComponent(recentDocUrl.split('/verification/document/')[1].split('?')[0]);

      const finRes = await origFetch(`${baseUrl}${recentDocUrl}`, {
        headers: { Authorization: `Bearer ${finSess.token}` },
      });
      assert.strictEqual(finRes.status, 403);

      const bystanderRes = await origFetch(`${baseUrl}${recentDocUrl}`, {
        headers: { Authorization: `Bearer ${bystanderToken}` },
      });
      assert.strictEqual(bystanderRes.status, 403);

      const ownerRes = await origFetch(`${baseUrl}${recentDocUrl}`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
      });
      assert.strictEqual(ownerRes.status, 200);

      const modRes = await origFetch(`${baseUrl}${recentDocUrl}`, {
        headers: { Authorization: `Bearer ${modSess.token}` },
      });
      assert.strictEqual(modRes.status, 200);
    });

    await test('6c. Legacy POST /sellers/verify/submit enforces ownerName + 11-digit NIN', async () => {
      const shortNin = await origFetch(`${baseUrl}/api/sellers/verify/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ sellerId, ownerName: 'Sweep Artisan', nin: '1234' }),
      });
      assert.strictEqual(shortNin.status, 400);

      const noName = await origFetch(`${baseUrl}/api/sellers/verify/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ sellerId, ownerName: '', nin: '12345678901' }),
      });
      assert.strictEqual(noName.status, 400);
    });

    await test('6d. Commissions reject self-commission (400), create valid commission (201), and allow admin read', async () => {
      const selfComm = await origFetch(`${baseUrl}/api/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sellerToken}` },
        body: JSON.stringify({ sellerId, title: 'Own Custom', budget: 5000 }),
      });
      assert.strictEqual(selfComm.status, 400);

      const validComm = await origFetch(`${baseUrl}/api/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${buyerToken}` },
        body: JSON.stringify({ sellerId, title: 'Custom Tote Bag', description: 'Navy cotton', budget: 6500 }),
      });
      assert.strictEqual(validComm.status, 201);
      const validCommJson: any = await validComm.json();

      const adminList: any = await (
        await origFetch(`${baseUrl}/api/commissions`, { headers: { Authorization: `Bearer ${modSess.token}` } })
      ).json();
      assert.ok(adminList.commissions.some((c: any) => c.id === validCommJson.commissionId));
    });

    // ------------------------------------------------------------------------
    // 7. 30-Day NDPA Automated KYC Document Purge
    // ------------------------------------------------------------------------
    await test('7. expireStalePendingOrders() purges KYC docs older than 30 days on completed reviews while preserving recent docs', async () => {
      const oldSellerId = `old_seller_p3s_${ts}`;
      const oldVerifId = `VERIF_OLD_${ts}`;
      const oldDocId = `doc_old_${ts}`;
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

      await query(
        `INSERT INTO shopit_verifications (
           id, seller_id, shop_name, owner_name, status, document_url, selfie_url, submitted_at, created_at, updated_at
         ) VALUES ($1, $2, 'Old Studio', 'Old Owner', 'verified', '/api/verification/document/old', '/api/verification/document/old_s', $3, $3, $3)`,
        [oldVerifId, oldSellerId, oldDate]
      );
      await query(
        `INSERT INTO shopit_verification_documents (id, seller_id, doc_type, encrypted_data, created_at)
         VALUES ($1, $2, 'id_document', 'encrypted_old_payload', $3)`,
        [oldDocId, oldSellerId, oldDate]
      );

      const purgeRes = await expireStalePendingOrders();
      assert.ok(purgeRes.purgedDocsCount >= 1, `Expected purgedDocsCount >= 1, got ${purgeRes.purgedDocsCount}`);

      const oldDocCheck = await query('SELECT id FROM shopit_verification_documents WHERE id = $1', [oldDocId]);
      assert.strictEqual(oldDocCheck.rows.length, 0);

      const oldVerCheck = await query('SELECT document_url, selfie_url FROM shopit_verifications WHERE id = $1', [oldVerifId]);
      assert.strictEqual(oldVerCheck.rows[0].document_url, '[Purged after 30 days]');
      assert.strictEqual(oldVerCheck.rows[0].selfie_url, '[Purged after 30 days]');

      // Recent pending submission doc must NOT be purged
      const recentDocCheck = await query('SELECT id FROM shopit_verification_documents WHERE id = $1', [recentDocId]);
      assert.strictEqual(recentDocCheck.rows.length, 1);
    });

    console.log(`\n=== PHASE 3 FULL DEBUG SWEEP RESULTS: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    globalThis.fetch = origFetch;
    server.close();
  }
}

main().catch(err => {
  console.error('Phase 3 sweep failed:', err);
  process.exit(1);
});
