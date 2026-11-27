import crypto from 'crypto';
import { withTransaction, query as dbQuery } from '../db/postgres.js';
import { commitPaidOrderTransaction, koboToNaira, sendAdminAlert } from '../lib/payments.js';
import { logAuditEvent } from '../auth/sessionStore.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getPaystackSecretKey(): string {
  return (process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
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

function logWebhookLine(event: string, reference: string, result: string): void {
  const safeEvent = String(event || 'unknown').replace(/[\r\n\s]+/g, '_').slice(0, 60);
  const safeRef = String(reference || 'none').replace(/[\r\n\s]+/g, '_').slice(0, 100);
  console.log(`[Paystack Webhook] event=${safeEvent} reference=${safeRef} result=${result}`);
}

/**
 * Handles Paystack Webhook events (`charge.success`).
 * Validates `x-paystack-signature` header against PAYSTACK_SECRET_KEY (HMAC SHA512)
 * and re-verifies transactions via Paystack API before settling ledger.
 */
export default async function handler(req: any, res: any) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(
      JSON.stringify({
        status: 'ok',
        message: 'Paystack Webhook Endpoint Active',
      })
    );
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, HEAD');
    res.statusCode = 405;
    return res.end(JSON.stringify({ status: false, message: 'Method Not Allowed' }));
  }

  let logEvent = 'unknown';
  let logReference = 'none';

  if (process.env.PAYMENTS_ENABLED !== 'true') {
    logWebhookLine(logEvent, logReference, 'payments-disabled');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        message: 'Payments are currently disabled on this instance.',
      })
    );
  }

  const paystackSecret = getPaystackSecretKey();
  if (!paystackSecret) {
    logWebhookLine(logEvent, logReference, 'secret-missing');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        status: false,
        message: 'Paystack webhook secret key is not configured.',
      })
    );
  }

  try {
    const rawBodyBuf = await getRawBodyBuffer(req);
    const signature = String(req.headers['x-paystack-signature'] || '').trim();

    if (!signature) {
      logWebhookLine('unknown', 'none', 'signature-missing');
      return res.status(401).json({ status: false, message: 'Missing x-paystack-signature header' });
    }

    const computedHash = crypto
      .createHmac('sha512', paystackSecret)
      .update(rawBodyBuf)
      .digest('hex');

    let isValidSignature = false;
    try {
      isValidSignature =
        signature.length === computedHash.length &&
        crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(computedHash, 'utf8'));
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      console.warn('[Paystack Webhook Warning] Forged signature blocked.');
      await sendAdminAlert(
        `paystack_forged_sig_${Date.now()}`,
        'Forged Paystack Webhook Attempt Blocked',
        `A webhook request with invalid signature was blocked.<br/>Provided signature: <code>${signature.slice(0, 16)}...</code>`
      );
      return res.status(401).json({ status: false, message: 'Invalid webhook signature' });
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBodyBuf.toString('utf-8'));
    } catch {
      return res.status(400).json({ status: false, message: 'Invalid JSON payload' });
    }

    const event = String(payload.event || '').trim();
    const data = payload.data || {};
    logEvent = event || 'unknown';
    const reference = String(data.reference || '').trim();
    logReference = reference || 'none';

    if (event !== 'charge.success' || !reference) {
      logWebhookLine(logEvent, logReference, 'ignored-event-or-ref');
      return res.status(200).json({ status: true, received: true });
    }

    // Always re-verify with Paystack API before crediting
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
      },
    });
    const verifyData = await verifyRes.json().catch(() => ({}));

    if (!verifyRes.ok || !verifyData?.status || verifyData?.data?.status !== 'success') {
      logWebhookLine(logEvent, logReference, 'upstream-verify-failed');
      return res.status(200).json({ status: false, message: 'Paystack transaction not successful upon re-verify' });
    }

    const confirmedAmountKobo = Math.round(Number(verifyData.data.amount || 0));
    const channel = String(verifyData.data.channel || 'card');
    const customerEmail = verifyData.data.customer?.email || '';

    const settlement = await commitPaidOrderTransaction({
      reference,
      confirmedAmountKobo,
      currency: String(verifyData.data.currency || 'NGN').toUpperCase(),
      channel,
      webhookReceived: true,
      customerEmail,
      gatewayData: {
        paystackTransactionId: verifyData.data.id,
        gatewayResponse: verifyData.data.gateway_response,
        channel,
        fees: verifyData.data.fees,
      },
      source: 'paystack_webhook',
    });

    if (settlement.currencyMismatch || settlement.amountMismatch) {
      logWebhookLine(logEvent, logReference, 'currency-or-amount-mismatch');
      return res.status(200).json({ status: false, message: 'Currency or paid amount mismatch' });
    }

    if (settlement.expired) {
      logWebhookLine(logEvent, logReference, 'late-payment-expired');
      return res.status(200).json({ status: true, received: true, note: 'Payment received after order expiry' });
    }

    if (settlement.committed) {
      await logAuditEvent({
        action: 'PAYSTACK_WEBHOOK_COMMITTED',
        actor: { id: 'paystack_webhook', email: 'webhook@paystack', role: 'system' },
        target: { type: 'order', id: settlement.order?.id || reference },
        details: { reference, amountNaira: koboToNaira(confirmedAmountKobo), channel },
      });
    }

    logWebhookLine(logEvent, logReference, settlement.committed ? 'committed-success' : 'already-paid');
    return res.status(200).json({ status: true, received: true });
  } catch (err: any) {
    console.error('[Paystack Webhook Error]:', err.message);
    logWebhookLine(logEvent, logReference, 'exception');
    return res.status(500).json({ status: false, message: 'Internal error processing Paystack webhook' });
  }
}
