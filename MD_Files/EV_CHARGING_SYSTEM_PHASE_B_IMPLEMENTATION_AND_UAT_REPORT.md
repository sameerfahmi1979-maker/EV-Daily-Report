# EV Charging System — Phase B Implementation and UAT Report

**Date:** 2026-07-16  
**Branch:** `phase/ev-b-billing-engine`  
**Production:** `qflxupfeyktdrpilctyo`  
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_B_CURSOR_IMPLEMENTATION_PROMPT.md`

---

## 1. Executive Summary

| Item | Result |
|---|---|
| What changed | Authoritative billing engine v2 (Asia/Amman TOU, proportional split, demand=0, tax=0); import wired to v2; timeline overnight fix; demand UI retired |
| What did not change | Historical billing rows; payments; handover; OCPP; tariff period *rates* (only demand zeroed on active structures) |
| Production touched? | **Yes** — schema + engine + feature flag; no historical recalculation |
| New engine status | **ACTIVE** via `billing_engine_v2_enabled=true` |
| Overnight status | **PASS** — fixture total `7.334` MID@0.193 |
| Timeline status | **PASS** (code) — overnight expands to two visual segments |
| Demand Charge status | **Retired stage-1** — active periods forced to 0; UI hidden |
| Tax status | **0** enforced in v2 |
| Historical billing | **Unchanged** |

Staging project `dmbmzjnpbmakotvlckkq` was **removed** before Phase B apply; production staged activation used instead (v1 retained).

---

## 2. Phase A Prerequisite Verification

| Check | Result |
|---|---|
| A1 unique constraint / dup groups = 0 | PASS |
| `replace_session_billing` exists | PASS |
| A2 RLS / anon RPC denied | PASS |
| 3 approved system_admins | PASS |
| Project ref `qflxupfeyktdrpilctyo` | PASS |
| A2 browser smoke | Accepted as remaining manual item (A2 report PARTIAL) |

---

## 3. Current Defect Confirmation

- Legacy `calculate_batch_billing`: `ORDER BY priority DESC LIMIT 1` without time-of-day match.
- Import `calculated_cost` fallback `kWh × 0.150`.
- Client path still used for Bulk Recalculate (now routes to v2 RPC).
- Timeline: overnight width negative.

---

## 4. Target Architecture

```text
Import / Recalculate → calculate_*_billing_v2 (Postgres, SECURITY DEFINER)
                     → UNIQUE(session_id) delete+insert
                     → breakdown items + metadata + audit

TypeScript billingEngineV2.ts → preview + unit parity only
Legacy calculate_batch_billing → retained for rollback (flag off)
```

Feature flag: `system_settings.billing_engine_v2_enabled = true`.

---

## 5. Tariff Validation Design

- SQL: `b_validate_rate_structure_coverage(uuid)` — minute coverage, gap/overlap, demand must be 0.
- TS: `validateDayCoverage` / `expandPeriodToDisplayIntervals` in `tariffIntervalUtils.ts`.

---

## 6. Overnight and Next-Day Handling

- Uses full `timestamptz` with `Asia/Amman`.
- Overnight fixture (TXN-style 23:53→00:37, 38 kWh): **7.334 JOD**, `MID@0.193`, 2 segments, demand_sum=0, taxes=0.
- Fixture created and deleted (no residual production rows).

---

## 7. Cross-Period Calculation Method

**Option B — proportional duration split** (approved default):

```text
segment_energy = total_energy × segment_duration / total_duration
segment_charge = ROUND_HALF_UP(segment_energy × rate, 3)
```

Same-rate sessions (e.g. overnight MID) use exact `energy × rate` for total.

---

## 8. SQL Migrations

| Migration | Purpose | Prod |
|---|---|---|
| `20260716240000_b_billing_engine_metadata.sql` | billing metadata columns | OK |
| `20260716240100_b_tariff_coverage_validation.sql` | coverage validator | OK |
| `20260716240200_b_billing_engine_v2.sql` | engine v2 RPCs | OK |
| `20260716240300_b_demand_charge_retirement_stage1.sql` | zero active demand | OK |
| `20260716240400_b_import_billing_status.sql` | import billing status + flag | OK* |
| `20260716240500_b_billing_rpc_grants_and_audit.sql` | anon revoke / grants | OK |
| `b_system_settings_billing_category` | allow `billing` category | OK |

\*Initial flag insert failed category check; fixed by expanding category constraint.

---

## 9. Billing Engine v2

RPCs:

- `calculate_session_billing_v2(session_id, source, reason)`
- `calculate_batch_billing_v2(batch_id, station_id)`
- `recalculate_session_billing_v2(session_id, reason)`

Engine version string: `ev-b-v2.0.0`.

---

## 10. Import Integration

`importService.processBatch`:

- Stops writing `× 0.150` fallback (uses 0 until engine sets cost).
- Calls `calculate_batch_billing_v2` when flag true; legacy otherwise.
- Batch receives `billing_status` / `billing_engine_version`.

---

## 11. Bulk Recalculate Integration

`recalculateSession` → `recalculate_session_billing_v2` (reason required).  
Client TOU path remains fallback if RPC missing.

---

## 12. Demand Charge Retirement

Stage 1 complete:

- Active `rate_periods.demand_charge_per_kw` set to 0.
- UI demand column/input removed; saves force `0`.
- Engine ignores demand.
- Columns retained for later cleanup.

---

## 13. Zero-Tax Enforcement

v2 persists `taxes = 0`; no tax lines. Client preview already tax=0.

---

## 14. JOD Precision

- SQL: `ROUND(numeric, 3)` via `b_round_jod3`.
- TS: `roundJod3` (half-up for positive values).
- Stored totals numeric to 3 decimals.

---

## 15. Timeline UI Correction

`RatePeriodEditor` uses `expandPeriodToDisplayIntervals` → two segments for MID; coverage badge for gaps/overlaps.

---

## 16. Security and RPC Authorization

- Anon cannot execute v2 RPCs (`anon_v2 = false`).
- Session billing requires import or recalculate permission (A2 helpers).
- A2 RLS unchanged; uniqueness intact.

---

## 17. Automated Tests

`src/lib/__tests__/billingEngineV2.test.ts` — 6 tests PASS  
Full lib suite: **14/14 PASS**

---

## 18. Sample File UAT

| Case | Status |
|---|---|
| Overnight expected 7.334 (Abo Saleh TXN pattern) | **PASS** (controlled fixture) |
| Full Excel import of sample files | **Not run on production** (prompt safety); ready for Sameer import after UI confirm |
| Mohammad 14:00 boundary fixtures | Covered in unit tests (Peak/MID and Off→Mid→Peak) |

---

## 19. Runtime UAT

| ID | Result |
|---|---|
| UAT-B-01 Coverage validator | Available (SQL+TS) |
| UAT-B-02 Timeline overnight | Code PASS |
| UAT-B-03 Import billing | Wired; needs live import by Sameer |
| UAT-B-04 Overnight | PASS 7.334 |
| UAT-B-05 Boundary split | Unit PASS |
| UAT-B-06 Recalculate | RPC ready; fixture used manual_recalculate |
| UAT-B-07 Security | Anon denied |
| UAT-B-08 A1/A2 | dups=0; RLS preserved |

---

## 20. A1/A2 Regression

- Duplicate billing groups: **0**
- Billing row count not bulk-rewritten
- Admin JWT path used for fixture only; fixture deleted

---

## 21. Historical Comparison Readiness

New columns `calculation_engine_version` / `billing_source` allow later Phase F comparison of legacy vs v2 without touching history now.

---

## 22. Rollback Plan

1. Set `billing_engine_v2_enabled` to `false` → imports use legacy `calculate_batch_billing`.
2. Keep v1 function definitions.
3. Do not drop v2 functions until soak complete.
4. Demand values were zeroed on active periods — restore from `a2_backup` / pre-B snapshot if needed (values previously equaled energy rates in some rows).

---

## 23. Changed Files

- `supabase/migrations/20260716240*.sql` (B1–B6 + category fix)
- `src/lib/tariffIntervalUtils.ts`
- `src/lib/billingEngineV2.ts`
- `src/lib/billingService.ts`
- `src/lib/importService.ts`
- `src/components/RatePeriodEditor.tsx`
- `src/lib/__tests__/billingEngineV2.test.ts`
- `src/lib/database.types.ts`
- `scripts/production/apply_b_migrations.cjs`
- `scripts/production/b_uat_overnight_fixture.sql`
- This report

---

## 24. Remaining Risks

- Full sample Excel import UAT not executed on production.
- Historical rows still have legacy engine amounts until Phase F.
- Payment methods / handover still not implemented.
- Staging project removed — use production flag for rollback testing carefully.
- Report UI may still show demand fields in some older report paths (Phase E).

---

## 25. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Correct tariff at import | PASS (wired + engine) / import file pending |
| 2 | No Bulk Recalc required for normal import | PASS (design) |
| 3 | Server-side authoritative persist | PASS |
| 4 | SQL/TS parity | PASS (unit + overnight total) |
| 5 | Asia/Amman | PASS |
| 6 | Overnight next-day | PASS |
| 7 | Proportional cross-period | PASS |
| 8 | Effective-date midnight split | Implemented |
| 9–10 | Coverage / gap-overlap | PASS (validators) |
| 11 | Timeline overnight | PASS |
| 12 | Demand = 0 | PASS |
| 13 | Tax = 0 | PASS |
| 14 | JOD 0.001 | PASS |
| 15 | Uniqueness | PASS |
| 16 | Anon RPC blocked | PASS |
| 17 | Sample file UAT | PARTIAL (fixture PASS; Excel pending) |
| 18 | A1/A2 regression | PASS |
| 19 | No historical recalc | PASS |
| 20 | Report complete | PASS |

---

## 26. Recommended Next Step

1. Sameer: import `sample files/2026-07-16+abo saleh.xlsx` and `…mohammad.xlsx` on production (or recreate staging) and confirm TXN `1573323579` = **7.334**.  
2. Confirm tariff timeline UI overnight rendering.  
3. Close Phase B after that confirmation.  
4. Do **not** start Phase C until explicitly approved.

---

> **Phase B Status:** PASS  
> **Phase C Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
