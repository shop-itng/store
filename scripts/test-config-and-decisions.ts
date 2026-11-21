import './testEnv.js';
import http from 'http';
import assert from 'assert';
import sharp from 'sharp';
import { app } from '../server/app.js';
import { query, runMigration } from '../server/db/postgres.js';
import { fileStorage, PER_USER_STORAGE_LIMIT_BYTES } from '../server/lib/fileStorage.js';
import { issueSignupVerificationToken } from '../server/db/otpStore.js';

let passed = 0;
let failed = 0;
const capturedWarnings: string[] = [];

process.on('warning', (w: Error) => {
  capturedWarnings.push(`${w.name}: ${w.message}`);
});

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
  console.log('==================================================================');
  console.log('SHOP IT - CONFIG UPDATE, SIGNUP BUG FIX & DECISIONS VERIFICATION');
  console.log('==================================================================\n');

  await runMigration();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const origFetch = globalThis.fetch;
  const origAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const origBrevoKey = process.env.BREVO_API_KEY;
  const origFlwSecret = process.env.FLW_SECRET_KEY;
  const origFlwPub = process.env.FLW_PUBLIC_KEY;
  const origFlwHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  const origPaymentsEnabled = process.env.PAYMENTS_ENABLED;

  const ts = Date.now();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Full End-to-End Signup Flow (send-otp -> 429 cooldown -> verify-otp
    //         -> shopit_verified_signups -> register atomic TX -> shopit_users -> login)
    // -------------------------------------------------------------------------
    await test('1. Full Buyer & Seller Signup E2E (send-otp, 429 cooldown, verify-otp, shopit_verified_signups, atomic register, login)', async () => {
      process.env.BREVO_API_KEY = 'xkeysib-test-signup-key';
      let lastOtpCode = '';
      let welcomeSentCount = 0;

      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://api.brevo.com/v3/smtp/email')) {
          const payload = JSON.parse(String(init?.body || '{}'));
          const textBody = String(payload.textContent || '');
          const htmlBody = String(payload.htmlContent || '');
          if (String(payload.subject || '').toLowerCase().includes('welcome')) {
            welcomeSentCount++;
          } else {
            const match = `${textBody} ${htmlBody}`.match(/\b(\d{6})\b/);
            if (match) lastOtpCode = match[1];
          }
          return new Response(JSON.stringify({ messageId: '<mock-brevo-id>' }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return origFetch(input, init);
      }) as any;

      try {
        const buyerEmail = `e2e_buyer_${ts}@shopit.ng`;
        const buyerPass = 'StrongBuyerPass123!';

        // Step 1: send-otp succeeds
        const send1 = await origFetch(`${baseUrl}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            purpose: 'signup',
            deviceId: `dev_e2e_${ts}`,
            metadata: { name: 'Amina Buyer' },
          }),
        });
        assert.strictEqual(send1.status, 200);
        const send1Json: any = await send1.json();
        assert.strictEqual(send1Json.status, true);
        assert.strictEqual(send1Json.emailDelivered, true);
        assert.ok(/^\d{6}$/.test(lastOtpCode), `Expected 6-digit OTP in email payload, got "${lastOtpCode}"`);

        // Step 2: Immediate duplicate send-otp 2s later returns friendly 429 cooldown
        const send2 = await origFetch(`${baseUrl}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            purpose: 'signup',
            deviceId: `dev_e2e_${ts}`,
          }),
        });
        assert.strictEqual(send2.status, 429);
        const send2Json: any = await send2.json();
        assert.ok(send2Json.waitSeconds >= 1, '429 cooldown must include waitSeconds');

        // Step 3: register without OTP proof must fail 403 and NOT create user or send welcome email
        const blockedReg = await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            password: buyerPass,
            name: 'Amina Buyer',
            role: 'buyer',
            age: 20,
          }),
        });
        assert.strictEqual(blockedReg.status, 403);
        assert.strictEqual(welcomeSentCount, 0, 'Welcome email must NEVER send before user exists in DB');

        // Step 4: verify-otp consumes OTP & writes row to shopit_verified_signups
        const verifyRes = await origFetch(`${baseUrl}/api/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            purpose: 'signup',
            code: lastOtpCode,
          }),
        });
        assert.strictEqual(verifyRes.status, 200);
        const verifyJson: any = await verifyRes.json();
        assert.ok(verifyJson.signupVerificationToken);

        const vsRowBefore = await query('SELECT email FROM shopit_verified_signups WHERE email = $1', [buyerEmail]);
        assert.strictEqual(vsRowBefore.rows.length, 1, 'verify-otp must insert email into shopit_verified_signups');

        // Step 5: register using token inserts shopit_users AND consumes shopit_verified_signups atomically
        const regRes = await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            password: buyerPass,
            name: 'Amina Buyer',
            role: 'buyer',
            age: 20,
            signupVerificationToken: verifyJson.signupVerificationToken,
          }),
        });
        assert.strictEqual(regRes.status, 201);
        const regJson: any = await regRes.json();
        assert.strictEqual(regJson.user.isVerifiedEmail, true);

        const dbUser = await query('SELECT id, email, is_verified_email FROM shopit_users WHERE email = $1', [buyerEmail]);
        assert.strictEqual(dbUser.rows.length, 1);
        assert.strictEqual(dbUser.rows[0].is_verified_email, true);

        const vsRowAfter = await query('SELECT email FROM shopit_verified_signups WHERE email = $1', [buyerEmail]);
        assert.strictEqual(vsRowAfter.rows.length, 0, 'shopit_verified_signups must be consumed in same TX');

        // Wait briefly for non-blocking post-commit welcome email
        await new Promise(r => setTimeout(r, 40));
        assert.strictEqual(welcomeSentCount, 1, 'Welcome email must fire strictly after DB commit');

        // Step 6: Registered buyer can immediately log in
        const loginRes = await origFetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: buyerEmail, password: buyerPass }),
        });
        assert.strictEqual(loginRes.status, 200);
        const loginJson: any = await loginRes.json();
        assert.ok(loginJson.sessionToken);

        // Step 7: Repeat for Seller flow
        lastOtpCode = '';
        const sellerEmail = `e2e_seller_${ts}@shopit.ng`;
        const sSend = await origFetch(`${baseUrl}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: sellerEmail, purpose: 'signup', deviceId: `dev_seller_${ts}` }),
        });
        assert.strictEqual(sSend.status, 200);
        assert.ok(/^\d{6}$/.test(lastOtpCode));

        const sVer: any = await (
          await origFetch(`${baseUrl}/api/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sellerEmail, purpose: 'signup', code: lastOtpCode }),
          })
        ).json();
        assert.ok(sVer.signupVerificationToken);

        const sReg = await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: sellerEmail,
            password: buyerPass,
            name: 'Zainab Artisan',
            role: 'seller',
            age: 22,
            shopName: 'Zainab Beads Studio',
            campus: 'UNILAG (Akoka)',
            signupVerificationToken: sVer.signupVerificationToken,
          }),
        });
        assert.strictEqual(sReg.status, 201);
        const sLogin = await origFetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: sellerEmail, password: buyerPass }),
        });
        assert.strictEqual(sLogin.status, 200);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 2: ALLOWED_ORIGINS Parsing, Canonical & Redirect Origins, Webhook Exempt
    // -------------------------------------------------------------------------
    await test('2. CORS accepts shopitng.vercel.app, shop-itng-pied.vercel.app & trimmed ALLOWED_ORIGINS; rejects others; webhook exempt', async () => {
      process.env.ALLOWED_ORIGINS = ' https://shopitng.vercel.app/ , https://shop-itng-pied.vercel.app/ ';
      for (const allowedOrigin of ['https://shopitng.vercel.app', 'https://shop-itng-pied.vercel.app']) {
        const optRes = await origFetch(`${baseUrl}/api/products`, {
          method: 'OPTIONS',
          headers: { Origin: allowedOrigin },
        });
        assert.strictEqual(optRes.status, 204);
        assert.strictEqual(optRes.headers.get('access-control-allow-origin'), allowedOrigin);
      }

      const evilOpt = await origFetch(`${baseUrl}/api/products`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://random-preview.vercel.app' },
      });
      assert.strictEqual(evilOpt.status, 403);

      // Server-to-server webhook POST with no Origin must reach webhook signature check (not blocked by CORS/CSRF)
      process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-mock-secret-key';
      process.env.FLW_WEBHOOK_SECRET_HASH = 'test_webhook_secret_hash_2026';
      process.env.PAYMENTS_ENABLED = 'true';
      const hookNoOrigin = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'charge.completed', data: { tx_ref: 'no_origin_test' } }),
      });
      assert.strictEqual(hookNoOrigin.status, 401);
    });

    // -------------------------------------------------------------------------
    // TEST 3: Flutterwave Webhook GET Check, Timing-Safe Signature, Replay & Logging
    // -------------------------------------------------------------------------
    await test('3. Flutterwave webhook GET message, 401 bad verif-hash, 200 idempotent credit, clean single-line logs', async () => {
      const hookGet = await origFetch(`${baseUrl}/api/webhooks/flutterwave`);
      assert.strictEqual(hookGet.status, 200);
      const hookGetJson: any = await hookGet.json();
      assert.deepStrictEqual(hookGetJson, { status: 'ok', message: 'POST only' });

      process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-mock-secret-key';
      process.env.FLW_PUBLIC_KEY = 'FLWPUBK_TEST-mock-public-key';
      process.env.FLW_WEBHOOK_SECRET_HASH = 'wh_hash_config_test_999';
      process.env.PAYMENTS_ENABLED = 'true';

      // Create buyer, seller, product, pending order & payment
      const sEmail = `wh_seller_${ts}@shopit.ng`;
      const sReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: sEmail,
            password: 'Password123!',
            name: 'Webhook Seller',
            role: 'seller',
            age: 22,
            shopName: 'Webhook Shop',
            signupVerificationToken: await issueSignupVerificationToken(sEmail),
          }),
        })
      ).json();
      const sId = sReg.user.sellerId || sReg.user.id;

      const bEmail = `wh_buyer_${ts}@shopit.ng`;
      const bReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: bEmail,
            password: 'Password123!',
            name: 'Webhook Buyer',
            role: 'buyer',
            age: 22,
            signupVerificationToken: await issueSignupVerificationToken(bEmail),
          }),
        })
      ).json();
      const bId = bReg.user.id;

      const prodId = `prod_wh_${ts}`;
      const ordId = `ORD-WH-${ts}`;
      const txRef = `FLW-REF-WH-${ts}`;
      await query(
        `INSERT INTO shopit_products (
           id, seller_id, seller_shop_name, title, category,
           seller_price_kobo, service_fee_kobo, display_price_kobo, stock
         ) VALUES ($1, $2, 'Webhook Shop', 'Webhook Vase', 'decor', 400000, 50000, 450000, 5)`,
        [prodId, sId]
      );
      await query(
        `INSERT INTO shopit_orders (
           id, buyer_id, buyer_name, buyer_email, items,
           subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
           payment_method, payment_reference, status
         ) VALUES ($1, $2, 'Webhook Buyer', $3, $4::jsonb, 400000, 50000, 0, 0, 450000, 'flutterwave_card', $5, 'pending_payment')`,
        [ordId, bId, bEmail, JSON.stringify([{ productId: prodId, sellerId: sId, sellerPrice: 4000, serviceFee: 500, quantity: 1 }]), txRef]
      );
      await query(
        `INSERT INTO shopit_payments (reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email)
         VALUES ($1, $2, 450000, 'NGN', 'card', 'pending_payment', false, $3)`,
        [txRef, ordId, bEmail]
      );

      const capturedLogs: string[] = [];
      const origInfo = console.info;
      const origLog = console.log;
      console.info = (...args: any[]) => {
        capturedLogs.push(args.map(String).join(' '));
      };
      console.log = (...args: any[]) => {
        capturedLogs.push(args.map(String).join(' '));
      };

      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/v3/transactions/998877/verify')) {
          return new Response(
            JSON.stringify({
              status: 'success',
              data: { id: 998877, tx_ref: txRef, amount: 4500, currency: 'NGN', status: 'successful', payment_type: 'card' },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return origFetch(input, init);
      }) as any;

      try {
        // Bad signature -> 401 & single-line log
        const badSig = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'verif-hash': 'wrong_hash' },
          body: JSON.stringify({ event: 'charge.completed', data: { id: 998877, tx_ref: txRef, amount: 4500, currency: 'NGN', status: 'successful' } }),
        });
        assert.strictEqual(badSig.status, 401);

        // Valid signature -> 200 + accepted log + wallet credited
        const okHook = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'verif-hash': 'wh_hash_config_test_999' },
          body: JSON.stringify({ event: 'charge.completed', data: { id: 998877, tx_ref: txRef, amount: 4500, currency: 'NGN', status: 'successful' } }),
        });
        assert.strictEqual(okHook.status, 200);

        // Duplicate replay -> 200 + duplicate log + no double credit
        const dupHook = await origFetch(`${baseUrl}/api/webhooks/flutterwave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'verif-hash': 'wh_hash_config_test_999' },
          body: JSON.stringify({ event: 'charge.completed', data: { id: 998877, tx_ref: txRef, amount: 4500, currency: 'NGN', status: 'successful' } }),
        });
        assert.strictEqual(dupHook.status, 200);
        const dupJson: any = await dupHook.json();
        assert.strictEqual(dupJson.duplicate, true);

        const wCheck = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sId]);
        assert.strictEqual(Number(wCheck.rows[0].pending_balance_kobo), 400000);

        const webhookLogs = capturedLogs.filter(l => l.startsWith('[FLW Webhook]'));
        assert.ok(webhookLogs.some(l => l.includes('result=rejected-signature')));
        assert.ok(webhookLogs.some(l => l.includes('result=accepted') && l.includes(txRef)));
        assert.ok(webhookLogs.some(l => l.includes('result=duplicate') && l.includes(txRef)));
        assert.ok(webhookLogs.every(l => !l.includes('wh_hash_config_test_999') && !l.includes(bEmail)), 'Webhook logs must not contain hashes or emails');
      } finally {
        console.info = origInfo;
        console.log = origLog;
        globalThis.fetch = origFetch;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 4: /api/health & /api/version & Zero url.parse() Deprecation Warnings
    // -------------------------------------------------------------------------
    await test('4. /api/health & /api/version return required operational fields with zero DEP0169 url.parse warnings', async () => {
      const hRes = await origFetch(`${baseUrl}/api/health`);
      assert.strictEqual(hRes.status, 200);
      const hJson: any = await hRes.json();
      assert.strictEqual(hJson.status, 'OK');
      assert.strictEqual(hJson.databaseConnected, true);
      assert.ok(typeof hJson.databaseHost === 'string' && hJson.databaseHost.length > 0);
      assert.ok(typeof hJson.tableCount === 'number' && hJson.tableCount >= 20);
      assert.strictEqual(typeof hJson.flutterwaveConfigured, 'boolean');
      assert.strictEqual(typeof hJson.paymentsEnabled, 'boolean');
      assert.strictEqual(typeof hJson.payoutsEnabled, 'boolean');
      assert.strictEqual(JSON.stringify(hJson).toLowerCase().includes('paystack'), false);

      const vRes = await origFetch(`${baseUrl}/api/version`);
      assert.strictEqual(vRes.status, 200);
      const vJson: any = await vRes.json();
      assert.ok(typeof vJson.commit === 'string' && vJson.commit.length > 0);
      assert.ok(!Number.isNaN(new Date(vJson.builtAt).getTime()));

      const urlParseWarnings = capturedWarnings.filter(w => w.includes('DEP0169') || w.includes('url.parse'));
      assert.strictEqual(urlParseWarnings.length, 0, `Unexpected url.parse warnings: ${urlParseWarnings.join('; ')}`);
    });

    // -------------------------------------------------------------------------
    // TEST 5: File Storage Compression (<=1280px, <400KB), Size Limits & 25MB Quota
    // -------------------------------------------------------------------------
    await test('5. Sharp resizes wide images <=1280px & <400KB stripping EXIF, rejects >4MB & PDF >2MB, enforces 25MB quota', async () => {
      const fEmail = `file_user_${ts}@shopit.ng`;
      const fReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: fEmail,
            password: 'Password123!',
            name: 'File User',
            role: 'buyer',
            age: 22,
            signupVerificationToken: await issueSignupVerificationToken(fEmail),
          }),
        })
      ).json();
      const fToken = fReg.sessionToken;
      const fUserId = fReg.user.id;

      // 5a. Large 2400x1600 PNG resized down cleanly
      const widePng = await sharp({
        create: { width: 2400, height: 1600, channels: 3, background: { r: 255, g: 107, b: 0 } },
      })
        .png()
        .toBuffer();
      const upWide = await origFetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({
          dataUrl: `data:image/png;base64,${widePng.toString('base64')}`,
          fileName: 'wide_camera_photo.png',
          purpose: 'product',
        }),
      });
      assert.strictEqual(upWide.status, 201);
      const upWideJson: any = await upWide.json();
      assert.ok(upWideJson.file.sizeBytes < 400 * 1024, `Compressed image must be <400KB, got ${upWideJson.file.sizeBytes}`);
      assert.ok(upWideJson.usage && upWideJson.usage.limitBytes === PER_USER_STORAGE_LIMIT_BYTES);

      // Verify uploaded binary dimensions <= 1280
      const storedRec = await fileStorage.getFileById(upWideJson.file.id);
      assert.ok(storedRec);
      const meta = await sharp(Buffer.from(storedRec!.dataBase64, 'base64')).metadata();
      assert.ok((meta.width || 0) <= 1280 && (meta.height || 0) <= 1280, `Expected <=1280px, got ${meta.width}x${meta.height}`);
      assert.strictEqual(meta.exif, undefined, 'EXIF must be stripped');

      // 5b. PDF > 2 MB rejected (413)
      const bigPdfBuf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(Math.floor(2.1 * 1024 * 1024), 'A')]);
      const bigPdfRes = await origFetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({
          dataUrl: `data:application/pdf;base64,${bigPdfBuf.toString('base64')}`,
          fileName: 'oversize.pdf',
          purpose: 'chat',
        }),
      });
      assert.strictEqual(bigPdfRes.status, 413);

      // 5c. Raw > 4 MB rejected BEFORE sharp (413)
      const hugeRaw = Buffer.alloc(4.2 * 1024 * 1024, 0xaa);
      const hugeRes = await origFetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({
          dataUrl: `data:image/jpeg;base64,${hugeRaw.toString('base64')}`,
          fileName: 'huge.jpg',
          purpose: 'avatar',
        }),
      });
      assert.strictEqual(hugeRes.status, 413);

      // 5d. Enforce 25 MB per-user quota cleanly
      const fake25Mb = PER_USER_STORAGE_LIMIT_BYTES - 10;
      await query(
        `INSERT INTO shopit_files (id, owner_id, purpose, original_name, mime_type, size_bytes, sha256, data_base64, is_public)
         VALUES ($1, $2, 'general', 'quota_fill.txt', 'text/plain', $3, 'deadbeef', 'Zg==', false)`,
        [`file_q_${ts}`, fUserId, fake25Mb]
      );
      const smallTxt = Buffer.from('A'.repeat(200)).toString('base64');
      const quotaRes = await origFetch(`${baseUrl}/api/files/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fToken}` },
        body: JSON.stringify({
          dataUrl: `data:text/plain;base64,${smallTxt}`,
          fileName: 'over_quota.txt',
          purpose: 'chat',
        }),
      });
      assert.strictEqual(quotaRes.status, 413);
    });

    // -------------------------------------------------------------------------
    // TEST 6: Gentle Chat Polling Cursor, /chat/unread-count & Under-18 Safety Rules
    // -------------------------------------------------------------------------
    await test('6. Incremental chat polling cursor, /chat/unread-count & centralized under-18 safety rules', async () => {
      const minor1Email = `m1_${ts}@shopit.ng`;
      const minor1Reg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: minor1Email,
            password: 'Password123!',
            name: 'Kemi MinorMaker',
            role: 'seller',
            age: 16,
            hasGuardianConsent: true,
            guardianName: 'Mrs Kemi',
            shopName: 'Kemi Young Crafts',
            signupVerificationToken: await issueSignupVerificationToken(minor1Email),
          }),
        })
      ).json();
      const minorSellerToken = minor1Reg.sessionToken;
      const minorSellerId = minor1Reg.user.sellerId || minor1Reg.user.id;

      const adultEmail = `ad_${ts}@shopit.ng`;
      const adultReg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: adultEmail,
            password: 'Password123!',
            name: 'Dapo Adult',
            role: 'buyer',
            age: 24,
            signupVerificationToken: await issueSignupVerificationToken(adultEmail),
          }),
        })
      ).json();
      const adultToken = adultReg.sessionToken;

      const minor2Email = `m2_${ts}@shopit.ng`;
      const minor2Reg: any = await (
        await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: minor2Email,
            password: 'Password123!',
            name: 'Bola Peer',
            role: 'buyer',
            age: 15,
            hasGuardianConsent: true,
            guardianName: 'Mr Bola',
            signupVerificationToken: await issueSignupVerificationToken(minor2Email),
          }),
        })
      ).json();
      const minor2Token = minor2Reg.sessionToken;

      // Minor product visible publicly & on shop
      const minorProdId = `prod_minor_${ts}`;
      await query(
        `INSERT INTO shopit_products (
           id, seller_id, seller_shop_name, title, category,
           seller_price_kobo, service_fee_kobo, display_price_kobo, stock
         ) VALUES ($1, $2, 'Kemi Young Crafts', 'Teen Ribbon Set', 'accessories', 200000, 30000, 230000, 3)`,
        [minorProdId, minorSellerId]
      );

      // Adult cannot follow minor -> 403
      const adultFollowMinor = await origFetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
        body: JSON.stringify({ targetUserId: minor1Reg.user.id }),
      });
      assert.strictEqual(adultFollowMinor.status, 403);

      // Minor cannot follow adult -> 403
      const minorFollowAdult = await origFetch(`${baseUrl}/api/follows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minorSellerToken}` },
        body: JSON.stringify({ targetUserId: adultReg.user.id }),
      });
      assert.strictEqual(minorFollowAdult.status, 403);

      // Minor-to-minor follow requires approval (pending)
      const m2FollowM1: any = await (
        await origFetch(`${baseUrl}/api/follows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${minor2Token}` },
          body: JSON.stringify({ targetUserId: minor1Reg.user.id }),
        })
      ).json();
      assert.strictEqual(m2FollowM1.followStatus, 'pending');

      // Search & Suggested exclude minor profiles
      const searchMinors: any = await (await origFetch(`${baseUrl}/api/profiles/search?q=Kemi`)).json();
      assert.strictEqual(searchMinors.profiles.some((p: any) => p.id === minor1Reg.user.id), false);

      // Unlinked private chat with minor (no productId/orderId) blocked -> 403
      const unlinkedMinorChat = await origFetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
        body: JSON.stringify({ sellerId: minorSellerId }),
      });
      assert.strictEqual(unlinkedMinorChat.status, 403);

      // Spoofed fake productId also blocked
      const fakeProdChat = await origFetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
        body: JSON.stringify({ sellerId: minorSellerId, productId: 'fake_product_id_999' }),
      });
      assert.ok([403, 404].includes(fakeProdChat.status));

      // Buyer CAN message minor seller about a verified active product -> 201
      const validMinorChat = await origFetch(`${baseUrl}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
        body: JSON.stringify({ sellerId: minorSellerId, productId: minorProdId }),
      });
      assert.strictEqual(validMinorChat.status, 201);
      const validChatJson: any = await validMinorChat.json();
      const convId = validChatJson.conversation.id;

      // Send message #1
      const msg1: any = await (
        await origFetch(`${baseUrl}/api/chat/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
          body: JSON.stringify({ content: 'Hello, is the ribbon set still available?' }),
        })
      ).json();
      assert.strictEqual(msg1.status, true);

      // Lightweight unread-count returns 1 for minor seller
      const unreadJson: any = await (
        await origFetch(`${baseUrl}/api/chat/unread-count`, {
          headers: { Authorization: `Bearer ${minorSellerToken}` },
        })
      ).json();
      assert.strictEqual(unreadJson.unreadCount, 1);

      // Incremental poll at cursor returns [] cleanly (no new messages)
      const cursorCreatedAt = msg1.message.createdAt;
      const cursorId = msg1.message.id;
      const emptyPoll: any = await (
        await origFetch(
          `${baseUrl}/api/chat/conversations/${convId}/messages?afterCreatedAt=${encodeURIComponent(cursorCreatedAt)}&afterId=${encodeURIComponent(cursorId)}`,
          { headers: { Authorization: `Bearer ${minorSellerToken}` } }
        )
      ).json();
      assert.strictEqual(emptyPoll.status, true);
      assert.strictEqual(emptyPoll.messages.length, 0);

      // Send message #2 -> incremental poll returns only message #2
      const msg2: any = await (
        await origFetch(`${baseUrl}/api/chat/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adultToken}` },
          body: JSON.stringify({ content: 'Can we meet at Moremi Gate?' }),
        })
      ).json();
      assert.strictEqual(msg2.status, true);

      const newPoll: any = await (
        await origFetch(
          `${baseUrl}/api/chat/conversations/${convId}/messages?afterCreatedAt=${encodeURIComponent(cursorCreatedAt)}&afterId=${encodeURIComponent(cursorId)}`,
          { headers: { Authorization: `Bearer ${minorSellerToken}` } }
        )
      ).json();
      assert.strictEqual(newPoll.messages.length, 1);
      assert.strictEqual(newPoll.messages[0].id, msg2.message.id);
    });

    // -------------------------------------------------------------------------
    // TEST 9: Logged-Out Visitor Public Routes, /api/auth/session (200) & Same-Origin CORS
    // -------------------------------------------------------------------------
    await test('9. Clean logged-out visitor receives 200 on /api/auth/session & all public routes; same-origin always accepted', async () => {
      // Unauthenticated /api/auth/session returns 200 { authenticated: false, user: null } (never 401)
      const anonSession = await origFetch(`${baseUrl}/api/auth/session`);
      assert.strictEqual(anonSession.status, 200);
      const anonSessionJson: any = await anonSession.json();
      assert.strictEqual(anonSessionJson.status, true);
      assert.strictEqual(anonSessionJson.authenticated, false);
      assert.strictEqual(anonSessionJson.user, null);

      // Unauthenticated /api/auth/me still enforces 401
      const anonMe = await origFetch(`${baseUrl}/api/auth/me`);
      assert.strictEqual(anonMe.status, 401);

      // Same-origin Origin header matching request Host is accepted cleanly
      const sameOriginRes = await origFetch(`${baseUrl}/api/products`, {
        headers: { Origin: baseUrl },
      });
      assert.strictEqual(sameOriginRes.status, 200);
      assert.strictEqual(sameOriginRes.headers.get('access-control-allow-origin'), baseUrl);

      // Every public initial-load endpoint responds 200 with zero cookies
      for (const ep of [
        '/api/health',
        '/api/version',
        '/api/platform/config',
        '/api/products?limit=20',
        '/api/sellers',
        '/api/profiles/discover/suggested?limit=8',
        '/api/webhooks/flutterwave',
      ]) {
        const res = await origFetch(`${baseUrl}${ep}`);
        assert.strictEqual(res.status, 200, `Expected 200 for ${ep}, got ${res.status}`);
      }

      // Authenticated /api/auth/session returns 200 authenticated: true + user
      const authTestEmail = `sess_check_${ts}@shopit.ng`;
      const regRes = await origFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authTestEmail,
          password: 'SessionUserPass123!',
          name: 'Kemi Tester',
          role: 'buyer',
          age: 21,
          signupVerificationToken: await issueSignupVerificationToken(authTestEmail),
        }),
      });
      assert.strictEqual(regRes.status, 201);
      const regData: any = await regRes.json();
      const authSessionRes = await origFetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${regData.sessionToken}` },
      });
      assert.strictEqual(authSessionRes.status, 200);
      const authSessionJson: any = await authSessionRes.json();
      assert.strictEqual(authSessionJson.authenticated, true);
      assert.strictEqual(authSessionJson.user.email, authTestEmail);
    });

    console.log(`\n=== CONFIG & DECISIONS TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    globalThis.fetch = origFetch;
    if (origAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = origAllowedOrigins;
    if (origBrevoKey === undefined) delete process.env.BREVO_API_KEY;
    else process.env.BREVO_API_KEY = origBrevoKey;
    if (origFlwSecret === undefined) delete process.env.FLW_SECRET_KEY;
    else process.env.FLW_SECRET_KEY = origFlwSecret;
    if (origFlwPub === undefined) delete process.env.FLW_PUBLIC_KEY;
    else process.env.FLW_PUBLIC_KEY = origFlwPub;
    if (origFlwHash === undefined) delete process.env.FLW_WEBHOOK_SECRET_HASH;
    else process.env.FLW_WEBHOOK_SECRET_HASH = origFlwHash;
    if (origPaymentsEnabled === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = origPaymentsEnabled;
    server.close();
  }
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
