# StockPilot Database Disaster Recovery & Maintenance Runbook

This operational runbook provides step-by-step procedures for database schema initialization, patch management, manual and automated backups, backup verification, and disaster recovery for StockPilot's Supabase PostgreSQL environment.

---

## 1. System Architecture & Database Overview

StockPilot uses a multi-tenant PostgreSQL architecture powered by Supabase. Data isolation is enforced at the database level using Row Level Security (RLS) policies tied to `auth.uid()`, complemented by server-side membership checks in Express API middleware.

### 1.1 Core Tables

| Table | Purpose | Tenant Scoping Column | RLS Enforced |
| :--- | :--- | :--- | :--- |
| `public.businesses` | Tenant organization profile | `owner_id` / membership | Yes |
| `public.business_members` | Organization access & user roles (`owner`, `admin`, `member`) | `business_id`, `user_id` | Yes |
| `public.products` | Inventory catalog items & stock counts | `business_id` | Yes |
| `public.suppliers` | Vendor directory & contact metadata | `business_id` | Yes |
| `public.stock_movements` | Immutable audit log of stock increments/decrements | `business_id` | Yes |
| `public.sales` | Sales transaction headers | `business_id` | Yes |
| `public.sale_items` | Sales transaction line items | Derived via `sale_id` | Yes |
| `public.purchases` | Purchase orders (`ordered`, `pending`, `received`) | `business_id` | Yes |
| `public.purchase_items` | Purchase order line items | Derived via `purchase_id` | Yes |

### 1.2 Transactional RPC Functions (`SECURITY DEFINER`)

- `public.create_sale_transaction`: Atomically deducts inventory, records immutable stock movement audit entries, and persists sale header and line items. Employs row-level locking (`SELECT ... FOR UPDATE`) ordered by `product_id ASC` to eliminate deadlock risks.
- `public.create_purchase_order`: Validates supplier and line items, creating purchase records in initial status.
- `public.receive_purchase_order`: Atomically transitions order status to `received`, increases inventory balances, and generates corresponding `PURCHASE_RECEIPT` stock movements.

---

## 2. Migration & Schema Initialization Order

When creating a new database instance or rebuilding from scratch, SQL scripts **must** be executed in the following strict order.

### Step 1: Base Schema (`database/schema.sql`)
- **Location**: `database/schema.sql`
- **Responsibilities**:
  1. Enables the `pgcrypto` extension for UUID generation.
  2. Creates automatic timestamp trigger function (`public.set_updated_at`).
  3. Creates all core tables and foreign key constraints.
  4. Builds composite and performance indexes on tenant columns (`business_id`, `created_at`, `status`).
  5. Enables Row Level Security on all tables and creates isolation policies for `authenticated` users.
  6. Provides initial definitions of transactional RPC functions.

```bash
# Execute via psql (replace connection string with your Supabase direct connection)
psql "$DATABASE_URL" -f database/schema.sql
```

### Step 2: Stage 5 Corrective Patch (`database/stage5_corrective_patch.sql`)
- **Location**: `database/stage5_corrective_patch.sql`
- **Responsibilities**:
  1. **Duplicate Line Aggregation**: Aggregates duplicate product items in a sale payload before validating against available stock, preventing over-allocation.
  2. **Deadlock Elimination**: Sorts target product IDs in ascending order (`ORDER BY product_id ASC`) during locking (`FOR UPDATE`) to ensure deterministic locking across concurrent transactions.
  3. **Strict Purchase State Transitions**: Validates allowed transitions (`ordered` -> `received`) and prevents double-receiving.
  4. **Access Control**: Explicitly revokes execution privileges from `PUBLIC` and `anon`, granting `EXECUTE` solely to `authenticated`.

```bash
# Execute corrective patch immediately following schema.sql
psql "$DATABASE_URL" -f database/stage5_corrective_patch.sql
```

> [!IMPORTANT]
> Never skip `database/stage5_corrective_patch.sql`. Without it, high-concurrency checkout requests risk database deadlocks and duplicate line item validation bypass.

---

## 3. Backup Procedures

### 3.1 Procedure A: Supabase CLI (Recommended)

The Supabase CLI is the standard tool for managing Supabase database dumps.

```bash
# 1. Full database dump (schema + roles + data)
supabase db dump -f backups/stockpilot_full_$(date +%Y%m%d_%H%M%S).sql --db-url "$DATABASE_URL"

# 2. Schema-only dump (useful for version control and migration auditing)
supabase db dump --schema-only -f backups/stockpilot_schema_$(date +%Y%m%d_%H%M%S).sql --db-url "$DATABASE_URL"

# 3. Data-only dump (useful for staging seed data)
supabase db dump --data-only -f backups/stockpilot_data_$(date +%Y%m%d_%H%M%S).sql --db-url "$DATABASE_URL"
```

### 3.2 Procedure B: Native `pg_dump`

Use `pg_dump` when working directly with the PostgreSQL connection string.

```bash
# Custom compressed format (recommended: fast, supports parallel restore, selective object restore)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file=backups/stockpilot_$(date +%Y%m%d_%H%M%S).dump \
  --no-owner \
  --no-privileges

# Plain text SQL dump
pg_dump "$DATABASE_URL" \
  --format=plain \
  --clean \
  --if-exists \
  --no-owner \
  --file=backups/stockpilot_$(date +%Y%m%d_%H%M%S).sql
```

### 3.3 Procedure C: Supabase Managed Backups

- **Free Tier**: Supabase takes daily automated backups retained for 7 days. These can be downloaded from the Supabase Dashboard: **Project Settings -> Database -> Backups**.
- **Pro / Enterprise Tier**: Point-in-Time Recovery (PITR) enables restoring to any second within the retention window (up to 7 or 30 days).

---

## 4. Backup Verification & Integrity Checks

Never assume a backup is valid without verifying its readability and structure.

### 4.1 Validate Custom Dump Contents
```bash
# Verify dump file is non-empty and readable by pg_restore
pg_restore --list backups/stockpilot_*.dump | head -n 40
```
Confirm that tables (`businesses`, `products`, `sales`, etc.) and functions (`create_sale_transaction`) appear in the TOC list.

### 4.2 Staging / Dry-Run Restore Test
1. Spin up a temporary local PostgreSQL or Supabase test container:
   ```bash
   docker run --name pg-test -e POSTGRES_PASSWORD=testpass -p 5433:5432 -d postgres:16
   ```
2. Test restore into the scratch instance:
   ```bash
   pg_restore -h localhost -p 5433 -U postgres -d postgres backups/stockpilot_*.dump
   ```
3. Verify that row counts match production and exit code is `0`.
4. Tear down the container:
   ```bash
   docker stop pg-test && docker rm pg-test
   ```

---

## 5. Restoration & Disaster Recovery Runbook

### 5.1 Pre-Restoration Checklist
1. **Notify Stakeholders**: Announce an active maintenance window.
2. **Divert Traffic**: Stop the Node.js application service or configure your reverse proxy to serve a `503 Service Unavailable / Maintenance` page.
3. **Capture Pre-Restore Snapshot**: Take a final manual snapshot of the current database state (even if corrupted) before restoring, ensuring no recently committed records are irretrievably overwritten.

### 5.2 Execute Database Restore

#### Restoring from Custom Dump (`.dump`):
```bash
# Restore schema and data, dropping existing objects cleanly
pg_restore \
  -d "$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  backups/stockpilot_YYYYMMDD_HHMMSS.dump
```

#### Restoring from Plain SQL Dump (`.sql`):
```bash
psql "$DATABASE_URL" -f backups/stockpilot_YYYYMMDD_HHMMSS.sql
```

### 5.3 Verify Corrective Patches
If restoring from an older base backup, immediately re-apply `database/stage5_corrective_patch.sql`:
```bash
psql "$DATABASE_URL" -f database/stage5_corrective_patch.sql
```

---

## 6. Post-Restore Verification Checklist

Execute these verification queries and checks before restoring application traffic.

### 6.1 Database Object & Table Count Verification
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```
*Expected*: All 9 core tables exist, and `rowsecurity` is `true` for all tables.

### 6.2 RPC Function & Security Definer Verification
```sql
SELECT routine_name, security_type, data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_sale_transaction', 'create_purchase_order', 'receive_purchase_order');
```
*Expected*: All 3 functions exist with `security_type = 'DEFINER'`.

### 6.3 RPC Permission Verification
```sql
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'create_sale_transaction';
```
*Expected*: `authenticated` role has `EXECUTE`; `anon` and `PUBLIC` have no `EXECUTE` privileges.

### 6.4 Application Integration & Regression Test Suite
Run the automated verification suite to validate authentication, business scoping, and transactional integrity:
```bash
# 1. Verify supplier business scoping and RLS isolation
node scripts/verify_suppliers_auth.js

# 2. Verify deterministic analytics calculations
node scripts/verify_analytics.js

# 3. Verify inventory intelligence computations
node scripts/verify_intelligence.js

# 4. Verify demand insights & period-over-period trends
node scripts/verify_demand_insights.js

# 5. Verify production security hardening
node scripts/verify_security_hardening.js
```
*Expected*: All test suites pass with exit code `0`.

---

## 7. Operational Hosting & Security Configuration

### 7.1 Reverse Proxy Settings (`TRUST_PROXY`)
StockPilot defaults to `trust proxy = false` to prevent IP spoofing attacks via untrusted `X-Forwarded-For` headers.

When deploying behind a managed reverse proxy or load balancer:
- **Render / Fly.io / Heroku / AWS ALB**: Set `TRUST_PROXY=1` in your environment variables.
- **Nginx / Local Reverse Proxy**: Set `TRUST_PROXY=loopback`.
- **Direct Internet Exposure**: Leave `TRUST_PROXY` unset or `false`.

### 7.2 Rate Limiting Safeguards
- Authentication endpoints (`/api/auth/login` and `/api/auth/register`) are rate-limited via `express-rate-limit`.
- Defaults: 10 attempts per 15-minute window per IP.
- Configuration overrides: `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`.
- Standard authenticated business operations (`/api/products`, `/api/sales`, `/api/purchases`, `/api/analytics`) are unthrottled by the auth limiter.

### 7.3 Content Security Policy (CSP)
StockPilot uses Helmet with a strict CSP that explicitly allows Google Fonts typography (`fonts.googleapis.com` and `fonts.gstatic.com`) while disallowing unsafe inline scripts. Core static scripts must remain served strictly from `'self'`.
