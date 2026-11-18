import './testEnv.js';
import { query, withTransaction, runMigration, getDatabaseUrl } from '../api/db/postgres.js';
import { commitPaidOrderTransaction, calculatePricingInKobo } from '../api/lib/payments.js';

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
}

async function seedLocalVerificationScenario() {
  if (isProductionRuntime() || getDatabaseUrl()) {
    throw new Error(
      'Refusing to seed test financial data: --seed-local is strictly restricted to non-production in-memory databases.'
    );
  }

  const existingOrders = await query(
    `SELECT COUNT(*)::int AS cnt FROM shopit_orders WHERE status IN ('paid', 'packed', 'shipped', 'delivered', 'completed')`
  );
  if (Number(existingOrders.rows[0]?.cnt || 0) > 0) {
    return { seeded: false };
  }

  console.log('[Reconcile] --seed-local enabled on pg-mem — seeding deterministic verification scenario...');
  const buyerId = 'rec_buyer_1';
  const sellerId1 = 'rec_seller_1';
  const sellerId2 = 'rec_seller_2';

  await query(
    `INSERT INTO shopit_users (id, email, name, password_hash, role, is_verified_email, age)
     VALUES
       ($1, 'rec_buyer@shopit.ng', 'Reconcile Buyer', 'hash_unused', 'buyer', true, 20),
       ($2, 'rec_seller1@shopit.ng', 'Reconcile Seller 1', 'hash_unused', 'seller', true, 21),
       ($3, 'rec_seller2@shopit.ng', 'Reconcile Seller 2', 'hash_unused', 'seller', true, 22)
     ON CONFLICT (id) DO NOTHING`,
    [buyerId, sellerId1, sellerId2]
  );

  await query(
    `INSERT INTO shopit_sellers (id, user_id, shop_name, owner_name, email, is_verified_seller, verification_status)
     VALUES
       ($1, $1, 'Reconcile Shop 1', 'Reconcile Seller 1', 'rec_seller1@shopit.ng', true, 'verified'),
       ($2, $2, 'Reconcile Shop 2', 'Reconcile Seller 2', 'rec_seller2@shopit.ng', true, 'verified')
     ON CONFLICT (id) DO NOTHING`,
    [sellerId1, sellerId2]
  );

  await query(
    `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo)
     VALUES
       ($1, 0, 0, 0),
       ($2, 0, 0, 0)
     ON CONFLICT (seller_id) DO NOTHING`,
    [sellerId1, sellerId2]
  );

  const p1 = calculatePricingInKobo(500000); // ₦5,000 + ₦500 fee = ₦5,500
  const p2 = calculatePricingInKobo(300000); // ₦3,000 + ₦500 fee = ₦3,500

  // Order 1: Paid & stays in Pending
  await query(
    `INSERT INTO shopit_orders (
       id, buyer_id, buyer_name, buyer_email, items,
       subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
       status, payment_method, payment_reference, handshake_otp
     ) VALUES (
       'REC-ORD-1', $1, 'Reconcile Buyer', 'rec_buyer@shopit.ng', $2,
       500000, 50000, 0, 0, 550000,
       'pending_payment', 'card', 'rec_ref_1', '1111'
     ) ON CONFLICT (id) DO NOTHING`,
    [
      buyerId,
      JSON.stringify([
        {
          productId: 'rec_prod_1',
          title: 'Handcrafted Bead Bag',
          sellerId: sellerId1,
          sellerShopName: 'Reconcile Shop 1',
          sellerPrice: p1.sellerPriceNaira,
          serviceFee: p1.serviceFeeNaira,
          displayPrice: p1.displayPriceNaira,
          sellerPriceKobo: p1.sellerPriceKobo,
          serviceFeeKobo: p1.serviceFeeKobo,
          displayPriceKobo: p1.displayPriceKobo,
          quantity: 1,
        },
      ]),
    ]
  );

  await commitPaidOrderTransaction({
    reference: 'rec_ref_1',
    confirmedAmountKobo: 550000,
    currency: 'NGN',
    channel: 'card',
    webhookReceived: true,
    customerEmail: 'rec_buyer@shopit.ng',
    source: 'reconcile_seed',
  });

  // Order 2: Paid -> Released to Available -> Partial Withdrawal of ₦1,500 (+ ₦50 fee)
  await query(
    `INSERT INTO shopit_orders (
       id, buyer_id, buyer_name, buyer_email, items,
       subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
       status, payment_method, payment_reference, handshake_otp
     ) VALUES (
       'REC-ORD-2', $1, 'Reconcile Buyer', 'rec_buyer@shopit.ng', $2,
       300000, 50000, 0, 0, 350000,
       'pending_payment', 'card', 'rec_ref_2', '2222'
     ) ON CONFLICT (id) DO NOTHING`,
    [
      buyerId,
      JSON.stringify([
        {
          productId: 'rec_prod_2',
          title: 'Brass Charm Bracelet',
          sellerId: sellerId2,
          sellerShopName: 'Reconcile Shop 2',
          sellerPrice: p2.sellerPriceNaira,
          serviceFee: p2.serviceFeeNaira,
          displayPrice: p2.displayPriceNaira,
          sellerPriceKobo: p2.sellerPriceKobo,
          serviceFeeKobo: p2.serviceFeeKobo,
          displayPriceKobo: p2.displayPriceKobo,
          quantity: 1,
        },
      ]),
    ]
  );

  await commitPaidOrderTransaction({
    reference: 'rec_ref_2',
    confirmedAmountKobo: 350000,
    currency: 'NGN',
    channel: 'card',
    webhookReceived: true,
    customerEmail: 'rec_buyer@shopit.ng',
    source: 'reconcile_seed',
  });

  await withTransaction(async client => {
    await client.query(`UPDATE shopit_orders SET status = 'completed', completed_at = NOW() WHERE id = 'REC-ORD-2'`);
    await client.query(
      `UPDATE shopit_wallets
       SET pending_balance_kobo = pending_balance_kobo - 300000,
           available_balance_kobo = available_balance_kobo + 300000
       WHERE seller_id = $1`,
      [sellerId2]
    );
    await client.query(
      `INSERT INTO shopit_ledger_entries (
         id, wallet_id, order_id, type, amount_kobo, fee_kobo,
         balance_type, balance_after_kobo, description, reference, idempotency_key, created_at
       ) VALUES ($1, $2, 'REC-ORD-2', 'escrow_release', 300000, 0, 'available', 300000, 'Reconcile Release REC-ORD-2', 'REC-ORD-2', 'rel_REC-ORD-2', NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [`led_rel_${Date.now()}`, sellerId2]
    );

    // Withdraw ₦1,500 (150,000 kobo) net + ₦50 fee (5,000 kobo) = ₦1,550 total debit
    await client.query(
      `UPDATE shopit_wallets
       SET available_balance_kobo = available_balance_kobo - 155000,
           total_withdrawn_kobo = total_withdrawn_kobo + 150000
       WHERE seller_id = $1`,
      [sellerId2]
    );
    await client.query(
      `INSERT INTO shopit_ledger_entries (
         id, wallet_id, type, amount_kobo, fee_kobo,
         balance_type, balance_after_kobo, description, reference, idempotency_key, created_at
       ) VALUES ($1, $2, 'withdrawal', 150000, 5000, 'available', 145000, 'Reconcile Withdrawal', 'wd_rec_1', 'wd_key_rec_1', NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [`led_wd_${Date.now()}`, sellerId2]
    );
  });

  return { seeded: true };
}

export async function runReadOnlyReconciliation(): Promise<{
  ok: boolean;
  errors: number;
  walletsChecked: number;
  ordersChecked: number;
  totalPendingKobo: number;
  totalAvailableKobo: number;
  totalWithdrawnKobo: number;
}> {
  let errors = 0;
  console.log('\n=== SHOP IT LEDGER & WALLET RECONCILIATION (READ-ONLY) ===');

  // 1. Check no negative balances
  const negRes = await query(
    `SELECT seller_id, pending_balance_kobo, available_balance_kobo
     FROM shopit_wallets
     WHERE pending_balance_kobo < 0 OR available_balance_kobo < 0`
  );
  if (negRes.rows.length > 0) {
    errors++;
    console.error('[FAIL] Negative wallet balances found:', negRes.rows);
  } else {
    console.log('[PASS] Zero negative wallet balances.');
  }

  // 2. Check every paid/active/completed order has exactly 1 paid payment record and matching sale_pending ledger set
  const paidOrdersRes = await query(
    `SELECT id, payment_reference, status, items
     FROM shopit_orders
     WHERE status IN ('paid', 'packed', 'shipped', 'delivered', 'completed')`
  );

  for (const ord of paidOrdersRes.rows) {
    const payRes = await query(
      `SELECT reference, status FROM shopit_payments WHERE reference = $1 OR order_id = $2`,
      [ord.payment_reference, ord.id]
    );
    const paidPayments = payRes.rows.filter((p: any) => p.status === 'paid');
    if (paidPayments.length !== 1) {
      errors++;
      console.error(`[FAIL] Order ${ord.id} expected 1 paid payment record, found ${paidPayments.length}`);
    }

    let items: any[] = [];
    try {
      items = typeof ord.items === 'string' ? JSON.parse(ord.items) : (ord.items || []);
    } catch {}
    const expectedSellerKobo = items.reduce((s: number, it: any) => {
      const unitKobo = Number(it.sellerPriceKobo) || Math.round(Number(it.sellerPrice || 0) * 100);
      return s + unitKobo * Math.max(1, Number(it.quantity || 1));
    }, 0);

    const ledRes = await query(
      `SELECT type, amount_kobo
       FROM shopit_ledger_entries
       WHERE order_id = $1`,
      [ord.id]
    );

    const salePendingKobo = ledRes.rows
      .filter((l: any) => l.type === 'sale_pending')
      .reduce((s: number, l: any) => s + Number(l.amount_kobo || 0), 0);
    const releaseKobo = ledRes.rows
      .filter((l: any) => l.type === 'escrow_release')
      .reduce((s: number, l: any) => s + Number(l.amount_kobo || 0), 0);

    if (salePendingKobo !== expectedSellerKobo) {
      errors++;
      console.error(`[FAIL] Order ${ord.id} sale_pending (${salePendingKobo} kobo) != item seller earnings (${expectedSellerKobo} kobo)`);
    }
    if (ord.status === 'completed' && releaseKobo !== expectedSellerKobo) {
      errors++;
      console.error(`[FAIL] Completed order ${ord.id} escrow_release (${releaseKobo} kobo) != ${expectedSellerKobo} kobo`);
    }
  }
  console.log(`[PASS] Checked ${paidOrdersRes.rows.length} paid/completed order(s): payment=1 & ledger set matches.`);

  // 3. Wallet conservation equation check per wallet and globally
  const walletsRes = await query(
    `SELECT seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo
     FROM shopit_wallets`
  );

  let totalPendingWallets = 0;
  let totalAvailableWallets = 0;
  let totalWithdrawnWallets = 0;

  for (const w of walletsRes.rows) {
    const sid = w.seller_id;
    const ledRes = await query(
      `SELECT type, balance_type, amount_kobo, fee_kobo
       FROM shopit_ledger_entries
       WHERE wallet_id = $1`,
      [sid]
    );

    let derivedPending = 0;
    let derivedAvailable = 0;

    for (const l of ledRes.rows) {
      const amt = Number(l.amount_kobo || 0);
      const fee = Number(l.fee_kobo || 0);
      if (l.type === 'sale_pending') {
        derivedPending += amt;
      } else if (l.type === 'escrow_release') {
        derivedPending -= amt;
        derivedAvailable += amt;
      } else if (l.type === 'withdrawal') {
        derivedAvailable -= (amt + fee);
      } else if (l.type === 'refund' || l.type === 'reversal') {
        if (l.balance_type === 'pending') derivedPending -= amt;
        else derivedAvailable += amt;
      }
    }

    const wPending = Number(w.pending_balance_kobo || 0);
    const wAvail = Number(w.available_balance_kobo || 0);
    const wWithdrawn = Number(w.total_withdrawn_kobo || 0);

    if (wPending !== derivedPending || wAvail !== derivedAvailable) {
      errors++;
      console.error(
        `[FAIL] Wallet ${sid} drift! DB(pending=${wPending}, avail=${wAvail}) vs Ledger(pending=${derivedPending}, avail=${derivedAvailable})`
      );
    }

    totalPendingWallets += wPending;
    totalAvailableWallets += wAvail;
    totalWithdrawnWallets += wWithdrawn;
  }

  const allLedgerRes = await query(
    `SELECT type, balance_type, amount_kobo, fee_kobo FROM shopit_ledger_entries`
  );
  let withdrawalFeesKobo = 0;
  let grossSalesKobo = 0;
  let pendingRefundsKobo = 0;
  let releasedEarningsKobo = 0;

  for (const l of allLedgerRes.rows) {
    const amt = Number(l.amount_kobo || 0);
    const fee = Number(l.fee_kobo || 0);
    if (l.type === 'withdrawal') withdrawalFeesKobo += fee;
    if (l.type === 'sale_pending') grossSalesKobo += amt;
    if (l.type === 'refund' && l.balance_type === 'pending') pendingRefundsKobo += amt;
    if (l.type === 'escrow_release') releasedEarningsKobo += amt;
  }

  const expectedAvailablePlusWithdrawn = Number(releasedEarningsKobo);
  const actualAvailablePlusWithdrawn = totalAvailableWallets + totalWithdrawnWallets + withdrawalFeesKobo;

  console.log(`Total Wallets Checked          : ${walletsRes.rows.length}`);
  console.log(`Pending Balance Total (kobo)   : ${totalPendingWallets}`);
  console.log(`Available Balance Total (kobo) : ${totalAvailableWallets}`);
  console.log(`Total Withdrawn Net (kobo)     : ${totalWithdrawnWallets} (+ withdrawal fees ${withdrawalFeesKobo})`);
  console.log(`Released Order Earnings (kobo) : ${expectedAvailablePlusWithdrawn}`);
  console.log(`Gross Sales - Pending Refunds  : ${Number(grossSalesKobo) - Number(pendingRefundsKobo)} (Actual Wallet+Withdrawn+Fees = ${totalPendingWallets + actualAvailablePlusWithdrawn})`);

  if (actualAvailablePlusWithdrawn !== expectedAvailablePlusWithdrawn) {
    errors++;
    console.error(`[FAIL] Global equation mismatch: available+withdrawn+fees (${actualAvailablePlusWithdrawn}) != released earnings (${expectedAvailablePlusWithdrawn})`);
  } else {
    console.log('[PASS] Sum of available wallet balances + withdrawals (+ fees) == sum of released order earnings.');
  }

  if (totalPendingWallets + actualAvailablePlusWithdrawn !== Number(grossSalesKobo) - Number(pendingRefundsKobo)) {
    errors++;
    console.error('[FAIL] Gross pending + available + withdrawn != net sales.');
  } else {
    console.log('[PASS] Full conservation across pending + available + withdrawn == net credited sales.');
  }

  return {
    ok: errors === 0,
    errors,
    walletsChecked: walletsRes.rows.length,
    ordersChecked: paidOrdersRes.rows.length,
    totalPendingKobo: totalPendingWallets,
    totalAvailableKobo: totalAvailableWallets,
    totalWithdrawnKobo: totalWithdrawnWallets,
  };
}

async function main() {
  await runMigration();

  if (process.argv.includes('--seed-local')) {
    await seedLocalVerificationScenario();
  }

  const report = await runReadOnlyReconciliation();
  if (!report.ok) {
    console.error(`\nRECONCILIATION FAILED with ${report.errors} error(s).`);
    process.exit(1);
  }
  console.log('\nRECONCILIATION PASSED CLEANLY (STRICTLY READ-ONLY).');
}

const isDirectExec =
  process.argv[1] &&
  (process.argv[1].endsWith('reconcile-ledger.ts') || process.argv[1].endsWith('reconcile-ledger.js'));

if (isDirectExec) {
  main().catch(err => {
    console.error('Reconciliation crashed:', err);
    process.exit(1);
  });
}
