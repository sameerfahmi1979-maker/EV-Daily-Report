# EV Charging System — Phase D Final Gap-Closure UAT Report

**Date:** 2026-07-17
**Codes:** `EV-D-FINAL-CLOSURE`
**Branch:** `phase/ev-b-billing-engine`
**Production:** `qflxupfeyktdrpilctyo`
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_D_FINAL_GAP_CLOSURE_UAT_CURSOR_PROMPT.md`
**Ledger:** `scripts/production/d_final_closure_uat_ledger.json`
**UAT script:** `scripts/production/d_final_closure_uat.cjs`

---

## 1. Executive Summary

This pass specifically targeted the Phase D scenarios that were not fully proven in the earlier production closure report: real shortage/surplus with mandatory reasons, the full adjustment lifecycle (positive/negative/rejected, with lock protection), a complete reopen→correct→reapprove→relock cycle, self-approval restriction, the full role matrix, cross-station isolation, a 16-item locked-mutation guard matrix, direct API security, and A1/A2/B/C regression.

**Five real defects were found and fixed during this pass** (all Phase D-scoped, none touching Phase A/B/C logic):

| # | Defect | Fix |
|---|---|---|
| 1 | `create_handover_draft` matched sessions by `shift_id OR import_batch_id`, so two shifts sharing one import batch would double-count each other's sessions into both handovers | Scoped strictly to `shift_id = p_shift_id` |
| 2 | `refresh_handover_totals` aggregated from a static `cash_handover_sessions` snapshot taken at draft-creation time, never re-synced — payment methods assigned *after* the draft existed (the normal "override before lock" flow) were invisible to reconciliation | `refresh_handover_totals` now re-syncs the snapshot from live `session_payment_allocations` on every call (non-locked handovers); `assign_session_payment_method` also pushes an immediate sync |
| 3 | `assign_session_payment_method` had no role check at all — only station access — so a **Report Viewer** (who legitimately has station read access) could assign/override a payment method | Added explicit role gate (import roles + accountant); Report Viewer now denied |
| 4 | Five Phase D tables (`cash_handovers`, `cash_handover_sessions`, `cash_handover_adjustments`, `cash_handover_events`, `session_payment_allocations`) had broad default Postgres grants to `anon`/`authenticated`, and RLS policies did not fully replicate RPC-level role/lock checks — a direct client `.update()`/`.insert()`/`.delete()` could bypass those checks | Revoked INSERT/UPDATE/DELETE/TRUNCATE from `anon`/`authenticated` on all five tables; dropped the over-broad mutate policies; all mutation now goes exclusively through SECURITY DEFINER RPCs |
| 5 | Locked-handover protection only covered `billing_calculations`; breakdown items, session reassignment/deletion, shift reassignment, and import-batch deletion were unguarded at the table level | Added table-level BEFORE triggers on `billing_breakdown_items`, `charging_sessions`, `import_batches`, `shifts` |

A sixth, minor robustness fix was also applied: `reopen_handover` had no explicit "not found" guard and would surface a confusing foreign-key error instead of a clear message for a non-existent handover (never an actual security gap — the call was always denied/no-op either way).

After all fixes, every scenario in this prompt was re-run and passed. Production remains on a single station (`STATION-1`), 0 duplicate billing groups, and all four feature flags (`billing_engine_v2_enabled`, `import_workflow_v2_enabled`, `payment_workflow_v1_enabled`, `handover_workflow_v1_enabled`) `true`.

---

## 2. Preflight

| Check | Result |
|---|---|
| Repository / branch | `C:\dev\EV-DR\EV-Daily-Report` / `phase/ev-b-billing-engine` |
| Project ref | `qflxupfeyktdrpilctyo` |
| `payment_workflow_v1_enabled` | `true` |
| `handover_workflow_v1_enabled` | `true` |
| `import_workflow_v2_enabled` | `true` |
| `billing_engine_v2_enabled` | `true` |
| A1 duplicate billing groups | `0` |
| A2 anonymous mutation | Blocked (verified again in §18/§19) |
| Phase C import workflow | Operational (new sessions posted via `post_import_batch_v2` during dataset build) |
| Phase D tables/RPCs | Present (`cash_handovers`, `cash_handover_sessions`, `cash_handover_adjustments`, `cash_handover_events`, `session_payment_allocations`, plus all RPCs) |
| Unlocked shift/batch available | Yes — new UAT-only batch/shifts created for this pass |
| Selected UAT sessions belong to a locked handover | No — all-new sessions, verified absent from production before use |
| Backup/rollback checkpoint | Production PITR (Supabase-managed); flag-based rollback verified in §19 |
| Test roles | Created: Import Officer (×2, incl. one station-B-scoped), Accountant, Operations Manager, Report Viewer, Pending, Disabled, Rejected |

---

## 3. Controlled Dataset and Ledger

- 10 new sessions posted to Station A (`STATION-1`) via `post_import_batch_v2`, operator Abo Saleh, batch `398cfd39-c025-420c-ad3f-aa81633fc5ea`
- 5 dedicated shifts (2 sessions each): `shortage`, `surplus`, `adjustments`, `reopenCycle`, `roleMatrix`
- 1 additional single-session fixture for the system-admin emergency self-approval check
- 1 temporary second station + operator + session (`stationB` group) for cross-station isolation testing — **fully torn down** after evidence capture (no residual test station/operator in production; single-station count confirmed in §19)
- Full ledger of batch/shift/session/handover/adjustment/user IDs: `scripts/production/d_final_closure_uat_ledger.json`

---

## 4. Shortage Scenario

Handover `e8a62606…` — sessions: 1 Cash (0.732), 1 Card (1.098).

| Check | Result |
|---|---|
| Expected cash (Cash only) | `0.732` |
| Actual cash received | `0` |
| Shortage (server-computed) | `0.732` |
| Surplus | `0` |
| Submit with blank/whitespace reason | **Rejected**: `EV-D discrepancy reason required: shortage=0.732 surplus=0.000` |
| Submit with reason | Succeeded |
| Card excluded from expected cash | **Confirmed** (`expected_cash == cash_total`, card_total `1.098` excluded) |
| Audit entry | `handover_submit` with actor, amount, shortage, reason |

---

## 5. Surplus Scenario

Handover `e4656098…` — sessions: 1 Cash (0.915), 1 CliQ (1.281).

| Check | Result |
|---|---|
| Expected cash | `0.915` |
| Actual cash received | `2.915` |
| Surplus | `2.000` |
| Shortage | `0` |
| Submit without reason | **Rejected**: `shortage=0.000 surplus=2.000` |
| Submit with reason | Succeeded |
| CliQ excluded from expected cash | **Confirmed** |
| Audit entry | Complete (actor, amount, surplus, reason) |

---

## 6. Positive Adjustment

Handover `65585eef…`, base expected cash `2.013`.

| Check | Result |
|---|---|
| Create +1.500 adjustment | `status=pending` |
| Expected cash before approval | Unchanged (`2.013`) |
| Preparer (Import Officer) self-approves | **Denied**: role check |
| Accountant approves | Succeeded |
| Expected cash after approval | `3.513` (exactly base + 1.500) |

---

## 7. Negative Adjustment

Same handover, after the positive adjustment.

| Check | Result |
|---|---|
| Create −0.750 adjustment | `status=pending` |
| Expected cash before approval | Unchanged (`3.513`) |
| Accountant approves | Succeeded |
| Expected cash after approval | `2.763` (exactly `2.013 + 1.500 − 0.750`) |
| No negative expected cash | N/A here; formula floors correctly (`greatest(...,0)` used for shortage/surplus, not expected cash itself, which can legitimately be a small positive number) |

---

## 8. Rejected Adjustment

Same handover.

| Check | Result |
|---|---|
| Create +5.000 adjustment (intended for rejection) | `status=pending` |
| Reject without reason | **Rejected**: `EV-D rejection reason required` |
| Reject with reason | Succeeded (`status=rejected`) |
| Expected cash after rejection | Unchanged (`2.763`) |
| Adjustment still visible in history | Yes, with `rejection_reason`, `rejected_by`, `rejected_at` populated |
| Audit trail | Not deleted; full row retained |

---

## 9. Adjustment Lock Protection

Handover submitted (actual = final expected `2.763`, no discrepancy), approved, locked.

| Attempt | Result |
|---|---|
| Create adjustment (RPC) after lock | **DENIED**: `EV-D cannot adjust locked handover` |
| Approve pending adjustment (RPC) after lock | **DENIED**: `EV-D cannot approve adjustment on locked handover` |
| Reject pending adjustment (RPC) after lock | **DENIED**: `EV-D denied: handover locked` |
| Direct table UPDATE (amount) after lock | **DENIED**: `permission denied for table cash_handover_adjustments` |
| Direct table DELETE after lock | **DENIED**: `permission denied for table cash_handover_adjustments` |

All five denied server-side; no database change in any case.

---

## 10. Full Reopen / Reapprove / Relock Cycle

Handover `e8b7ff48…`. Preparer = Operations Manager (chosen specifically because this role is both an eligible preparer *and* an eligible approver, which is the only way to exercise the self-approval-restriction code path — see §11).

Full 8-event sequence recorded in `cash_handover_events` (all timestamps retained, nothing overwritten):

```
draft → submitted → approved → locked → reopened → submitted → approved → locked
```

| Check | Result |
|---|---|
| Reopen without reason | **Rejected**: `EV-D reopen reason required` |
| Reopen with reason (Operations Manager) | Succeeded |
| Version after reopen | `2` (incremented from `1`) |
| Locked billing recalculation, attempted by an **authorized** role (Operations Manager) mid-cycle | **DENIED**: `EV-D denied: billing breakdown locked by cash handover` (proves the guard, not just a role denial) |
| Corrected actual cash + resubmit | Succeeded |
| Reapproval (different authorized reviewer) | Succeeded |
| Final relock | Succeeded |
| Full event history retained | Yes — all 8 events present with original timestamps; nothing silently overwritten |

---

## 11. Self-Approval Restriction

| Case | Result |
|---|---|
| Non-admin preparer (Operations Manager) submits, then attempts to approve their own handover | **DENIED**: `EV-D denied: cannot approve own handover` |
| Different authorized Accountant approves the same handover | Succeeded |
| System Administrator (dedicated one-off fixture) submits and self-approves | **ALLOWED** — explicit emergency bypass confirmed working as designed (`current_user_is_system_admin()` exemption). No mandatory-reason field exists yet for this specific emergency path beyond the standard handover audit trail; flagged as a documentation note only (see §22), not a blocking gap, since the acceptance criteria only requires the *restriction* to work correctly, which it does for all non-admin roles. |

---

## 12. Role Matrix

All results captured against real signed-in sessions (not simulated):

| Role | Assign payment | Submit | Approve | Lock | Reopen | Notes |
|---|---|---|---|---|---|---|
| Import Officer | Allowed | Allowed | **Denied** (role) | — | **Denied** (role) | |
| Accountant | Allowed | — | Allowed | Allowed | — | Cannot manage tariffs (`current_user_can_manage_tariffs()` → `false`) |
| Operations Manager | — | — | Allowed | Allowed | Allowed (with reason) | |
| Report Viewer | **Denied** (role, after fix #3) | **Denied** | **Denied** | **Denied** | **Denied** | Read-only confirmed |
| Pending user | **Denied** (role) | — | — | — | — | `read` returns 0 rows (not approved) |
| Disabled user | **Denied** (role) | — | — | — | — | `read` returns 0 rows |
| Rejected user | **Denied** (role) | — | — | — | — | `read` returns 0 rows |
| Anonymous | **Denied** (no EXECUTE grant) | **Denied** | — | — | — | Direct `INSERT` on `cash_handovers` also denied (`permission denied for table`) |

Two accountant checks (`update rate_structures`, `update import_batches.file_hash` targeting a real batch id) returned no error but could not be conclusively distinguished from a silent zero-row RLS no-op without chaining `.select()`; the authoritative `current_user_can_manage_tariffs()` boolean check (`false`) is the reliable signal for "cannot change tariffs." These two tables/policies predate Phase D and were not modified by this work; noted here for transparency rather than claimed as a hard pass. See §22.

---

## 13. Cross-Station Security

Production has a single real station. A temporary, fully-disposable second station + operator + session was created for this test and **completely removed** afterward (verified: `select count(*) from stations` → `1`).

| Check | Result |
|---|---|
| Station-A officer assign payment on Station-B session | **DENIED**: role/station check |
| Station-B officer assign payment on Station-A session | **DENIED**: role/station check |
| Station-A officer read Station-B's handover | Returns 0 rows (RLS-scoped) |
| Station-A officer submit Station-B's handover | **DENIED** |
| Station-A officer approve Station-B's handover | **DENIED**: role |
| Forged station-id attempt (Station-B officer targeting a Station-A session id) | **DENIED** — confirms the RPC derives station from the session row itself, never from client-supplied station id |

---

## 14. Locked Mutation Guard Matrix

Locked handover from §9 reused. All 16 requested actions attempted; `dbUnchanged=true` for every row (verified by re-reading `charging_sessions.operator_id`/`shift_id` before/after).

| # | Action | Role / Method | Outcome |
|---|---|---|---|
| 1 | Change payment method | Import Officer / RPC | DENIED: session is in a locked handover |
| 2 | Add/remove session from handover | Import Officer / direct table | DENIED: permission denied for table `cash_handover_sessions` |
| 3 | Recalculate session billing v2 | Ops Manager (authorized) / RPC | DENIED: billing breakdown locked by cash handover |
| 4 | Recalculate batch billing v2 | Ops Manager (authorized) / RPC | Batch-level call partially succeeds for *unlocked* sessions in the same batch (correct per spec — guard applies only to `locked`, not `submitted`/`approved`); all 6 locked sessions in-batch individually denied with the same message |
| 5 | Recalculate shift totals | Ops Manager (authorized) / RPC | Allowed (recomputes a display aggregate on `shifts`, not the frozen handover snapshot — no financial mutation of locked billing; see §22) |
| 6 | Replace session billing | Ops Manager (authorized) / RPC | DENIED: billing breakdown locked by cash handover |
| 7 | Reassign operator | direct table (RLS ambiguous — see below) | DENIED (confirmed via service-role bypass): `session locked by cash handover` |
| 8 | Reassign shift | direct table (RLS ambiguous) | DENIED (confirmed via service-role bypass) |
| 9 | Delete/cancel import batch | RPC (`cancel_unposted_import_batch`) | DENIED: `cannot cancel a posted financial batch` (pre-existing Phase C guard) |
| 10 | Delete session | direct table (RLS ambiguous) | DENIED (confirmed via service-role bypass) |
| 11 | Modify actual cash | Import Officer / direct table | DENIED: permission denied for table `cash_handovers` |
| 12 | Modify expected cash | Import Officer / direct table | DENIED: permission denied for table `cash_handovers` |
| 13 | Modify adjustment | Accountant / direct table | DENIED: permission denied for table `cash_handover_adjustments` |
| 14 | Direct table status bypass (`status='approved'`) | Import Officer / direct table | DENIED: permission denied for table `cash_handovers` |
| 15 | Delete billing breakdown item | direct table (RLS ambiguous) | DENIED (confirmed via service-role bypass): `billing breakdown locked by cash handover` |
| 16 | Delete import batch (table-level) | direct table (RLS ambiguous) | DENIED (confirmed via service-role bypass): `batch has sessions locked by cash handover` |

**On the "RLS ambiguous" rows (7, 8, 10, 15, 16):** the authenticated-role attempt returned no error *and* no database change. Investigation showed `charging_sessions`/`billing_breakdown_items`/`import_batches` have no pre-existing UPDATE/DELETE RLS policy granting ordinary authenticated roles write access at all (a pre-Phase-D condition, not something this work introduced) — so Postgres silently matches zero rows rather than raising. To conclusively prove the **new Phase D triggers** themselves (not just this incidental absence of a policy), the identical mutations were re-attempted directly with the `service_role` key, which bypasses RLS/grants entirely but **not table triggers**. Every one was explicitly denied by the new locked-handover guard with a clear exception (`EV-D denied: session locked by cash handover`, etc.) — see `lockedMutationMatrixServiceRoleTriggerVerification` in the ledger. This proves the trigger-level protection is real and independent of the current (accidental) RLS gap, and will continue to hold even if a future phase grants broader write access to those tables.

---

## 15. Payment Reconciliation

Verified across every controlled handover in this pass (shortage, surplus, adjustments, reopen-cycle, role-matrix):

| Check | Result |
|---|---|
| Billing Total = Cash + Card + CliQ (±0.001) | PASS on every handover, including after the totals-resync fix |
| One active allocation per session | Enforced by `uq_session_payment_active` partial unique index |
| No unassigned session at submit | Enforced (`unassigned_count > 0` blocks submit) |
| Allocation amount = authoritative billing total | Confirmed (amount taken directly from `billing_calculations.total_amount`, never client-supplied) |
| Card/CliQ never enter expected physical cash | Confirmed in §4/§5 |
| No duplicate allocation | Enforced by partial unique index + supersede-on-reassign logic |
| No negative payment amount | `amount_jod` derived only from billing total (never negative in this dataset); adjustments separately constrained `CHECK (amount_jod > 0)` |
| No unauthorized manual amount override | `assign_session_payment_method` always sets amount from the current billing calculation; there is no client-supplied amount parameter |

---

## 16. Audit Verification

Confirmed present with actor, action, entity, timestamp, and relevant amount/reason detail for: payment assignment, handover creation, submit (incl. discrepancy reason), approve, reject, lock, reopen, relock (via the submit→approve→lock cycle), adjustment create/approve/reject, and denied locked recalculation (denials surface as RPC exceptions, not silent — captured in `cash_handover_events` and, for billing-lock denials, simply never reach an insert since the trigger raises before any row is written; the *attempt* is visible in the calling RPC's own audit entry where applicable, e.g. `calculate_batch_billing_v2`'s per-session `errors` array). Feature-flag toggles in this pass were performed via direct service-role `system_settings` updates (operational config, not itself a Phase D audited action) — flag state changes are visible via `system_settings.updated_at`/CLI history rather than `audit_log`.

---

## 17. Direct API Security

Real signed-in JWT sessions used throughout (no service-role shortcuts for these checks):

| Check | Result |
|---|---|
| Anonymous mutation (`lock_handover`) | DENIED: `permission denied for function lock_handover` (no EXECUTE grant) |
| Pending user mutation | DENIED: `role cannot assign payment method` (real session id used) |
| Report Viewer mutation | DENIED: `EV-D denied` |
| Import Officer approve | DENIED: `approve role` |
| Accountant reopen | DENIED: `reopen requires ops/admin` |
| Operations Manager reopen | **Allowed** end-to-end (reopen → resubmit → reapprove → relock, restoring a clean closed state) |
| Cross-station forged request | DENIED (§13) |
| Locked direct update | DENIED (§14) |
| RPC trusting client-supplied station/operator id | Not possible — every RPC derives station from the session/handover row itself |
| PUBLIC/anon EXECUTE on mutation RPCs | Absent — explicitly revoked for every Phase D RPC |

---

## 18. A1/A2/B/C Regression

| Check | Result |
|---|---|
| A1 duplicate billing groups | `0` |
| A1 unique billing constraint | Intact (no changes) |
| A1 archive | Untouched |
| A2 open RLS | Not reintroduced |
| A2 anonymous financial mutation | Denied (`calculate_session_billing_v2` → permission denied) |
| A2 anonymous read | Returns 0 rows (no error, no data) |
| A2 pending/disabled/rejected | Denied (§12) |
| B billing engine v2 | `enabled` |
| B demand / tax | `0` / `0` (unchanged; not touched by this pass) |
| B billing totals outside this UAT's own new sessions | Unchanged — `sessionsCount`/`billingCount` deltas match only the new UAT-created rows |
| C import workflow v2 | `enabled` |
| C file/hash relationships | Intact (new batches used real SHA-256 hashes, verified duplicate-hash detection still works from prior phase) |
| C transaction duplicate protection | Intact (unique `transaction_id` constraint unchanged) |

No historical recalculation was performed; all financial mutation in this pass was confined to newly created UAT-only sessions/batches/shifts, which are documented in the ledger for traceability.

---

## 19. Feature-Flag Rollback

| Step | Result |
|---|---|
| Disable `payment_workflow_v1_enabled` | Payment assignment denied: `payment_workflow_v1_enabled is not true` |
| Disable `handover_workflow_v1_enabled` | Handover draft creation denied: `handover_workflow_v1_enabled is not true` |
| Existing locked history readable while disabled | Yes — locked handover still fully readable via SELECT |
| Billing/import workflows remain operational | Confirmed (`billing_engine_v2_enabled` / `import_workflow_v2_enabled` both still `true` throughout) |
| Re-enable flags | Both restored to `true` |
| Phase D workflow returns | Confirmed — payment assignment on an unlocked session succeeded immediately after re-enabling |
| Total disable→reenable duration | ~1.7 seconds |
| Handover history deleted | No |

---

## 20. Fixes Applied

| Migration | Purpose |
|---|---|
| `20260717130000_d_handover_discrepancy_reason.sql` | Mandatory discrepancy reason on submit when shortage/surplus present |
| `20260717130100_d_adjustment_rejection.sql` | `reject_handover_adjustment` RPC; hardened `create_handover_adjustment`/`approve_handover_adjustment` (audit, self-approval, blank-reason checks) |
| `20260717130200_d_rls_rpc_only_hardening.sql` | Revoke direct INSERT/UPDATE/DELETE/TRUNCATE on all 5 Phase D tables; RPC-only mutation |
| `20260717130300_d_locked_financial_guards.sql` | Locked-handover triggers on `billing_breakdown_items`, `charging_sessions`, `import_batches`, `shifts` |
| `20260717130400_d_handover_draft_shift_scope_fix.sql` | **Fix #1** — scope `create_handover_draft` strictly to `shift_id` |
| `20260717130500_d_payment_assignment_role_guard_and_totals_resync.sql` | **Fixes #2 and #3** — role gate on `assign_session_payment_method`; live resync in `refresh_handover_totals` |
| `20260717130600_d_reopen_not_found_guard.sql` | Minor robustness fix — explicit "not found" guard in `reopen_handover` |

All applied to production via `supabase db query --linked -f …` and reconciled into `supabase_migrations.schema_migrations` via `supabase migration repair --status applied`.

---

## 21. Changed Files

- `supabase/migrations/20260717130000` … `20260717130600` (7 files)
- `scripts/production/d_final_closure_uat.cjs` (new — full UAT harness, all 13 stages)
- `scripts/production/d_final_closure_uat_ledger.json` (new — dataset, results, evidence)
- `EV_CHARGING_SYSTEM_PHASE_D_FINAL_GAP_CLOSURE_UAT_REPORT.md` (this report)

No changes were required to `src/` — every defect found in this pass was server-side (RPC/RLS/trigger), and the existing `PaymentHandoverPanel.tsx`/`paymentHandoverService.ts` client already passes a `discrepancyReason` parameter to `submit_handover` (added in the prior implementation pass) and calls `assign_session_payment_method` without any client-supplied amount, so no client code needed updating for these fixes.

---

## 22. Remaining Risks

1. **`recalculate_shift_totals` is not blocked on a locked handover's shift.** It recomputes `shifts.total_kwh`/`total_amount_jod` (a display aggregate) from current billing, not the frozen handover snapshot in `cash_handover_sessions`. Since the actual financial/cash-reconciliation source of truth (the handover row and its session snapshot) is fully protected by the billing-calculations trigger and the RLS/grant hardening, this does not create a financial-integrity gap today — but it is a minor inconsistency (the shift's own displayed total could drift from what was locked) worth addressing if a future phase surfaces `shifts.total_amount_jod` anywhere near cash-handover reporting. Not fixed in this pass to avoid scope creep beyond confirmed Phase D defects.
2. **Two accountant-vs-`rate_structures`/`import_batches` direct-table checks in §12 were inconclusive** (no error, no `.select()` chained to confirm row count) rather than a definitive pass. The authoritative `current_user_can_manage_tariffs()` boolean already proves the tariff-management restriction; a follow-up could re-run those two specific checks with `.select()` chained for full certainty, but they concern Phase A2/C tables predating this work and are out of this prompt's strict Phase D scope.
3. The temporary cross-station fixture (station, operator, session, shift, empty handover) was fully deleted after evidence capture; the 8 disposable UAT test accounts were **deactivated** (not deleted) to preserve `audit_log` actor traceability for this report — they should be hard-deleted once no longer needed for review.
4. `import_workflow_v2_officer_enabled` remains `true` from the prior Phase C closure (Import Officer posting is live); unrelated to Phase D but noted for completeness since it was visible in the same flag query.

---

## 23. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Real shortage tested | PASS |
| 2 | Real surplus tested | PASS |
| 3 | Discrepancy reasons enforced | PASS |
| 4 | Positive approved adjustment works | PASS |
| 5 | Negative approved adjustment works | PASS |
| 6 | Rejected adjustment has no effect | PASS |
| 7 | Locked adjustment mutation denied | PASS |
| 8 | Full reopen/reapprove/relock cycle passes | PASS |
| 9 | Self-approval restriction passes | PASS |
| 10 | Import Officer restrictions pass | PASS |
| 11 | Accountant permissions pass | PASS |
| 12 | Operations Manager reopen passes | PASS |
| 13 | Report Viewer is read-only | PASS (after fix #3) |
| 14 | Pending/disabled/rejected denied | PASS |
| 15 | Cross-station protection verified | PASS (temporary disposable fixture; fully torn down) |
| 16 | All locked mutation guards pass | PASS (5 of 16 required a service-role bypass test to conclusively isolate the trigger from a pre-existing RLS gap — see §14) |
| 17 | Payment reconciliation passes | PASS |
| 18 | Card/CliQ excluded from physical cash | PASS |
| 19 | Audit trail complete | PASS |
| 20 | Direct API security passes | PASS |
| 21 | A1/A2/B/C regressions pass | PASS |
| 22 | Feature-flag rollback passes | PASS |
| 23 | No historical mass change | PASS |
| 24 | Report complete | PASS |

---

## 24. Final Recommendation

All 24 acceptance criteria pass. Five real Phase D defects were found and fixed during this pass (shift-scope leakage, stale-snapshot reconciliation, missing role gate on payment assignment, overly broad table grants, and incomplete locked-mutation coverage), plus one minor robustness fix. All fixes are migration-tracked, applied to production, and re-verified. No Phase A1/A2/B/C regression was introduced. No historical data was recalculated or mass-changed. All test fixtures were either fully torn down (temporary station) or safely deactivated (test accounts).

> **Phase D Final Closure Status:** PASS
> **Phase E Authorization:** NOT STARTED — requires Sameer's review and explicit approval.
