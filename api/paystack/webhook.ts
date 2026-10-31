import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

/**
 * Vercel Serverless Function Config:
 * Disable default bodyParser so we receive the raw unparsed request stream
 * required for cryptographic HMAC SHA-512 signature verification.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

// In-memory idempotency cache for processed webhook references
const processedReferences = new Set<string>();

/**
 * Safely stream and collect the raw request body as a Buffer.
 * Supports both unparsed Node streams and pre-parsed Express/Vercel body Buffers.
 */
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

  // Stream readable chunks from the request
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

  // Fallback if req.body was already parsed as an object by middleware
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf-8');
  }

  return Buffer.from('');
}

/**
 * Dedicated Vercel Serverless Function Handler
 * Route: /api/paystack/webhook
 */
export default async function handler(req: any, res: any) {
  // 1. CORS Preflight Support
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-paystack-signature');
    res.statusCode = 200;
    return res.end();
  }

  // 2. Read Secrets from Vercel Environment Variables
  const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
  const PAYSTACK_WEBHOOK_SECRET = (
    process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY
  ).trim().replace(/^["']|["']$/g, '');

  // 3. Handle GET / HEAD: Friendly Status Page for Browser & Health Check Probes
  if (req.method === 'GET' || req.method === 'HEAD') {
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');

    if (acceptsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.statusCode = 200;
      return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shop It &bull; Paystack Webhook Serverless Endpoint</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: #131b2e;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 36px;
      max-width: 540px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.02em;
      margin-bottom: 20px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .table-box {
      background: #0a0f1d;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 16px;
      text-align: left;
      font-size: 13px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #cbd5e1;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #141e33;
    }
    .row:last-child {
      border-bottom: none;
    }
    .label {
      color: #64748b;
    }
    .val-green {
      color: #34d399;
      font-weight: 600;
    }
    .btn {
      display: inline-block;
      margin-top: 24px;
      background: #ea580c;
      color: #ffffff;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      transition: background 0.15s ease;
    }
    .btn:hover {
      background: #c2410c;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="dot"></span> Vercel Serverless Function Active
    </div>
    <h1>Shop It &bull; Paystack Webhook</h1>
    <p>This endpoint is deployed as a standalone Vercel Serverless Function, operational and listening for incoming Paystack payment webhooks.</p>
    <div class="table-box">
      <div class="row">
        <span class="label">Status:</span>
        <span class="val-green">200 OK &bull; Healthy</span>
      </div>
      <div class="row">
        <span class="label">Platform:</span>
        <span>Vercel Serverless</span>
      </div>
      <div class="row">
        <span class="label">Route:</span>
        <span>/api/paystack/webhook</span>
      </div>
      <div class="row">
        <span class="label">Signature Auth:</span>
        <span>HMAC SHA-512</span>
      </div>
      <div class="row">
        <span class="label">Accepted Method:</span>
        <span class="val-green">POST</span>
      </div>
    </div>
    <a href="/" class="btn">Return to Shop It Marketplace &rarr;</a>
  </div>
</body>
</html>`);
    }

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

  // 4. Handle POST: Webhook event payload processing
  if (req.method === 'POST') {
    try {
      const rawBuffer = await getRawBodyBuffer(req);
      const signature = (req.headers['x-paystack-signature'] || '') as string;
      const secret = PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY;

      // 4a. Cryptographic HMAC SHA-512 Signature Check
      if (secret && signature) {
        const computedHash = crypto
          .createHmac('sha512', secret)
          .update(rawBuffer)
          .digest('hex');

        const sigBuf = Buffer.from(signature, 'utf8');
        const hashBuf = Buffer.from(computedHash, 'utf8');

        const isValid =
          sigBuf.length === hashBuf.length && crypto.timingSafeEqual(sigBuf, hashBuf);

        if (!isValid) {
          console.warn(
            `[Paystack Webhook] Invalid signature received. Returning 200 to prevent retry storms.`
          );
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              status: false,
              message: 'Invalid signature logged',
            })
          );
        }
      } else if (!secret) {
        console.warn(
          `[Paystack Webhook] Warning: PAYSTACK_SECRET_KEY / PAYSTACK_WEBHOOK_SECRET is not configured in Vercel environment variables.`
        );
      }

      // 4b. Parse JSON Payload
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

      // 4c. Acknowledge Test Pings and Health Checks immediately
      if (!reference || event === 'ping' || event === 'test') {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            status: true,
            message: 'Webhook test received successfully',
            event,
          })
        );
      }

      // 4d. Idempotency Check: Prevent double-crediting
      if (processedReferences.has(reference)) {
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

      // 4e. Process Successful Charges
      if (event === 'charge.success') {
        let isConfirmedWithPaystack = false;
        let confirmedAmountKobo = data.amount || 0;

        // Verify directly against Paystack REST API when secret key is provided
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
              console.log(
                `[Paystack Webhook] Confirmed transaction ${reference} of ${confirmedAmountKobo / 100} NGN via Paystack REST API`
              );
            }
          } catch (verifyErr: any) {
            console.warn(
              `[Paystack Webhook] REST API verification attempt warning:`,
              verifyErr.message
            );
          }
        }

        // Record reference in idempotency cache
        processedReferences.add(reference);

        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            status: true,
            message: 'Paystack charge.success received and processed successfully',
            reference,
            amountNaira: confirmedAmountKobo / 100,
            verifiedWithPaystack: isConfirmedWithPaystack,
          })
        );
      }

      // Other Paystack events (refunds, transfers, etc.)
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          status: true,
          message: `Webhook event '${event}' acknowledged`,
          reference: reference || null,
        })
      );
    } catch (err: any) {
      console.error('[Paystack Webhook] Handler error:', err.message);
      // Always return 200 OK so Paystack does not retry endlessly
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(
        JSON.stringify({
          status: false,
          message: 'Error handling webhook event (safely logged)',
        })
      );
    }
  }

  // 5. Method Not Allowed Fallback
  res.setHeader('Allow', 'POST, GET, OPTIONS, HEAD');
  res.statusCode = 405;
  return res.end(JSON.stringify({ status: false, message: 'Method Not Allowed' }));
}
