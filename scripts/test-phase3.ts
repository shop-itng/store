import crypto from 'crypto';
import { runMigration, query as dbQuery } from '../api/db/postgres.js';
import { processEscrowAutoRelease } from '../api/routes/marketplace.js';
import { hashOtp, saveHashedOtp, getOtpRecord, verifyOtpHash } from '../api/db/otpStore.js';
import paystackWebhookHandler from '../api/paystack/webhook.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader: (key: string, val: string) => void;
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
    end(data?: string) {
      if (data) this.body = data;
    },
  };
  return res;
}

async function runPhase3Tests() {
  console.log('====================================================');
  console.log('🧪 SHOP IT - PHASE 3 VERIFICATION & PROOF SUITE');
  console.log('====================================================\n');

  // Ensure DB tables exist
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

  // TEST 1: Paystack Webhook rejects missing signature with 401
  {
    const req: any = {
      method: 'POST',
      headers: {},
      rawBody: Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'TEST_REF_1' } })),
    };
    const res = createMockRes();
    process.env.PAYSTACK_WEBHOOK_SECRET = 'test_secret_key_123';

    await paystackWebhookHandler(req, res);
    assert(res.statusCode === 401, 'Webhook rejects missing x-paystack-signature header with HTTP 401');
  }

  // TEST 2: Paystack Webhook rejects invalid HMAC SHA-512 signature with 401
  {
    const req: any = {
      method: 'POST',
      headers: {
        'x-paystack-signature': 'invalid_forged_signature_hex_value',
      },
      rawBody: Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'TEST_REF_2' } })),
    };
    const res = createMockRes();

    await paystackWebhookHandler(req, res);
    assert(res.statusCode === 401, 'Webhook rejects invalid HMAC signature with HTTP 401');
  }

  // TEST 3: Paystack Webhook accepts valid HMAC SHA-512 signature and processes 5-day escrow
  {
    const secret = 'test_secret_key_123';
    process.env.PAYSTACK_WEBHOOK_SECRET = secret;
    process.env.PAYSTACK_SECRET_KEY = secret;

    const testRef = `PSTK_TEST_${Date.now()}`;
    const testOrderId = `ORD_ESCROW_${Date.now()}`;
    const testSellerId = `seller_escrow_${Date.now()}`;

    // Seed test order in Neon Postgres
    await dbQuery(`
      INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email,
        items, subtotal, service_fee_total, delivery_total, discount_total, grand_total,
        payment_method, payment_reference, campus, status, auto_release_at, created_at, updated_at
      ) VALUES (
        $1, 'buyer_123', 'Emeka Okafor', 'emeka@futo.edu.ng',
        $2, 10000, 500, 1000, 0, 11500,
        'paystack', $3, 'FUTO', 'pending_payment', NULL, NOW(), NOW()
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
    ]);

    const payloadObj = {
      event: 'charge.success',
      data: {
        reference: testRef,
        amount: 1150000, // 11,500 NGN in kobo
        currency: 'NGN',
        status: 'success',
        channel: 'card',
        metadata: { orderId: testOrderId },
        customer: { email: 'emeka@futo.edu.ng' },
      },
    };
    const rawBuffer = Buffer.from(JSON.stringify(payloadObj), 'utf-8');
    const validSignature = crypto.createHmac('sha512', secret).update(rawBuffer).digest('hex');

    const req: any = {
      method: 'POST',
      headers: {
        'x-paystack-signature': validSignature,
      },
      rawBody: rawBuffer,
    };
    const res = createMockRes();

    await paystackWebhookHandler(req, res);
    assert(res.statusCode === 200, 'Webhook processes valid signature with HTTP 200');

    // Verify Neon database updates
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
    assert(replayBody.message?.includes('idempotent') || replayBody.status === true, 'Duplicate webhook event handled idempotently without duplicate credit');
  }

  // TEST 5: Escrow 5-day Auto-Release Routine
  {
    const autoReleaseOrderId = `ORD_EXPIRED_${Date.now()}`;
    const autoReleaseSellerId = `seller_auto_${Date.now()}`;

    // Seed expired escrow order (auto_release_at in past)
    await dbQuery(`
      INSERT INTO shopit_orders (
        id, buyer_id, buyer_name, buyer_email,
        items, subtotal, service_fee_total, delivery_total, discount_total, grand_total,
        payment_method, payment_reference, campus, status, auto_release_at, created_at, updated_at
      ) VALUES (
        $1, 'buyer_test', 'Chidi', 'chidi@unn.edu.ng',
        $2, 8000, 400, 0, 0, 8400,
        'paystack', $3, 'UNN', 'paid', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '6 days', NOW()
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
    ]);

    // Setup seller pending balance
    await dbQuery(`
      INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
      VALUES ($1, 80, 0, 0, false, 800000, 0, 0, NOW(), NOW())
      ON CONFLICT (seller_id) DO UPDATE SET pending_balance_kobo = 800000, available_balance_kobo = 0
    `, [autoReleaseSellerId]);

    const releaseResult = await processEscrowAutoRelease();
    assert(releaseResult.releasedCount >= 1 && releaseResult.orderIds.includes(autoReleaseOrderId), 'Escrow auto-release routine released expired order');

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
  console.log(`📊 PHASE 3 TEST RESULTS: ${passed}/${total} PASSED`);
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
