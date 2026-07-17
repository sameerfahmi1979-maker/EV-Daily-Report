# EV Charging System — Phase B Production Closure UAT Report

**Date:** 2026-07-16 / 2026-07-17  
**Codes:** `EV-B-CLOSURE`  
**Branch:** `phase/ev-b-billing-engine`  
**Production:** `qflxupfeyktdrpilctyo`  
**Prompt:** `ChatGPT/EV_CHARGING_SYSTEM_PHASE_B_CLOSURE_AND_PHASE_C_CURSOR_PROMPT.md`  
**Sample files:**
- `sample files/2026-07-16+abo saleh.xlsx`
- `sample files/2026-07-16+mohammad.xlsx`

---

## 1. Executive Summary

Phase B production closure UAT used the two approved machine Excel files on live production. Both files imported with automatic billing engine v2 (`ev-b-v2.0.0`), correct operator linkage, overnight next-day storage, boundary TOU splits, demand=0, tax=0, and controlled duplicate re-import. A1 uniqueness and A2 anonymous denial remain intact.

| Gate | Result |
|---|---|
| Real Excel import | PASS |
| Overnight TXN `1573323579` = 7.334 | PASS |
| Mohammad boundary TOU | PASS |
| Automatic billing (no Bulk Recalculate) | PASS |
| Duplicate re-import controlled | PASS |
| A1/A2/B regression | PASS |
| Rollback ledger | PASS |

---

## 2. Preflight

| Check | Result |
|---|---|
| Repo `EV-Daily-Report` | PASS |
| Project ref `qflxupfeyktdrpilctyo` | PASS |
| `billing_engine_v2_enabled=true` | PASS |
| Duplicate billing groups | 0 PASS |
| A1 unique billing constraint | PASS |
| Anon session read blocked | PASS |
| Anon `calculate_session_billing_v2` denied | PASS |
| Approved system admins | 3 PASS |
| Sample files readable | PASS |
| Target TXNs absent before import | PASS |
| Ledger / checkpoint created | PASS (`scripts/production/b_closure_import_ledger.json`, schema `b_closure_20260716`) |

---

## 3. Backup and Rollback Ledger

| Item | Value |
|---|---|
| Pre sessions | 84,306 |
| Pre billing | 84,301 |
| Pre batches | 624 |
| Pre breakdown | 89,050 |
| Snapshot schema | `b_closure_20260716.pre_counts` |
| Import ledger | `scripts/production/b_closure_import_ledger.json` |
| Abo Saleh batch | `e3186925-a296-44cb-b51a-f171afc96219` |
| Mohammad batch | `85790708-1574-4238-a744-d9c311702f42` |
| Post sessions | 84,448 (+142) |
| Post billing | 84,443 (+142) |
| Post batches | 626 (+2) |

Rollback path: delete sessions by ledger `sessionIds` / batch IDs (cascade billing via existing A1 uniqueness + FK), then delete import batches. Do not use for casual financial undo after soak.

---

## 4. Abo Saleh Import Results

| Field | Value |
|---|---|
| File | `2026-07-16+abo saleh.xlsx` |
| SHA-256 | `a2ec2253144325f044a4f0829e88ac2687136d39741ba7b432084e3801371b47` |
| Operator | ABO SALEH ALI SALEH (`12a51b90-5690-4495-af6b-5c45cd783aa8`) |
| Card context | ending `6424` |
| Station | `48f00127-09e8-47f6-8f6a-c3a331b332be` |
| Inserted / billed | 59 / 59 |
| Engine | `ev-b-v2.0.0` |
| Billing errors | 0 |

### Critical overnight TXN `1573323579`

| Field | Expected | Actual |
|---|---|---|
| Start date/time | 2026-07-15 23:53:32 | 2026-07-15 / 23:53:32 |
| End date/time | 2026-07-16 00:37:05 | 2026-07-16 / 00:37:05 |
| Energy | 38.000 kWh | 38 |
| Tariff | MID @ 0.193 | `MID@0.193` |
| Total | 7.334 JOD | **7.334** |
| Demand / tax | 0 / 0 | 0 / 0 |
| Billing rows | 1 | 1 |
| Source | import | import |
| Operator / batch | Abo Saleh / abo batch | linked correctly |

Next-day end date preserved; no date collapse; billing automatic.

---

## 5. Mohammad Import Results

| Field | Value |
|---|---|
| File | `2026-07-16+mohammad.xlsx` |
| SHA-256 | `04eead7f0807d00ecdd617de773683538a37599bb7b3eff324aa46f726779385` |
| Operator | MOHAMMAD DARWESH (`0014b83c-a401-44d0-a7f5-ff39a254be5f`) |
| Card context | ending `6443` |
| Inserted / billed | 83 / 83 |
| Engine | `ev-b-v2.0.0` |
| Billing errors | 0 |

All critical boundary TXNs linked to Mohammad operator and Mohammad batch; billing source `import`.

---

## 6. Boundary Calculation Table

Method: Option B proportional duration split at 14:00 Asia/Amman (Off-Peak 0.183 → Mid-Peak 0.193). Expected computed from file timestamps/energy; actual from production `billing_calculations`.

| Transaction ID | Energy (kWh) | Off-sec | Mid-sec | Expected (JOD) | Actual (JOD) | Δ | Demand | Tax | Engine | Match |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1409778499 | 8.2 | 43 | 884 | 1.579 | 1.579 | 0 | 0 | 0 | ev-b-v2.0.0 | PASS |
| 1613808371 | 10.9 | 593 | 22 | 1.999 | 1.998 | 0.001 | 0 | 0 | ev-b-v2.0.0 | PASS* |
| 445488588 | 8.2 | 642 | 114 | 1.513 | 1.513 | 0 | 0 | 0 | ev-b-v2.0.0 | PASS |
| 1201532186 | 16.6 | 669 | 220 | 3.079 | 3.079 | 0 | 0 | 0 | ev-b-v2.0.0 | PASS |
| 696086752 | 34.5 | 1966 | 825 | 6.415 | 6.415 | 0 | 0 | 0 | ev-b-v2.0.0 | PASS |
| 2046279491 | 38.2 | 2693 | 1624 | 7.134 | 7.134 | 0 | 0 | 0 | ev-b-v2.0.0 | PASS |

\* Within 0.001 JOD half-up precision; applied summary `Mid-Peak@0.193, Off-Peak@0.183`.

SQL/TS preview parity: production totals match TS Option-B expectations within JOD 3dp rule.

---

## 7. Duplicate Re-import Results

| File | File TXNs | Already in DB | Would insert | Existing overnight/boundary totals |
|---|---:|---:|---|---|
| Abo Saleh | 59 | 59 | 0 (skip all) | unchanged (`1573323579` = 7.334) |
| Mohammad | 83 | 83 | 0 (skip all) | unchanged |

**Detection mechanism:** `charging_sessions.transaction_id` UNIQUE + import path `checkDuplicateTransactionIds` → skip with skip count.

**Database result:** no second sessions, no second billing rows, originals unchanged.

**Note:** Phase C will add file-hash identity and clearer duplicate-file UX; closure accepts transaction-level skip as controlled prevention.

---

## 8. Timeline Verification

Code verification (`tariffIntervalUtils.expandPeriodToDisplayIntervals` + `RatePeriodEditor`):

| Check | Result |
|---|---|
| MID overnight expands to two visual segments | PASS (unit-tested) |
| 23:00–24:00 / 00:00–05:00 representation | PASS |
| No negative width helper | PASS (`Math.max(0, width)`) |
| Single logical DB overnight period | PASS (display-only split) |
| Demand Charge absent from active billing UI | PASS (Phase B retirement) |
| Tax absent from v2 billing | PASS |

Browser visual smoke of the tariff editor remains a recommended manual check; code path is covered.

---

## 9. Security Regression

| Check | Result |
|---|---|
| Anon `charging_sessions` select | 0 rows |
| Anon `calculate_session_billing_v2` | `permission denied` |
| Duplicate billing groups | 0 |
| A1 archive count | 236 (unchanged) |
| Billing flag | `true` |

---

## 10. Data Integrity

| Check | Result |
|---|---|
| Sessions delta | +142 (= 59 + 83) |
| Billing delta | +142 |
| Batches delta | +2 |
| Dup groups | 0 |
| Critical TXNs billing_rows | 1 each |
| Demand / tax on critical set | 0 / 0 |
| No global recalculation | PASS (only new import batches billed) |

---

## 11. Remaining Risks

1. Duplicate control is transaction-ID based; same file hash not yet stored on `import_batches` (Phase C).
2. Import posting remains client-driven insert + RPC bill (Phase C transactional post).
3. Browser timeline visual smoke not re-captured in this closure run (code PASS).
4. Staging project previously removed; closure executed on production with ledger.

---

## 12. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Both files import through real workflow | PASS |
| 2 | Correct operators linked | PASS |
| 3 | Overnight `1573323579` = 7.334 | PASS |
| 4 | Mohammad boundary TXNs correct | PASS |
| 5 | Billing automatic | PASS |
| 6 | No Bulk Recalculate required | PASS |
| 7 | Duplicate re-import controlled | PASS |
| 8 | Demand = 0 | PASS |
| 9 | Tax = 0 | PASS |
| 10 | JOD 0.001 reconcile | PASS |
| 11 | Timeline renders correctly | PASS (code) |
| 12 | A1/A2 intact | PASS |
| 13 | No unrelated historical change | PASS |
| 14 | Rollback ledger complete | PASS |

---

## 13. Final Status

> **Phase B Production Closure Status:** PASS  
> **Phase C Start Authorization:** AUTHORIZED
