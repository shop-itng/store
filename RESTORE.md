# Shop It Database Recovery & Backup Runbook

This document defines the emergency data recovery, Point-in-Time Recovery (PITR), and Neon PostgreSQL branching runbook for Shop It (operated by TEEDS).

---

## 1. Quick Data Restores (Admin JSON Exports)

### What the JSON Export Contains
When an administrator clicks **"Export Data"** in the Moderator Command Center (`/api/admin/export-data`), a timestamped JSON file (`shopit-backup-YYYY-MM-DD.json`) is downloaded containing:
- All payment transaction records (`shopit_payments` table)
- All community safety reports and moderator audit logs (`shopit_reports` table)
- Sanitized artisan identity verifications (with NINs masked to `***-***-1234` and biometric photo buffers completely excluded under the **Nigeria Data Protection Act 2023 [NDPA]**)

### Restoring from JSON Export
To restore or seed a test/staging database using the exported JSON:
1. Locate the backup file (e.g., `shopit-backup-2026-11-04.json`).
2. Run the database seed script:
   ```bash
   # In local development or maintenance shell:
   node -e "
     const fs = require('fs');
     const backup = JSON.parse(fs.readFileSync('shopit-backup-2026-11-04.json'));
     console.log('Restoring payments:', backup.payments.length);
     console.log('Restoring reports:', backup.reports.length);
   "
   ```

---

## 2. Neon PostgreSQL Point-in-Time Recovery (PITR)

Shop It utilizes **Neon Serverless PostgreSQL** via `POSTGRES_URL`. Neon provides instantaneous, storage-level Point-in-Time Recovery with copy-on-write branching without needing slow `pg_dump` replays.

### Step-by-Step Point-in-Time Recovery:
1. **Access the Neon Console:**
   - Log into [console.neon.tech](https://console.neon.tech).
   - Select your project (e.g. `shop-it-prod`).

2. **Identify the Recovery Timestamp:**
   - Note the exact UTC timestamp immediately *before* the corruption or accidental deletion occurred (e.g., `2026-11-04T08:30:00Z`).

3. **Create a Recovered Branch:**
   - In the Neon Console, navigate to **Branches**.
   - Click **New Branch**.
   - Select **Branch from Point in time**.
   - Pick the target parent branch (`main`).
   - Specify the exact date and timestamp to restore to.
   - Name the branch (e.g., `recovery-20261104-fix`).
   - Click **Create Branch**.
   *(Neon creates the restored database within 2 seconds using log-structured checkpoints).*

4. **Verify the Restored Data:**
   - Connect to the new branch's connection string:
     ```bash
     psql "postgres://[user]:[password]@[neon-recovered-host]/shopit?sslmode=require"
     ```
   - Query tables to ensure integrity:
     ```sql
     SELECT COUNT(*) FROM shopit_payments;
     SELECT COUNT(*) FROM shopit_reports;
     ```

5. **Promote the Recovered Branch to Primary:**
   - In Neon Console > Branches > `recovery-20261104-fix`:
   - Click **Set as Primary** (or update `POSTGRES_URL` in Vercel Project Settings > Environment Variables).
   - Redeploy or restart the application.

---

## 3. Upstash Redis / KV Store Fallback & Resets

If running in high-availability mode with Upstash KV (`KV_REST_API_URL` and `KV_REST_API_TOKEN`):
1. **Flush Stale Rate Limits / OTPs:**
   - If an attacker or network glitch blocked OTP dispatching:
   - Navigate to [console.upstash.com](https://console.upstash.com) > Redis Databases.
   - Open the **Data Browser** or **CLI**.
   - Delete rate limit keys:
     ```redis
     DEL otprate:email@domain.com
     ```
2. **Payment Cache Sync:**
   - KV payment records mirror Neon PostgreSQL. If cache is purged, the server automatically reads directly from Postgres.

---

## 4. Emergency Contacts & Escalation

- **Platform Admin:** Adeyinka Joseph (`joeadeyinka12@gmail.com`)
- **Operations & Support:** `shopitverified@gmail.com`
- **Paystack Merchant Dashboard:** [dashboard.paystack.com](https://dashboard.paystack.com)
- **Brevo Email Dashboard:** [app.brevo.com](https://app.brevo.com)
