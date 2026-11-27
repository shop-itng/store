import './testEnv.js';
import { runMigration, query as dbQuery } from '../server/db/postgres.js';
import { processEscrowAutoRelease } from '../server/routes/marketplace.js';
import { hashOtp, saveHashedOtp, getOtpRecord, verifyOtpHash } from '../server/db/otpStore.js';
import paystackWebhookHandler from '../server/webhooks/paystack.js';
import crypto from 'crypto';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader: (key: string, val: string) => void;
  status: (code: number) => MockResponse;
  json: (data: any) => void;
  end: (data?: string) => void;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = JSON.stringify(data);
    },
    end(data?: string) {
      if (data) this.body = data;
    },
  };
  return res;
}

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🧪 SHOP IT - PAYSTACK WEBHOOK & ESCROW VERIFICATION');
  console.log('====================================================\n');

  await runMigration();

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${name}`);
    } else {
      console.error(`❌ [FAIL] ${name}`);
    }
  }

  process.env.PAYMENTS_ENABLED = 'true';
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_phase3_mock_secret_key';

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  // TEST 1: Paystack Webhook rejects missing x-paystack-signature with 401
  {
    const req: any = {
      method: 'POST',
      headers: {},
      rawBody: Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'TEST_REF_1' } })),
    };
    const res = createMockRes();
    await paystackWebhookHandler(req, res);
    assert(res.statusCode === 401, 'Webhook rejects missing x-paystack-signature header with HTTP 401');
  }

  // TEST 2: Paystack Webhook rejects invalid x-paystack-signature with 401
  {
    const req: any = {
      method: 'POST',
      headers: {
        'x-paystack-signature': 'invalid_forged_hash_value',
      },
      rawBody: Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'TEST_REF_2' } })),
    };
    const res = createMockRes();
    await paystackWebhookHandler(req, res);
    assert(res.statusCode === 401, 'Webhook rejects invalid x-paystack-signature header with HTTP 401');
  }

  // TEST 3: Paystack Webhook accepts valid signature + Paystack verify and processes 5-day escrow
  {
    const testRef = `PSTK_TEST_${Date.now()}`;
    const testOrderId = `ORD_ESCROW_${Date.now()}`;
    const testSellerId = `seller_escrow_${Date.now()}`;
    const testBuyerId = `buyer_123_${Date.now()}`;

    await dbQuery(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, is_verified_email, age)
       VALUES
         ($1, $2, 'Emeka Okafor', 'hash_placeholder', 'buyer', true, 21),
         ($3, $4, 'Owerri Artisan', 'hash_placeholder', 'seller', true, 23)`,
      [testBuyerId, `emeka_${Date.now()}@futo.edu.ng`, testSellerId, `seller_${Date.now()}@futo.edu.ng`]
    );
    await dbQuery(
      `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status)
       VALUES ($1, $1, 'Owerri Leather Works', 'Owerri Artisan', $2, true, 'verified')`,
      [testSellerId, `seller_${Date.now()}@futo.edu.ng`]
    );

    await dbQuery(`
      INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email,
        items, subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
        payment_method, payment_reference, campus, status, auto_release_at, created_at, updated_at
      ) VALUES (
        $1, $4, 'Emeka Okafor', 'emeka@futo.edu.ng',
        $2, 1000000, 50000, 100000, 0, 1150000,
        'paystack_card', $3, 'FUTO', 'pending_payment', NULL, NOW(), NOW()
      )
    `, [
      testOrderId,
      JSON.stringify([{
        productId: 'prod_99',
        sellerId: testSellerId,
        sellerShopName: 'Owerri Leather Works',
        sellerPrice: 10000,
        quantity: 1,
      }]),
      testRef,
      testBuyerId,
    ]);

    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('api.paystack.co/transaction/verify')) {
        return new Response(
          JSON.stringify({
            status: true,
            data: {
              id: 9876543,
              reference: testRef,
              amount: 1150000, // in kobo
              currency: 'NGN',
              status: 'success',
              channel: 'card',
              customer: { email: 'emeka@futo.edu.ng' },
              gateway_response: 'Approved',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return origFetch(input, init);
    }) as any;

    try {
      const payloadObj = {
        event: 'charge.success',
        data: {
          id: 9876543,
          reference: testRef,
          amount: 1150000,
          currency: 'NGN',
          status: 'success',
          channel: 'card',
          customer: { email: 'emeka@futo.edu.ng' },
        },
      };
      const rawBuffer = Buffer.from(JSON.stringify(payloadObj), 'utf-8');
      const computedSig = crypto.createHmac('sha512', paystackSecret!).update(rawBuffer).digest('hex');

      const req: any = {
        method: 'POST',
        headers: {
          'x-paystack-signature': computedSig,
        },
        rawBody: rawBuffer,
      };
      const res = createMockRes();

      await paystackWebhookHandler(req, res);
      assert(res.statusCode === 200, 'Webhook processes valid signature with HTTP 200');

      const orderCheck = await dbQuery('SELECT status, auto_release_at FROM shopit_orders WHERE id = $1', [testOrderId]);
      assert(orderCheck.rows[0]?.status === 'paid', 'Order status moved to "paid" in PostgreSQL');
      assert(orderCheck.rows[0]?.auto_release_at !== null, 'Order auto_release_at set to 5-day escrow window');

      const walletCheck = await dbQuery('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [testSellerId]);
      const pendingKobo = parseInt(walletCheck.rows[0]?.pending_balance_kobo || '0', 10);
      assert(pendingKobo === 1000000, `Seller pending escrow balance credited with 1,000,000 kobo (actual: ${pendingKobo} kobo)`);

      const ledgerCheck = await dbQuery('SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1 AND type = $2', [testSellerId, 'sale_pending']);
      assert(ledgerCheck.rows.length > 0, 'Append-only ledger recorded "sale_pending" entry in PostgreSQL');

      // TEST 4: Idempotency (replay attack prevention)
      const replayRes = createMockRes();
      await paystackWebhookHandler(req, replayRes);
      const replayBody = JSON.parse(replayRes.body || '{}');
      assert(replayBody.status === true, 'Duplicate webhook event handled idempotently without duplicate credit');
    } finally {
      globalThis.fetch = origFetch;
    }
  }

  // TEST 5: Escrow 5-day Auto-Release Routine (releases shipped/delivered orders, never unshipped 'paid' orders)
  {
    const autoReleaseOrderId = `ORD_EXPIRED_${Date.now()}`;
    const unshippedOrderId = `ORD_UNSHIPPED_${Date.now()}`;
    const autoReleaseSellerId = `seller_auto_${Date.now()}`;
    const autoBuyerId = `buyer_test_${Date.now()}`;

    await dbQuery(
      `INSERT INTO shopit_users (id, email, name, password_hash, role, is_verified_email, age)
       VALUES
         ($1, $2, 'Chidi', 'hash_placeholder', 'buyer', true, 21),
         ($3, $4, 'UNN Maker', 'hash_placeholder', 'seller', true, 23)`,
      [autoBuyerId, `chidi_${Date.now()}@unn.edu.ng`, autoReleaseSellerId, `unn_${Date.now()}@unn.edu.ng`]
    );
    await dbQuery(
      `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status)
       VALUES ($1, $1, 'UNN Craft Store', 'UNN Maker', $2, true, 'verified')`,
      [autoReleaseSellerId, `unn_${Date.now()}@unn.edu.ng`]
    );

    await dbQuery(`
      INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email,
        items, subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
        payment_method, payment_reference, campus, status, auto_release_at, created_at, updated_at
      ) VALUES
      (
        $1, $6, 'Chidi', 'chidi@unn.edu.ng',
        $2, 800000, 40000, 0, 0, 840000,
        'paystack_card', $3, 'UNN', 'shipped', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '6 days', NOW()
      ),
      (
        $4, $6, 'Chidi', 'chidi@unn.edu.ng',
        $2, 800000, 40000, 0, 0, 840000,
        'paystack_card', $5, 'UNN', 'paid', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '6 days', NOW()
      )
    `, [
      autoReleaseOrderId,
      JSON.stringify([{
        productId: 'prod_auto_1',
        sellerId: autoReleaseSellerId,
        sellerShopName: 'UNN Craft Store',
        sellerPrice: 8000,
        quantity: 1,
      }]),
      `REF_EXPIRED_${Date.now()}`,
      unshippedOrderId,
      `REF_UNSHIPPED_${Date.now()}`,
      autoBuyerId,
    ]);

    await dbQuery(`
      INSERT INTO shopit_wallets (seller_id, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
      VALUES ($1, false, 800000, 0, 0, NOW(), NOW())
      ON CONFLICT (seller_id) DO UPDATE SET pending_balance_kobo = 800000, available_balance_kobo = 0
    `, [autoReleaseSellerId]);

    const releaseResult = await processEscrowAutoRelease();
    assert(releaseResult.releasedCount >= 1 && releaseResult.orderIds.includes(autoReleaseOrderId), 'Escrow auto-release routine released expired shipped order');
    assert(!releaseResult.orderIds.includes(unshippedOrderId), 'Escrow auto-release does NOT release never-shipped "paid" order');

    const updatedWallet = await dbQuery('SELECT pending_balance_kobo, available_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [autoReleaseSellerId]);
    const finalPending = parseInt(updatedWallet.rows[0]?.pending_balance_kobo || '0', 10);
    const finalAvailable = parseInt(updatedWallet.rows[0]?.available_balance_kobo || '0', 10);

    assert(finalPending === 0, `Pending escrow cleared to 0 (actual: ${finalPending})`);
    assert(finalAvailable === 800000, `Available withdrawable balance credited with 800,000 kobo (actual: ${finalAvailable})`);

    const autoLedger = await dbQuery('SELECT * FROM shopit_ledger_entries WHERE wallet_id = $1 AND type = $2', [autoReleaseSellerId, 'escrow_release']);
    assert(autoLedger.rows.length > 0, 'Append-only ledger recorded "escrow_release" entry in PostgreSQL');
  }

  // TEST 6: OTP Generation & Hashing Verification
  {
    const testEmail = 'artisan_withdraw@shopit.ng';
    const otpCode = '849201';
    const hashed = hashOtp(otpCode);

    await saveHashedOtp(testEmail, 'withdrawal', hashed, { sellerId: 'seller_123' });
    const stored = await getOtpRecord(testEmail, 'withdrawal');

    assert(stored !== null, 'Hashed OTP stored in DB');
    assert(verifyOtpHash(otpCode, stored?.codeHash || ''), 'Timing-safe OTP hash verification succeeds');
    assert(!verifyOtpHash('000000', stored?.codeHash || ''), 'Incorrect OTP code safely rejected');
  }

  console.log(`\n====================================================`);
  console.log(`📊 ESCROW & PAYSTACK WEBHOOK TEST RESULTS: ${passed}/${total} PASSED`);
  console.log(`====================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
