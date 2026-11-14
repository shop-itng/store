// Verification test for Phase 0 Safety Switches
// Tests that all payment, order-creation, wallet and payout endpoints return 503 when PAYMENTS_ENABLED / PAYOUTS_ENABLED are false

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TestResult {
  endpoint: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  expectedMessageSnippet: string;
  actualMessage: string;
  passed: boolean;
}

async function runTest(
  name: string,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
  expectedSnippet = 'Online payments are coming soon'
): Promise<TestResult> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data: any = await res.json().catch(() => ({}));
    const message = data.message || data.error || JSON.stringify(data);
    const passed = res.status === 503 && message.includes(expectedSnippet);

    return {
      endpoint: path,
      method,
      expectedStatus: 503,
      actualStatus: res.status,
      expectedMessageSnippet: expectedSnippet,
      actualMessage: message,
      passed,
    };
  } catch (err: any) {
    return {
      endpoint: path,
      method,
      expectedStatus: 503,
      actualStatus: 0,
      expectedMessageSnippet: expectedSnippet,
      actualMessage: `FETCH_ERROR: ${err.message}`,
      passed: false,
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log('SHOP IT: PHASE 0 SAFETY SWITCH VERIFICATION SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  const tests: TestResult[] = [];

  // 1. POST /api/orders
  tests.push(
    await runTest('Order Creation', 'POST', '/api/orders', {
      items: [{ productId: 'p1', quantity: 1 }],
      buyerEmail: 'buyer@test.ng',
    })
  );

  // 2. GET /api/wallet
  tests.push(
    await runTest('Seller Wallet Retrieval', 'GET', '/api/wallet')
  );

  // 3. POST /api/wallet/payout-account
  tests.push(
    await runTest('Payout Account Setup', 'POST', '/api/wallet/payout-account', {
      bankCode: '999992',
      accountNumber: '1234567890',
    })
  );

  // 4. POST /api/payments/initialize
  tests.push(
    await runTest('Payment Initialization', 'POST', '/api/payments/initialize', {
      email: 'buyer@test.ng',
      sellerPrice: 1000,
    })
  );

  // 5. POST /api/payments/webhook
  tests.push(
    await runTest('Payment Webhook', 'POST', '/api/payments/webhook', {
      event: 'charge.completed',
    })
  );

  // 6. GET /api/payments/verify/:reference
  tests.push(
    await runTest('Payment Verification Query', 'GET', '/api/payments/verify/SAMPLE_REF_123')
  );

  // 7. POST /api/payments/transfer (Payout safety switch)
  tests.push(
    await runTest(
      'Seller Withdrawal / Payout',
      'POST',
      '/api/payments/transfer',
      { amount: 5000, payoutAccountId: 'acc_123', otpCode: '123456' },
      undefined,
      'Payouts are currently disabled by system safety switch'
    )
  );

  console.table(
    tests.map(t => ({
      Method: t.method,
      Endpoint: t.endpoint,
      Expected: t.expectedStatus,
      Actual: t.actualStatus,
      Snippet: t.expectedMessageSnippet.slice(0, 30) + '...',
      Result: t.passed ? 'PASS' : 'FAIL',
    }))
  );

  const allPassed = tests.every(t => t.passed);
  console.log('\n----------------------------------------------------');
  console.log(`TOTAL TESTS: ${tests.length}`);
  console.log(`PASSED: ${tests.filter(t => t.passed).length}`);
  console.log(`FAILED: ${tests.filter(t => !t.passed).length}`);
  console.log(`SAFETY SWITCH STATUS: ${allPassed ? 'ALL ENFORCED (503 SERVICE UNAVAILABLE)' : 'BREACH DETECTED'}`);
  console.log('----------------------------------------------------\n');

  if (!allPassed) {
    process.exit(1);
  }
}

main();
