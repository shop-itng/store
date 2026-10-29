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
| `PAYSTACK_PUBLIC_KEY` | Public key used for checkout (no `VITE_` prefix required) | `pk_live_cc9a7381a83f3279812dfceaef5475977441cd94` |
| `PAYSTACK_SECRET_KEY` | Server-only secret key for verification | `sk_live_...` (from your Paystack Dashboard) |
| `PAYSTACK_WEBHOOK_SECRET` | Secret key used to verify webhook HMAC SHA-512 | `sk_live_...` (same as secret key) |
| `APP_URL` | Your live Vercel URL | `https://shop-itng.vercel.app` |

Click **Deploy**.

---

### Step 3: Set Your Paystack Webhook URL

In your [Paystack Dashboard](https://dashboard.paystack.com/):

1. Go to **Settings** → **API Keys & Webhooks**.
2. Under **Live Webhook URL**, paste your exact endpoint:
   ```text
   https://shop-itng.vercel.app/api/paystack/webhook
   ```
3. Click **Save Changes** (and click **Test** to send a test event).

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
- **Cryptographic HMAC SHA-512 Webhook Verification**: Incoming Paystack webhooks are verified with constant-time equality checks against the raw body buffer.
- **Server-Authoritative Pricing**: Subtotals, tiered service fees, delivery costs, and kobo amounts are computed strictly on the backend.
- **Anti-Bypass Protection**: Phone numbers, account numbers, and off-platform contact patterns are filtered in chat to protect buyers and sellers from off-platform fraud.
- **Handshake Verification**: 4-digit numeric OTPs secure safe campus and local parcel pickups.
