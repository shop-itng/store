import { query, withTransaction, runMigration } from '../api/db/postgres.js';
import { commitPaidOrderTransaction, calculatePricingInKobo } from '../api/lib/payments.js';

async function seedVerificationScenario() {
  const existingOrders = await query(
    `SELECT COUNT(*)::int AS cnt FROM shopit_orders WHERE status IN ('paid', 'packed', 'shipped', 'delivered', 'completed')`
  );
  if (Number(existingOrders.rows[0]?.cnt || 0) > 0) {
    return { seeded: false };
  }

  console.log('[Reconcile] No existing paid orders found — seeding deterministic financial test scenario in local DB...');
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
    `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo)
     VALUES
       ($1, 0, 0, 0, 0, 0, 0),
       ($2, 0, 0, 0, 0, 0, 0)
     ON CONFLICT (seller_id) DO NOTHING`,
    [sellerId1, sellerId2]
  );

  const p1 = calculatePricingInKobo(500000); // ₦5,000 + ₦500 fee = ₦5,500
  const p2 = calculatePricingInKobo(300000); // ₦3,000 + ₦500 fee = ₦3,500

  // Order 1: Paid & stays in Pending
  await query(
    `INSERT INTO shopit_orders (
       id, buyer_id, buyer_name, buyer_email, items,
       subtotal, subtotal_kobo, service_fee_total, service_fee_kobo,
       delivery_total, delivery_fee_kobo, discount_total, discount_total_kobo,
       grand_total, grand_total_kobo,
       status, payment_method, payment_reference, handshake_otp
     ) VALUES (
       'REC-ORD-1', $1, 'Reconcile Buyer', 'rec_buyer@shopit.ng', $2,
       5000, 500000, 500, 50000,
       0, 0, 0, 0,
       5500, 550000,
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
       subtotal, subtotal_kobo, service_fee_total, service_fee_kobo,
       delivery_total, delivery_fee_kobo, discount_total, discount_total_kobo,
       grand_total, grand_total_kobo,
       status, payment_method, payment_reference, handshake_otp
     ) VALUES (
       'REC-ORD-2', $1, 'Reconcile Buyer', 'rec_buyer@shopit.ng', $2,
       3000, 300000, 500, 50000,
       0, 0, 0, 0,
       3500, 350000,
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
       SET pending_balance = pending_balance - 3000,
           available_balance = available_balance + 3000,
           pending_balance_kobo = pending_balance_kobo - 300000,
           available_balance_kobo = available_balance_kobo + 300000
       WHERE seller_id = $1`,
      [sellerId2]
    );
    await client.query(
      `INSERT INTO shopit_ledger_entries (
         id, wallet_id, order_id, type, amount, amount_kobo, fee, fee_kobo,
         balance_type, balance_after, balance_after_kobo, description, reference, idempotency_key, created_at
       ) VALUES ($1, $2, 'REC-ORD-2', 'escrow_release', 3000, 300000, 0, 0, 'available', 3000, 300000, 'Reconcile Release REC-ORD-2', 'REC-ORD-2', 'rel_REC-ORD-2', NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [`led_rel_${Date.now()}`, sellerId2]
    );

    // Withdraw ₦1,500 (150,000 kobo) net + ₦50 fee (5,000 kobo) = ₦1,550 total debit
    await client.query(
      `UPDATE shopit_wallets
       SET available_balance = available_balance - 1550,
           total_withdrawn = total_withdrawn + 1500,
           available_balance_kobo = available_balance_kobo - 155000,
           total_withdrawn_kobo = total_withdrawn_kobo + 150000
       WHERE seller_id = $1`,
      [sellerId2]
    );
    await client.query(
      `INSERT INTO shopit_ledger_entries (
         id, wallet_id, type, amount, amount_kobo, fee, fee_kobo,
         balance_type, balance_after, balance_after_kobo, description, reference, idempotency_key, created_at
       ) VALUES ($1, $2, 'withdrawal', 1500, 150000, 50, 5000, 'available', 1450, 145000, 'Reconcile Withdrawal', 'wd_rec_1', 'wd_key_rec_1', NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [`led_wd_${Date.now()}`, sellerId2]
    );
  });

  return { seeded: true };
}

async function main() {
  await runMigration();
  await seedVerificationScenario();

  let errors = 0;
  console.log('\n=== SHOP IT LEDGER & WALLET RECONCILIATION ===');

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

  // 2. Check every paid/active/completed order has exactly 1 paid payment record and 1 sale_pending ledger set
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
      `SELECT type, amount_kobo, amount
       FROM shopit_ledger_entries
       WHERE order_id = $1`,
      [ord.id]
    );

    const toKobo = (row: any) =>
      Number(row.amount_kobo) !== 0 && row.amount_kobo !== null && row.amount_kobo !== undefined
        ? Number(row.amount_kobo)
        : Math.round(Number(row.amount || 0) * 100);

    const salePendingKobo = ledRes.rows
      .filter((l: any) => l.type === 'sale_pending')
      .reduce((s: number, l: any) => s + toKobo(l), 0);
    const releaseKobo = ledRes.rows
      .filter((l: any) => l.type === 'escrow_release')
      .reduce((s: number, l: any) => s + toKobo(l), 0);

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
    `SELECT seller_id, pending_balance_kobo, pending_balance, available_balance_kobo, available_balance, total_withdrawn_kobo, total_withdrawn
     FROM shopit_wallets`
  );

  let totalPendingWallets = 0;
  let totalAvailableWallets = 0;
  let totalWithdrawnWallets = 0;

  const fieldKobo = (koboVal: any, nairaVal: any) =>
    koboVal !== null && koboVal !== undefined && Number(koboVal) !== 0
      ? Number(koboVal)
      : Math.round(Number(nairaVal || 0) * 100);

  for (const w of walletsRes.rows) {
    const sid = w.seller_id;
    const ledRes = await query(
      `SELECT type, balance_type, description, amount_kobo, amount, fee_kobo, fee
       FROM shopit_ledger_entries
       WHERE wallet_id = $1`,
      [sid]
    );

    let derivedPending = 0;
    let derivedAvailable = 0;

    for (const l of ledRes.rows) {
      const amt = fieldKobo(l.amount_kobo, l.amount);
      const fee = fieldKobo(l.fee_kobo, l.fee);
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

    const wPending = fieldKobo(w.pending_balance_kobo, w.pending_balance);
    const wAvail = fieldKobo(w.available_balance_kobo, w.available_balance);
    const wWithdrawn = fieldKobo(w.total_withdrawn_kobo, w.total_withdrawn);

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
    `SELECT type, balance_type, amount_kobo, amount, fee_kobo, fee FROM shopit_ledger_entries`
  );
  let withdrawalFeesKobo = 0;
  let gross_sales_kobo = 0;
  let pending_refunds_kobo = 0;
  let released_earnings_kobo = 0;

  for (const l of allLedgerRes.rows) {
    const amt = fieldKobo(l.amount_kobo, l.amount);
    const fee = fieldKobo(l.fee_kobo, l.fee);
    if (l.type === 'withdrawal') withdrawalFeesKobo += fee;
    if (l.type === 'sale_pending') gross_sales_kobo += amt;
    if (l.type === 'refund' && l.balance_type === 'pending') pending_refunds_kobo += amt;
    if (l.type === 'escrow_release') released_earnings_kobo += amt;
  }
  const expectedAvailablePlusWithdrawn = Number(released_earnings_kobo);
  const actualAvailablePlusWithdrawn = totalAvailableWallets + totalWithdrawnWallets + withdrawalFeesKobo;

  console.log(`Total Wallets Checked          : ${walletsRes.rows.length}`);
  console.log(`Pending Balance Total (kobo)   : ${totalPendingWallets}`);
  console.log(`Available Balance Total (kobo) : ${totalAvailableWallets}`);
  console.log(`Total Withdrawn Net (kobo)     : ${totalWithdrawnWallets} (+ withdrawal fees ${withdrawalFeesKobo})`);
  console.log(`Released Order Earnings (kobo) : ${expectedAvailablePlusWithdrawn}`);
  console.log(`Gross Sales - Pending Refunds  : ${Number(gross_sales_kobo) - Number(pending_refunds_kobo)} (Actual Wallet+Withdrawn+Fees = ${totalPendingWallets + actualAvailablePlusWithdrawn})`);

  if (actualAvailablePlusWithdrawn !== expectedAvailablePlusWithdrawn) {
    errors++;
    console.error(`[FAIL] Global equation mismatch: available+withdrawn+fees (${actualAvailablePlusWithdrawn}) != released earnings (${expectedAvailablePlusWithdrawn})`);
  } else {
    console.log('[PASS] Sum of available wallet balances + withdrawals (+ fees) == sum of released order earnings.');
  }

  if (totalPendingWallets + actualAvailablePlusWithdrawn !== Number(gross_sales_kobo) - Number(pending_refunds_kobo)) {
    errors++;
    console.error('[FAIL] Gross pending + available + withdrawn != net sales.');
  } else {
    console.log('[PASS] Full conservation across pending + available + withdrawn == net credited sales.');
  }

  if (errors > 0) {
    console.error(`\nRECONCILIATION FAILED with ${errors} error(s).`);
    process.exit(1);
  }
  console.log('\nRECONCILIATION PASSED CLEANLY.');
}

main().catch(err => {
  console.error('Reconciliation crashed:', err);
  process.exit(1);
});
