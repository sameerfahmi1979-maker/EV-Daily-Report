# CURSOR IMPLEMENTATION PROMPT — CREATE AND PREPARE SUPABASE STAGING PROJECT FOR EV CHARGING SYSTEM

## Task Type

Infrastructure preparation and staging-environment setup.

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Governing Files

Read and follow:

- `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_A2_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_A2_CURSOR_IMPLEMENTATION_PROMPT.md`
- `EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

---

# 1. Objective

Create and prepare a completely separate Supabase staging environment for the EV Charging System so that Phase A2 migrations, RLS policies, RPC authorization, application changes, and security UAT can be tested safely before any live production deployment.

The staging environment must:

1. Be isolated from production.
2. Use a separate Supabase project reference.
3. Use separate API keys.
4. Use a separate database.
5. Contain only approved sanitized or test data.
6. Never write to the production project.
7. Support full migration testing.
8. Support direct API RLS and RPC testing.
9. Support application runtime testing.
10. Support rollback rehearsal.
11. Support A1 and A2 regression testing.
12. Be clearly identifiable as staging in the application UI and logs.

---

# 2. Production Environment

Current production project:

```text
Project Ref: qflxupfeyktdrpilctyo
Environment: PRIMARY / LIVE
```

Do not modify, reset, migrate, seed, or connect write operations to this project during staging setup.

Production must be treated as read-only for inventory and comparison unless Sameer explicitly authorizes otherwise.

---

# 3. Required Staging Naming

Create a separate Supabase project with a clear name such as:

```text
EV-Daily-Report-Staging
```

Recommended environment label:

```text
staging
```

Recommended local environment file:

```text
.env.staging
```

Recommended project documentation:

```text
docs/staging/EV_STAGING_ENVIRONMENT_SETUP.md
```

Do not reuse production project credentials.

Do not place service-role secrets in frontend code.

Do not commit secrets to Git.

---

# 4. Stop Conditions

Stop and create a blocker report if:

- Supabase project creation permissions are unavailable.
- Billing or organization permissions prevent project creation.
- Region selection is unclear and may introduce unacceptable latency.
- Staging credentials cannot be stored securely.
- Production credentials are the only available credentials.
- Local migrations cannot be applied in a safe order.
- Required production schema objects are missing from the repository and cannot be reconstructed.
- Any command points to production for write operations.
- Any migration attempts to alter production.
- A backup or rollback strategy is not defined.
- The staging project cannot be uniquely identified.

Do not silently fall back to production.

---

# 5. Pre-Creation Inventory

Before creating the staging project, record:

- Current Supabase organization
- Available project quota
- Available regions
- Current production region
- Current production PostgreSQL version
- Current production extensions
- Current production auth settings
- Current production storage buckets
- Current production Edge Functions
- Current production secrets
- Current production migration history
- Current production table count
- Current production RPC count
- Current production policies
- Current production users
- Current production row counts for core tables

Do not copy secrets into the report.

Only document names and whether configuration exists.

---

# 6. Region and Database Version

Choose the staging region to match production where possible.

Choose the same PostgreSQL major version as production.

Document:

- Region
- PostgreSQL version
- Timezone behavior
- Required extensions
- Connection pooler mode
- Database password handling
- Backup availability
- Branching availability

The application timezone remains:

```text
Asia/Amman
```

Database timestamps should use `timestamptz`.

Do not change the business timezone.

---

# 7. Create the Staging Project

Use the Supabase dashboard or approved CLI/API workflow.

Create:

```text
Project Name: EV-Daily-Report-Staging
Environment: Staging
Region: Same as production where possible
Database Password: Strong generated secret
```

After creation, record securely:

- Project reference
- Project URL
- Anon/publishable key
- Service-role key
- Database connection string
- Direct connection string
- Pooler connection string
- JWT secret location
- Database password storage location

Do not print secrets in the report.

Use masked values only.

---

# 8. Repository Environment Configuration

Create or prepare:

```text
.env.staging
```

Expected variables may include:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_PROJECT_REF=
SUPABASE_DB_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_ENV=staging
VITE_APP_ENV=staging
```

Rules:

- Frontend may use only publishable/anon key.
- Service-role key must be server-side or local tooling only.
- Add `.env.staging` to `.gitignore` if not already excluded.
- Provide `.env.staging.example` with placeholders only.
- Never copy production values into staging files.
- Never commit real staging secrets.

Update any environment loader only if required.

Do not alter production environment files.

---

# 9. Visible Staging Identification

Add a clear staging indicator to prevent user confusion.

Recommended:

- Top banner: `STAGING ENVIRONMENT`
- Different app title suffix: `(Staging)`
- Environment badge in header
- Console warning
- Report footer label: `STAGING — NOT FOR FINANCIAL USE`
- Export filename suffix: `_STAGING`
- Optional watermark on PDF/Excel outputs during staging UAT

Do not redesign the application.

The indicator must be impossible to confuse with production.

---

# 10. Schema and Migration Preparation

Before applying migrations:

1. Inventory all local migrations.
2. Compare against production migration history.
3. Identify missing base schema migrations.
4. Identify missing RPC migrations.
5. Identify missing trigger/view/policy definitions.
6. Confirm A1 migrations are present.
7. Confirm A2 migrations are present.
8. Confirm migration order.
9. Confirm no migration contains production-specific UUIDs or secrets.
10. Confirm no migration hardcodes production project reference.

The previous reports identified incomplete local migration history.

Do not claim staging is valid until the active non-OCPP schema can be reproduced.

---

# 11. Schema Reconstruction Strategy

Use the safest available method.

Preferred order:

## Option A — Reconstruct from Complete Migrations

Use when all required schema objects are available locally.

Steps:

1. Initialize Supabase config if missing.
2. Link only to staging.
3. Apply all migrations in order.
4. Verify clean bootstrap.
5. Compare schema with production.

## Option B — Create a Sanitized Schema Baseline

Use when production contains required schema objects missing from local migrations.

Steps:

1. Export schema only from production.
2. Remove:
   - Data
   - Secrets
   - Production-only grants
   - Production-specific ownership
   - Unwanted OCPP runtime activation
3. Save a reviewed baseline migration.
4. Apply baseline to staging.
5. Apply subsequent local migrations.
6. Document all differences.

## Option C — Controlled Staging Restore

Use only if Sameer approves and a sanitized restore is available.

Do not copy the full production database automatically.

Do not include personal data unless required and approved.

---

# 12. Required Core Schema

Staging must include the active non-OCPP workflow:

- `stations`
- `operators`
- `import_batches`
- `charging_sessions`
- `billing_calculations`
- `billing_breakdown_items`
- `shifts`
- `rate_structures`
- `rate_periods`
- `fixed_charges`
- `tax_configurations`
- `system_settings`
- `user_profiles`
- `audit_log`
- A1 archive tables
- A1 conflict report
- A1 RPC baseline catalog
- `replace_session_billing`
- Current billing RPCs
- Current shift RPCs
- Current analytics RPCs
- A2 planned approval and station-access objects

OCPP may remain in schema if required by migrations, but must remain deferred and inactive.

---

# 13. Extensions, Triggers, Views, and Functions

Compare and reproduce required:

- PostgreSQL extensions
- Triggers
- Views
- Functions
- RPCs
- Indexes
- Unique constraints
- Foreign keys
- Check constraints
- RLS state
- Grants
- Sequences
- Storage policies

Record any production object intentionally omitted from staging.

---

# 14. Authentication Configuration

Configure staging Auth separately.

Required:

- Separate staging users
- No production user session reuse
- No copied production passwords
- Admin-created test accounts
- Email confirmation behavior documented
- Redirect URLs point only to staging
- Site URL points only to staging
- Password reset redirects point only to staging
- New users default to pending after A2 migration
- Current test admins explicitly approved

Create test users for:

- System Administrator
- Operations Manager
- Station Manager
- Import Officer
- Accountant
- Report Viewer
- Pending User
- Disabled User
- Rejected User

Do not expose passwords in the report.

Use secure temporary credentials.

---

# 15. Staging Data Strategy

Use only sanitized or synthetic data.

Required data:

- One or more stations
- Operators matching sample file card IDs
- Four confirmed tariff periods
- Test shifts
- Test users and station assignments
- Sample import batches
- Controlled billing fixtures
- Duplicate billing fixture for A1 regression
- Locked handover fixture when later needed

Use the two new sample files in:

```text
C:\dev\EV-DR\EV-Daily-Report\sample files
```

Do not import them into production.

Use them only after staging is confirmed.

---

# 16. Confirmed Staging Tariff Seed

Seed the staging tariff only after confirming schema.

Use:

| Period | Start | End | Rate |
|---|---|---|---:|
| Off-Peak | 05:00 | 14:00 | 0.183 |
| Mid-Peak | 14:00 | 17:00 | 0.193 |
| Peak | 17:00 | 23:00 | 0.213 |
| MID | 23:00 | 05:00 | 0.193 |

Rules:

- Energy tariff only
- Demand Charge must remain zero/inactive
- Tax must remain zero
- Exactly one active period per minute
- No overlap
- No gap
- Timezone: `Asia/Amman`

Do not apply Phase B tariff-engine changes yet unless explicitly authorized.

The staging seed should reproduce the current approved tariff configuration for testing.

---

# 17. A1 Migration Verification in Staging

Apply and verify Phase A1 objects:

- Backup/archive schema objects as appropriate
- Duplicate archive tables
- Conflict report table
- RPC baseline catalog
- Unique billing constraint
- `replace_session_billing`
- Generated type compatibility

Run:

- Duplicate insert test
- Unique rejection test
- Replace RPC idempotency test
- Archive restore test
- Orphan breakdown test

Expected:

```text
Duplicate billing groups = 0
```

---

# 18. Apply A2 Migrations in Staging

Apply in this order:

1. `20260716230000_a2_user_approval_and_role_foundation.sql`
2. `20260716230100_a2_user_station_access.sql`
3. `20260716230200_a2_authorization_helpers.sql`
4. `20260716230300_a2_core_rls_policies.sql`
5. `20260716230400_a2_financial_rpc_authorization.sql`
6. `20260716230500_a2_archive_and_audit_security.sql`

Before each migration:

- Record current state.
- Confirm dependencies.
- Confirm admin continuity.
- Confirm rollback script.
- Confirm project reference is staging.

After each migration:

- Run verification SQL.
- Record policies and grants.
- Test current admin access.
- Stop on unexpected denial.

---

# 19. Direct API Security UAT

Run with actual staging user sessions.

## Anonymous

- Cannot read charging sessions
- Cannot read billing
- Cannot call mutation RPCs
- Cannot access archive/conflict tables

## Pending User

- Cannot read operational data
- Cannot call mutation RPCs
- Sees pending-approval screen

## Station Manager

- Can access assigned station
- Cannot access another station
- Cannot manage tariffs
- Cannot manage users

## Import Officer

- Can access upload workflow for assigned station
- Cannot recalculate billing
- Cannot manage tariffs
- Cannot approve users

## Accountant

- Can read authorized financial data
- Cannot import
- Cannot manage tariffs
- Cannot manage users

## Report Viewer

- Read-only
- Cannot mutate
- Cannot call financial mutation RPCs

## System Administrator

- Full approved administrative access
- Cannot bypass audit requirements where enforced

---

# 20. Application Runtime UAT

Run the frontend against staging.

Verify:

- Environment badge
- Login
- Pending user screen
- Disabled/rejected behavior
- Dashboard
- Station list
- Operator list
- File upload access
- Billing view
- Recalculation permission
- Reports
- Direct URL access
- Logout
- No production data visible
- No production project reference in network calls

Use browser developer tools to confirm all Supabase requests target the staging project.

---

# 21. Sample File UAT

After staging is secure:

Use:

- `2026-07-16+abo saleh.xlsx`
- `2026-07-16+mohammad.xlsx`

Verify:

- Files parse
- Card IDs match seeded operators
- Transactions remain staging-only
- Duplicate re-upload is controlled
- Current tariff defect remains reproducible before Phase B if current RPC is still used
- No production records are touched

Do not execute historical recalculation.

---

# 22. Rollback Rehearsal

Before approving staging:

1. Export pre-A2 policy/grant state.
2. Apply A2 migrations.
3. Run UAT.
4. Roll back A2 in staging using compensating scripts.
5. Confirm admin access restored.
6. Reapply A2.
7. Confirm repeatability.

Document:

- Rollback duration
- Objects restored
- Failures
- Manual steps
- Final state

---

# 23. Production Promotion Package

Do not apply to production.

Prepare a package containing:

- Ordered migration list
- Pre-production checklist
- Backup checklist
- Admin continuity checklist
- User approve-list
- Station assignment list
- Verification SQL
- Direct API security tests
- Rollback scripts
- Expected downtime
- Go/no-go criteria
- Post-deployment checks

The package must be ready for Sameer’s review.

---

# 24. Required Deliverables

Create:

1. `EV_CHARGING_SYSTEM_STAGING_SUPABASE_SETUP_AND_UAT_REPORT.md`
2. `docs/staging/EV_STAGING_ENVIRONMENT_SETUP.md`
3. `.env.staging.example`
4. Staging seed scripts
5. Staging verification scripts
6. A2 staging UAT scripts
7. Production promotion checklist
8. Rollback scripts
9. Updated generated staging types if needed

Do not include secrets.

---

# 25. Required Report Structure

## 1. Executive Summary

Include:

- Staging project created?
- Project reference masked
- Region
- PostgreSQL version
- Schema bootstrap status
- A1 status
- A2 migration status
- Security UAT status
- Application UAT status
- Production untouched confirmation

## 2. Environment Separation

## 3. Staging Credentials Handling

No secrets.

## 4. Schema Reconstruction

## 5. Migration Application Log

## 6. Auth and Test Users

No passwords.

## 7. Seed Data

## 8. A1 Regression Results

## 9. A2 RLS and RPC Results

## 10. Direct API Security Results

## 11. Application Runtime Results

## 12. Sample File Results

## 13. Rollback Rehearsal

## 14. Remaining Risks

## 15. Production Promotion Package

## 16. Changed Files

## 17. Acceptance Checklist

## 18. Recommended Next Step

---

# 26. Acceptance Criteria

Staging setup is complete only when:

1. Separate Supabase staging project exists.
2. Production and staging project references differ.
3. Production was not modified.
4. Staging secrets are stored securely.
5. Frontend targets staging only.
6. Staging is visibly labeled.
7. Active non-OCPP schema is reproducible.
8. A1 migrations and protections are verified.
9. A2 migrations apply successfully.
10. At least one staging System Administrator remains functional.
11. Pending users are blocked.
12. Cross-station access is blocked.
13. Anonymous financial RPC execution is blocked.
14. Archive tables are protected.
15. Direct API security tests pass.
16. Application runtime UAT passes.
17. Sample files can be tested safely.
18. Rollback rehearsal passes.
19. Production promotion package is complete.
20. Full report is created.

---

# 27. Final Instruction

Create and prepare the staging environment only.

Do not apply A2 to production.

Do not start Phase B.

Do not change tariff logic.

Do not remove Demand Charge yet.

Do not implement payment methods.

Do not change handover.

Do not recalculate historical billing.

Do not activate OCPP.

End the report with:

> **Staging Environment Status:** PASS / FAIL / BLOCKED  
> **A2 Staging Status:** PASS / FAIL / BLOCKED  
> **Production A2 Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
