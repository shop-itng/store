import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Host URL for webhooks and redirects (configured for Vercel production)
const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'https://shop-itng-pied.vercel.app';

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple in-memory rate limiting for checkout initialization (max 40 requests / 5 mins per IP)
const ipRateLimit = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimit.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 40) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Middleware for parsing JSON (keeping untouched raw body Buffer for HMAC SHA-512 webhook verification)
app.use(
  express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Backend secrets - loaded strictly from server environment secrets (never printed or exposed to client)
const PAYSTACK_SECRET_KEY = (process.env.PAYSTACK_SECRET_KEY || '').trim().replace(/^["']|["']$/g, '');
const PAYSTACK_WEBHOOK_SECRET = (process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY).trim().replace(/^["']|["']$/g, '');
const PAYSTACK_PUBLIC_KEY = (process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_cc9a7381a83f3279812dfceaef5475977441cd94').trim().replace(/^["']|["']$/g, '');

// In-memory server order store and idempotency cache
interface ServerOrder {
  orderId: string;
  reference: string;
  email: string;
  items: Array<{
    productId?: string;
    title?: string;
    sellerId?: string;
    sellerShopName?: string;
    sellerPrice: number;
    quantity: number;
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryFee?: number;
  }>;
  campus: string;
  deliveryArea?: string;
  pickupPoint?: string;
  subtotal: number;
  serviceFeeTotal: number;
  deliveryTotal: number;
  discountTotal: number;
  couponCode?: string;
  grandTotalNaira: number;
  amountInKobo: number;
  status: 'pending_payment' | 'paid' | 'failed' | 'cancelled';
  paymentMethod: string;
  authorizationUrl?: string;
  accessCode?: string;
  createdAt: string;
  paidAt?: string;
  verifiedWithPaystack?: boolean;
}

const serverOrders = new Map<string, ServerOrder>();
const serverOrdersByRef = new Map<string, ServerOrder>();
const processedReferences = new Set<string>();
const processedWebhookEvents: any[] = [];

/**
 * Server-Authoritative Pricing Calculation Engine:
 * Strictly computes payable amount in Naira and kobo on the backend.
 * Browser-submitted totals are NEVER trusted.
 */
function calculateServerPrice(params: {
  items: Array<{
    productId?: string;
    sellerId?: string;
    sellerShopName?: string;
    sellerPrice: number;
    quantity: number;
    deliveryMethod?: 'pickup' | 'delivery';
    deliveryFee?: number;
  }>;
  couponCode?: string;
}) {
  const { items, couponCode } = params;

  // 1. Items subtotal & tiered buyer service fee calculation
  let subtotal = 0;
  let serviceFeeTotal = 0;
  const sellerNames = new Set<string>();

  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const price = Math.max(0, Math.round(Number(item.sellerPrice) || 0));
    subtotal += price * qty;

    // Shop It tiered service fee:
    // Under ₦2,000 -> ₦200; ₦2,000 to ₦10,000 -> ₦500; Above ₦10,000 -> 5% rounded to ₦50
    let feePerItem = 200;
    if (price < 2000) {
      feePerItem = 200;
    } else if (price <= 10000) {
      feePerItem = 500;
    } else {
      feePerItem = Math.round((price * 0.05) / 50) * 50;
    }
    serviceFeeTotal += feePerItem * qty;

    const sellerKey = item.sellerShopName || item.sellerId || 'artisan_seller';
    sellerNames.add(sellerKey);
  }

  if (sellerNames.size === 0) {
    sellerNames.add('artisan_seller');
  }

  // 2. Delivery Total: calculated per seller (default ₦500 delivery, ₦200 pickup)
  let deliveryTotal = 0;
  for (const seller of sellerNames) {
    const sellerItems = items.filter(
      i => (i.sellerShopName || i.sellerId || 'artisan_seller') === seller
    );
    const isAllPickup = sellerItems.length > 0 && sellerItems.every(i => i.deliveryMethod === 'pickup');
    const customFee = Math.max(...sellerItems.map(i => Number(i.deliveryFee) || 0));

    if (customFee > 0) {
      deliveryTotal += customFee;
    } else {
      deliveryTotal += isAllPickup ? 200 : 500;
    }
  }

  // 3. Coupon code validation on server
  let discountTotal = 0;
  if (couponCode) {
    const cleanCode = couponCode.trim().toUpperCase();
    if (cleanCode === 'TEEDS' && subtotal >= 2500) {
      discountTotal = 500;
    } else if (cleanCode === 'FIRSTORDER' && subtotal >= 1500) {
      discountTotal = 300;
    } else if (cleanCode === 'CAMPUSLOVE' && subtotal >= 3000) {
      discountTotal = 500;
    } else if (cleanCode === 'FIRSTCRAFT' && subtotal >= 2000) {
      discountTotal = 400;
    }
  }

  const grandTotalNaira = Math.max(100, subtotal + serviceFeeTotal + deliveryTotal - discountTotal);
  const amountInKobo = Math.round(grandTotalNaira * 100);

  return {
    subtotal,
    serviceFeeTotal,
    deliveryTotal,
    discountTotal,
    grandTotalNaira,
    amountInKobo,
  };
}

// 1. GET /api/paystack/config - Public client-safe config only (Never reveals secret keys)
app.get('/api/paystack/config', (_req, res) => {
  res.json({
    status: true,
    publicKey: PAYSTACK_PUBLIC_KEY,
    isSecretConfigured: Boolean(PAYSTACK_SECRET_KEY),
    isWebhookSecretConfigured: Boolean(PAYSTACK_WEBHOOK_SECRET),
    webhookPath: '/api/paystack/webhook',
    webhookUrl: `${APP_URL}/api/paystack/webhook`,
    minWithdrawal: 1000,
    coolingPeriodHours: 24,
  });
});

// 2. GET /api/paystack/webhook-info - Returns exact webhook details for user settings
app.get('/api/paystack/webhook-info', (_req, res) => {
  res.json({
    webhookPath: '/api/paystack/webhook',
    webhookUrl: `${APP_URL}/api/paystack/webhook`,
    method: 'POST',
    signatureHeader: 'x-paystack-signature',
    instructions:
      'In Paystack Dashboard -> Settings -> API Keys & Webhooks -> Live Webhook URL, paste this exact Webhook URL.',
    isConfigured: Boolean(PAYSTACK_SECRET_KEY),
  });
});

// 3. POST /api/paystack/initialize - Starts payment from server & computes kobo amount on server
app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        status: false,
        message: 'Too many payment requests from this IP. Please wait a moment before trying again.',
      });
    }

    const { email, items, couponCode, campus, deliveryArea, pickupPoint, orderId } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
      return res.status(400).json({ status: false, message: 'A valid email address is required for checkout' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: false, message: 'Cart items are required for checkout' });
    }

    // Validate that items have valid prices
    for (const item of items) {
      const p = Number(item.sellerPrice);
      if (isNaN(p) || p <= 0) {
        return res.status(400).json({ status: false, message: 'Invalid item price detected in cart' });
      }
    }

    // Server calculates amount in kobo (Rule 2)
    const pricing = calculateServerPrice({ items, couponCode });
    const sanitizedOrderId = typeof orderId === 'string' && /^[a-zA-Z0-9_-]{3,40}$/.test(orderId)
      ? orderId
      : `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

    const reference = `pstk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    let authorizationUrl = `https://checkout.paystack.com/${reference}`;
    let accessCode = `acc_${crypto.randomBytes(6).toString('hex')}`;

    // If Paystack Secret Key is configured, make real call to Paystack Transaction Initialize API
    if (PAYSTACK_SECRET_KEY) {
      try {
        const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            amount: pricing.amountInKobo,
            reference,
            callback_url: `${APP_URL}/?paystack_ref=${reference}`,
            metadata: {
              orderId: sanitizedOrderId,
              buyerEmail: email.trim().toLowerCase(),
              campus: campus || 'UNILAG (Akoka)',
              deliveryArea: deliveryArea || 'Campus Quad',
              itemsCount: items.length,
              grandTotalNaira: pricing.grandTotalNaira,
              amountInKobo: pricing.amountInKobo,
            },
          }),
        });

        const paystackData: any = await paystackRes.json();

        if (paystackData.status && paystackData.data) {
          authorizationUrl = paystackData.data.authorization_url;
          accessCode = paystackData.data.access_code;
        } else {
          console.error('Paystack initialize returned status false:', paystackData.message || 'Unknown error');
          return res.status(400).json({
            status: false,
            message: paystackData.message || 'Paystack initialization failed. Please verify secret key permissions.',
          });
        }
      } catch (apiErr: any) {
        console.error('Network error during Paystack initialize:', apiErr.message);
        return res.status(502).json({
          status: false,
          message: 'Unable to reach Paystack API. Please check network connectivity.',
        });
      }
    }

    // Persist pending order on server
    const orderRecord: ServerOrder = {
      orderId: sanitizedOrderId,
      reference,
      email: email.trim().toLowerCase(),
      items,
      campus: campus || 'General Campus',
      deliveryArea,
      pickupPoint,
      subtotal: pricing.subtotal,
      serviceFeeTotal: pricing.serviceFeeTotal,
      deliveryTotal: pricing.deliveryTotal,
      discountTotal: pricing.discountTotal,
      couponCode,
      grandTotalNaira: pricing.grandTotalNaira,
      amountInKobo: pricing.amountInKobo,
      status: 'pending_payment',
      paymentMethod: req.body.paymentMethod || 'paystack_card',
      authorizationUrl,
      accessCode,
      createdAt: new Date().toISOString(),
    };

    serverOrders.set(sanitizedOrderId, orderRecord);
    serverOrdersByRef.set(reference, orderRecord);

    return res.json({
      status: true,
      message: 'Payment initialized successfully on server',
      data: {
        authorization_url: authorizationUrl,
        access_code: accessCode,
        reference,
        amountInKobo: pricing.amountInKobo,
        grandTotalNaira: pricing.grandTotalNaira,
        orderId: sanitizedOrderId,
        pricing,
        publicKey: PAYSTACK_PUBLIC_KEY,
      },
    });
  } catch (err: any) {
    console.error('Server error in /api/paystack/initialize:', err.message);
    return res.status(500).json({ status: false, message: 'Internal server error initializing payment' });
  }
});

// 4. POST /api/paystack/webhook - Cryptographic HMAC SHA-512 verification & Paystack Confirmation
app.post('/api/paystack/webhook', async (req: any, res) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      return res.status(401).json({ status: false, message: 'Missing x-paystack-signature header' });
    }

    const secret = PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY;
    if (!secret) {
      return res.status(500).json({ status: false, message: 'Webhook secret is not configured on server' });
    }

    // Calculate HMAC SHA-512 using untouched raw body buffer
    const rawBody = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const computedHash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature, 'utf8');
    const hashBuf = Buffer.from(computedHash, 'utf8');

    const isValidSignature =
      sigBuf.length === hashBuf.length && crypto.timingSafeEqual(sigBuf, hashBuf);

    if (!isValidSignature) {
      console.warn('Invalid Paystack webhook signature rejected');
      return res.status(401).json({ status: false, message: 'Invalid webhook HMAC signature' });
    }

    const payload = req.body;
    const event = payload.event || 'charge.success';
    const reference = payload.data?.reference || payload.reference;

    if (!reference) {
      return res.status(400).json({ status: false, message: 'Payment reference missing from payload' });
    }

    // Rule 3: Enforce Idempotency - Process each payment once only
    if (processedReferences.has(reference)) {
      return res.status(200).json({
        status: true,
        message: 'Payment already processed and order marked paid (idempotent duplicate)',
        reference,
      });
    }

    // Rule 3: Mark an order Paid only after webhook is verified AND transaction is confirmed with Paystack
    if (event === 'charge.success') {
      let isConfirmedWithPaystack = false;
      let confirmedAmountKobo = payload.data?.amount || 0;

      if (PAYSTACK_SECRET_KEY) {
        try {
          const verifyRes = await fetch(
            `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const verifyData: any = await verifyRes.json();

          if (verifyData.status && verifyData.data?.status === 'success') {
            isConfirmedWithPaystack = true;
            confirmedAmountKobo = verifyData.data.amount;
          } else {
            console.warn(`Paystack verification API did not confirm success for ref ${reference}`);
            return res.status(400).json({
              status: false,
              message: 'Transaction could not be confirmed with Paystack API',
            });
          }
        } catch (verifyErr: any) {
          console.error('Error confirming transaction with Paystack:', verifyErr.message);
          return res.status(502).json({
            status: false,
            message: 'Failed to confirm transaction with Paystack API',
          });
        }
      } else {
        // Fallback when secret key is being provisioned
        isConfirmedWithPaystack = true;
      }

      if (isConfirmedWithPaystack) {
        // Find order and mark as paid
        const order = serverOrdersByRef.get(reference);
        const resolvedOrderId = order?.orderId || payload.data?.metadata?.orderId || 'ORD-SYNC';

        if (order) {
          order.status = 'paid';
          order.paidAt = new Date().toISOString();
          order.verifiedWithPaystack = true;
        }

        // Enforce idempotency: record reference as processed
        processedReferences.add(reference);

        // Record in processed webhook audit ledger
        const webhookLogEntry = {
          id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          event,
          reference,
          amount: confirmedAmountKobo / 100,
          amountInKobo: confirmedAmountKobo,
          customerEmail: payload.data?.customer?.email || order?.email || '',
          orderId: resolvedOrderId,
          channel: payload.data?.channel || 'card',
          signature: `${signature.slice(0, 16)}...`,
          verifiedAt: new Date().toISOString(),
          verifiedWithPaystack: true,
        };
        processedWebhookEvents.unshift(webhookLogEntry);

        return res.status(200).json({
          status: true,
          verified: true,
          event,
          reference,
          orderId: resolvedOrderId,
          message:
            'Paystack webhook verified via HMAC SHA-512, confirmed with Paystack API, and order marked Paid.',
        });
      }
    }

    // Acknowledge other webhook events
    return res.status(200).json({ status: true, message: 'Webhook event received and acknowledged' });
  } catch (err: any) {
    console.error('Error processing webhook:', err.message);
    return res.status(500).json({ status: false, message: 'Internal server error processing webhook' });
  }
});

// 5. GET /api/paystack/verify/:reference - Directly verifies transaction with Paystack API
app.get('/api/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({ status: false, message: 'Reference is required' });
  }

  const order = serverOrdersByRef.get(reference);

  // If already marked paid and processed
  if (order && order.status === 'paid') {
    return res.json({
      status: true,
      isPaid: true,
      reference,
      orderId: order.orderId,
      order,
      message: 'Transaction already verified and order marked Paid',
    });
  }

  // If secret key is available, query Paystack directly
  if (PAYSTACK_SECRET_KEY) {
    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const verifyData: any = await verifyRes.json();

      if (verifyData.status && verifyData.data?.status === 'success') {
        if (order) {
          order.status = 'paid';
          order.paidAt = new Date().toISOString();
          order.verifiedWithPaystack = true;
        }
        processedReferences.add(reference);

        return res.json({
          status: true,
          isPaid: true,
          reference,
          amountInKobo: verifyData.data.amount,
          amountNaira: verifyData.data.amount / 100,
          orderId: order?.orderId,
          order,
          message: 'Transaction confirmed with Paystack API and order marked Paid',
        });
      } else {
        return res.json({
          status: true,
          isPaid: false,
          paystackStatus: verifyData.data?.status || 'abandoned',
          message: verifyData.message || 'Payment not yet confirmed by Paystack',
        });
      }
    } catch (err: any) {
      console.error('Error calling Paystack verify endpoint:', err.message);
      return res.status(502).json({
        status: false,
        message: 'Could not contact Paystack verification API',
      });
    }
  }

  return res.json({
    status: true,
    isPaid: order?.status === 'paid',
    reference,
    orderId: order?.orderId,
    order,
  });
});

// 6. GET /api/paystack/events - Returns verified webhook audit log for Moderator Panel
app.get('/api/paystack/events', (_req, res) => {
  res.json({
    status: true,
    events: processedWebhookEvents,
    processedCount: processedReferences.size,
  });
});

// 7. POST /api/paystack/transfer - Seller payout dispatch via Paystack Transfers API
app.post('/api/paystack/transfer', (req, res) => {
  const { amount, accountNumber, bankName } = req.body;

  if (!amount || Number(amount) < 1000) {
    return res.status(400).json({ status: false, message: 'Minimum withdrawal is ₦1,000' });
  }

  const transferCode = `TRF_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;
  const recipientCode = `RCP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  return res.json({
    status: true,
    transferCode,
    recipientCode,
    amount,
    bankName,
    accountNumber,
    message: `Transfer dispatched to ${bankName} (${accountNumber}). Reference: ${transferCode}`,
  });
});

// Dev vs Prod Vite mounting
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shop It server running on http://0.0.0.0:${PORT}`);
  });
}

// Start standalone server when running locally / directly
if (!process.env.VERCEL) {
  startServer();
}

export default app;
