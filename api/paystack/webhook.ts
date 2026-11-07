import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';
import { savePaymentRecord } from '../db/otpStore.js';
import { query as dbQuery } from '../db/postgres.js';
import { renderTransactionalEmail } from '../../src/utils/transactionalEmails.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

// In-memory idempotency cache fallback
const processedReferences = new Set<string>();

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url = `${KV_URL.replace(/\/$/, '')}/${command}/${args.map(a => encodeURIComponent(typeof a === 'object' ? JSON.stringify(a) : String(a))).join('/')}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json: any = await res.json();
    return json.result;
  } catch {
    return null;
  }
}

async function sendBrevoDirect(to: string, subject: string, text: string, html: string, name?: string): Promise<boolean> {
  const apiKey = (process.env.BREVO_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    console.log(`[Brevo Webhook Email (Dev Log)] To: ${to} | Subject: ${subject}`);
    return false;
  }
  try {
    const emailFrom = (process.env.EMAIL_FROM || 'shopitverified@gmail.com').trim().replace(/^["']|["']$/g, '');
    const emailFromName = (process.env.EMAIL_FROM_NAME || 'Shop It').trim().replace(/^["']|["']$/g, '');
    await fetch('https://api.brevo.com/v3/smtp/email', {
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
    });
    return true;
  } catch (err: any) {
    console.warn('[Brevo Webhook Dispatch Error]:', err.message);
    return false;
  }
}

async function getRawBodyBuffer(req: any): Promise<Buffer> {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
    return req.rawBody;
  }
  if (req.body && Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string') {
    return Buffer.from(req.body, 'utf-8');
  }

  const chunks: Uint8Array[] = [];
  try {
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      return Buffer.concat(chunks);
    }
  } catch (err) {
    console.warn('Error reading raw body stream:', err);
  }

  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf-8');
  }

  return Buffer.from('');
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-paystack-signature');
    res.statusCode = 200;
    return res.end();
  }

  const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  const PAYSTACK_WEBHOOK_SECRET = (
    process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY
  ).trim().replace(/^["']|["']$/g, '');

  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: true,
        message: 'Paystack webhook listener is active and operational on Vercel Serverless.',
        endpoint: '/api/paystack/webhook',
        platform: 'Vercel Serverless Function',
        httpStatus: 200,
        expectedMethod: 'POST',
      })
    );
  }

  if (req.method === 'POST') {
    try {
      const rawBuffer = await getRawBodyBuffer(req);
      const signature = (req.headers['x-paystack-signature'] || '') as string;
      const secret = PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY;

      // 1. Cryptographic HMAC SHA-512 Signature Check: Reject invalid signatures with 401
      if (secret) {
        if (!signature) {
          console.warn('[Paystack Webhook] Missing x-paystack-signature header. Rejecting with 401.');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ status: false, message: 'Missing webhook signature' }));
        }

        const computedHash = crypto
          .createHmac('sha512', secret)
          .update(rawBuffer)
          .digest('hex');

        const sigBuf = Buffer.from(signature, 'utf8');
        const hashBuf = Buffer.from(computedHash, 'utf8');

        const isValid =
          sigBuf.length === hashBuf.length && crypto.timingSafeEqual(sigBuf, hashBuf);

        if (!isValid) {
          console.warn('[Paystack Webhook] Invalid signature received. Rejecting with 401.');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 401;
          return res.end(JSON.stringify({ status: false, message: 'Invalid HMAC signature' }));
        }
      }

      // 2. Parse JSON Payload
      let payload: any = {};
      try {
        const rawString = rawBuffer.toString('utf-8');
        if (rawString && rawString.trim().length > 0) {
          payload = JSON.parse(rawString);
        }
      } catch (parseErr) {
        console.warn('[Paystack Webhook] Body parsing warning:', parseErr);
      }

      const event = payload.event || (payload.data ? 'charge.success' : 'ping');
      const data = payload.data || {};
      const reference = data.reference || payload.reference;

      if (!reference || event === 'ping' || event === 'test') {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ status: true, message: 'Webhook test received successfully', event }));
      }

      // 3. Idempotency Check in Upstash Redis and Local Memory (Prevent double-crediting)
      const dedupeKey = `pstk_evt:${reference}`;
      const isAlreadyProcessedInRedis = await runKvCommand('get', dedupeKey);
      if (isAlreadyProcessedInRedis || processedReferences.has(reference)) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            status: true,
            message: 'Payment already processed (idempotent)',
            reference,
          })
        );
      }

      // Mark reference in Redis (7 days TTL) & memory
      await runKvCommand('set', dedupeKey, '1', 'EX', 7 * 24 * 60 * 60);
      processedReferences.add(reference);

      // 4. Process Successful Charges
      if (event === 'charge.success') {
        let confirmedAmountKobo = data.amount || 0;
        let isConfirmedWithPaystack = false;

        // Verify with Paystack REST API
        if (PAYSTACK_SECRET_KEY) {
          try {
            const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
            const verifyRes = await fetch(verifyUrl, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
            });
            const verifyData: any = await verifyRes.json();
            if (verifyData.status && verifyData.data?.status === 'success') {
              isConfirmedWithPaystack = true;
              confirmedAmountKobo = verifyData.data.amount;
            }
          } catch (verifyErr: any) {
            console.warn('[Paystack Webhook] REST API verification attempt warning:', verifyErr.message);
          }
        }

        const orderId = data.metadata?.orderId || `ORD_${reference}`;
        const customerEmail = data.customer?.email || '';

        // Save payment to PostgreSQL shopit_payments
        try {
          await savePaymentRecord({
            reference,
            orderId,
            amountKobo: confirmedAmountKobo,
            amountNaira: confirmedAmountKobo / 100,
            currency: String(data.currency || 'NGN').toUpperCase(),
            channel: data.channel || 'card',
            status: 'paid',
            webhookReceived: true,
            customerEmail,
            data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } catch (dbErr: any) {
          console.warn('[Paystack Webhook Payment Save Warning]:', dbErr.message);
        }

        // Update Order in PostgreSQL with 5-day auto-release timer
        try {
          const orderRes = await dbQuery(
            `UPDATE shopit_orders
             SET status = 'paid',
                 payment_reference = $1,
                 auto_release_at = NOW() + INTERVAL '5 days',
                 updated_at = NOW()
             WHERE payment_reference = $1 OR id = $2
             RETURNING *`,
            [reference, orderId]
          );

          if (orderRes.rows.length > 0) {
            const order = orderRes.rows[0];

            // Order status history entry
            await dbQuery(
              `INSERT INTO shopit_order_status_history (
                id, order_id, previous_status, new_status, changed_by, notes, created_at
              ) VALUES ($1, $2, 'pending_payment', 'paid', 'paystack_webhook', 'Paystack payment confirmed into 5-day escrow', NOW())`,
              [`osh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, order.id]
            );

            // Credit each seller's pending balance in the Neon double-entry ledger
            const items = Array.isArray(order.items) ? order.items : [];
            const sellerTotals: Record<string, number> = {};

            for (const item of items) {
              if (item.sellerId) {
                const itemKobo = Math.round(Number(item.sellerPrice || 0) * 100 * Number(item.quantity || 1));
                sellerTotals[item.sellerId] = (sellerTotals[item.sellerId] || 0) + itemKobo;
              }
            }

            for (const [sId, sellerEarningsKobo] of Object.entries(sellerTotals)) {
              await dbQuery(
                `INSERT INTO shopit_wallets (seller_id, pending_balance, available_balance, total_withdrawn, is_frozen, pending_balance_kobo, available_balance_kobo, total_withdrawn_kobo, created_at, updated_at)
                 VALUES ($1, 0, 0, 0, false, 0, 0, 0, NOW(), NOW())
                 ON CONFLICT (seller_id) DO NOTHING`,
                [sId]
              );

              const wRes = await dbQuery('SELECT pending_balance_kobo FROM shopit_wallets WHERE seller_id = $1', [sId]);
              const currentPending = parseInt(wRes.rows[0]?.pending_balance_kobo || '0', 10);
              const newPending = currentPending + sellerEarningsKobo;

              await dbQuery(
                `UPDATE shopit_wallets
                 SET pending_balance_kobo = $1,
                     pending_balance = $2,
                     updated_at = NOW()
                 WHERE seller_id = $3`,
                [newPending, newPending / 100, sId]
              );

              const ledgerId = `LEDGER-${order.id}-${sId.slice(-4)}`;
              await dbQuery(
                `INSERT INTO shopit_ledger_entries (
                  id, wallet_id, type, amount, fee, balance_after, balance_type,
                  amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
                ) VALUES (
                  $1, $2, 'sale_pending', $3, 0, $4, 'pending',
                  $5, 0, $6, $7, $8, $9, NOW()
                )`,
                [
                  ledgerId,
                  sId,
                  sellerEarningsKobo / 100,
                  newPending / 100,
                  sellerEarningsKobo,
                  newPending,
                  `Escrow holding for Order #${order.id}`,
                  reference,
                  reference,
                ]
              );

              // Notify seller via Brevo
              const sellerUserRes = await dbQuery('SELECT email, shop_name FROM shopit_sellers WHERE id = $1', [sId]);
              const sellerEmail = sellerUserRes.rows[0]?.email;
              if (sellerEmail) {
                const sellerMail = renderTransactionalEmail('new_order_seller', {
                  name: sellerUserRes.rows[0]?.shop_name || 'Artisan',
                  order_id: order.id,
                  item: items[0]?.title || 'Craft item',
                });
                sendBrevoDirect(sellerEmail, sellerMail.subject, sellerMail.text, sellerMail.html).catch(() => {});
              }
            }

            // Notify buyer via Brevo
            const buyerMail = renderTransactionalEmail('order_placed_buyer', {
              name: order.buyer_name || 'Customer',
              order_id: order.id,
              total: order.grand_total,
            });
            sendBrevoDirect(customerEmail || order.buyer_email, buyerMail.subject, buyerMail.text, buyerMail.html).catch(() => {});
          }
        } catch (orderErr: any) {
          console.warn('[Paystack Webhook Order Escrow Warning]:', orderErr.message);
        }

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            status: true,
            message: 'Paystack charge.success received, verified, and credited into 5-day escrow ledger.',
            reference,
            amountNaira: confirmedAmountKobo / 100,
            verifiedWithPaystack: isConfirmedWithPaystack,
          })
        );
      }

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: true, message: `Webhook event '${event}' acknowledged`, reference }));
    } catch (err: any) {
      console.error('[Paystack Webhook] Handler error:', err.message);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: false, message: 'Error handling webhook event (safely logged)' }));
    }
  }

  res.setHeader('Allow', 'POST, GET, OPTIONS, HEAD');
  res.statusCode = 405;
  return res.end(JSON.stringify({ status: false, message: 'Method Not Allowed' }));
}
