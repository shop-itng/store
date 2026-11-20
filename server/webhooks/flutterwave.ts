import crypto from 'crypto';
import { withTransaction, query as dbQuery } from '../db/postgres.js';
import { commitPaidOrderTransaction, koboToNaira, sendAdminAlert } from '../lib/payments.js';
import { logAuditEvent } from '../auth/sessionStore.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const KV_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
const KV_TOKEN = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

async function runKvCommand(command: string, ...args: any[]): Promise<any> {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(KV_URL.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command.toUpperCase(), ...args.map(a => String(a))]),
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

async function getRawBodyBuffer(req: any): Promise<Buffer> {
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (req.body && Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf-8');

  const chunks: Uint8Array[] = [];
  try {
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  } catch {}

  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf-8');
  }
  return Buffer.from('');
}

function timingSafeCompareHash(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function logWebhookLine(event: string, txRef: string, result: string): void {
  const safeEvent = String(event || 'unknown').replace(/[\r\n\s]+/g, '_').slice(0, 60);
  const safeRef = String(txRef || 'none').replace(/[\r\n\s]+/g, '_').slice(0, 100);
  console.log(`[FLW Webhook] event=${safeEvent} tx_ref=${safeRef} result=${result}`);
}

/**
 * Handles Flutterwave v3 Webhook events (`charge.completed` and `transfer.completed`).
 * Verifies `verif-hash` header against FLW_WEBHOOK_SECRET_HASH (constant-time)
 * and re-verifies transactions via Flutterwave v3 API before settling ledger.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: 'ok',
        message: 'POST only',
      })
    );
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, HEAD');
    res.statusCode = 405;
    return res.end(JSON.stringify({ status: false, message: 'Method Not Allowed' }));
  }

  let logEvent = 'unknown';
  let logTxRef = 'none';

  if (process.env.PAYMENTS_ENABLED !== 'true') {
    logWebhookLine(logEvent, logTxRef, 'payments-disabled');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        error: 'PAYMENTS_DISABLED',
        message: 'Online payments are coming soon. Arrange directly with the seller',
      })
    );
  }

  const secretKey = (process.env.FLW_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  const webhookSecretHash = (process.env.FLW_WEBHOOK_SECRET_HASH || '').trim().replace(/^["']|["']$/g, '');

  // Fail closed if secret hash or gateway secret key is missing
  if (!webhookSecretHash || !secretKey) {
    logWebhookLine(logEvent, logTxRef, 'missing-config');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        message: 'Flutterwave webhook verification hash or secret key is not configured.',
      })
    );
  }

  try {
    const providedHash = String(req.headers['verif-hash'] || '').trim();
    if (!providedHash) {
      logWebhookLine(logEvent, logTxRef, 'rejected-signature');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      return res.end(JSON.stringify({ status: false, message: 'Missing verif-hash webhook signature' }));
    }

    if (!timingSafeCompareHash(providedHash, webhookSecretHash)) {
      logWebhookLine(logEvent, logTxRef, 'rejected-signature');
      await logAuditEvent({
        action: 'WEBHOOK_SIGNATURE_REJECTED',
        actor: { id: 'flutterwave_webhook', email: 'webhook@flutterwave', role: 'system' },
        target: { type: 'webhook', id: 'flutterwave' },
        details: { reason: 'Invalid verif-hash signature' },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      await sendAdminAlert(
        `forged_webhook_${Math.floor(Date.now() / 60000)}`,
        'Forged Flutterwave Webhook Attempt Blocked',
        `A webhook request failed <code>verif-hash</code> validation and was rejected with HTTP 401.`
      ).catch(() => {});
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      return res.end(JSON.stringify({ status: false, message: 'Invalid webhook verif-hash signature' }));
    }

    const rawBuffer = await getRawBodyBuffer(req);
    const payload: any = JSON.parse(rawBuffer.toString('utf-8') || '{}');
    const event = String(payload.event || '').trim();
    const data = payload.data || {};
    logEvent = event || 'unknown';
    logTxRef = String(data.tx_ref || data.reference || 'none').trim() || 'none';

    // 1. Handle Transfer (Payout) Webhook
    if (event === 'transfer.completed') {
      const flwTransferStatus = String(data.status || '').toUpperCase();
      const transferRef = String(data.reference || '').trim();
      const flwTransferId = data.id ? String(data.id) : '';
      logTxRef = transferRef || flwTransferId || 'none';

      if (!transferRef && !flwTransferId) {
        logWebhookLine(logEvent, logTxRef, 'ignored');
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ status: true, message: 'Transfer webhook missing reference; acknowledged.' }));
      }

      const transferOutcome = await withTransaction(async client => {
        const pRes = await client.query(
          `SELECT * FROM shopit_payouts
           WHERE reference = $1 OR flw_transfer_id = $2
           FOR UPDATE`,
          [transferRef, flwTransferId]
        );
        if (pRes.rows.length === 0) {
          return { found: false };
        }
        const payout = pRes.rows[0];

        if (flwTransferStatus === 'SUCCESSFUL') {
          await client.query(
            `UPDATE shopit_payouts
             SET status = 'success',
                 provider_response = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(data), payout.id]
          );
          await client.query(
            `UPDATE shopit_ledger_entries
             SET status = 'completed'
             WHERE reference = $1 AND type = 'withdrawal'`,
            [payout.reference]
          );
          return { found: true, outcome: 'success', reference: payout.reference };
        }

        if (flwTransferStatus === 'FAILED') {
          if (payout.status === 'failed') {
            return { found: true, outcome: 'already_reversed', reference: payout.reference };
          }
          const amountKobo = Number(payout.amount_kobo || 0);
          const feeKobo = Number(payout.fee_kobo || 0);
          const totalRestoreKobo = Number(payout.total_deduction_kobo || amountKobo + feeKobo);

          const wRes = await client.query(
            'SELECT available_balance_kobo, total_withdrawn_kobo FROM shopit_wallets WHERE seller_id = $1 FOR UPDATE',
            [payout.seller_id]
          );
          if (wRes.rows.length > 0) {
            const curAvail = parseInt(String(wRes.rows[0].available_balance_kobo || '0'), 10);
            const curWtd = parseInt(String(wRes.rows[0].total_withdrawn_kobo || '0'), 10);
            const restoredAvail = curAvail + totalRestoreKobo;
            const restoredWtd = Math.max(0, curWtd - amountKobo);

            const idempotencyKey = `transfer_failed:${payout.reference}`;
            const ledIns = await client.query(
              `INSERT INTO shopit_ledger_entries (
                id, wallet_id, type, balance_type, status,
                amount_kobo, fee_kobo, balance_after_kobo, description, reference, idempotency_key, created_at
              ) VALUES ($1, $2, 'refund', 'available', 'completed', $3, 0, $4, $5, $6, $7, NOW())
              ON CONFLICT (idempotency_key) DO NOTHING
              RETURNING id`,
              [
                `LEDGER-WTD-REV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
                payout.seller_id,
                totalRestoreKobo,
                restoredAvail,
                `Failed payout reversal · ${payout.reference}`,
                payout.reference,
                idempotencyKey,
              ]
            );

            if (ledIns.rows.length > 0) {
              await client.query(
                `UPDATE shopit_wallets
                 SET available_balance_kobo = $1,
                     total_withdrawn_kobo = $2, updated_at = NOW()
                 WHERE seller_id = $3`,
                [restoredAvail, restoredWtd, payout.seller_id]
              );
            }
          }

          await client.query(
            `UPDATE shopit_payouts
             SET status = 'failed',
                 provider_response = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(data), payout.id]
          );
          return { found: true, outcome: 'reversed', reference: payout.reference };
        }

        return { found: true, outcome: flwTransferStatus, reference: payout.reference };
      });

      const tResult = !transferOutcome.found
        ? 'not-found'
        : transferOutcome.outcome === 'already_reversed'
          ? 'duplicate'
          : transferOutcome.outcome === 'reversed'
            ? 'payout-reversed'
            : transferOutcome.outcome === 'success'
              ? 'accepted'
              : String(transferOutcome.outcome || 'ignored');
      logWebhookLine(logEvent, logTxRef, tResult);

      await logAuditEvent({
        action: 'PAYOUT_WEBHOOK_PROCESSED',
        actor: { id: 'flutterwave_webhook', email: 'webhook@flutterwave', role: 'system' },
        target: { type: 'payout', id: transferRef || flwTransferId },
        details: { status: flwTransferStatus, outcome: (transferOutcome as any).outcome },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });

      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: true, ...transferOutcome }));
    }

    // 2. Handle Charge Completion Webhook
    const reference = String(data.tx_ref || '').trim();
    const flwTransactionId = data.id ? String(data.id).trim() : '';
    logTxRef = reference || flwTransactionId || 'none';

    if (event !== 'charge.completed' || (!reference && !flwTransactionId)) {
      logWebhookLine(logEvent, logTxRef, 'ignored');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ status: true, message: 'Event ignored or ping acknowledged.' }));
    }

    // Check charge payload status early: if Flutterwave explicitly reports failed/cancelled, do not mark paid
    if (data.status && String(data.status).toLowerCase() !== 'successful') {
      if (reference) {
        await dbQuery(
          `UPDATE shopit_payments
           SET status = $1, webhook_received = true, data = $2, updated_at = NOW()
           WHERE reference = $3 AND status IN ('pending', 'pending_payment')`,
          [String(data.status).toLowerCase(), JSON.stringify({ flwTransactionId, rawStatus: data.status }), reference]
        ).catch(() => {});
      }
      logWebhookLine(logEvent, logTxRef, 'non-successful');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          status: true,
          isPaid: false,
          message: `Non-successful charge status (${data.status}) recorded without settlement.`,
        })
      );
    }

    // Always re-verify with Flutterwave API v3; fail closed on timeout or non-200
    const verifyUrl = flwTransactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(flwTransactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let verifyRes: Response;
    let verifyData: any;
    try {
      verifyRes = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      verifyData = await verifyRes.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (verifyRes.status >= 500) {
      logWebhookLine(logEvent, logTxRef, 'upstream-error');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 502;
      return res.end(JSON.stringify({ status: false, message: 'Flutterwave verification upstream temporarily unavailable.' }));
    }

    if (!verifyRes.ok || verifyData?.status !== 'success' || verifyData?.data?.status !== 'successful') {
      logWebhookLine(logEvent, logTxRef, 'verify-failed');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(
        JSON.stringify({
          status: false,
          message: 'Flutterwave verification failed or transaction status is not successful.',
        })
      );
    }

    const verifiedRef = String(verifyData.data.tx_ref || reference).trim();
    logTxRef = verifiedRef || logTxRef;
    if (!verifiedRef || (reference && verifiedRef !== reference)) {
      logWebhookLine(logEvent, logTxRef, 'tx-ref-mismatch');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ status: false, message: 'Verified tx_ref mismatch.' }));
    }

    const verifiedCurrency = String(verifyData.data.currency || '').toUpperCase();
    const verifiedAmountKobo = Math.round(Number(verifyData.data.amount || 0) * 100);
    const channel = String(verifyData.data.payment_type || data.payment_type || 'card');

    // Match order ONLY by server tx_ref (`payment_reference`), atomic transaction + idempotency inside DB
    const settlement = await commitPaidOrderTransaction({
      reference: verifiedRef,
      confirmedAmountKobo: verifiedAmountKobo,
      currency: verifiedCurrency,
      channel,
      webhookReceived: true,
      customerEmail: verifyData.data.customer?.email || data.customer?.email,
      gatewayData: {
        flwTransactionId: verifyData.data.id,
        flwRef: verifyData.data.flw_ref,
        processorResponse: verifyData.data.processor_response,
        paymentType: channel,
      },
      source: 'flutterwave_webhook',
    });

    if (!settlement.found) {
      logWebhookLine(logEvent, logTxRef, 'not-found');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 404;
      return res.end(JSON.stringify({ status: false, message: 'Order reference (tx_ref) not found.' }));
    }

    if (settlement.currencyMismatch || settlement.amountMismatch) {
      logWebhookLine(logEvent, logTxRef, settlement.amountMismatch ? 'amount-mismatch' : 'currency-mismatch');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 400;
      return res.end(JSON.stringify({ status: false, message: 'Currency or paid amount mismatch.' }));
    }

    if (settlement.expired) {
      logWebhookLine(logEvent, logTxRef, 'expired');
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 409;
      return res.end(
        JSON.stringify({
          status: false,
          expired: true,
          message: 'Order had already expired/cancelled. Flagged for admin refund.',
        })
      );
    }

    if (settlement.committed) {
      await runKvCommand('SETEX', `pay_evt:${verifiedRef}`, String(7 * 24 * 60 * 60), '1');
      await logAuditEvent({
        action: 'ORDER_PAID_WEBHOOK',
        actor: {
          id: settlement.order?.buyer_id || 'buyer',
          email: verifyData.data.customer?.email || settlement.order?.buyer_email || 'buyer@shopit.ng',
          role: 'buyer',
        },
        target: { type: 'order', id: settlement.order?.id || verifiedRef },
        details: {
          reference: verifiedRef,
          amountNaira: koboToNaira(verifiedAmountKobo),
          channel,
          flwTransactionId: verifyData.data.id,
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }

    logWebhookLine(logEvent, verifiedRef, settlement.alreadyPaid ? 'duplicate' : 'accepted');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: true,
        alreadyProcessed: settlement.alreadyPaid,
        duplicate: Boolean(settlement.alreadyPaid),
        reference: verifiedRef,
        flwTransactionId: verifyData.data.id,
        message: settlement.alreadyPaid
          ? 'Payment already settled (idempotent).'
          : 'Flutterwave payment verified and settled into escrow ledger.',
      })
    );
  } catch (err: any) {
    logWebhookLine(logEvent, logTxRef, 'error');
    console.error('[Flutterwave Webhook Error]:', err.message);
    await sendAdminAlert(
      `webhook_err_${Math.floor(Date.now() / 60000)}`,
      'Flutterwave Webhook Processing Error',
      `An internal or upstream timeout occurred while processing a webhook event: <code>${String(err.message || 'Unknown error').slice(0, 200)}</code>`
    ).catch(() => {});
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    return res.end(JSON.stringify({ status: false, message: 'Internal error processing Flutterwave webhook' }));
  }
}
