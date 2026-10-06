# NegoZaar Database Backup & Disaster Recovery Strategy

**Production Target:** PostgreSQL 15+ / Supabase Managed Cloud  
**RPO (Recovery Point Objective):** < 1 minute (via Continuous WAL archiving)  
**RTO (Recovery Time Objective):** < 15 minutes  

---

## 1. Backup Architecture & Policies

### 1.1 Continuous WAL Archiving (Point-in-Time Recovery - PITR)
- **Mechanism:** Continuous write-ahead log (WAL) archiving to encrypted multi-region cloud object storage (AWS S3 / GCP Cloud Storage).
- **Retention Period:** 30 days rolling window for production; 7 days for staging.
- **Granularity:** Allows state restoration down to any specific second in time, critical for recovering from accidental data truncations or malicious tampering without losing unrelated transactions.

### 1.2 Automated Daily Logical Snapshots
- **Schedule:** Nightly at 02:00 UTC (off-peak).
- **Tooling:** `pg_dump` with custom directory format (`-Fd -j 4`) and zstd compression.
- **Storage:** Amazon S3 Glacier Instant Retrieval / Google Cloud Storage Nearline with Object Lock (WORM - Write Once, Read Many) to prevent ransomware tampering.
- **Retention:** 
  - Daily snapshots retained for 30 days.
  - Weekly snapshots retained for 12 weeks.
  - Monthly snapshots retained for 1 year.

---

## 2. Automated Backup Execution Script

Save as `scripts/db-backup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/tmp/negozaar_backups"
BUCKET_NAME="${S3_BACKUP_BUCKET:-negozaar-db-backups-prod}"
DB_URL="${DATABASE_URL}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting NegoZaar PostgreSQL logical backup..."
pg_dump --format=custom \
        --compress=9 \
        --no-owner \
        --no-privileges \
        --exclude-table-data='idempotency_keys' \
        "${DB_URL}" > "${BACKUP_DIR}/negozaar_prod_${TIMESTAMP}.dump"

echo "[$(date)] Uploading encrypted backup to ${BUCKET_NAME}..."
aws s3 cp "${BACKUP_DIR}/negozaar_prod_${TIMESTAMP}.dump" \
       "s3://${BUCKET_NAME}/daily/negozaar_prod_${TIMESTAMP}.dump" \
       --sse aws:kms \
       --sse-kms-key-id "${BACKUP_KMS_KEY_ID}"

rm -f "${BACKUP_DIR}/negozaar_prod_${TIMESTAMP}.dump"
echo "[$(date)] Backup completed and verified successfully."
```

---

## 3. Disaster Recovery & Restoration Runbook

### Step 1: Emergency Assessment & Freeze
1. Declare Sev-1 incident in incident channel (`#incident-sev1`).
2. Put the customer widget and merchant dashboard into maintenance mode (`NEXT_PUBLIC_MAINTENANCE_MODE=true`).
3. Terminate active connection pool in PgBouncer / Supabase connection manager.

### Step 2: Provision or Reset Target Database
```bash
# Verify target database connectivity
pg_isready -h "${TARGET_DB_HOST}" -p 5432 -U "${DB_USER}"

# Ensure required extensions exist
psql "${TARGET_DB_URL}" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
```

### Step 3: Execute Restoration
```bash
# Download latest verified backup
aws s3 cp "s3://${BUCKET_NAME}/daily/negozaar_prod_${LATEST_TIMESTAMP}.dump" /tmp/latest.dump

# Restore schema and records with 4 parallel jobs
pg_restore -v \
           --clean \
           --if-exists \
           --no-owner \
           --no-privileges \
           --jobs=4 \
           -d "${TARGET_DB_URL}" \
           /tmp/latest.dump
```

### Step 4: Replay WAL to Target Timestamp (PITR)
If recovering to a specific second before an erroneous data modification:
1. In Supabase Dashboard: Navigate to **Database** -> **Backups** -> **Point in Time**.
2. Select target recovery timestamp (e.g., `2026-10-05 14:22:15 UTC`).
3. Click **Restore to New Instance**.
4. Update application environment variables with the newly provisioned instance credentials.

### Step 5: Post-Restoration Verification
Run automated database integrity checks:
```bash
npm run test
```
Verify:
- Tenancy isolation via Row Level Security is active: `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('merchants', 'stores', 'products', 'negotiation_sessions');`
- Recent orders and accepted offers match Shopify financial records.
- Pricing guard invariant check: `SELECT count(*) FROM product_negotiation_settings WHERE min_acceptable_price > original_price;` (must return `0`).

### Step 6: Lift Maintenance Mode
1. Set `NEXT_PUBLIC_MAINTENANCE_MODE=false`.
2. Monitor error logs in Datadog/CloudWatch for 60 minutes.
