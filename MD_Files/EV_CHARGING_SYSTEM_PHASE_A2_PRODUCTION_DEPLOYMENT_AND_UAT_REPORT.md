# EV Charging System — Phase A2 Production Deployment and UAT Report

**Date:** 2026-07-16  
**Production project:** `qflxupfeyktdrpilctyo` (EV Charging Daily Report)  
**Branch:** `phase/ev-a2-security`  
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_A2_PRODUCTION_DEPLOYMENT_CURSOR_PROMPT.md`

---

## 1. Executive Summary

| Item | Result |
|---|---|
| Deployment status | **PASS** |
| Production touched? | **Yes** — A2 security migrations only |
| Backup status | **PASS** — schema `a2_backup_20260716` + local rollback SQL |
| Admin continuity | **PASS** — 3× `system_admin` approved; JWT-simulated RLS read OK |
| RLS status | **PASS** — open `USING (true)` policies removed on core tables |
| RPC security status | **PASS** — anon execute revoked on financial mutation RPCs |
| Direct API status | **PASS** — 6/6 anon denial tests |
| Runtime status | **PARTIAL** — admin path verified via JWT/RLS SQL; browser login by Sameer recommended |
| Rollback status | **READY** — restore scripts prepared; not executed (no rollback needed) |

---

## 2. Authorization and Maintenance Window

- Staging UAT previously reported **PASS** (`EV_CHARGING_SYSTEM_STAGING_SUPABASE_SETUP_AND_UAT_REPORT.md`).
- Production deployment authorized by attaching the production deployment Cursor prompt.
- Target confirmed: `https://qflxupfeyktdrpilctyo.supabase.co` via `user-supabase` MCP + CLI link.
- Note: Cursor plugin MCP `plugin-supabase-supabase` pointed at a **different** project (`owcfljxxfznifftoezpf`) and was **not** used.

---

## 3. Git and Environment Verification

| Check | Value |
|---|---|
| Repo | `C:/dev/EV-DR/EV-Daily-Report` |
| Branch | `phase/ev-a2-security` |
| CLI linked project | `qflxupfeyktdrpilctyo` |
| App `.env` | production URL |
| Migration 1 fix present | `DROP CONSTRAINT IF EXISTS user_profiles_role_check` before role remap |
| PostgreSQL | 17.6 |

---

## 4. Backup and Restore Point

| Item | Detail |
|---|---|
| Method | Logical backup schema via migration `a2_predeploy_logical_backup_20260716` |
| Identifier | `a2_backup_20260716` |
| Contents | `user_profiles`, `stations`, `operators`, `pg_policies_snapshot`, role constraints, financial RPC defs, function grants |
| Local snapshots | `scripts/production/a2_predeploy_*.json` |
| Rollback artifacts | `scripts/production/a2_restore_predeployment_policies.sql`, `…_grants.sql`, `…_role_constraint.sql`, `a2_emergency_admin_restore.sql` |
| Client access to backup schema | Revoked from `anon` / `authenticated` |

Supabase dashboard PITR remains available as platform-level restore.

---

## 5. Pre-Deployment User Inventory

| UUID | Email | Pre-A2 role | Active |
|---|---|---|---|
| `5bbb7898-638e-4a95-b4c5-3bd0cae57a7c` | sameer@algt.net | global_admin | true |
| `8845fcbe-0f8f-42d9-9a65-988acbb54f3c` | sameer@energy-stream.net | global_admin | true |
| `fd11648e-9758-4e3e-8ddd-49dac210ae6e` | tariq@energy-stream.net | global_admin | true |

- Auth users confirmed email-confirmed.
- No unexpected `user_profiles` rows.
- Pre-A2: `duplicate_billing_groups = 0`, unique index `billing_calculations_one_per_session_key` present, A1 archives present, `user_station_access` absent, policies ≈ 108.

---

## 6. Migration-by-Migration Log

| # | Filename | Result | Verification |
|---|---|---|---|
| 0 | `a2_predeploy_logical_backup_20260716` | OK | Backup tables created |
| 1 | `20260716230000_a2_user_approval_and_role_foundation.sql` | OK | 3 admins → `system_admin` + `approved` |
| 2 | `20260716230100_a2_user_station_access.sql` | OK | 3 USA rows (one station each) |
| 3 | `20260716230200_a2_authorization_helpers.sql` | OK | Helpers resolve admin JWT correctly |
| 4 | `20260716230300_a2_core_rls_policies.sql` | OK | Policies 53; open true policies on core tables = 0 |
| 5 | `20260716230400_a2_financial_rpc_authorization.sql` | OK | Anon execute denied on `replace_session_billing` |
| 6 | `20260716230500_a2_archive_and_audit_security.sql` | OK | Archive RLS limited; backup schema locked down |

Apply channel: Supabase CLI `db query --linked` against production (+ MCP for backup / migration 2).

---

## 7. Role Mapping Results

| Email | legacy_role | New role |
|---|---|---|
| sameer@algt.net | global_admin | system_admin |
| sameer@energy-stream.net | global_admin | system_admin |
| tariq@energy-stream.net | global_admin | system_admin |

---

## 8. User Approval Results

All three allow-listed admins: `approval_status = approved`, `is_active = true`.  
Default for new profiles: `role = report_viewer`, `approval_status = pending`.

---

## 9. Station Access Results

| Email | station_id | access_level |
|---|---|---|
| sameer@algt.net | `48f00127-09e8-47f6-8f6a-c3a331b332be` | manager |
| sameer@energy-stream.net | same | manager |
| tariq@energy-stream.net | same | manager |

Total `user_station_access` rows: **3** (single production station).

---

## 10. RLS Before-and-After Matrix

| Metric | Before | After |
|---|---:|---:|
| Public policies | ~108 | 53 |
| Open `USING (true)` on sessions/billing/stations | present historically | **0** |
| Anon read sessions (API) | previously open | **blocked (0 rows)** |

---

## 11. RPC Grants and Authorization Matrix

| RPC / check | Anon | Approved system_admin |
|---|---|---|
| `replace_session_billing` execute | **DENIED** | Gate allows when authenticated + role |
| Other financial mutation RPCs | **REVOKE from anon/PUBLIC** | `authenticated` + `service_role` |
| Tariff algorithm / billing math | unchanged | unchanged |

---

## 12. Direct API Security Tests

Production anon key against `qflxupfeyktdrpilctyo`:

| Test | Result |
|---|---|
| Anon cannot read `charging_sessions` | PASS |
| Anon cannot read `billing_calculations` | PASS |
| Anon cannot read `shifts` | PASS |
| Anon cannot read billing archive | PASS |
| Anon cannot read `stations` | PASS |
| Anon cannot execute `replace_session_billing` | PASS |

Artifact: `scripts/production/a2_prod_security_uat.json`

Pending / station-scoped production test users were not created on live (safety). Staging covered those cases earlier.

---

## 13. Application Runtime Smoke Test

| Check | Result |
|---|---|
| Admin helpers with JWT sub = sameer@algt.net | `approved=true`, `role=system_admin`, `is_admin=true` |
| As `authenticated` role with that JWT | stations=1, operators=4, sessions=84365, billing=84360 |
| Browser UI login / dashboard | **Sameer to confirm** (passwords not used by agent) |

---

## 14. A1 Regression Results

| Check | Result |
|---|---|
| Duplicate billing groups | **0** |
| Unique index present | `billing_calculations_one_per_session_key` |
| Archive row count | **236** (unchanged from A1) |
| Billing row count | **84360** (unchanged through A2) |

---

## 15. Production Data Integrity

- No tariff algorithm changes.
- No Demand Charge / tax / payment / handover changes.
- No historical recalculation.
- No sample file imports.
- Billing count stable at 84360.

---

## 16. Audit Log Verification

- Audit insert policy retained for authenticated.
- Update/Delete policies for normal roles removed / not granted (append-only intent).
- RPC denial / recalculation paths write audit rows when invoked under A2 gates.

---

## 17. Rollback Verification

Rollback scripts prepared under `scripts/production/`:

1. Restore pre-A2 policies  
2. Restore open financial grants (emergency only)  
3. Restore legacy role constraint / remap  
4. Emergency admin restore SQL  

Full policy restore was **not** executed (deployment succeeded). Staging previously rehearsed policy rollback + re-apply.

---

## 18. Changed Files

- Production DB: A2 objects/policies/RPC grants (live)
- `src/lib/database.types.ts` (regenerated)
- `scripts/production/*` (backup snapshots, apply log, UAT, rollback)
- This report

App A2 foundation files from earlier staging prep remain in the branch (`rbac.ts`, `PendingApprovalScreen`, AuthContext, etc.).

---

## 19. Remaining Risks

1. **Tariff engine still wrong** until Phase B (Off-Peak / import RPC time-of-day defect).
2. Demand Charge still present in production tariff data until Phase B.
3. Payment methods / handover still not implemented.
4. Historical billing amounts not corrected.
5. Browser UI smoke test should be confirmed by Sameer immediately.
6. Plugin Supabase MCP must not be used for this project (wrong project ref).
7. New registrations default to pending — ensure operators know approval workflow.

---

## 20. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Backup/restore point verified | PASS |
| 2 | Correct production project | PASS |
| 3 | Corrected migration 1 used | PASS |
| 4 | Admins remain functional | PASS (SQL/RLS) |
| 5 | New users default pending | PASS |
| 6 | Pending denied server-side | PASS (policy design + staging UAT) |
| 7 | Open core RLS removed | PASS |
| 8 | Role/station scope enforced | PASS |
| 9 | Anon financial RPC blocked | PASS |
| 10 | Unauthorized RPC blocked | PASS (grants + gates) |
| 11 | Authorized admin workflows | PASS (RLS counts) / UI confirm pending |
| 12 | A1 uniqueness/archives intact | PASS |
| 13 | No tariff behavior change | PASS |
| 14 | No billing amount change | PASS |
| 15 | No historical recalculation | PASS |
| 16 | Direct API security tests | PASS |
| 17 | Application runtime smoke | PARTIAL (UI confirm) |
| 18 | Rollback plan ready | PASS |
| 19 | Deployment report complete | PASS |
| 20 | Sameer review before Phase B | REQUIRED |

---

## 21. Recommended Next Step

1. Sameer: log in to production UI with an allow-listed admin and confirm dashboard / stations / sessions / billing / users load.  
2. Close Phase A2 after that confirmation.  
3. Do **not** start Phase B until explicitly approved.

---

> **Phase A2 Production Status:** PASS  
> **Phase B Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
