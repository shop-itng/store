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
| `FLW_PUBLIC_KEY` | Flutterwave public key | `FLWPUBK_TEST-...` (from Flutterwave Dashboard) |
| `FLW_SECRET_KEY` | Server-only secret key for API calls & verification | `FLWSECK_TEST-...` (from Flutterwave Dashboard) |
| `FLW_WEBHOOK_SECRET_HASH` | Secret hash matched against `verif-hash` header | Unique 32+ char secret set in Flutterwave Dashboard |
| `VITE_FLW_PUBLIC_KEY` | Optional client test-mode indicator | `FLWPUBK_TEST-...` |
| `APP_URL` | Your live Vercel URL | `https://shop-itng-pied.vercel.app` |

Click **Deploy**.

---

### Step 3: Set Your Flutterwave Webhook URL

In your [Flutterwave Dashboard](https://app.flutterwave.com/):

1. Go to **Settings** → **Webhooks**.
2. Under **URL**, paste your exact endpoint:
   ```text
   https://shop-itng-pied.vercel.app/api/payments/webhook
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
