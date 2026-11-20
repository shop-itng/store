import './testEnv.js';
import { query, runMigration } from '../server/db/postgres.js';

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
