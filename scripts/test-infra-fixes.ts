import './testEnv.js';
import http from 'http';
import assert from 'assert';
import { app } from '../api/index.js';
import {
  query,
  hashPassword,
  runMigration,
  ensureBootstrapAdminFromEnv,
} from '../api/db/postgres.js';
import { createSession } from '../api/auth/sessionStore.js';
import { issueSignupVerificationToken } from '../api/db/otpStore.js';
import { runReadOnlyReconciliation } from './reconcile-ledger.js';
import { restoreBackupPayload } from './restore-backup.js';

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
  console.log('==================================================================');
  console.log('SHOP IT - INFRASTRUCTURE, UNBLOCKED SIGNUP, FKs & RECOVERY TESTS');
  console.log('==================================================================\n');

  await runMigration();

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const origFetch = globalThis.fetch;

  try {
    const ts = Date.now();

    // Seed an Admin user & session
    const adminId = `adm_infra_${ts}`;
    const adminEmail = `adm_infra_${ts}@shopit.ng`;
    await query(
      `INSERT INTO shopit_users (id, email, name, display_name, profile_slug, password_hash, role, sub_role, is_verified_email, age)
       VALUES ($1, $2, 'Infra Admin', 'Infra', $3, $4, 'admin', 'superadmin', true, 30)`,
      [adminId, adminEmail, `infra-${ts}`, hashPassword('AdminPass123!')]
    );
    const adminSess = await createSession({
      userId: adminId,
      email: adminEmail,
      name: 'Infra Admin',
      role: 'admin',
      subRole: 'superadmin',
      tokenVersion: 1,
    });

    // -------------------------------------------------------------------------
    // TEST 1: Unblocked Registration & Same-TX Admin Alert with Redis DOWN,
    //         Email FAILING, Maintenance Mode=true, Pause Seller Signups=true
    // -------------------------------------------------------------------------
    let newBuyerId = '';
    let newSellerId = '';
    await test('1. Buyer & Seller signup + Admin New Users feed work when Redis is DOWN, Email FAILS, and Maintenance/Pause flags are ON', async () => {
      const savedKvUrl = process.env.KV_REST_API_URL;
      const savedKvToken = process.env.KV_REST_API_TOKEN;
      const savedBrevoKey = process.env.BREVO_API_KEY;
      const savedCronSecret = process.env.CRON_SECRET;

      process.env.KV_REST_API_URL = 'https://127.0.0.1:1';
      process.env.KV_REST_API_TOKEN = 'dead_redis_token';
      process.env.BREVO_API_KEY = 'xkeysib-failing-test-key';

      globalThis.fetch = (async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://127.0.0.1:1')) {
          throw new Error('ECONNREFUSED: Simulated Redis outage');
        }
        if (url.startsWith('https://api.brevo.com')) {
          return new Response(JSON.stringify({ message: 'Simulated Brevo 503 Outage' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return origFetch(input, init);
      }) as any;

      try {
        // Turn ON maintenanceMode + pauseSellerSignups
        const ksRes = await origFetch(`${baseUrl}/api/admin/emergency-controls`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
          body: JSON.stringify({ maintenanceMode: true, pauseSellerSignups: true, pauseNewOrders: false }),
        });
        assert.strictEqual(ksRes.status, 200);

        // 1a. send-otp saves OTP in Postgres during Redis + Brevo outage in non-prod; verify-otp records shopit_verified_signups
        const buyerEmail = `outage_buyer_${ts}@shopit.ng`;
        const otpRes = await origFetch(`${baseUrl}/api/auth/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: buyerEmail, purpose: 'signup', metadata: { name: 'Resilient Buyer' } }),
        });
        assert.strictEqual(otpRes.status, 200);
        const otpJson: any = await otpRes.json();
        assert.strictEqual(otpJson.status, true);
        assert.strictEqual(otpJson.emailDelivered, false);

        // Unverified /auth/signup must fail closed with 403
        const unverifiedRes = await origFetch(`${baseUrl}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            password: 'ResilientPass123!',
            name: 'Resilient Buyer',
            role: 'buyer',
            age: 22,
          }),
        });
        assert.strictEqual(unverifiedRes.status, 403);

        // 1b. With OTP proof token (even while Redis is DOWN & maintenanceMode=true & pauseSellerSignups=true) -> 201 + Postgres + Admin Alert
        const buyerProof = await issueSignupVerificationToken(buyerEmail);
        const buyerRegRes = await origFetch(`${baseUrl}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: buyerEmail,
            password: 'ResilientPass123!',
            name: 'Resilient Buyer',
            role: 'buyer',
            age: 22,
            signupVerificationToken: buyerProof,
          }),
        });
        assert.strictEqual(buyerRegRes.status, 201);
        const buyerRegJson: any = await buyerRegRes.json();
        assert.ok(buyerRegJson.sessionToken);
        assert.strictEqual(buyerRegJson.user.isVerifiedEmail, true);
        newBuyerId = buyerRegJson.user.id;

        // 1c. Seller registration via /api/auth/register -> 201 + Postgres + Wallet + Admin Alert
        const sellerEmail = `outage_seller_${ts}@shopit.ng`;
        const sellerProof = await issueSignupVerificationToken(sellerEmail);
        const sellerRegRes = await origFetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: sellerEmail,
            password: 'ResilientPass123!',
            name: 'Resilient Maker',
            role: 'seller',
            age: 24,
            shopName: 'Resilient Beads',
            campus: 'UNILAG (Akoka)',
            signupVerificationToken: sellerProof,
          }),
        });
        assert.strictEqual(sellerRegRes.status, 201);
        const sellerRegJson: any = await sellerRegRes.json();
        assert.ok(sellerRegJson.sessionToken);
        newSellerId = sellerRegJson.user.id;

        // 1d. Both users can immediately log in even with Redis down
        const loginRes = await origFetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: buyerEmail, password: 'ResilientPass123!' }),
        });
        assert.strictEqual(loginRes.status, 200);

        // 1e. Verify same-tx shopit_admin_alerts + shopit_notifications AND GET /api/admin/new-users
        const feedRes = await origFetch(`${baseUrl}/api/admin/new-users?limit=50`, {
          headers: { Authorization: `Bearer ${adminSess.token}` },
        });
        assert.strictEqual(feedRes.status, 200);
        const feedJson: any = await feedRes.json();
        assert.ok(feedJson.unreadCount >= 2, `Expected unreadCount >= 2, got ${feedJson.unreadCount}`);
        const buyerEntry = feedJson.items.find((it: any) => it.userId === newBuyerId);
        const sellerEntry = feedJson.items.find((it: any) => it.userId === newSellerId);
        assert.ok(buyerEntry, 'New buyer must appear instantly in GET /api/admin/new-users');
        assert.ok(sellerEntry && sellerEntry.shopName === 'Resilient Beads', 'New seller + shopName must appear in GET /api/admin/new-users');

        const notifCheck = await query(
          `SELECT COUNT(*)::int AS cnt FROM shopit_notifications WHERE user_id = $1 AND message LIKE $2`,
          [adminId, `%${sellerEmail}%`]
        );
        assert.ok(Number(notifCheck.rows[0].cnt) >= 1, 'Admin notification must exist from registration transaction');

        // 1f. Mark alert read via PATCH /api/admin/alerts/:id/read
        const readRes = await origFetch(`${baseUrl}/api/admin/alerts/${encodeURIComponent(buyerEntry.alertKey)}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${adminSess.token}` },
        });
        assert.strictEqual(readRes.status, 200);
        const feedAfterRead: any = await (
          await origFetch(`${baseUrl}/api/admin/new-users?limit=50`, {
            headers: { Authorization: `Bearer ${adminSess.token}` },
          })
        ).json();
        const buyerAfter = feedAfterRead.items.find((it: any) => it.userId === newBuyerId);
        assert.strictEqual(buyerAfter.isRead, true);

        // Reset emergency controls
        await origFetch(`${baseUrl}/api/admin/emergency-controls`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSess.token}` },
          body: JSON.stringify({ maintenanceMode: false, pauseSellerSignups: false, pauseNewOrders: false }),
        });
      } finally {
        globalThis.fetch = origFetch;
        if (savedKvUrl === undefined) delete process.env.KV_REST_API_URL;
        else process.env.KV_REST_API_URL = savedKvUrl;
        if (savedKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
        else process.env.KV_REST_API_TOKEN = savedKvToken;
        if (savedBrevoKey === undefined) delete process.env.BREVO_API_KEY;
        else process.env.BREVO_API_KEY = savedBrevoKey;
        if (savedCronSecret !== undefined) process.env.CRON_SECRET = savedCronSecret;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 2: Foreign Keys Enforced + Duplicate NUMERIC Money Columns Removed
    // -------------------------------------------------------------------------
    await test('2. Foreign keys enforce referential integrity and duplicate NUMERIC money columns do not exist', async () => {
      // Orphan product -> shopit_sellers FK
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_products (id, seller_id, title, seller_price_kobo, service_fee_kobo, display_price_kobo)
             VALUES ($1, 'nonexistent_seller_fk', 'Orphan', 100000, 20000, 120000)`,
            [`orphan_p_${ts}`]
          ),
        /.+/
      );

      // Orphan order -> shopit_users FK
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_orders (id, buyer_id, items, grand_total_kobo, payment_reference)
             VALUES ($1, 'nonexistent_buyer_fk', '[]'::jsonb, 100000, $2)`,
            [`orphan_o_${ts}`, `orphan_ref_${ts}`]
          ),
        /.+/
      );

      // Orphan payment -> shopit_orders FK
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_payments (reference, order_id, amount_kobo, status)
             VALUES ($1, 'nonexistent_order_fk', 100000, 'pending')`,
            [`orphan_pay_${ts}`]
          ),
        /.+/
      );

      // Orphan wallet -> shopit_sellers FK
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_wallets (seller_id, pending_balance_kobo, available_balance_kobo)
             VALUES ('nonexistent_wallet_seller_fk', 0, 0)`
          ),
        /.+/
      );

      // Orphan ledger entry -> shopit_wallets FK
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_ledger_entries (id, wallet_id, type, amount_kobo, balance_after_kobo, description)
             VALUES ($1, 'nonexistent_wallet_fk', 'sale_pending', 1000, 1000, 'orphan')`,
            [`orphan_led_${ts}`]
          ),
        /.+/
      );

      // Orphan dispute -> shopit_orders / shopit_sellers FKs
      await assert.rejects(
        () =>
          query(
            `INSERT INTO shopit_disputes (id, order_id, seller_id, reason, amount_held_in_escrow_kobo)
             VALUES ($1, 'nonexistent_order_fk', 'nonexistent_seller_fk', 'orphan', 1000)`,
            [`orphan_disp_${ts}`]
          ),
        /.+/
      );

      // Legacy duplicate NUMERIC columns must fail to select (dropped from schema)
      const legacyColChecks: Array<{ table: string; col: string }> = [
        { table: 'shopit_products', col: 'seller_price' },
        { table: 'shopit_products', col: 'display_price' },
        { table: 'shopit_orders', col: 'grand_total' },
        { table: 'shopit_orders', col: 'subtotal' },
        { table: 'shopit_payments', col: 'amount_naira' },
        { table: 'shopit_wallets', col: 'available_balance' },
        { table: 'shopit_wallets', col: 'pending_balance' },
        { table: 'shopit_ledger_entries', col: 'amount' },
        { table: 'shopit_disputes', col: 'amount_held_in_escrow' },
      ];
      for (const chk of legacyColChecks) {
        await assert.rejects(
          () => query(`SELECT ${chk.col} FROM ${chk.table} LIMIT 0`),
          /.+/,
          `Legacy column ${chk.table}.${chk.col} must NOT exist`
        );
      }
    });

    // -------------------------------------------------------------------------
    // TEST 3: scripts/reconcile-ledger.ts is strictly read-only
    // -------------------------------------------------------------------------
    await test('3. runReadOnlyReconciliation() performs zero writes or fake seeding', async () => {
      const beforeOrd = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_orders')).rows[0].c);
      const beforeWal = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_wallets')).rows[0].c);
      const beforeLed = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_ledger_entries')).rows[0].c);

      const report = await runReadOnlyReconciliation();
      assert.strictEqual(report.ok, true, `Expected clean reconciliation, got errors=${report.errors}`);

      const afterOrd = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_orders')).rows[0].c);
      const afterWal = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_wallets')).rows[0].c);
      const afterLed = Number((await query('SELECT COUNT(*)::int AS c FROM shopit_ledger_entries')).rows[0].c);

      assert.strictEqual(afterOrd, beforeOrd);
      assert.strictEqual(afterWal, beforeWal);
      assert.strictEqual(afterLed, beforeLed);
    });

    // -------------------------------------------------------------------------
    // TEST 4: /api/cron/escrow & /api/cron/daily enforce CRON_SECRET
    // -------------------------------------------------------------------------
    await test('4. /api/cron/escrow and /api/cron/daily reject unauth (401), reject unset secret (503), and allow valid CRON_SECRET (200)', async () => {
      for (const cronPath of ['/api/cron/escrow', '/api/cron/daily']) {
        const missingRes = await origFetch(`${baseUrl}${cronPath}`);
        assert.strictEqual(missingRes.status, 401);

        const wrongRes = await origFetch(`${baseUrl}${cronPath}`, {
          headers: { Authorization: 'Bearer wrong_cron_secret_value' },
        });
        assert.strictEqual(wrongRes.status, 401);

        const validRes = await origFetch(`${baseUrl}${cronPath}`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        });
        assert.strictEqual(validRes.status, 200);
        const validJson: any = await validRes.json();
        assert.strictEqual(validJson.ok, true);
      }

      const savedCron = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      try {
        const unsetRes = await origFetch(`${baseUrl}/api/cron/escrow`, {
          headers: { Authorization: 'Bearer anything' },
        });
        assert.strictEqual(unsetRes.status, 503);
      } finally {
        process.env.CRON_SECRET = savedCron;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 5: Admin Bootstrap Refuses Promoting Pre-existing User
    // -------------------------------------------------------------------------
    await test('5. Admin bootstrap refuses to promote an existing non-admin user holding ADMIN_EMAIL', async () => {
      const targetEmail = `hijack_check_${ts}@shopit.ng`;
      const targetUserId = `usr_hijack_${ts}`;
      await query(
        `INSERT INTO shopit_users (id, email, name, display_name, profile_slug, password_hash, role, sub_role, is_verified_email, age)
         VALUES ($1, $2, 'Normal Buyer', 'Normal', $3, $4, 'buyer', NULL, true, 22)`,
        [targetUserId, targetEmail, `hijack-${ts}`, hashPassword('BuyerPass123!')]
      );

      const savedAdminEmail = process.env.ADMIN_EMAIL;
      const savedAdminPw = process.env.ADMIN_INITIAL_PASSWORD;
      process.env.ADMIN_EMAIL = targetEmail;
      process.env.ADMIN_INITIAL_PASSWORD = 'BootstrapAttemptPassword123!';

      try {
        await ensureBootstrapAdminFromEnv();
        const check = await query('SELECT role, sub_role FROM shopit_users WHERE id = $1', [targetUserId]);
        assert.strictEqual(check.rows[0].role, 'buyer', 'Existing buyer must NEVER be promoted to admin');
        assert.strictEqual(check.rows[0].sub_role, null);
      } finally {
        if (savedAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
        else process.env.ADMIN_EMAIL = savedAdminEmail;
        if (savedAdminPw === undefined) delete process.env.ADMIN_INITIAL_PASSWORD;
        else process.env.ADMIN_INITIAL_PASSWORD = savedAdminPw;
      }
    });

    // -------------------------------------------------------------------------
    // TEST 6: Export v3.0 & Restore Roundtrip (Users, Orders, Wallets, Ledger)
    // -------------------------------------------------------------------------
    await test('6. GET /api/admin/export-data + restoreBackupPayload round-trips users, orders, wallets, and ledger', async () => {
      // Seed an order + payment + ledger entry linked to our resilient buyer & seller
      const expOrderId = `ORD_EXP_${ts}`;
      const expRef = `REF_EXP_${ts}`;
      const expLedId = `led_exp_${ts}`;

      await query(
        `INSERT INTO shopit_orders (
           id, buyer_id, buyer_name, buyer_email, items,
           subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo, grand_total_kobo,
           payment_method, payment_reference, status, paid_at, created_at, updated_at
         ) VALUES (
           $1, $2, 'Resilient Buyer', $3, $4::jsonb,
           500000, 50000, 0, 0, 550000,
           'flutterwave_card', $5, 'paid', NOW(), NOW(), NOW()
         )`,
        [
          expOrderId,
          newBuyerId,
          `outage_buyer_${ts}@shopit.ng`,
          JSON.stringify([{ productId: 'p_exp', sellerId: newSellerId, sellerPrice: 5000, quantity: 1 }]),
          expRef,
        ]
      );
      await query(
        `INSERT INTO shopit_payments (reference, order_id, amount_kobo, currency, channel, status, webhook_received, customer_email)
         VALUES ($1, $2, 550000, 'NGN', 'card', 'paid', true, $3)`,
        [expRef, expOrderId, `outage_buyer_${ts}@shopit.ng`]
      );
      await query(
        `UPDATE shopit_wallets SET pending_balance_kobo = 500000 WHERE seller_id = $1`,
        [newSellerId]
      );
      await query(
        `INSERT INTO shopit_ledger_entries (
           id, wallet_id, order_id, type, amount_kobo, fee_kobo, balance_after_kobo,
           balance_type, status, description, reference, idempotency_key
         ) VALUES ($1, $2, $3, 'sale_pending', 500000, 0, 500000, 'pending', 'completed', 'Export test sale', $4, $5)`,
        [expLedId, newSellerId, expOrderId, expRef, `idemp_exp_${ts}`]
      );

      const exportRes = await origFetch(`${baseUrl}/api/admin/export-data`, {
        headers: { Authorization: `Bearer ${adminSess.token}` },
      });
      assert.strictEqual(exportRes.status, 200);
      const backup: any = await exportRes.json();

      assert.strictEqual(backup.version, '3.0');
      assert.ok(Array.isArray(backup.users) && backup.users.some((u: any) => u.id === newBuyerId));
      assert.ok(backup.users.every((u: any) => u.password_hash === undefined && u.password === undefined), 'Export must never leak passwords');
      assert.ok(Array.isArray(backup.orders) && backup.orders.some((o: any) => o.id === expOrderId));
      assert.ok(Array.isArray(backup.wallets) && backup.wallets.some((w: any) => w.seller_id === newSellerId && Number(w.pending_balance_kobo) === 500000));
      assert.ok(Array.isArray(backup.ledger) && backup.ledger.some((l: any) => l.id === expLedId));

      // Delete seeded rows in reverse FK order, then restore from backup JSON!
      await query('DELETE FROM shopit_ledger_entries WHERE id = $1', [expLedId]);
      await query('DELETE FROM shopit_payments WHERE reference = $1', [expRef]);
      await query('DELETE FROM shopit_orders WHERE id = $1', [expOrderId]);
      await query('UPDATE shopit_wallets SET pending_balance_kobo = 0 WHERE seller_id = $1', [newSellerId]);
      await query('DELETE FROM shopit_admin_alerts WHERE user_id = $1', [newBuyerId]);
      await query('DELETE FROM shopit_users WHERE id = $1', [newBuyerId]);

      const restored = await restoreBackupPayload(backup);
      assert.ok(restored.restored.users >= 1);
      assert.ok(restored.restored.orders >= 1);
      assert.ok(restored.restored.wallets >= 1);
      assert.ok(restored.restored.ledger >= 1);

      const userBack = await query('SELECT id, email FROM shopit_users WHERE id = $1', [newBuyerId]);
      const orderBack = await query('SELECT id, grand_total_kobo FROM shopit_orders WHERE id = $1', [expOrderId]);
      const walletBack = await query('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [newSellerId]);
      const ledgerBack = await query('SELECT id, amount_kobo FROM shopit_ledger_entries WHERE id = $1', [expLedId]);

      assert.strictEqual(userBack.rows.length, 1);
      assert.strictEqual(Number(orderBack.rows[0].grand_total_kobo), 550000);
      assert.strictEqual(Number(walletBack.rows[0].pending_balance_kobo), 500000);
      assert.strictEqual(Number(ledgerBack.rows[0].amount_kobo), 500000);
    });

    console.log(`\n=== INFRASTRUCTURE FIXES TEST SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
  } finally {
    globalThis.fetch = origFetch;
    server.close();
  }
}

main().catch(err => {
  console.error('Infrastructure fixes suite crashed:', err);
  process.exit(1);
});
