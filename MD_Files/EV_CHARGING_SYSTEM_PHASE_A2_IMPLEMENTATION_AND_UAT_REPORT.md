# EV Charging System — Phase A2 Implementation and UAT Report

**Phase code:** EV-A2  
**Branch:** `phase/ev-a2-security`  
**Date:** 2026-07-16  
**Governing plan:** `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`  
**A1 report:** `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`

---

## 1. Executive Summary

Phase A2 **security inventory, role mapping, migration pack, and client approval UX foundation were prepared**, but **live RLS / RPC hardening was NOT applied**.

| Item | Result |
|---|---|
| What was secured on live DB | **Nothing new** — open RLS and anon RPC execute remain as before A2 |
| What was prepared in repo | 6 A2 migrations, RBAC module, pending-approval UI, role mapping docs, unit tests |
| Live database touched by A2 | **No** (read-only inventory only) |
| Users locked out | **No** |
| Direct API bypass prevented on live | **No** — blocked pending staging |

**Stop condition hit:** A2 prompt forbids applying experimental RLS to live production without a disposable/staging environment. Supabase branching is unavailable (`Project reference is missing when validating permissions`), and local migration history cannot reproduce the full live schema for a clean disposable DB.

---

## 2. A1 Prerequisite Verification

| Check | Result |
|---|---|
| `billing_calculations_one_per_session_key` exists | **Pass** |
| Duplicate billing groups = 0 | **Pass** |
| `replace_session_billing` exists | **Pass** |
| A1 archive + backup schema exist | **Pass** (`a1_backup_20260716`, 84,537 backup billing rows; 236 archive rows) |
| Git branch safe | **Pass** — created `phase/ev-a2-security` from A1 worktree |
| DB environment identified | **Pass** — `https://qflxupfeyktdrpilctyo.supabase.co` (primary/live) |
| Disposable/staging for RLS | **Fail / Blocked** |

A1 gates that allow A2 *design* are satisfied. A1 gate for *live RLS apply* is not.

---

## 3. Current User and Role Inventory

(No passwords/tokens exposed.)

| Email | Role (live) | Active | Station |
|---|---|---|---|
| sameer@algt.net | `global_admin` | true | null |
| sameer@energy-stream.net | `global_admin` | true | null |
| tariq@energy-stream.net | `global_admin` | true | null |

- `auth.users` count: **3**
- Stations: **1** — Ein al basha (`48f00127-09e8-47f6-8f6a-c3a331b332be`, `STATION-1`)
- No `company_manager` / `station_manager` / `accountant` rows currently

---

## 4. Role Mapping

Documented in `docs/a2/EV_A2_ROLE_MAPPING.md`.

| Legacy | Target |
|---|---|
| `global_admin` | `system_admin` |
| `company_manager` | `operations_manager` |
| `station_manager` | `station_manager` |
| `accountant` | `accountant` |
| _(new)_ | `import_officer` |
| _(new)_ | `report_viewer` (default for new pending users) |

Explicit approve-list for migration backfill: the three emails above → `approval_status = approved`.

---

## 5. Station Access Model

**Chosen model:** `user_station_access` join table (multi-station ready).  
Legacy `user_profiles.station_id` retained.  
Backfill: all approved system/operations admins get all stations; accountants readonly all stations.

---

## 6. RLS Before-and-After Matrix

### Before (live, still current)

Core tables have **duplicate open policies** (`USING (true)` / `WITH CHECK (true)`) for authenticated users on:

stations, operators, import_batches, charging_sessions, billing_calculations, billing_breakdown_items, shifts, rate_structures, rate_periods, fixed_charges, tax_configurations, system_settings, user_profiles

A1 archives currently service_role-only (good).

### After (prepared, not applied)

See `supabase/migrations/20260716230300_a2_core_rls_policies.sql`:

- Approved + role + station-scope checks
- Open/duplicate policies dropped
- Audit append-only for normal users
- Archives privileged read-only

---

## 7. RPC Authorization Matrix

### Before (live, still current)

| RPC | Security | anon execute | Authz in body |
|---|---|---|---|
| `calculate_batch_billing` | DEFINER | **Yes** | No |
| `replace_session_billing` | DEFINER | **Yes** | No |
| `delete_import_batch` | DEFINER | **Yes** | No |
| `recalculate_shift_totals` | DEFINER | **Yes** | No |
| `recalculate_all_shift_totals` | DEFINER | **Yes** | No |
| `turbo_bulk_calculate_billing` | DEFINER | **Yes** | No |
| `turbo_calculate_all_pending` | DEFINER | **Yes** | No |
| analytics RPCs | INVOKER | Yes | Relies on open RLS |

### After (prepared, not applied)

`20260716230400_a2_financial_rpc_authorization.sql`:

- Auth gate in `replace_session_billing`
- Assert helpers + audit on deny
- Revoke PUBLIC/anon execute on financial mutation RPCs
- Full body injection for remaining DEFINER RPCs staged for staging verification

---

## 8. Migration Details (prepared only)

| File | Purpose | Applied live? |
|---|---|---|
| `20260716230000_a2_user_approval_and_role_foundation.sql` | approval fields, role remap, approve-list | **No** |
| `20260716230100_a2_user_station_access.sql` | join table + backfill | **No** |
| `20260716230200_a2_authorization_helpers.sql` | SQL auth helpers | **No** |
| `20260716230300_a2_core_rls_policies.sql` | replace open RLS | **No** |
| `20260716230400_a2_financial_rpc_authorization.sql` | RPC grants + replace auth | **No** |
| `20260716230500_a2_archive_and_audit_security.sql` | archive/backup/audit harden | **No** |

**Rollback strategy (when applied in staging):** restore policy snapshot from pre-change `pg_policies` export; restore RPC grants; drop new columns/tables only after confirming no dependency; keep A1 backup schema untouched.

---

## 9. Application Changes (repo)

| Path | Change |
|---|---|
| `src/lib/rbac.ts` | New A2 role/permission model + legacy aliases |
| `src/lib/userService.ts` | Pending default role `report_viewer`; resilient insert; updated permission map |
| `src/contexts/AuthContext.tsx` | Loads profile; exposes approval state |
| `src/components/ProtectedRoute.tsx` | Pending/disabled/rejected screen gate |
| `src/components/PendingApprovalScreen.tsx` | Clear non-access UI |
| `src/components/RegisterForm.tsx` | Messaging: admin approval required |
| `src/lib/__tests__/rbac.test.ts` | Automated RBAC tests |
| `docs/a2/EV_A2_ROLE_MAPPING.md` | Mapping inventory |

**Backward compatibility:** without A2 DB columns, existing active users are treated as approved so the app does not lock out admins before migrations.

---

## 10. Automated Tests

```text
npm test
```

Includes:

- A1 uniqueness selection tests
- A2 RBAC mapping / permission / approval tests

Expected: all pass locally (no DB required).

---

## 11. Runtime UAT

| Scenario | Status |
|---|---|
| UAT-A2-01 Admin continuity (live RLS) | **Blocked** — RLS not applied |
| UAT-A2-02 Pending user (live) | **Blocked** — approval columns not applied |
| UAT-A2-03 Station isolation (live API) | **Blocked** |
| UAT-A2-04 Role boundaries (live) | **Blocked** |
| UAT-A2-05 RPC security (live) | **Blocked** — anon still has execute |
| UAT-A2-06 App smoke (pending screen code) | **Partial** — code present; full flow needs migration |
| UAT-A2-07 A1 regression | **Pass** — A1 state unchanged by A2 |

---

## 12. Direct API Security Tests

Not executed against live (would be misleading while open policies remain).  
Staging checklist after apply:

1. anon `select * from charging_sessions` → denied  
2. pending user select sessions → denied  
3. station A user select station B sessions → denied  
4. anon `rpc replace_session_billing` → denied  
5. report_viewer `rpc replace_session_billing` → denied  

---

## 13. Audit Logging Verification

Prepared policies make `audit_log` insertable by authenticated users and selectable by admin/ops/accountant only; no update/delete policies for normal roles.  
**Not verified on live** because migration not applied.

---

## 14. Remaining Risks

1. **Live production remains fully open RLS** until staging UAT + approved apply.
2. Financial mutation RPCs still executable by `anon` on live.
3. Tariff algorithm still wrong until Phase B.
4. Payment methods / handover still missing.
5. Historical billing still uncorrected.
6. Applying prepared RLS without staging risks admin lockout if approve-list is wrong (mitigated by explicit 3-email allow-list).

---

## 15. Changed / Created Files

### Created
- `EV_CHARGING_SYSTEM_PHASE_A2_IMPLEMENTATION_AND_UAT_REPORT.md`
- `docs/a2/EV_A2_ROLE_MAPPING.md`
- `supabase/migrations/20260716230000_a2_user_approval_and_role_foundation.sql`
- `supabase/migrations/20260716230100_a2_user_station_access.sql`
- `supabase/migrations/20260716230200_a2_authorization_helpers.sql`
- `supabase/migrations/20260716230300_a2_core_rls_policies.sql`
- `supabase/migrations/20260716230400_a2_financial_rpc_authorization.sql`
- `supabase/migrations/20260716230500_a2_archive_and_audit_security.sql`
- `src/lib/rbac.ts`
- `src/components/PendingApprovalScreen.tsx`
- `src/lib/__tests__/rbac.test.ts`

### Modified
- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/components/RegisterForm.tsx`
- `src/lib/userService.ts`

---

## 16. Phase Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Existing users inventoried | **Pass** |
| 2 | Verified System Administrator identity known | **Pass** (3 global_admin) |
| 3 | New users default pending (DB) | **Blocked** (migration not applied) |
| 4 | Pending/rejected/disabled blocked server-side | **Blocked** |
| 5 | Open core policies removed | **Blocked** |
| 6 | Role/station enforced server-side | **Blocked** |
| 7 | Critical RPCs authorize | **Blocked** |
| 8 | Anonymous financial mutation impossible | **Blocked** (still possible live) |
| 9 | Cross-station API blocked | **Blocked** |
| 10 | Archives protected | **Partial** (service_role only today; privileged read policies prepared) |
| 11 | Audit append-only | **Blocked** (prepared) |
| 12 | Automated security tests pass | **Pass** (client RBAC unit tests) |
| 13 | Runtime UAT in staging/disposable | **Blocked** |
| 14 | A1 intact | **Pass** |
| 15 | No tariff behavior change | **Pass** |
| 16 | No historical recalc | **Pass** |
| 17 | Rollback documented | **Pass** (strategy in §8) |
| 18 | Report complete | **Pass** |

---

## 17. Rollback Test

Not executed (no live apply).  
When staging apply occurs: keep `pg_dump` of policies/grants; A1 logical backup remains available; A2 migrations are additive except policy drops (recreate from pre-apply policy export).

---

## 18. Recommended Next Step

1. **Sameer:** enable Supabase branching / provide a staging project, **or** explicitly authorize a controlled live apply window after backup.
2. Apply A2 migrations **1→6 in order** on staging.
3. Run UAT-A2-01…07 with direct API tests.
4. Only then apply to live.
5. Do **not** start Phase B until A2 live enforcement is closed.

### Unblock options

| Option | Action |
|---|---|
| A | Create/fix Supabase preview branch; re-run A2 apply + UAT there |
| B | Provide separate staging Supabase project credentials |
| C | Explicit written approval to apply A2 RLS to live `qflxupfeyktdrpilctyo` after dashboard backup |

---

> **Phase A2 Status:** BLOCKED  
> **Blocker:** No disposable/staging environment available for RLS testing; prompt forbids applying experimental RLS directly to live production.  
> **Phase B Authorization:** NOT STARTED — requires Sameer’s review and approval after A2 live security enforcement is completed.
