# Shop It Database Recovery & Backup Runbook

This document defines the emergency data recovery, Point-in-Time Recovery (PITR), and JSON export/restore procedures for Shop It (operated by TEEDS).

---

## 1. Full Export & Transactional Restore (Admin JSON Backups)

### What `/api/admin/export-data` Contains (v3.0)
When an administrator clicks **"Export Data"** in the Governance Panel (`GET /api/admin/export-data`), a timestamped JSON file (`shopit-backup-<timestamp>.json`) is downloaded containing sanitized records across all core operational tables (stored in integer **kobo**):
- **Users (`users` -> `shopit_users`)**: Account metadata, role, verification status, age/guardian flags (password hashes are strictly excluded).
- **Sellers (`sellers` -> `shopit_sellers`)**: Shop profiles, campuses, and verification metadata.
- **Products (`products` -> `shopit_products`)**: Marketplace catalog listings in `*_kobo` pricing.
- **Orders (`orders` -> `shopit_orders`)**: Order totals in `*_kobo`, items JSON, escrow statuses, delivery metadata.
- **Payments (`payments` -> `shopit_payments`)**: Transaction references, `amount_kobo`, channel, gateway status.
- **Wallets (`wallets` -> `shopit_wallets`)**: `pending_balance_kobo`, `available_balance_kobo`, `total_withdrawn_kobo`, freeze flags.
- **Ledger (`ledger` -> `shopit_ledger_entries`)**: Immutable double-entry ledger rows in `*_kobo` (`idempotency_key` enforced).
- **Disputes (`disputes` -> `shopit_disputes`)**: Escrow dispute records and `amount_held_in_escrow_kobo`.
- **Safety Reports (`reports` -> `shopit_reports`)**: Moderation flags and action logs.
- **Verifications (`verifications` -> `shopit_verifications`)**: Sanitized KYC metadata (`id_number_masked` and `full_nin_last4` only; encrypted document buffers are excluded under NDPA 2023).
- **Admin Alerts (`adminAlerts` -> `shopit_admin_alerts`)**: New user signup alerts and read statuses.

### Restoring from JSON Export
Use `scripts/restore-backup.ts` to restore an exported JSON backup atomically inside a single PostgreSQL transaction in foreign-key dependency order (`shopit_users` -> `shopit_sellers` -> `shopit_products` -> `shopit_orders` -> `shopit_payments` -> `shopit_wallets` -> `shopit_ledger_entries` -> `shopit_disputes` -> `shopit_reports` -> `shopit_verifications` -> `shopit_admin_alerts`):

```bash
# Restore into the target PostgreSQL database (uses POSTGRES_URL / DATABASE_URL):
NODE_ENV=production DATABASE_URL="postgresql://..." npx tsx scripts/restore-backup.ts ./shopit-backup-1731900000000.json
```

> **Note on Passwords:** Because `password_hash` is never exported in JSON backups, any newly inserted user during a full cold restore is provisioned with `must_change_password = true` and a cryptographically random unguessable placeholder hash, requiring a password reset (`POST /api/auth/send-otp` -> `POST /api/auth/reset-password`) before logging in.

---

## 2. Neon PostgreSQL Point-in-Time Recovery (PITR)

Shop It utilizes **Neon Serverless PostgreSQL** via `DATABASE_URL` / `POSTGRES_URL`. Neon provides instantaneous storage-level Point-in-Time Recovery with copy-on-write branching without slow `pg_dump` replays.

### Step-by-Step Point-in-Time Recovery:
1. **Access the Neon Console:**
   - Log into [console.neon.tech](https://console.neon.tech).
   - Select your project (e.g. `shop-it-prod`).

2. **Identify the Recovery Timestamp:**
   - Note the exact UTC timestamp immediately *before* the corruption or accidental deletion occurred (e.g., `2026-11-04T08:30:00Z`).

3. **Create a Recovered Branch:**
   - In the Neon Console, navigate to **Branches** -> **New Branch** -> **Branch from Point in time**.
   - Pick the target parent branch (`main`), specify the exact timestamp, name the branch (e.g., `recovery-fix`), and click **Create Branch**.

4. **Verify the Restored Data:**
   ```bash
   psql "postgres://[user]:[password]@[neon-recovered-host]/neondb?sslmode=verify-full" -c "
     SELECT
       (SELECT COUNT(*) FROM shopit_users) AS users,
       (SELECT COUNT(*) FROM shopit_orders) AS orders,
       (SELECT COUNT(*) FROM shopit_wallets) AS wallets,
       (SELECT COUNT(*) FROM shopit_ledger_entries) AS ledger;
   "
   ```

5. **Promote the Recovered Branch & Reconcile Read-Only:**
   - Set the branch as Primary (or update `DATABASE_URL` in Vercel Project Settings -> Environment Variables).
   - Run read-only ledger reconciliation:
     ```bash
     NODE_ENV=production DATABASE_URL="postgresql://..." npx tsx scripts/reconcile-ledger.ts
     ```

---

## 3. Upstash Redis / KV Store Fallback & Resets

If running with Upstash KV (`KV_REST_API_URL` and `KV_REST_API_TOKEN`):
1. If Redis is unreachable or flushed, authentication sessions, rate limits, OTPs, and payments automatically fall back to PostgreSQL.
2. Delete stale rate limit keys via Upstash Data Browser / CLI if needed (`DEL otprate:email@domain.com`).

---

## 4. Emergency Contacts & Escalation

- **Operations & Support:** `shopitverified@gmail.com`
- **Flutterwave Merchant Dashboard:** [app.flutterwave.com](https://app.flutterwave.com)
- **Brevo Email Dashboard:** [app.brevo.com](https://app.brevo.com)
