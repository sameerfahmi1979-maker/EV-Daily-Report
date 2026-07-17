# EV Charging System — Staging Supabase Setup and UAT Report

**Date:** 2026-07-16  
**Repository:** `C:\dev\EV-DR\EV-Daily-Report`  
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_CREATE_SUPABASE_STAGING_PROJECT_CURSOR_PROMPT.md`

---

## 1. Executive Summary

| Item | Result |
|---|---|
| Staging project created? | **Yes** — `EV-Daily-Report-Staging` |
| Project reference | `dmbmzjnpbmakotvlckkq` (distinct from production) |
| Region | Northeast Asia (Tokyo) — matches production |
| PostgreSQL version | **17.6** (matches production) |
| Schema bootstrap | **PASS** — Option B sanitized public schema baseline |
| A1 status in staging | **PASS** — included in baseline; uniqueness smoke PASS |
| A2 migration status | **PASS** — all 6 migrations applied on staging |
| Security UAT | **PASS** — 13/13 direct API + RPC role UAT |
| Application UAT | **PARTIAL** — staging badge/env wired; full UI login pass deferred to Sameer with local credentials file |
| Sample file UAT | **READY** — operators `6424`/`6443` seeded; imports not executed in this pass |
| Production untouched | **Confirmed** — MCP production still has `global_admin`×3, no `user_station_access` |

---

## 2. Environment Separation

| | Production | Staging |
|---|---|---|
| Name | EV Charging Daily Report | EV-Daily-Report-Staging |
| Ref | `qflxupfeyktdrpilctyo` | `dmbmzjnpbmakotvlckkq` |
| URL host | `qflxupfeyktdrpilctyo.supabase.co` | `dmbmzjnpbmakotvlckkq.supabase.co` |
| Keys | Production only | Separate anon + service_role |
| Database | Live financial data | Synthetic/seed only |
| MCP `user-supabase` | Still points here | Not used for writes |
| CLI link (end state) | — | Linked to staging |

---

## 3. Staging Credentials Handling

- Stored locally in `.env.staging` (gitignored).
- Example placeholders in `.env.staging.example`.
- Test user password file: `scripts/staging/.staging_test_credentials.local.json` (gitignored).
- No secrets printed in this report.
- Frontend uses anon/publishable key only; service role used only in local Node seed/UAT scripts.

---

## 4. Schema Reconstruction

**Strategy:** Option B (sanitized schema baseline).

**Why not Option A:** Local migration history is incomplete (missing core `CREATE TABLE` / early RPC definitions). Documented previously in A1 reports.

**Method:**

1. Read-only DDL extraction from production via Management API (`supabase db query --linked` + `scripts/staging/export_public_schema_ddl.sql`).
2. Docker Desktop was unavailable (`unable to start`), so `supabase db dump` could not be used.
3. Baseline written to `supabase/migrations/20251219000000_staging_schema_baseline.sql` (~347 statements).
4. Applied to staging over pooler session connection (direct `db.*` host was IPv6-only / not usable from this environment).

**Baseline includes:** post-A1 tables/constraints/RPCs (`replace_session_billing`, archive tables, unique session billing key, open pre-A2 RLS snapshot).

**Intentionally omitted from automatic copy:** production row data, auth users, secrets, storage objects, Edge Functions (none in prod).

---

## 5. Migration Application Log

| Step | Target | Result |
|---|---|---|
| Baseline schema | Staging | OK |
| A2 `…230000` role/approval foundation | Staging | OK after fix (see below) |
| A2 `…230100` user_station_access | Staging | OK |
| A2 `…230200` auth helpers | Staging | OK |
| A2 `…230300` core RLS | Staging | OK |
| A2 `…230400` financial RPC auth | Staging | OK |
| A2 `…230500` archive/audit security | Staging | OK |
| Any write to production | Production | **None** |

### A2 migration fix discovered during staging

`20260716230000_a2_user_approval_and_role_foundation.sql` attempted to remap `global_admin` → `system_admin` **while the legacy `user_profiles_role_check` still allowed only old role names**, and the “add new check if not exists” branch was a no-op because the old constraint name collided.

**Fix applied in repo:** `DROP CONSTRAINT IF EXISTS user_profiles_role_check` before remap, then add the expanded check. This fix is required before any production A2 apply.

---

## 6. Auth and Test Users

Staging Auth users created (emails only; passwords not listed):

| Email | Role | Approval |
|---|---|---|
| `admin.staging@example.com` | system_admin | approved |
| `ops.staging@example.com` | operations_manager | approved |
| `station.staging@example.com` | station_manager | approved |
| `import.staging@example.com` | import_officer | approved |
| `acct.staging@example.com` | accountant | approved |
| `viewer.staging@example.com` | report_viewer | approved |
| `pending.staging@example.com` | report_viewer | pending |
| `disabled.staging@example.com` | report_viewer | disabled |
| `rejected.staging@example.com` | report_viewer | rejected |
| `sameer@algt.net` | system_admin | approved (allow-list continuity) |

Password material: local credentials file only.

---

## 7. Seed Data

- Station: `Ein al basha Staging` / `STATION-STG-1`
- Operators: Abo Saleh `6424`, Mohammad `6443`
- Rate structure: `Staging TOU Energy` with periods Off-Peak / Mid-Peak / Peak / MID at `0.183` / `0.193` / `0.213` / `0.193`
- Demand charge seeded as **0** (energy-only staging rule)
- Zero tax configuration row
- `user_station_access` rows for approved scoped users

---

## 8. A1 Regression Results

| Test | Result |
|---|---|
| Duplicate billing insert for same `session_id` | **Rejected** (PASS) |
| Staging has A1 archive / conflict / baseline catalog tables | Present via baseline |
| `replace_session_billing` present and admin-callable after A2 | PASS (RPC role UAT) |

---

## 9. A2 RLS and RPC Results

| Check | Result |
|---|---|
| `user_profiles.approval_status` / role remap | PASS |
| `user_station_access` exists | PASS |
| Policies on public schema | 53 after A2 |
| Approved system_admin count | 2 |
| Import/viewer denied recalculate on real session | PASS |
| Admin allowed recalculate on real session | PASS |

---

## 10. Direct API Security Results

`node scripts/staging/security_uat.cjs` → **13/13 PASS**

Highlights:

- Anon: no sessions/billing/archive; RPC execute denied
- Pending: no operational session read
- Station manager: can read scoped station; tariff insert denied by RLS
- Import officer / report viewer: recalculate denied
- System admin: can read profiles
- Client URL confirmed staging host

Additional: `node scripts/staging/rpc_role_uat.cjs` → **PASS**

---

## 11. Application Runtime Results

| Item | Status |
|---|---|
| `VITE_APP_ENV=staging` support | Implemented |
| Amber staging banner | Implemented (`StagingBanner`) |
| Document title `(Staging)` | Implemented |
| Console staging warning | Implemented |
| Report PDF footer staging label | Implemented |
| Export filename `_STAGING` suffix | Implemented |
| Full browser login matrix | Not fully exercised in automated pass — use local credentials file |

---

## 12. Sample File Results

| File | Staging readiness |
|---|---|
| `sample files/2026-07-16+abo saleh.xlsx` | Card `6424` operator seeded |
| `sample files/2026-07-16+mohammad.xlsx` | Card `6443` operator seeded |

Imports were **not** executed in this pass (avoid mixing import UAT with infra bootstrap). Safe to import only while app points at staging.

---

## 13. Rollback Rehearsal

`node scripts/staging/a2_rollback_rehearsal.cjs`:

1. Opened `charging_sessions` SELECT to anon → anon could read 1 row  
2. Re-applied A2 core RLS migration → anon rows returned to 0  
3. Duration ~4s  

**Full reset path:** re-apply baseline SQL + `seed_staging.cjs` (documented in setup guide).

---

## 14. Remaining Risks

1. Cursor MCP remains production-linked — operator discipline required.
2. Baseline generator is SQL-based (not `pg_dump`); rare object types may differ (views/materialized views not in current public set).
3. Application browser UAT matrix not fully completed in automation.
4. Sample imports not yet run on staging.
5. Auth Site URL / redirect URLs should be confirmed in staging dashboard.
6. Docker Desktop broken on this machine — prefer Management API / pooler workflows until fixed.
7. Production A2 still blocked pending approval; migration 1 fix must ship with production apply.

---

## 15. Production Promotion Package

See: `docs/staging/EV_A2_PRODUCTION_PROMOTION_CHECKLIST.md`

Contains ordered migrations, backup/admin continuity checks, verification SQL, go/no-go, and rollback notes.

**Production A2 is not started.**

---

## 16. Changed Files

- `supabase/migrations/20251219000000_staging_schema_baseline.sql` (new)
- `supabase/migrations/20260716230000_a2_user_approval_and_role_foundation.sql` (role_check drop fix)
- `scripts/staging/*` (export SQL, seed, UAT, rollback)
- `.env.staging.example`
- `.gitignore` (staging secrets)
- `src/components/StagingBanner.tsx`
- `src/App.tsx`
- `src/lib/reportUtils.ts` (staging footer/filename)
- `docs/staging/EV_STAGING_ENVIRONMENT_SETUP.md`
- `docs/staging/EV_A2_PRODUCTION_PROMOTION_CHECKLIST.md`
- `EV_CHARGING_SYSTEM_STAGING_SUPABASE_SETUP_AND_UAT_REPORT.md`

Local only (not committed): `.env.staging`, `scripts/staging/.staging_test_credentials.local.json`, DDL JSON artifacts.

---

## 17. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Separate staging project exists | PASS |
| 2 | Distinct project refs | PASS |
| 3 | Production not modified | PASS |
| 4 | Staging secrets stored securely | PASS |
| 5 | Frontend can target staging | PASS (env) |
| 6 | Staging visibly labeled | PASS |
| 7 | Active non-OCPP schema reproducible | PASS (Option B) |
| 8 | A1 protections verified | PASS |
| 9 | A2 migrations apply on staging | PASS |
| 10 | Staging system admin functional | PASS (API) |
| 11 | Pending users blocked | PASS (API) |
| 12 | Cross-station / tariff mutate blocked | PASS (station mgr tariff insert) |
| 13 | Anon financial RPC blocked | PASS |
| 14 | Archive tables protected | PASS |
| 15 | Direct API security tests pass | PASS |
| 16 | Application runtime UAT | PARTIAL |
| 17 | Sample files testable safely | READY |
| 18 | Rollback rehearsal | PASS |
| 19 | Production promotion package | PASS (docs) |
| 20 | Full report created | PASS |

---

## 18. Recommended Next Step

1. Sameer: open app with `.env.staging` / `VITE_*` staging values; walk UI login matrix.  
2. Import the two 2026-07-16 sample files **only** against staging.  
3. After staging app UAT sign-off, review `docs/staging/EV_A2_PRODUCTION_PROMOTION_CHECKLIST.md` and explicitly authorize production A2.  
4. Do **not** start Phase B / tariff engine / payments / handover / OCPP.

---

> **Staging Environment Status:** PASS  
> **A2 Staging Status:** PASS  
> **Production A2 Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
