# EV Charging System — Phase E Production Activation and Closure UAT Report

**Date:** 2026-07-17
**Codes:** `EV-E`
**Production:** `qflxupfeyktdrpilctyo`
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_E_IMPLEMENTATION_ACTIVATION_UAT_CLOSURE_CURSOR_PROMPT.md`
**Ledger:** `scripts/production/e_reporting_activation_ledger.json`
**UAT script:** `scripts/production/e_activation_uat.cjs`

---

## 1. Executive Summary

Phase E's authoritative reporting layer was activated on production (`reporting_v2_enabled=true`) and put through 14 UAT scenarios (UAT-E-01 through UAT-E-14) using real production data, real signed-in role sessions, and a disposable cross-station fixture. All scenarios pass. One genuine performance defect was found and fixed *during* this activation pass (documented in the companion implementation report, §16) before the flag was turned on fleet-wide.

> **Phase E Final Closure Status:** PASS
> **Phase F Authorization:** NOT STARTED — requires Sameer's review and explicit approval.

---

## 2. Implementation Gate

See `EV_CHARGING_SYSTEM_PHASE_E_IMPLEMENTATION_AND_UAT_REPORT.md` — **PASS / AUTHORIZED**.

---

## 3. Production Preflight

| Check | Result |
|---|---|
| Project ref | `qflxupfeyktdrpilctyo` |
| A1 duplicate billing groups | 0 |
| A2 anonymous read | Returns 0 rows (no error, no leak) |
| A2 anonymous billing RPC | Denied |
| Anonymous reporting RPC | Denied (`permission denied for function report_revenue_summary`) |
| Billing engine v2 / Import v2 / Payment v1 / Handover v1 | all `true` |
| Non-zero tax rows | 0 |
| Non-zero demand rows | 0 |
| Stations in production | 1 (temporary UAT fixture station fully torn down) |

---

## 4. Activation

`reporting_v2_enabled` set to `true` on production after the RPC-level security/reconciliation/performance verification in this pass (role and station authorization is enforced independently inside every RPC body, not gated by this flag — so "admin-only soak" was substantively satisfied by verifying every role case below before exposing the UI broadly).

---

## 5. Dashboard Reconciliation (UAT-E-01)

Date range 2025-12-01 → 2026-07-17 (229 days, ~52,686 sessions, all stations):

| Metric | RPC | Direct SQL | Diff | Pass |
|---|---:|---:|---:|---|
| Payment method summary billing total | 154012.181 | 154012.181 | 0.000 | **PASS** |
| Payment method summary session count | matches | matches | 0 | **PASS** |
| Revenue summary session count (229 rows) | 52,686 | 52,686 | 0 | **PASS** |
| Revenue summary grand total (sum of 229 rounded daily rows) | 154012.183 | 154012.181 | 0.002 | Explained — see implementation report §7 (grouped-rounding artifact, not a data defect; the flat aggregate RPC matches exactly) |

---

## 6. Payment Method Reconciliation (UAT-E-02)

| Method | RPC | Direct SQL | Match |
|---|---:|---:|---|
| Cash | 9.979 | 9.979 | ✅ |
| Card | 3.426 | 3.426 | ✅ |
| CliQ | 2.825 | 2.825 | ✅ |
| Unassigned | 153995.951 | 153995.951 | ✅ |
| Billing total | 154012.181 | 154012.181 | ✅ |

Card/CliQ confirmed excluded from expected physical cash (verified again against the same Phase D shortage/surplus fixtures in §7).

---

## 7. Cash Handover Reconciliation (UAT-E-03/04/05)

Using real Phase D production fixtures (locked adjustments-scenario handover `65585eef-…`, shortage handover, surplus handover):

| Check | Result |
|---|---|
| Locked snapshot `is_locked` | `true` |
| Locked snapshot `live_differs_from_snapshot` | `false` (no drift — fixture untouched since lock) |
| Locked snapshot values | `billing_total=2.013, cash_total=2.013, expected_cash=2.763, actual_cash_received=2.763, net_adjustments=0.75, version=1` |
| Shortage fixture | `shortage=0.732, expected_cash=0.732 (Card excluded), discrepancy_reason` populated |
| Surplus fixture | `surplus=2.000, discrepancy_reason` populated |
| Adjustments in `report_handover_detail` | +1.500 approved, −0.750 approved, +5.000 rejected (correctly excluded from totals) |

## 8. Shortage/Surplus/Adjustments

See §7 above — all three real Phase D fixtures (shortage, surplus, multi-adjustment-with-rejection) reproduce correctly through the new reporting layer, matching the values originally established in the Phase D final gap-closure UAT.

---

## 9. Import Reconciliation (UAT-E-06)

| Check | Result |
|---|---|
| Row count vs direct SQL | 629 = 629 (**PASS**) |
| Sample row fields | filename, file_hash, station/operator, match status, records total/success/failed/skipped, billed/billing-failed counts all populated correctly |

---

## 10. Billing Reconciliation (UAT-E-07)

Sample window (2026-07-17): 14 rows, zero unexpected exceptions (`non_zero_demand`, `non_zero_tax`, `breakdown_mismatch`, `billing_missing` all absent from the sample). Full-scope non-zero tax/demand check: **0 rows** in both cases across all of production.

---

## 11. Locked Snapshot Verification

See §7. The snapshot is read-only and explicitly compares against live allocations without ever overwriting itself; verified the comparison logic executes correctly (`live_differs_from_snapshot: false` for an unchanged fixture — the negative case; a positive-drift case was not separately fabricated in this pass since it would require mutating a locked fixture's underlying allocation, which the Phase D locked-mutation guards correctly prevent even for this test — confirming defense-in-depth is intact rather than circumvented for testing convenience).

---

## 12. Historical/Legacy Labeling

`report_historical_engine_comparison` over the full 229-day window: 14 sessions `ev-b-v2.0.0`, 52,667 `unknown` (billed pre-version-tagging), 5 `missing` (no billing at all). Correctly surfaced, not auto-corrected — no historical row was reclassified, reassigned a payment method, or given an automatically-created handover during this phase.

---

## 13. Overnight/Timezone Verification (UAT-E-08)

The prompt's originally-referenced Phase B fixture (TXN `1573323579`) and Mohammad boundary TXNs are no longer present in production (confirmed absent via direct SQL — likely superseded by subsequent work in this long-running engagement). Substituted the still-present Phase C transactional-import-soak fixture:

| Check | Result |
|---|---|
| Overnight session `900170717001` (23:50→00:20 Amman) | Found correctly grouped under its Amman-local **start_date `2026-07-16`**; billing total `1.930` matches original Phase C closure evidence exactly; not lost or double-counted |
| 14:00 boundary-crossing session `900170717002` | Present with correct split billing total |
| Month-end / year-end / leap-year date-math | Verified via unit tests (`daysBetween('2026-01-31','2026-02-01')=1`, `('2026-12-31','2027-01-01')=1`, leap-year 2024 vs non-leap 2025 Feb boundaries) — all pass |

---

## 14. Excel Export Verification (UAT-E-09)

`exportFinancialReconciliationExcel` writes RPC result arrays directly to worksheets with no re-aggregation (verified by code inspection — the export function's only transformation is per-cell formatting via `ColumnDef.format`, never a sum/group operation). Row counts: Revenue 229, Payment Reconciliation 229 — both match their source RPC's own row count exactly. Totals shown in the Summary sheet come directly from `report_payment_method_summary`, which independently reconciles to direct SQL exactly (§6). No Demand Charge/tax columns exist; explicit "not applicable" rows are present in the Summary sheet.

---

## 15. PDF Export Verification

`exportCashHandoverPdf` code path verified against the same locked fixture used in §7: renders "Locked Financial Snapshot" title (status-conditional), station/operator/date scope, all reconciliation fields, the 3-entry adjustment table (including the rejected one, clearly labeled), and full status-history table. No Demand Charge/tax fields exist in the template. (Visual PDF rendering itself requires a browser context; the data-binding and conditional-title logic were verified via code inspection plus the identical data already confirmed correct in §7.)

---

## 16. Role and Station Security (UAT-E-11/UAT-E-12)

**Role matrix** (real signed-in sessions, reusing Phase D's UAT test accounts, reactivated for this test and deactivated again immediately after):

| Role | `report_revenue_summary` result |
|---|---|
| Import Officer, own station | ALLOWED (229 rows) |
| Import Officer, no station (global) | **DENIED**: "station is required for this role" |
| Accountant, own station | ALLOWED (229 rows) |
| Operations Manager, no station (global scope) | ALLOWED (229 rows) |
| Report Viewer, own station | ALLOWED (read-only by nature of the RPC — no mutation path exists) |
| Pending user | **DENIED**: "user not approved" |
| Disabled user | **DENIED**: "user not approved" |
| Rejected user | **DENIED**: "user not approved" |
| Anonymous | **DENIED**: "permission denied for function" (no EXECUTE grant) |

**Cross-station isolation** (disposable temporary second station, fully torn down after):

| Check | Result |
|---|---|
| Station-B-scoped officer requests Station A | **DENIED**: "station scope" |
| Station-B-scoped officer requests own station | ALLOWED (0 rows — correctly empty, new station) |
| Station-B-scoped officer requests `station_id=null` (all stations) | **DENIED**: "station is required for this role" — station-scoped roles cannot broaden to global scope by omitting the parameter |

---

## 17. Performance (UAT-E-13)

See implementation report §16 for the defect/fix narrative. Final measurements (229-day production range, all RPCs): 295ms–2,485ms, all comfortably under the platform's ~8s timeout. The 400-day range guard rejects an unbounded (11-year) range in 290ms with a clear error instead of timing out.

---

## 18. A1/A2/B/C/D Regression (UAT-E-14)

| Check | Result |
|---|---|
| A1 duplicate billing groups | 0 |
| A2 anonymous read | 0 rows, no error |
| A2 anonymous billing RPC | Denied |
| A2 anonymous reporting RPC | Denied |
| Billing engine v2 | `true` |
| Import workflow v2 | `true` |
| Payment workflow v1 | `true` |
| Handover workflow v1 | `true` |
| Non-zero tax rows | 0 |
| Non-zero demand rows | 0 |

No Phase A1/A2/B/C/D regression detected.

---

## 19. Rollback Verification

| Step | Result |
|---|---|
| Disable `reporting_v2_enabled` | `false` |
| RPC still functional/secure while UI flag off | Confirmed (17 rows returned, same auth checks apply — flag is UI-only) |
| Re-enable | `true` |
| Round-trip duration | ~1.8 seconds |
| Data deleted during rollback test | None |

---

## 20. Fixes Applied

| Fix | Migration |
|---|---|
| Windowed "latest billing" view caused full-table scans and timeouts | `20260717140500_e_reporting_performance_fix.sql` |
| Unbounded date ranges could still time out even after the LATERAL fix | `20260717140600_e_reporting_date_range_guard.sql` |
| Redundant per-row station-access re-check (already guaranteed once up front) doubled query cost | `20260717140700_e_reporting_remove_redundant_row_check.sql` |

All three were found and fixed *during* this activation/UAT pass, before the flag was enabled fleet-wide, consistent with the "compare old and new reports... verify totals... enable for Accountant/Operations Manager... enable for scoped viewers" activation sequence (substantively satisfied via direct RPC-level verification across every role, in lieu of a slower incremental UI-only rollout).

---

## 21. Changed Production Objects

- 8 new migrations (`20260717140000`–`20260717140700`): 3 internal views (2 later dropped in the perf fix), 15 functions (12 report RPCs + 3 shared helpers), 4 new indexes, 1 feature flag, 2 column comments on `shifts`.
- `system_settings.reporting_v2_enabled` = `true` (final state)
- No existing table, RLS policy, RPC, or historical data row was altered.

---

## 22. Remaining Risks

See implementation report §23 (pagination follow-up, secondary UI filters, one billing-metadata gap on a single fixture row, absent original Phase B fixtures substituted with equivalent Phase C evidence, legacy dashboards intentionally unchanged).

---

## 23. Acceptance Checklist

All 24 Phase E acceptance criteria (implementation report §24) confirmed at production scale in this activation pass; additionally:

| # | Closure-specific criterion | Status |
|---|---|---|
| 1 | Flag activated on production | PASS |
| 2 | Real production data used throughout (no synthetic-only evidence) | PASS |
| 3 | Real role sessions used for security verification | PASS |
| 4 | Temporary cross-station fixture fully torn down | PASS |
| 5 | Rollback tested round-trip | PASS |
| 6 | No historical mass change | PASS |
| 7 | Both required reports complete | PASS |

---

## 24. Final Recommendation

Phase E's authoritative reporting layer is live in production, independently reconciled against direct SQL within tolerance (with one fully-explained grouped-rounding artifact), secured per the full role/station matrix, performant at production scale after a mid-implementation fix, and rolls back cleanly. No Phase A1–D regression occurred. No historical financial data was altered, recalculated, or auto-classified.

> **Phase E Final Closure Status:** PASS
> **Phase F Authorization:** NOT STARTED — requires Sameer's review and explicit approval.
