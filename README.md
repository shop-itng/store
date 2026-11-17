# Shop It - Nigerian Youth Artisanal Marketplace

Shop It is a direct peer-to-peer artisanal marketplace built for Nigerian teens and youth to buy and sell handmade beads, fashion, fragrance oils, crochet wear, and crafts safely with escrow protection.

---

## 🚀 Deploying to Vercel

### Step 1: Import Repository
1. Push this codebase to your GitHub, GitLab, or Bitbucket account.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **Add New... → Project**.
3. Import your repository. Vercel will automatically detect `vite build` and the `dist` output directory from `vercel.json`.

### Step 2: Configure Environment Variables in Vercel
In the Vercel project deployment screen, open **Environment Variables** and add the following:

| Variable Name | Description | Value / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required in Production**: Pooled PostgreSQL connection string (Neon / Postgres) | `postgresql://user:pass@ep-xyz-pooler.region.aws.neon.tech/neondb?sslmode=verify-full` |
| `APP_SECRET` | Master 64-hex-character secret for HKDF key derivation (OTP hashing, NIN hash, AES-256-GCM KYC docs) | Generate with `openssl rand -hex 32` |
| `ADMIN_EMAIL` | Email address for initial superadmin provisioning | `admin@yourdomain.com` |
| `ADMIN_INITIAL_PASSWORD` | Initial superadmin password (must be changed on first login) | Strong random password |
| `FLW_PUBLIC_KEY` | Flutterwave public key | `FLWPUBK_TEST-...` (from Flutterwave Dashboard) |
| `FLW_SECRET_KEY` | Server-only secret key for API calls & verification | `FLWSECK_TEST-...` (from Flutterwave Dashboard) |
| `FLW_WEBHOOK_SECRET_HASH` | Secret hash matched against `verif-hash` header | Unique 32+ char secret set in Flutterwave Dashboard |
| `VITE_FLW_PUBLIC_KEY` | Optional client test-mode indicator | `FLWPUBK_TEST-...` |
| `APP_URL` | Your live Vercel URL | `https://shopitng.vercel.app` |

> **PostgreSQL / Neon Production Notes:**
> - Always configure `DATABASE_URL` in **Vercel → Project Settings → Environment Variables** for **Production** (and Preview if testing). Use Neon's **pooled** connection string with `?sslmode=verify-full` (or `?sslmode=require`).
> - Production fails closed if `DATABASE_URL` is missing (it never falls back to in-memory `pg-mem`).
> - After deploying, verify `GET https://shopitng.vercel.app/api/health` returns `{"status":"OK","schemaOk":true}`.
> - To run migrations manually against a remote database from your terminal without local `.env` overriding it, pass `NODE_ENV=production DATABASE_URL="postgresql://..." npm run migrate`.

Click **Deploy**. Daily maintenance runs automatically via `/api/cron/escrow` (`0 3 * * *` UTC / 4:00 AM WAT).

---

### Step 3: Set Your Flutterwave Webhook URL

In your [Flutterwave Dashboard](https://app.flutterwave.com/):

1. Go to **Settings** → **Webhooks**.
2. Under **URL**, paste your exact endpoint:
   ```text
   https://shopitng.vercel.app/api/webhooks/flutterwave
   ```
3. Under **Secret Hash**, paste the exact value you set for `FLW_WEBHOOK_SECRET_HASH`.
4. Enable **Receive webhook response in JSON format** and click **Save**.

---

## 💻 Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Local Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your keys in `.env`.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production
```bash
npm run build
```
Outputs static assets to `dist/`.

---

## 🔒 Security Architecture
- **Constant-Time `verif-hash` Webhook Verification + Server Re-Verification**: Incoming Flutterwave webhooks verify `verif-hash` in constant time and re-verify transactions directly via `GET /v3/transactions/:id/verify` before settling ledger balances.
- **Server-Authoritative Pricing**: Subtotals, tiered service fees, delivery costs, and kobo amounts are computed strictly on the backend.
- **Anti-Bypass Protection**: Phone numbers, account numbers, and off-platform contact patterns are filtered in chat to protect buyers and sellers from off-platform fraud.
- **Handshake Verification**: 4-digit numeric OTPs secure safe campus and local parcel pickups.
