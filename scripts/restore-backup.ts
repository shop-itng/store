import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { loadLocalEnvSafely } from './migrate.js';
loadLocalEnvSafely();

import { hashPassword, runMigration, withTransaction } from '../api/db/postgres.js';

export interface ShopItBackupPayload {
  version?: string;
  exportedAt?: string;
  users?: any[];
  sellers?: any[];
  products?: any[];
  orders?: any[];
  payments?: any[];
  wallets?: any[];
  ledger?: any[];
  disputes?: any[];
  reports?: any[];
  verifications?: any[];
  adminAlerts?: any[];
}

export async function restoreBackupPayload(payload: ShopItBackupPayload): Promise<{
  restored: Record<string, number>;
}> {
  await runMigration();

  const counts: Record<string, number> = {
    users: 0,
    sellers: 0,
    products: 0,
    orders: 0,
    payments: 0,
    wallets: 0,
    ledger: 0,
    disputes: 0,
    reports: 0,
    verifications: 0,
    adminAlerts: 0,
  };

  await withTransaction(async client => {
    // 1. Users (inserted with random unguessable placeholder password & must_change_password = true if absent)
    for (const u of payload.users || []) {
      const placeholderHash = hashPassword(crypto.randomBytes(24).toString('hex'));
      await client.query(
        `INSERT INTO shopit_users (
          id, email, name, display_name, profile_slug, bio, campus, location_area,
          password_hash, role, sub_role, is_verified_email, age, has_guardian_consent, guardian_name,
          is_banned, ban_reason, deleted_at, must_change_password, last_login_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, true, $19, COALESCE($20::timestamptz, NOW()), COALESCE($21::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          bio = EXCLUDED.bio,
          campus = EXCLUDED.campus,
          location_area = EXCLUDED.location_area,
          is_verified_email = EXCLUDED.is_verified_email,
          is_banned = EXCLUDED.is_banned,
          ban_reason = EXCLUDED.ban_reason,
          updated_at = NOW()`,
        [
          u.id,
          String(u.email).toLowerCase(),
          u.name || 'Restored User',
          u.display_name || u.name || 'Member',
          u.profile_slug || u.id,
          u.bio || '',
          u.campus || null,
          u.location_area || null,
          placeholderHash,
          u.role || 'buyer',
          u.sub_role || null,
          Boolean(u.is_verified_email),
          u.age ?? null,
          u.has_guardian_consent ?? true,
          u.guardian_name || null,
          Boolean(u.is_banned),
          u.ban_reason || null,
          u.deleted_at || null,
          u.last_login_at || null,
          u.created_at || null,
          u.updated_at || null,
        ]
      );
      counts.users++;
    }

    // 2. Sellers
    for (const s of payload.sellers || []) {
      await client.query(
        `INSERT INTO shopit_sellers (
          id, user_id, shop_name, owner_name, email, bio, campus,
          location_state, location_city, location_area,
          is_verified_seller, verification_status, verified_nin_last4, verified_at,
          under_18, guardian_consent, guardian_name, rating, sales_count, views_count,
          vacation_mode, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20,
          $21, COALESCE($22::timestamptz, NOW()), COALESCE($23::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          shop_name = EXCLUDED.shop_name,
          bio = EXCLUDED.bio,
          campus = EXCLUDED.campus,
          is_verified_seller = EXCLUDED.is_verified_seller,
          verification_status = EXCLUDED.verification_status,
          vacation_mode = EXCLUDED.vacation_mode,
          updated_at = NOW()`,
        [
          s.id,
          s.user_id || s.id,
          s.shop_name || 'Shop',
          s.owner_name || 'Seller',
          s.email || '',
          s.bio || '',
          s.campus || 'Lagos Mainland',
          s.location_state || 'Lagos',
          s.location_city || 'Lagos Mainland',
          s.location_area || 'Yaba',
          Boolean(s.is_verified_seller),
          s.verification_status || 'not_started',
          s.verified_nin_last4 || null,
          s.verified_at || null,
          Boolean(s.under_18),
          Boolean(s.guardian_consent),
          s.guardian_name || null,
          Number(s.rating || 5),
          Number(s.sales_count || 0),
          Number(s.views_count || 0),
          Boolean(s.vacation_mode),
          s.created_at || null,
          s.updated_at || null,
        ]
      );
      counts.sellers++;
    }

    // 3. Products
    for (const p of payload.products || []) {
      await client.query(
        `INSERT INTO shopit_products (
          id, seller_id, seller_shop_name, seller_campus, title, description, category,
          seller_price_kobo, service_fee_kobo, display_price_kobo, stock, images,
          delivery_pickup_fee_kobo, delivery_local_fee_kobo, delivery_buyer_arranges,
          location_state, location_city, location_area, is_sold_out, is_paused, is_draft,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12::jsonb,
          $13, $14, $15,
          $16, $17, $18, $19, $20, $21,
          COALESCE($22::timestamptz, NOW()), COALESCE($23::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          stock = EXCLUDED.stock,
          display_price_kobo = EXCLUDED.display_price_kobo,
          updated_at = NOW()`,
        [
          p.id,
          p.seller_id,
          p.seller_shop_name || 'Shop',
          p.seller_campus || 'Lagos Mainland',
          p.title || 'Item',
          p.description || '',
          p.category || 'crafts',
          Number(p.seller_price_kobo || 0),
          Number(p.service_fee_kobo || 0),
          Number(p.display_price_kobo || 0),
          Number(p.stock ?? 0),
          typeof p.images === 'string' ? p.images : JSON.stringify(p.images || []),
          Number(p.delivery_pickup_fee_kobo || 0),
          Number(p.delivery_local_fee_kobo || 0),
          Boolean(p.delivery_buyer_arranges),
          p.location_state || 'Lagos',
          p.location_city || 'Lagos Mainland',
          p.location_area || 'Yaba',
          Boolean(p.is_sold_out),
          Boolean(p.is_paused),
          Boolean(p.is_draft),
          p.created_at || null,
          p.updated_at || null,
        ]
      );
      counts.products++;
    }

    // 4. Orders
    for (const o of payload.orders || []) {
      await client.query(
        `INSERT INTO shopit_orders (
          id, buyer_id, buyer_name, buyer_email, buyer_masked_id, items,
          subtotal_kobo, service_fee_kobo, delivery_fee_kobo, discount_total_kobo,
          coupon_code, grand_total_kobo, payment_method, payment_reference,
          status, campus, delivery_area, pickup_point, admin_hold,
          paid_at, shipped_at, delivered_at, completed_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6::jsonb,
          $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, COALESCE($24::timestamptz, NOW()), COALESCE($25::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          admin_hold = EXCLUDED.admin_hold,
          updated_at = NOW()`,
        [
          o.id,
          o.buyer_id || null,
          o.buyer_name || 'Buyer',
          o.buyer_email || '',
          o.buyer_masked_id || 'Buyer',
          typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []),
          Number(o.subtotal_kobo || 0),
          Number(o.service_fee_kobo || 0),
          Number(o.delivery_fee_kobo || 0),
          Number(o.discount_total_kobo || 0),
          o.coupon_code || null,
          Number(o.grand_total_kobo || 0),
          o.payment_method || 'card',
          o.payment_reference || null,
          o.status || 'pending_payment',
          o.campus || 'Lagos Mainland',
          o.delivery_area || 'Campus Hub',
          o.pickup_point || 'Main Security Gate Hub',
          Boolean(o.admin_hold),
          o.paid_at || null,
          o.shipped_at || null,
          o.delivered_at || null,
          o.completed_at || null,
          o.created_at || null,
          o.updated_at || null,
        ]
      );
      counts.orders++;
    }

    // 5. Payments
    for (const pay of payload.payments || []) {
      await client.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, currency, channel, status,
          webhook_received, customer_email, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, COALESCE($9::timestamptz, NOW()), COALESCE($10::timestamptz, NOW())
        )
        ON CONFLICT (reference) DO UPDATE SET
          status = EXCLUDED.status,
          webhook_received = EXCLUDED.webhook_received,
          updated_at = NOW()`,
        [
          pay.reference,
          pay.order_id || null,
          Number(pay.amount_kobo || 0),
          pay.currency || 'NGN',
          pay.channel || 'card',
          pay.status || 'pending_payment',
          Boolean(pay.webhook_received),
          pay.customer_email || null,
          pay.created_at || null,
          pay.updated_at || null,
        ]
      );
      counts.payments++;
    }

    // 6. Wallets
    for (const w of payload.wallets || []) {
      await client.query(
        `INSERT INTO shopit_wallets (
          seller_id, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo,
          is_frozen, freeze_reason, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, COALESCE($7::timestamptz, NOW()), COALESCE($8::timestamptz, NOW())
        )
        ON CONFLICT (seller_id) DO UPDATE SET
          pending_balance_kobo = EXCLUDED.pending_balance_kobo,
          available_balance_kobo = EXCLUDED.available_balance_kobo,
          total_withdrawn_kobo = EXCLUDED.total_withdrawn_kobo,
          is_frozen = EXCLUDED.is_frozen,
          freeze_reason = EXCLUDED.freeze_reason,
          updated_at = NOW()`,
        [
          w.seller_id,
          Number(w.pending_balance_kobo || 0),
          Number(w.available_balance_kobo || 0),
          Number(w.total_withdrawn_kobo || 0),
          Boolean(w.is_frozen),
          w.freeze_reason || null,
          w.created_at || null,
          w.updated_at || null,
        ]
      );
      counts.wallets++;
    }

    // 7. Ledger Entries (immutable idempotency-safe insert)
    for (const l of payload.ledger || []) {
      await client.query(
        `INSERT INTO shopit_ledger_entries (
          id, wallet_id, order_id, type, amount_kobo, fee_kobo, balance_after_kobo,
          balance_type, status, description, reference, idempotency_key, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          l.id,
          l.wallet_id,
          l.order_id || null,
          l.type,
          Number(l.amount_kobo || 0),
          Number(l.fee_kobo || 0),
          Number(l.balance_after_kobo || 0),
          l.balance_type || 'pending',
          l.status || 'completed',
          l.description || '',
          l.reference || null,
          l.idempotency_key || l.id,
          l.created_at || null,
        ]
      );
      counts.ledger++;
    }

    // 8. Disputes
    for (const d of payload.disputes || []) {
      await client.query(
        `INSERT INTO shopit_disputes (
          id, order_id, buyer_id, seller_id, reason, description, status, amount_held_in_escrow_kobo,
          resolution_notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, COALESCE($10::timestamptz, NOW()), COALESCE($11::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          d.id,
          d.order_id,
          d.buyer_id || null,
          d.seller_id,
          d.reason || '',
          d.description || null,
          d.status || 'open',
          Number(d.amount_held_in_escrow_kobo || 0),
          d.resolution_notes || null,
          d.created_at || null,
          d.updated_at || null,
        ]
      );
      counts.disputes++;
    }

    // 9. Reports
    for (const r of payload.reports || []) {
      await client.query(
        `INSERT INTO shopit_reports (
          id, target_type, target_id, target_title, reason, details, status, action_logs, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, COALESCE($9::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          r.id,
          r.target_type || 'product',
          r.target_id || '',
          r.target_title || '',
          r.reason || '',
          r.details || '',
          r.status || 'open',
          typeof r.action_logs === 'string' ? r.action_logs : JSON.stringify(r.action_logs || []),
          r.created_at || null,
        ]
      );
      counts.reports++;
    }

    // 10. Verifications
    for (const v of payload.verifications || []) {
      await client.query(
        `INSERT INTO shopit_verifications (
          id, seller_id, user_id, shop_name, owner_name, id_type, id_number_masked,
          full_nin_last4, under_18, status, submitted_at, reviewed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, COALESCE($11::timestamptz, NOW()), $12
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          v.id,
          v.seller_id,
          v.user_id || v.seller_id,
          v.shop_name || 'Shop',
          v.owner_name || 'Owner',
          v.id_type || 'nin_slip',
          v.id_number_masked || '***',
          v.full_nin_last4 || null,
          Boolean(v.under_18),
          v.status || 'pending',
          v.submitted_at || null,
          v.reviewed_at || null,
        ]
      );
      counts.verifications++;
    }

    // 11. Admin Alerts
    for (const a of payload.adminAlerts || []) {
      await client.query(
        `INSERT INTO shopit_admin_alerts (
          alert_key, id, alert_type, user_id, user_email, user_name, user_role,
          title, message, is_read, metadata, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11::jsonb, COALESCE($12::timestamptz, NOW())
        )
        ON CONFLICT (alert_key) DO NOTHING`,
        [
          a.alert_key,
          a.id || null,
          a.alert_type || 'new_user',
          a.user_id || null,
          a.user_email || null,
          a.user_name || null,
          a.user_role || null,
          a.title || null,
          a.message || null,
          Boolean(a.is_read),
          typeof a.metadata === 'string' ? a.metadata : JSON.stringify(a.metadata || {}),
          a.created_at || null,
        ]
      );
      counts.adminAlerts++;
    }
  });

  return { restored: counts };
}

async function main() {
  const fileArg = process.argv.slice(2).find(a => !a.startsWith('--')) ||
    process.argv.slice(2).find(a => a.startsWith('--file='))?.slice(7);

  if (!fileArg) {
    console.error('Usage: npx tsx scripts/restore-backup.ts <path/to/shopit-backup.json>');
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(resolved)) {
    console.error(`Backup file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const payload = JSON.parse(raw) as ShopItBackupPayload;
  const result = await restoreBackupPayload(payload);
  console.log('=== Shop It JSON Backup Restore Completed ===');
  console.log(JSON.stringify(result.restored, null, 2));
}

const isDirectExec =
  process.argv[1] &&
  (process.argv[1].endsWith('restore-backup.ts') || process.argv[1].endsWith('restore-backup.js'));

if (isDirectExec) {
  main().catch(err => {
    console.error('Backup restore failed:', err);
    process.exit(1);
  });
}
