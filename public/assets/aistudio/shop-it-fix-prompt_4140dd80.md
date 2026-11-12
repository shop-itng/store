# SHOP IT: FULL SECURITY, PAYMENT AND BUG-FIX TASK

Shop It is a LIVE Nigerian marketplace run by TEEDS. It will handle real money and real users, many of them minors (minimum age 10). A bug here means lost money or legal trouble for me. Treat this as a security audit and repair, not a feature task.

**PAYMENT PROVIDER CHANGE: I no longer use Paystack. I use Flutterwave.** Remove Paystack completely (code, file names, routes, env vars, UI text, legal pages, README, comments) and rebuild payments on Flutterwave.

I had the whole project reviewed. The findings below are real and come from the code. Fix every one. Then do your own full sweep for anything else.

---

## RULES (follow strictly)

1. Never say something is "fixed", "working" or "secure" unless you proved it with a command or test and pasted the output. If you cannot verify it, write NOT VERIFIED.
2. Do not guess Flutterwave API details. Read the current official docs at developer.flutterwave.com and use the stable API version. Confirm from the docs: checkout method, verify-transaction endpoint, webhook signature header and method, transfer/payout endpoints, bank-list and account-name-resolve endpoints, test cards and test mode behaviour. Tell me which API version you chose and why.
3. Never hard-code keys. No secrets in frontend code, README, logs or error messages.
4. FAIL CLOSED. If a key or config is missing, payments must refuse. Nothing may ever "simulate success", fake a verification, or fall back to a demo mode in production.
5. Money is integer kobo only, calculated on the SERVER from prices stored in the database. Never trust prices, quantities, fees, discounts, totals, seller IDs, user IDs, roles, order status or payment status sent from the browser.
6. Keep the current UI and branding. Do not redesign. Do not break signup, login, product listing or browsing.
7. Work in the phases below. After each phase, give a short report: what changed, which files, and proof. Do not start the next phase until `npm run lint` and `npm run build` both pass.
8. If a decision is mine to make (marked ASK ME), stop and ask. Do not decide for me.

---

## PHASE 0: SAFETY SWITCH AND BASELINE

1. Add env flags `PAYMENTS_ENABLED` and `PAYOUTS_ENABLED`, both default `false`.
2. While `PAYMENTS_ENABLED` is false: checkout is disabled in the UI with the message "Online payments are coming soon. Arrange directly with the seller", and every payment, order-creation and wallet endpoint returns 503. While `PAYOUTS_ENABLED` is false: no withdrawal can be requested or debited.
3. Run `npm install`, `npm run lint` and `npm run build`. Fix every error. Report the error count before and after.

---

## PHASE 1: CRITICAL HOLES (fix ALL, in this order)

### C1. Login bypass with an `x-user-id` header
- `api/auth/middleware.ts` `extractToken()` step 4 turns an `x-user-id` header into `usr_direct_<id>`.
- `api/auth/sessionStore.ts` `getSession()` accepts that token with NO password or session, looks the user up by id OR email, and gives `subRole` = `superadmin` by default.
- Result: anyone who knows an email or user ID can act as that user, including the admin.
- Fix: delete the `usr_direct_` path completely. Delete the `x-user-id` header from every client call (it is sent in `AppContext.tsx` `placeOrder` and elsewhere). Sessions must come only from the httpOnly cookie or a real session token.
- Also remove the `subRole || 'superadmin'` default in login and session code. A user with no sub-role gets none.

### C2. Admin and sensitive routes have NO authentication (`api/index.ts`)
These have no auth middleware at all: `GET /admin/users`, `DELETE /admin/users/:id`, `POST /admin/users/:id/ban`, `POST /admin/users/:id/reset-password`, `POST /admin/sellers/:id/verify`, `GET /admin/metrics`, `GET /admin/export-data`, `GET /reports`, `PATCH /reports/:id`, `GET /verification/admin/queue`, `POST /verification/admin/review`, and `POST /escrow/auto-release`.
Also unauthenticated: `POST /sellers/verify/submit`, `POST /verification/submit`, `GET /verification/status/:sellerId`, `POST /verification/delete-data`, `GET /auth/me?email=&userId=` (leaks age, guardian name, ban reason and NIN last 4 of ANY user, including minors), and `POST /email/send` (C14).
- Fix: give every route an explicit guard (`requireAuth`, `requireAdmin`, `requireModerator`, `requireFinance`, or owner-only). Default-deny. Add one test that lists every registered route and fails if a route has no guard and is not on an explicit public allow-list.
- `/verification/admin/review` must take the reviewer from the session, never from `req.body.adminName`.
- `/auth/me` must return only the logged-in user from the session, never look up by query parameters.

### C3. Orders are created as "paid" with no payment (`api/routes/marketplace.ts` `POST /orders`)
- Route uses `optionalAuth`, trusts every amount in the body, inserts the order as `status = 'paid'`, credits sellers' pending wallets, and returns the handshake OTP. Anyone can print money into a seller wallet, release it (C8) and withdraw it (C7).
- Fix: remove client-side order creation. The server creates the order as `pending_payment` at payment initialization, requires login, and loads prices from the products table. Only a verified Flutterwave webhook or a server-side verification call may change it to `paid`. Delete the client-side `placeOrder` money logic.

### C4. Payment initialization trusts the browser (`POST /paystack/initialize`, `calculateServerPrice`)
- `sellerPrice`, `deliveryFee`, `quantity` and `sellerId` come from the request body. Sending `sellerPrice: 1` gives a ₦100 order for an expensive item. No login required. Coupons are hard-coded in code. Orders and idempotency are kept in in-memory Maps, which do not work on Vercel serverless (state is lost between requests).
- Fix: require login. Accept only `productId` and `quantity`. Load price, seller, stock and delivery rules from the database. Reject inactive, deleted or out-of-stock products, quantity above stock, and buying your own product. Store coupons in the database with expiry and usage limits. Persist the pending order and payment record in Postgres, not memory. Use a unique `tx_ref` per attempt.

### C5. Fake payment confirmation paths
- `POST /paystack/confirm-test-payment` is public and marks any reference paid and credits `'seller-amaka-beads'` with any amount.
- `GET /paystack/verify/:reference?simulate=true`, and the branch used when the secret key is missing, mark everything paid. Deleting the Paystack env vars during migration would turn this on for EVERY payment.
- `CheckoutModal.tsx` "Confirm Order in Escrow" button calls both of the above and then runs `finalizeOrder()` even when they fail.
- Fix: delete all of it. A buyer clicking a button must never mark anything paid. The UI may only poll a server endpoint that reads the order status written by the verified webhook or server verification.

### C6. Webhook is unsafe (`api/paystack/webhook.ts`)
- Signature check is skipped entirely when no secret is set.
- It still marks the order paid when the gateway verification call FAILS, using the amount from the payload.
- No check that the paid amount matches the order total, or that currency is NGN.
- Order is found by `payment_reference = ref OR id = metadata.orderId`. The attacker controls metadata, so a ₦100 payment can mark a different, expensive order as paid.
- Idempotency key is written BEFORE processing, and errors are swallowed with HTTP 200, so a failed credit is lost forever.
- No database transaction. Wallet credit is read-then-write (race condition).
- It overwrites order status from any state (can revive a refunded order and credit again). It can double-credit together with C3.
- Emails are sent without `await`, so serverless may drop them.
- Fix in the Flutterwave webhook: reject if the secret hash is not configured; verify the signature with a constant-time compare on the raw body; re-verify the transaction with the Flutterwave API; require status successful, currency NGN, and amount >= order total in kobo; match the order ONLY by your own `tx_ref`; only move `pending_payment` to `paid`; do everything in one DB transaction with a unique constraint on the payment reference (idempotency inside the transaction); return 5xx on internal failure so Flutterwave retries; await the emails or queue them.

### C7. Withdrawals can be stolen (`POST /paystack/transfer`)
- `sellerId` is read from the request body and never compared to the logged-in user. Any logged-in user can withdraw another seller's balance (OTP is checked against the attacker's own email).
- If no saved payout account matches, it accepts `bankName` and `accountNumber` from the request body, bypassing the 24-hour cooling period and name check.
- When `PAYOUTS_ENABLED` is false it still DEBITS the wallet and returns "completed in test mode". Sellers lose money and nothing is sent.
- Balance check and update are separate queries (double-spend with parallel requests). Default bank code is `044` when missing, so money can go to the wrong bank. No idempotency key. OTP `123456` is accepted when `NODE_ENV` is not production. Payout account is saved with `isVerified: true` without any bank name lookup.
- Fix: seller comes only from the session. Use only a saved, cooled-down payout account, never body values. Resolve the account name through Flutterwave, require a match with the seller's verified ID name, and store the verified name. In one DB transaction: lock the wallet row (`SELECT ... FOR UPDATE`), check the balance, debit, insert a ledger entry with a unique idempotency key, and create a payout record with status `pending`. Then call the Flutterwave Transfers API with a unique reference. Handle the transfer webhook: on failure, reverse the debit with a ledger entry; on success, mark complete. Remove the `123456` OTP. Cap daily withdrawals. Alert admin on large amounts.

### C8. Anyone can release escrow (`PATCH /orders/:id/status`)
- Only `requireAuth`. Any logged-in user can set ANY order to `delivered` or `completed` and release the seller's money. No state machine. The handshake OTP is checked but never enforced.
- `GET /orders` returns `handshakeOtp` to the SELLER, so the seller can confirm delivery without the buyer.
- Auto-release pays sellers 5 days after payment even if the order was never packed or shipped.
- The auto-release timer is `setInterval` in `server.ts`, which does not run on Vercel. `vercel.json` has no cron. So auto-release never runs in production.
- Fix: enforce roles and a strict state machine (paid, packed, shipped, delivered, completed, with disputed, cancelled, refunded as branches). Only the seller can mark packed/shipped. Only the buyer, or the verified handshake OTP, can mark delivered/completed. Never return the handshake OTP to the seller. Auto-release only for orders that were shipped or delivered and have no open dispute, and ASK ME what the rule should be for never-shipped orders (default: auto-refund the buyer). Create a Vercel Cron job protected by a `CRON_SECRET` header. The manual trigger route must be admin-only. Every release is one DB transaction with a unique ledger key so it can never run twice.

### C9. Fake bank account numbers and false claims shown to buyers
- `api/index.ts` and `CheckoutModal.tsx` generate RANDOM account numbers labelled "Wema Bank (Paystack Escrow)" and fake USSD codes like `*737*000*1234#`. A buyer could send real money to a wrong or non-existent account.
- UI and legal text claim "Central Bank of Nigeria & NDPA-compliant Escrow", "CBN Compliant", "CBN-licensed escrow", "256-bit encryption". Legal pages also say TEEDS is not registered with CAC.
- Fix: delete every fake transfer and USSD detail. Bank transfer and USSD must come ONLY from the Flutterwave response (generated virtual account, USSD code). If Flutterwave fails, show an error. Replace the false compliance claims with accurate wording (for example: "Payments are processed by Flutterwave. Shop It holds your payment until delivery is confirmed"). Do not claim CBN licensing, bank escrow or regulatory approval. List every place you changed.

### C10. CORS, CSRF and CSP
- CORS allows ANY origin ending in `.vercel.app` or `.run.app` with credentials. Anyone can host a page on vercel.app and make logged-in requests to my API.
- CSP allows `unsafe-eval` and `unsafe-inline` scripts, and still lists Paystack domains.
- Fix: allow only my exact production origin (and localhost in development). Add CSRF protection for cookie-authenticated POST/PUT/PATCH/DELETE (Origin check plus a token or `SameSite=Strict` where possible). Tighten CSP, remove Paystack, add only the Flutterwave domains the docs require. Keep `Secure` and `HttpOnly` on cookies.

### C11. Registration, login and password flow
- `POST /auth/register` forces `is_verified_email = true`. The email OTP is not enforced by the server, so anyone can register with someone else's email. Login says whether an email is registered (account enumeration). `age` is optional, so the under-18 guardian check can be skipped by omitting it. There is no rate limit on register, send-otp or reset. Password minimum is 6 characters. Sessions are not revoked after a password change or reset.
- Fix: create accounts as unverified; the server must require a verified signup OTP before activating. Same generic error for wrong email or wrong password. Make date of birth or age required and validate it server-side; guardian consent for under 18 must be recorded properly (ASK ME how guardian consent should be verified). Per-IP and per-email rate limits stored in Redis (not memory). Minimum password length 8. Revoke all sessions after password change or reset. Apply an OTP attempt limit atomically (the current read-modify-write can be bypassed with parallel requests).

### C14. `POST /email/send` is an open relay
Anyone can send any subject and HTML to any address from shopitverified@gmail.com. This enables phishing from my domain and can get the sender blocked.
- Fix: delete the route, or make it admin-only with fixed templates. Escape all user text inserted into email HTML.

### C12. Identity data (NIN, selfies, guardian data of minors)
- Part of the `/verification/*` flow keeps submissions and document photos in in-memory Maps (lost on restart, not shared across serverless instances), and the routes are unauthenticated (C2).
- Under the Nigeria Data Protection Act 2023 this is high-risk data, and some of it is about children.
- Fix: persist in Postgres with encryption at rest for NIN and images (or use a proper KYC provider; ASK ME), restrict access to admin with audit logging, signed short-lived URLs for documents, retention and deletion rules, and a working delete-my-data flow. Never log NINs or images.

### C13. Secrets and server state
- A live Paystack key is hard-coded as a default in `paystackService.ts`, `api/index.ts`, `vite.config.ts` and `README.md`. A 64-character hex string that looks like part of a Brevo API key is hard-coded twice in `api/index.ts` (the email sender and the `/auth/send-otp` route).
- Rate limits, lockouts, processed-reference sets and the admin alert de-duplication live in process memory. That does not work on Vercel serverless.
- Fix: remove every hard-coded key and default. Tell me which keys to rotate (assume Brevo, Neon, Upstash and the admin password are exposed, because this code has been shared). Move all rate limiting, lockouts, idempotency and de-duplication to Redis or Postgres. Remove `pg-mem` and any in-memory database fallback from production paths.

### C15. Two sources of truth
- `AppContext.tsx` keeps orders, wallets, ledger entries and "Paystack webhook events" in localStorage, and the client fabricates webhook events with `verified: true` and fake signatures. The server database is the real record, so the two can disagree and mislead users and admins.
- Fix: the browser must never hold or create financial records. Orders, wallets, ledger and payment events come only from the API. Delete the simulated webhook, simulated signature checks (`verifyPaystackWebhookSignature` always returns valid), and the simulated `executePaystackTransfer`. Remove `src/data/mockData.ts` demo data from production paths (keep only real constants such as campus lists). Load the bank list from Flutterwave, not a hard-coded array.

### C16. Database integrity
- `shopit_orders.payment_reference` is not unique, so one payment can be reused for several orders. Ledger and wallet writes are separate queries with no transaction. Amounts exist as both float naira and integer kobo columns.
- Fix: unique constraint on payment reference and on ledger idempotency key; foreign keys; `CHECK (balance >= 0)` on wallets; one transaction per money movement; kobo as the single source of truth (drop or derive the float columns). Write a migration and a reconciliation script that checks: sum of wallet balances + withdrawals = sum of released order earnings, and every paid order has exactly one payment and one ledger set. Run it and show the output.

---

## PHASE 2: REBUILD PAYMENTS ON FLUTTERWAVE

Rename everything from paystack to payments/flutterwave (routes, files, variables, UI strings). Suggested env vars: `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_WEBHOOK_SECRET_HASH` (and `FLW_ENCRYPTION_KEY` only if the docs require it for the method you use). Update `.env.example`, Vercel instructions and README. Delete all `PAYSTACK_*` references. The webhook URL for the Flutterwave dashboard is `https://shop-itng-pied.vercel.app/api/payments/webhook`.

Required flow:
1. Buyer logs in and taps Pay. Server builds the order from DB prices, stores it `pending_payment`, and creates a Flutterwave payment (hosted/standard checkout) in NGN with a unique `tx_ref` and a redirect URL. Offer card, bank transfer and USSD (and Opay if the docs say it is available for my account).
2. The browser only opens the payment link or popup. It never sends the amount.
3. Flutterwave webhook plus a server-side "verify by tx_ref" endpoint decide if it was paid (see C6). The UI polls the order status.
4. On confirmed payment: order becomes `paid`, one DB transaction credits each seller's PENDING balance (seller price only; the Shop It service fee stays with the platform), writes ledger entries, notifies buyer and seller.
5. Do NOT use Flutterwave split payments for the escrow flow. Money is collected into my Flutterwave balance, tracked in my own ledger, and paid out with the Transfers API after release.
6. Refunds: admin-only, server calls the Flutterwave refund API, ledger reversal in the same transaction, idempotent.
7. Payouts: see C7. Use the Flutterwave bank list and account resolve. Check that Opay and other wallets are supported as payout destinations before promising them in the UI. If a bank or wallet is not supported, hide it.
8. Handle edge cases: customer pays twice, pays less, pays after the order expired, transfer arrives late, webhook arrives before the redirect, webhook arrives twice, Flutterwave API timeout. Pending orders expire after a set time and restore stock.
9. Test mode first. Show test results for card success, card failure, bank transfer, USSD, underpayment, replayed webhook, forged webhook (must be rejected) and wrong-currency payment. Live keys only after I approve.
10. ASK ME: who pays the Flutterwave processing fee (the fee is about 2% on local payments and a flat fee per transfer out; check current rates on their pricing page) and how it must be reflected in the service fee. Show me a table of platform profit per order at ₦1,000, ₦5,000 and ₦20,000 after Flutterwave fees.

---

## PHASE 3: FULL DEBUG SWEEP OF EVERYTHING ELSE

Test and fix every feature, in the browser and by API. For each, write what you tested and the result.

- Auth: register (buyer and seller), email OTP, resend limits, login, logout, wrong password lockout, reset password, change password, expired session, banned user, mobile layout.
- Seller: onboarding checklist, ID verification submit, product create/edit/delete with images, price and fee calculator, stock, shop page, dashboard numbers.
- Buyer: browse, search, filters, cart (add, remove, quantity, persists after login), wishlist, checkout form validation, delivery fee rules, coupon rules, order list, order tracking, handshake OTP, review, dispute, chat (anti-bypass filter, buyer identity hidden from seller), reports.
- Wallet: pending vs available balance, ledger display, payout accounts, cooling period, withdrawal OTP.
- Admin: users, verification queue, reports, disputes, refunds, metrics, export, broadcast banner. Every action must be server-authorized and logged in the audit table.
- Authorization sweep (IDOR): for every endpoint that takes an id, prove a normal user cannot read or change another user's data (orders, chat, disputes, wallet, cart, notifications, commissions, products, sellers).
- Input safety: SQL injection (all queries parameterized), XSS (escape user text in product titles, bios, chat, reports, emails), file upload type and size limits, request body size limits, pagination limits.
- Serverless: nothing important in memory; cold starts; DB connection pooling for Neon; timeouts on every external call; useful logs without personal data.
- Remove dead code, test banners, placeholder text and fake data. List any remaining "TODO", "demo", "test", "mock", "simulate" strings with `grep` output.
- Legal pages (Terms, Privacy, Refunds, Seller policy): update to describe Flutterwave and the real escrow and refund behaviour. No placeholders. Do not claim licences or registrations I do not have. TEEDS is not registered with CAC.

ASK ME (do not decide): how under-18 sellers get paid (they usually cannot hold a bank account in their own name; options include a guardian's account with consent), what happens to payments for orders that are never shipped, and whether to use a KYC provider instead of storing NIN data.

---

## PHASE 4: PROVE IT

1. Create `scripts/security-tests.ts` (run with one npm command). It must automatically ATTACK my API and assert the correct failure for each of these, and print PASS or FAIL:
   - `x-user-id` header with an admin's email gives 401
   - Every admin route called without a session gives 401, and as a normal user gives 403
   - `POST /orders` without payment is rejected
   - Initialize with a tampered price or fee is ignored (server price is used)
   - A forged webhook (bad signature) is rejected
   - A webhook with the right signature but wrong amount, wrong currency or unknown `tx_ref` does not mark anything paid
   - A replayed webhook does not credit twice
   - Withdrawal with another seller's ID is rejected
   - Two parallel withdrawals cannot overspend
   - A normal user cannot set order status to delivered or completed
   - Seller cannot see the handshake OTP
   - CORS from a random `*.vercel.app` origin is rejected
   - `/email/send` is not usable by the public
   - Register without a verified OTP does not create an active account
2. Run `npm run lint`, `npm run build` and the test script. Paste the full output.
3. Final report as a table: ID, status (FIXED / NOT FIXED / NOT VERIFIED / NEEDS MY DECISION), files changed, proof. Also list anything you found that is not in this document.

---

## PHASE 5: GO-LIVE CHECKLIST (give this to me as plain steps)

- Env vars to set in Vercel, with where to get each one, and which old ones to delete.
- Keys and passwords I must rotate now.
- Flutterwave dashboard steps: webhook URL and secret hash, enable card, bank transfer and USSD, business verification documents needed (TEEDS is not registered with CAC; tell me what Flutterwave will accept for my account type and the limits that apply).
- Vercel Cron setup for escrow auto-release and for expiring pending orders.
- Neon: backups, point-in-time recovery, separate production and test databases.
- Monitoring: Sentry alerts, an alert when a webhook fails, an alert for large withdrawals, and a daily reconciliation job.
- A short "first 10 real orders" test plan to run with small amounts before telling anyone the site is open.
- A reminder list of what I should check with a Nigerian lawyer before accepting payments from minors (NDPA 2023 compliance, child consent, holding customer funds, and operating without CAC registration).

Begin with Phase 0 and report.
