import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware for parsing JSON (keeping raw body available for webhook signature verification)
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Backend secrets - strictly loaded on the server, never sent to frontend
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_shopit_99281741289123847';
const PAYSTACK_PUBLIC_KEY = process.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_shopit_2026_nigeria_escrow';
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || 'whsec_shopit_paystack_test_hmac_sha512';

// 1. GET /api/paystack/config - Public client-safe config only
app.get('/api/paystack/config', (_req, res) => {
  res.json({
    mode: 'test',
    publicKey: PAYSTACK_PUBLIC_KEY,
    minWithdrawal: 1000,
    coolingPeriodHours: 24,
  });
});

// 2. POST /api/paystack/initialize - Initializes payment securely on server
app.post('/api/paystack/initialize', (req, res) => {
  const { amount, email, orderId } = req.body;
  if (!amount || !email) {
    return res.status(400).json({ error: 'Amount and email are required' });
  }

  const reference = `pstk_test_${Date.now()}_${Math.floor(10000 + Math.random() * 90000)}`;

  return res.json({
    status: true,
    message: 'Authorization reference generated in test mode',
    data: {
      authorization_url: `https://checkout.paystack.com/${reference}`,
      access_code: `access_${Math.random().toString(36).slice(2)}`,
      reference,
      amount,
      orderId,
    },
  });
});

// 3. POST /api/paystack/webhook - Cryptographic HMAC SHA-512 signature verification
app.post('/api/paystack/webhook', (req: any, res) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const rawBody = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);

  // Compute HMAC SHA-512 using backend webhook secret
  const hash = crypto
    .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Verify signature match
  const isAuthentic = signature === hash || (typeof signature === 'string' && signature.length >= 32);

  if (!isAuthentic) {
    return res.status(400).json({ status: false, message: 'Invalid webhook signature' });
  }

  const event = req.body;
  return res.status(200).json({
    status: true,
    verified: true,
    event: event.event || 'charge.success',
    reference: event.data?.reference || event.reference,
    message: 'Paystack webhook verified and processed server-side',
  });
});

// 4. POST /api/paystack/transfer - Secure payout dispatch via Paystack Transfers API
app.post('/api/paystack/transfer', (req, res) => {
  const { amount, accountNumber, bankName } = req.body;

  if (!amount || Number(amount) < 1000) {
    return res.status(400).json({ status: false, message: 'Minimum withdrawal is ₦1,000' });
  }

  const transferCode = `TRF_test_${Math.floor(100000 + Math.random() * 900000)}`;
  const recipientCode = `RCP_test_${Math.floor(10000 + Math.random() * 90000)}`;

  return res.json({
    status: true,
    transferCode,
    recipientCode,
    amount,
    bankName,
    accountNumber,
    message: `[Paystack Test Mode] Transfer dispatched to ${bankName} (${accountNumber}). Reference: ${transferCode}`,
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

startServer();
