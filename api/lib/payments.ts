import crypto from 'crypto';
import { query as dbQuery, withTransaction } from '../db/postgres.js';
import { renderTransactionalEmail } from '../../src/utils/transactionalEmails.js';

export function nairaToKobo(naira: number | string): number {
  const num = typeof naira === 'string' ? parseFloat(naira) : naira;
  return Math.round((Number.isFinite(num) ? num : 0) * 100);
}

export function koboToNaira(kobo: number | string): number {
  const num = typeof kobo === 'string' ? parseInt(kobo, 10) : kobo;
  return (Number.isFinite(num) ? num : 0) / 100;
}

/**
 * Tiered Shop It service fee in integer kobo (matches src/utils/pricing.ts):
 * - Under ₦2,000 (200,000 kobo) -> ₦200 (20,000 kobo)
 * - ₦2,000 to ₦10,000 -> ₦500 (50,000 kobo)
 * - Above ₦10,000 -> 5% rounded to nearest ₦50 (5,000 kobo)
 */
export function calculateTieredServiceFeeKobo(sellerPriceKobo: number): number {
  const safeKobo = Math.max(0, Math.round(Number(sellerPriceKobo) || 0));
  if (safeKobo < 200000) {
    return 20000;
  }
  if (safeKobo <= 1000000) {
    return 50000;
  }
  const rawFivePercent = safeKobo * 0.05;
  return Math.round(rawFivePercent / 5000) * 5000;
}

export function calculatePricingInKobo(sellerPriceKobo: number) {
  const serviceFeeKobo = calculateTieredServiceFeeKobo(sellerPriceKobo);
  const displayPriceKobo = sellerPriceKobo + serviceFeeKobo;
  return {
    sellerPriceKobo,
    serviceFeeKobo,
    displayPriceKobo,
    sellerPriceNaira: koboToNaira(sellerPriceKobo),
    serviceFeeNaira: koboToNaira(serviceFeeKobo),
    displayPriceNaira: koboToNaira(displayPriceKobo),
  };
}

// ============================================================================
// AES-256-GCM Encryption for Sensitive Identity Documents (NDPA 2023)
// ============================================================================
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const ENV_DOC_ENC_KEY = (process.env.DOC_ENCRYPTION_KEY || '').trim();
if (IS_PROD && !ENV_DOC_ENC_KEY) {
  console.error('[SECURITY CRITICAL] DOC_ENCRYPTION_KEY environment variable is missing in production.');
}
const EPHEMERAL_DEV_DOC_KEY = crypto.randomBytes(32);

function getDocAesKey(): Buffer {
  if (ENV_DOC_ENC_KEY) {
    return crypto.createHash('sha256').update(ENV_DOC_ENC_KEY).digest();
  }
  if (IS_PROD) {
    throw new Error('DOC_ENCRYPTION_KEY must be configured in production.');
  }
  return EPHEMERAL_DEV_DOC_KEY;
}

export function encryptSensitiveData(plaintext: string): string {
  const key = getDocAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitiveData(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format.');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const key = getDocAesKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}

// ============================================================================
// Transactional Email & Deduplicated Admin Alert Helpers
// ============================================================================

export async function sendBrevoDirect(
  to: string,
  subject: string,
  text: string,
  html: string,
  name?: string
): Promise<boolean> {
  const apiKey = (process.env.BREVO_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey || apiKey.startsWith('xkeysib-...')) {
    if (!IS_PROD) {
      console.log(`[Brevo Dev Log] To: ${to} | Subject: ${subject}`);
    } else {
      console.error('[Brevo Critical] BREVO_API_KEY missing in production.');
    }
    return false;
  }

  try {
    const emailFrom = (process.env.EMAIL_FROM || 'shopitverified@gmail.com').trim().replace(/^["']|["']$/g, '');
    const emailFromName = (process.env.EMAIL_FROM_NAME || 'Shop It').trim().replace(/^["']|["']$/g, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: emailFromName, email: emailFrom },
        to: [{ email: to, name: name || to.split('@')[0] }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err: any) {
    console.warn('[Brevo Direct Warning]:', err.message);
    return false;
  }
}

function escapeHtmlSafe(str: any): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendAdminAlert(
  key: string,
  subject: string,
  htmlDetails: string
): Promise<void> {
  try {
    const ins = await dbQuery(
      'INSERT INTO shopit_admin_alerts (alert_key, created_at) VALUES ($1, NOW()) ON CONFLICT (alert_key) DO NOTHING RETURNING alert_key',
      [key]
    );
    if (ins.rows.length === 0) return;
  } catch {
    // Allow dispatch once if dedup table temporarily unavailable
  }

  const safeSubject = escapeHtmlSafe(subject);
  const adminEmail = (process.env.ADMIN_ALERT_EMAIL || 'shopitverified@gmail.com').trim();
  try {
    await sendBrevoDirect(
      adminEmail,
      `[Shop It Alert] ${subject}`,
      subject,
      `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <div style="margin-bottom: 16px;">
          <span style="background: #FF6B00; color: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Admin Notification</span>
          <h2 style="color: #0f172a; margin: 8px 0 0; font-size: 18px;">${safeSubject}</h2>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 14px; line-height: 1.6;">
          ${htmlDetails}
        </div>
        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
          Shop It Operations &amp; Safety Alert · Sent to <strong>${escapeHtmlSafe(adminEmail)}</strong>
        </div>
      </div>`,
      'Shop It Admin'
    );
  } catch (err: any) {
    console.warn('[Admin Alert Warning]', err.message);
  }
}

// ============================================================================
// Order Expiration & Stock Restoration Helpers
// ============================================================================

export async function restoreOrderStockInTx(client: any, order: any): Promise<void> {
  if (!order.stock_reserved) return;
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (item.productId) {
      await client.query(
        'UPDATE shopit_products SET stock = stock + $1, is_sold_out = false, updated_at = NOW() WHERE id = $2',
        [qty, item.productId]
      );
    }
  }
  await client.query('UPDATE shopit_orders SET stock_reserved = false, updated_at = NOW() WHERE id = $1', [order.id]);
}

export async function expireStalePendingOrders(): Promise<{
  expiredCount: number;
  orderIds: string[];
  purgedDocsCount: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = await withTransaction(async client => {
    const staleRes = await client.query(
      `SELECT id, status, items, stock_reserved, expires_at, created_at
       FROM shopit_orders
       WHERE status = 'pending_payment'
         AND (
           (expires_at IS NOT NULL AND expires_at <= NOW())
           OR (expires_at IS NULL AND created_at < NOW() - INTERVAL '30 minutes')
         )
       FOR UPDATE`
    );

    const expiredIds: string[] = [];
    for (const row of staleRes.rows) {
      await restoreOrderStockInTx(client, row);
      await client.query(
        `UPDATE shopit_orders
         SET status = 'cancelled',
             stock_reserved = false,
             notes = COALESCE(notes || ' | ', '') || 'Expired without completed payment',
             updated_at = NOW()
         WHERE id = $1`,
        [row.id]
      );
      await client.query(
        `UPDATE shopit_payments
         SET status = 'expired', updated_at = NOW()
         WHERE order_id = $1 AND status IN ('pending', 'pending_payment')`,
        [row.id]
      );
      await client.query(
        `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
         VALUES ($1, $2, 'pending_payment', 'cancelled', 'expire_orders_cron', 'Pending order expired and reserved stock restored.', NOW())`,
        [`osh_exp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, row.id]
      );
      expiredIds.push(row.id);
    }

    // NDPA 2023 automated 30-day purge of completed KYC identity documents
    const purgedRes = await client.query(
      `DELETE FROM shopit_verification_documents
       WHERE created_at < $1
         AND seller_id IN (
           SELECT seller_id FROM shopit_verifications
           WHERE status IN ('verified', 'approved', 'rejected') AND submitted_at < $1
         )
       RETURNING id`,
      [thirtyDaysAgo]
    );
    await client.query(
      `UPDATE shopit_verifications
       SET document_url = '[Purged after 30 days]',
           selfie_url = '[Purged after 30 days]',
           updated_at = NOW()
       WHERE submitted_at < $1
         AND status IN ('verified', 'approved', 'rejected')
         AND (
           COALESCE(document_url, '') <> '[Purged after 30 days]'
           OR COALESCE(selfie_url, '') <> '[Purged after 30 days]'
         )`,
      [thirtyDaysAgo]
    );

    return {
      expiredCount: expiredIds.length,
      orderIds: expiredIds,
      purgedDocsCount: purgedRes.rowCount || 0,
    };
  });
  return result;
}

// ============================================================================
// Atomic Server-Side Payment Settlement (Shared by Webhook & Verify Endpoint)
// ============================================================================

export interface SettleOrderResult {
  found: boolean;
  committed: boolean;
  alreadyPaid: boolean;
  amountMismatch?: boolean;
  currencyMismatch?: boolean;
  expired?: boolean;
  invalidState?: string;
  order?: any;
}

export async function commitPaidOrderTransaction(params: {
  reference: string;
  confirmedAmountKobo: number;
  currency: string;
  channel: string;
  webhookReceived: boolean;
  customerEmail?: string;
  gatewayData?: any;
  source: string;
}): Promise<SettleOrderResult> {
  const cleanCurrency = String(params.currency || '').trim().toUpperCase();
  if (cleanCurrency !== 'NGN') {
    return { found: true, committed: false, alreadyPaid: false, currencyMismatch: true };
  }

  const lateAlertHolder: { alert: { orderId: string; amountNaira: number; txRef: string; flwId: any } | null } = {
    alert: null,
  };

  const txResult = await withTransaction(async client => {
    const orderRes = await client.query(
      'SELECT * FROM shopit_orders WHERE payment_reference = $1 FOR UPDATE',
      [params.reference]
    );

    if (orderRes.rows.length === 0) {
      return { found: false, committed: false, alreadyPaid: false } as SettleOrderResult;
    }

    const order = orderRes.rows[0];
    const paidStatuses = ['paid', 'packed', 'shipped', 'delivered', 'completed'];

    if (paidStatuses.includes(order.status)) {
      if (params.webhookReceived || params.gatewayData?.flwTransactionId) {
        const payRowRes = await client.query('SELECT data FROM shopit_payments WHERE reference = $1', [params.reference]);
        const rawExisting = payRowRes.rows[0]?.data;
        let existingObj: Record<string, any> = {};
        if (rawExisting) {
          existingObj =
            typeof rawExisting === 'string'
              ? (() => {
                  try {
                    return JSON.parse(rawExisting);
                  } catch {
                    return {};
                  }
                })()
              : typeof rawExisting === 'object'
                ? rawExisting
                : {};
        }
        const mergedData = { ...existingObj, ...(params.gatewayData || {}) };
        await client.query(
          `UPDATE shopit_payments
           SET webhook_received = COALESCE(webhook_received, false) OR $1,
               data = $2,
               updated_at = NOW()
           WHERE reference = $3`,
          [params.webhookReceived, JSON.stringify(mergedData), params.reference]
        );
      }
      return { found: true, committed: false, alreadyPaid: true, order } as SettleOrderResult;
    }

    const expectedKobo = Number(order.grand_total_kobo) || nairaToKobo(order.grand_total);
    if (Number(params.confirmedAmountKobo) < expectedKobo) {
      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        amountMismatch: true,
        order,
      } as SettleOrderResult;
    }

    // Check if pending order expired before payment arrived (or was already cancelled)
    const isExpired =
      order.status === 'cancelled' ||
      (order.status === 'pending_payment' &&
        order.expires_at &&
        new Date(order.expires_at).getTime() <= Date.now());

    if (isExpired) {
      if (order.status === 'pending_payment') {
        await restoreOrderStockInTx(client, order);
        await client.query(
          `UPDATE shopit_orders
           SET status = 'cancelled',
               stock_reserved = false,
               notes = COALESCE(notes || ' | ', '') || 'Late payment received after expiry',
               updated_at = NOW()
           WHERE id = $1`,
          [order.id]
        );
        await client.query(
          `INSERT INTO shopit_order_status_history (id, order_id, previous_status, new_status, changed_by, notes, created_at)
           VALUES ($1, $2, 'pending_payment', 'cancelled', $3, 'Late payment received after expiry; stock restored and flagged for refund.', NOW())`,
          [`osh_late_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, order.id, params.source]
        );
      }

      await client.query(
        `INSERT INTO shopit_payments (
          reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, data, updated_at
        ) VALUES ($1, $2, $3, $4, 'NGN', $5, 'late_after_expiry', $6, $7, $8, NOW())
        ON CONFLICT (reference) DO UPDATE SET
          status = 'late_after_expiry',
          webhook_received = COALESCE(shopit_payments.webhook_received, false) OR $6,
          data = $8,
          updated_at = NOW()`,
        [
          params.reference,
          order.id,
          params.confirmedAmountKobo,
          koboToNaira(params.confirmedAmountKobo),
          params.channel || 'online',
          params.webhookReceived,
          params.customerEmail || order.buyer_email || '',
          JSON.stringify(params.gatewayData || {}),
        ]
      );

      lateAlertHolder.alert = {
        orderId: order.id,
        amountNaira: koboToNaira(params.confirmedAmountKobo),
        txRef: params.reference,
        flwId: params.gatewayData?.flwTransactionId || params.gatewayData?.gatewayId || 'N/A',
      };

      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        expired: true,
        invalidState: 'cancelled',
        order,
      } as SettleOrderResult;
    }

    if (order.status !== 'pending_payment') {
      return {
        found: true,
        committed: false,
        alreadyPaid: false,
        invalidState: order.status,
        order,
      } as SettleOrderResult;
    }

    // 1. Update order strictly from pending_payment -> paid
    await client.query(
      `UPDATE shopit_orders
       SET status = 'paid',
           stock_reserved = true,
           auto_release_at = NOW() + INTERVAL '5 days',
           updated_at = NOW()
       WHERE id = $1 AND status = 'pending_payment'`,
      [order.id]
    );

    // 2. Append order status history
    await client.query(
      `INSERT INTO shopit_order_status_history (
        id, order_id, previous_status, new_status, changed_by, notes, created_at
      ) VALUES ($1, $2, 'pending_payment', 'paid', $3, 'Payment verified via Flutterwave into 5-day escrow', NOW())`,
      [`osh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, order.id, params.source]
    );

    // 3. Decrement product stock atomically ONLY if not already reserved at init; mark coupon usage
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const sellerTotalsKobo: Record<string, number> = {};

    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (item.productId && !order.stock_reserved) {
        const pRes = await client.query('SELECT stock FROM shopit_products WHERE id = $1 FOR UPDATE', [item.productId]);
        if (pRes.rows.length > 0) {
          const nextStock = Math.max(0, parseInt(String(pRes.rows[0].stock || '0'), 10) - qty);
          await client.query(
            'UPDATE shopit_products SET stock = $1, is_sold_out = $2, updated_at = NOW() WHERE id = $3',
            [nextStock, nextStock <= 0, item.productId]
          );
        }
      }
      if (item.sellerId) {
        const itemTotalKobo = (Number(item.sellerPriceKobo) || Math.round(Number(item.sellerPrice || 0) * 100)) * qty;
        sellerTotalsKobo[item.sellerId] = (sellerTotalsKobo[item.sellerId] || 0) + itemTotalKobo;
      }
    }

    if (order.coupon_code) {
      await client.query(
        'UPDATE shopit_coupons SET current_uses = current_uses + 1 WHERE code = $1',
        [String(order.coupon_code).trim().toUpperCase()]
      );
    }

    // 4. Persist/update shopit_payments inside the same transaction
    await client.query(
      `INSERT INTO shopit_payments (
        reference, order_id, amount_kobo, amount_naira, currency, channel, status, webhook_received, customer_email, data, updated_at
      ) VALUES ($1, $2, $3, $4, 'NGN', $5, 'paid', $6, $7, $8, NOW())
      ON CONFLICT (reference) DO UPDATE SET
        status = 'paid',
        webhook_received = COALESCE(shopit_payments.webhook_received, false) OR $6,
        channel = COALESCE($5, shopit_payments.channel),
        data = $8,
        updated_at = NOW()`,
      [
        params.reference,
        order.id,
        expectedKobo,
        koboToNaira(expectedKobo),
        params.channel || 'online',
        params.webhookReceived,
        params.customerEmail || order.buyer_email || '',
        JSON.stringify(params.gatewayData || {}),
      ]
    );

    // 5. Credit each seller wallet pending balance idempotently inside transaction
    for (const [sId, sellerEarningsKobo] of Object.entries(sellerTotalsKobo)) {
      await client.query(
        `INSERT INTO shopit_wallets (
          seller_id, pending_balance, available_balance, total_withdrawn, is_frozen,
          pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at
        ) VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
        ON CONFLICT (seller_id) DO NOTHING`,
        [sId]
      );

      const wRes = await client.query(
        'SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
        [sId]
      );
      const currentPendingKobo = parseInt(wRes.rows[0]?.pending_balance_kobo || '0', 10);
      const newPendingKobo = currentPendingKobo + sellerEarningsKobo;

      const idempotencyKey = `sale_pending:${order.id}:${sId}`;
      const ledgerIns = await client.query(
        `INSERT INTO shopit_ledger_entries (
          id, wallet_id, order_id, type, amount, fee, balance_after, balance_type, status,
          amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
        ) VALUES (
          $1, $2, $3, 'sale_pending', $4, 0, $5, 'pending', 'held',
          $6, 0, $7, $8, $9, $10, NOW()
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id`,
        [
          `LEDGER-PEND-${order.id}-${sId.slice(-6)}`,
          sId,
          order.id,
          koboToNaira(sellerEarningsKobo),
          koboToNaira(newPendingKobo),
          sellerEarningsKobo,
          newPendingKobo,
          `Escrow holding for Order #${order.id}`,
          params.reference,
          idempotencyKey,
        ]
      );

      if (ledgerIns.rows.length > 0) {
        await client.query(
          `UPDATE shopit_wallets
           SET pending_balance_kobo = $1,
               pending_balance = $2,
               updated_at = NOW()
           WHERE seller_id = $3`,
          [newPendingKobo, koboToNaira(newPendingKobo), sId]
        );
      }
    }

    // Clear buyer cart if logged in
    if (order.buyer_id) {
      await client.query('DELETE FROM shopit_carts WHERE user_id = $1', [order.buyer_id]);
    }

    return { found: true, committed: true, alreadyPaid: false, order } as SettleOrderResult;
  });

  if (lateAlertHolder.alert) {
    const alertInfo = lateAlertHolder.alert;
    await sendAdminAlert(
      `late_payment_${alertInfo.txRef}`,
      `Late Payment Received for Expired Order #${alertInfo.orderId}`,
      `Flutterwave confirmed a payment after the checkout order expired/cancelled.<br/>
       Order ID: <strong>#${escapeHtmlSafe(alertInfo.orderId)}</strong><br/>
       tx_ref: <code>${escapeHtmlSafe(alertInfo.txRef)}</code><br/>
       Flutterwave TX ID: <code>${escapeHtmlSafe(alertInfo.flwId)}</code><br/>
       Amount: <strong>₦${alertInfo.amountNaira.toLocaleString()}</strong><br/>
       Action Required: Issue refund to buyer via Admin Panel.`
    ).catch(() => {});
  }

  // Post-commit awaiting notifications & high-value alert
  if (txResult.committed && txResult.order) {
    const order = txResult.order;
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const sellerIds = Array.from(new Set(items.map(i => i.sellerId).filter(Boolean)));

    try {
      const emailTasks: Promise<any>[] = [];

      const buyerEmail = params.customerEmail || order.buyer_email;
      if (buyerEmail) {
        const buyerMail = renderTransactionalEmail('order_placed_buyer', {
          name: order.buyer_name || 'Customer',
          order_id: order.id,
          total: Number(order.grand_total || koboToNaira(order.grand_total_kobo)),
        });
        emailTasks.push(sendBrevoDirect(buyerEmail, buyerMail.subject, buyerMail.text, buyerMail.html, order.buyer_name));
      }

      for (const sId of sellerIds) {
        const sRes = await dbQuery('SELECT email, shop_name FROM shopit_sellers WHERE id = $1 OR user_id = $1', [sId]);
        const sellerEmail = sRes.rows[0]?.email;
        if (sellerEmail) {
          const sMail = renderTransactionalEmail('new_order_seller', {
            name: sRes.rows[0]?.shop_name || 'Artisan',
            order_id: order.id,
            item: items.find(i => i.sellerId === sId)?.title || 'Craft item',
          });
          emailTasks.push(sendBrevoDirect(sellerEmail, sMail.subject, sMail.text, sMail.html, sRes.rows[0]?.shop_name));
        }
      }

      const settledKobo = Number(order.grand_total_kobo) || Number(params.confirmedAmountKobo);
      if (settledKobo >= 5000000) {
        emailTasks.push(
          sendAdminAlert(
            `high_order_${params.reference}`,
            `High-Value Order Confirmed (₦${koboToNaira(settledKobo).toLocaleString()})`,
            `An order above ₦50,000 has been verified and committed to Escrow.<br/>
             Order ID: <strong>#${escapeHtmlSafe(order.id)}</strong><br/>
             Amount: <strong>₦${koboToNaira(settledKobo).toLocaleString()}</strong><br/>
             Payment Channel: <strong>${escapeHtmlSafe(params.channel || 'online')}</strong>`
          )
        );
      }

      await Promise.allSettled(emailTasks);
    } catch {}
  }

  return txResult;
}
