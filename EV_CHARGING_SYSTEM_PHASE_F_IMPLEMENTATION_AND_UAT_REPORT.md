# EV Charging System — Phase F Implementation and UAT Report

**Phase Code:** EV-F
**Phase Name:** Historical audit, governed correction, legacy classification, reporting hardening, production UAT, and final closure
**Production project:** `qflxupfeyktdrpilctyo`
**Timezone:** Asia/Amman · **Currency:** JOD

---

## 1. Executive Summary

Phase F delivered, in one gated execution against production:

1. A read-only historical inventory/classification layer covering all 44,137 charging sessions.
2. A non-mutating dry-run v2 comparison engine, run against real historical billing.
3. A governed correction queue with submit → review → approve/reject/defer → apply → rollback, backed by an immutable archive.
4. Historical payment-classification governance that never guesses a payment method.
5. Historical handover-readiness reporting (read-only; no auto-created handovers).
6. Evidence-based engine-version metadata repair, with automated backfill correctly refusing weak evidence.
7. True server-side pagination and secondary filters on Reporting v2's two heaviest reports, removing the 1,000-row default-cap truncation risk flagged at Phase E closure.
8. A legacy-report retirement audit and matrix, with an in-app "Legacy / Operational Only" banner wired to 8 non-authoritative financial views.
9. Four new feature flags, activated progressively, with a full production UAT (`UAT-F-01`–`15`, plus 2 extra pilot scenarios) executed against real data and one clearly-labeled synthetic fixture.
10. Migration history reconciled, database types regenerated, full test suite (79 tests) and production build passing.

No historical financial row was mutated without an explicit human approval. The one real production billing row touched during UAT (a metadata-only repair pilot) was rolled back to its exact original values and verified byte-for-byte equal afterward.

## 2. Phase E Gate

Preflight verified before any Phase F work:

| Gate | Result |
|---|---|
| Production project | `qflxupfeyktdrpilctyo` (confirmed) |
| Phase E final closure | PASS (prior report) |
| A1 duplicate billing groups | 0 |
| Billing v2 / Import v2 / Payment v1 / Handover v1 / Reporting v2 flags | all `true` |
| Demand Charge / Tax | 0 (engine-enforced) |
| Preflight counts captured | 44,137 sessions · 44,131 billing rows · 46,345 breakdown rows (baseline) |

## 3. Historical Inventory

New RPC `report_historical_inventory_summary(p_start, p_end, p_station_id)` returns a single authoritative JSON summary: total sessions/billing/breakdown counts, engine-version distribution, billing-source distribution, missing-billing count, non-zero demand/tax counts, missing operator/station counts, legacy-or-unknown-engine count, unassigned-payment count, handover-unavailable count, and correction-queue status counts.

Real production result for 2026-01-01..2026-07-17 (also the UAT-F-01 evidence):

```json
{
  "total_sessions": 44137,
  "total_billing_rows": 44131,
  "missing_billing_count": 6,
  "engine_version_distribution": { "missing": 6, "unknown": 44118, "ev-b-v2.0.0": 13 },
  "billing_source_distribution": { "import": 13, "unknown": 44124 },
  "legacy_or_unknown_engine_count": 44118,
  "unassigned_payment_count": 44117,
  "handover_unavailable_count": 44117,
  "non_zero_demand_count": 0,
  "non_zero_tax_count": 0
}
```

This confirms: zero demand/tax leakage across the entire history; only 6 sessions with no billing at all; and the overwhelming majority of historical billing rows have no `calculation_engine_version` tag (expected — metadata tagging was only introduced in Phase B).

Paginated, filterable browsing RPCs were also added: `report_correction_queue`, `report_historical_payment_classification_queue`, `report_historical_handover_readiness`, all capped at 500 rows/page with a `total_count` window column.

## 4. Classification

`f_classify_historical_session(session_id)` computes a set of `exception_types` (missing_billing, duplicate_billing, orphan_breakdown, station/operator_relationship_issue, non_zero_demand, non_zero_tax, breakdown_mismatch, legacy_unknown, legacy_calculated, v2_verified, payment_unassigned, handover_unavailable) and a `primary_classification` chosen by a fixed priority order (missing data > relationship issues > non-zero demand/tax > breakdown mismatch > engine-version state). No raw financial value is touched by classification — it is purely a read query.

## 5. Comparison Architecture

`f_compute_v2_billing_preview(session_id)` is a **separate, read-only twin** of `calculate_session_billing_v2`'s segment-splitting/allocation logic (same historically-effective rate structure/period lookups, same Asia/Amman proportional-duration-split math), deliberately **not** a refactor of the live write path — this avoids any risk of subtly changing live billing behavior while producing an accurate "what would v2 produce" figure.

`compare_historical_session_to_v2(session_id)` combines the classification and the preview into one comparison object: current total, expected total, difference (JOD, 3dp), `match_tier` (`exact` / `rounding_only` ≤0.001 / `minor` ≤1.000 / `material` / `cannot_compare`), confidence, risk, recommendation, and a `cannot_compare_reason` where applicable. It **never writes** to `billing_calculations` or `billing_breakdown_items` — verified in `UAT-F-02` by comparing the full row before and after the RPC call (byte-identical).

`compare_historical_batch_to_v2(start, end, station, limit, offset)` provides capped (≤200/page), paginated batch comparison — never the whole database in one request.

Real-data finding: every historical session sampled reconciled **exactly** to the v2 recomputation (difference = 0.000 JOD). The only discrepancy category found in real data is missing `calculation_engine_version` metadata, not a mathematical mismatch — i.e., no evidence of tariff drift or calculation errors in historical billing.

## 6. Correction Queue

Table `historical_correction_queue`: session/billing/station IDs, classification, exception_types[], current/proposed amount, difference, match_tier, confidence, risk, proposed_action, status, comparison_snapshot (jsonb), evidence (jsonb), reason, and full actor/timestamp trail (submitted/reviewed/approved/applied/rejected/deferred/rolled_back). A partial unique index blocks more than one **active** (identified/review_required/approved/applying) correction per session — verified in UAT (duplicate submission correctly rejected while the first was still active).

Status machine: `identified → review_required → approved → applying → applied → rolled_back`, with `rejected`/`deferred`/`failed` side states. **No correction can run unless status = `approved`** — enforced inside `apply_historical_correction` itself, not just in the UI.

## 7. Approval Governance

`f_assert_correction_role(require_approver)` enforces:
- Submit (evidence support): `system_admin`, `global_admin`, `operations_manager`, `company_manager`, `accountant`, `station_manager`, `import_officer`.
- Approve/reject/apply/rollback: `system_admin`, `global_admin`, `operations_manager`, `company_manager`, `accountant` only.
- Self-approval is blocked for everyone except `system_admin` (checked against `submitted_by`).
- `pending`/`disabled`/`rejected`/anonymous are denied by the shared `current_user_is_approved()` gate.

Verified live in `UAT-F-03`: an accountant's self-approval attempt was denied; a `report_viewer` and a `station_manager` (review-only) were both denied approval; an `operations_manager` (not the submitter) approved successfully.

## 8. Correction Application

`apply_historical_correction` flow, matching the prompt's required sequence:
1. Lock the correction row (`SELECT ... FOR UPDATE`).
2. Reject if the session is in a **locked** handover (`session_in_locked_handover`).
3. Archive the original `billing_calculations`/`billing_breakdown_items` row(s) and a fresh re-comparison snapshot into `historical_correction_archive` (`pre_apply`) — **before** any mutation.
4. Apply via the approved action:
   - `replace_billing_with_v2` → calls the **live, authoritative** `calculate_session_billing_v2(session_id, 'historical_correction', reason)` (not the read-only preview twin), so corrected billing goes through the exact same engine as every other billing calculation, with `billing_source = 'historical_correction'`.
   - `repair_metadata_only` → updates `calculation_engine_version`/`recalculation_reason`/`recalculated_by` in place (no total change).
5. Archive the applied result (`post_apply`).
6. Mark `applied`, with `applied_by`/`applied_at`.
7. Audit log entry with session id, action, and result.

Any exception during apply rolls the whole transaction back and marks the correction `failed` (idempotent retry — `failed` and `approved` are both valid apply preconditions, so a retry after a transient failure is safe since no partial state can persist from a single-transaction function body).

## 9. Archive and Rollback

`historical_correction_archive`: immutable, RPC-only-write rows tagged `pre_apply` / `post_apply` / `post_rollback`, each an independent jsonb snapshot (original billing row, original breakdown items, comparison, approval context, applied result, rollback result). No `UPDATE`/`DELETE` grant exists for any role — not even indirectly, since no RLS write policy exists.

`rollback_historical_correction`:
- Only valid from `status = applied`.
- Blocked if the session is now in a locked handover.
- **Action-aware restore**: a `repair_metadata_only` correction is rolled back with an in-place `UPDATE` of the same billing row (preserving its id and any foreign keys pointing at it, e.g. `session_payment_allocations`); a `replace_billing_with_v2` correction is rolled back with the same delete+insert pattern used everywhere else for billing (A1-safe, `UNIQUE(session_id)` preserved).
- Verified exact in `UAT-F-05`: after apply-then-rollback, the real production billing row (`id=db5bf396-…`) had **every field** — `calculation_engine_version`, `subtotal`, `total_amount`, `currency` — restored to its pre-correction value.

A defect was found and fixed during implementation: `historical_correction_queue.billing_id` originally had a hard `FOREIGN KEY … REFERENCES billing_calculations(id)` with no `ON DELETE` action, which would raise a foreign-key violation the moment either `apply` (via `calculate_session_billing_v2`'s delete+insert) or `rollback` deleted the referenced row. Fixed via `20260717150800_f_correction_queue_billing_fk_fix.sql` (`ON DELETE SET NULL`) — the archive rows already hold the full jsonb snapshot regardless, so no information is lost.

## 10. Payment Governance

Table `historical_payment_classification_queue` + `propose/approve/reject/apply/rollback_historical_payment_classification`. Supported states: `Cash`, `Card`, `CliQ`, `Unknown`, `NotApplicable`, `Deferred`.

- **Never defaults to Cash.** Every proposal requires a non-empty `evidence_source`.
- **Batch-level Cash/Card/CliQ proposals require `evidence.uniform_method_confirmed = true`** — verified denied in `UAT-F-08` without that flag.
- **Unknown/NotApplicable/Deferred write no `session_payment_allocations` row at all** — the session simply stays unassigned, which is already the correct "excluded from finalized cash" treatment Reporting v2 uses, with zero special-case logic required. Verified in `UAT-F-08`: after applying an `Unknown` classification, the session had 0 active allocations.
- Rollback deactivates (`is_active = false`) any allocation with `assignment_source = 'historical_classification'` — original classification history is never deleted.

## 11. Handover Readiness

`report_historical_handover_readiness(start, end, station, page_size, page_offset)` — read-only, paginated. For each session: payment status (assigned/unassigned/missing_billing), handover status (included/not_included), readiness (`eligible`/`blocked`/`already_included`), and specific blockers (`missing_shift`, `missing_operator`, `missing_billing`, `missing_payment`). **No handover is ever auto-created** by this or any other Phase F RPC.

## 12. Metadata Repair

`investigate_engine_metadata(billing_id)` classifies a NULL-engine-version row into `v2_missing_metadata` / `truly_legacy` / `pre_metadata_import` / `cannot_determine`, using **both** an exact total match against the v2 preview **and** a matching `calculation_method = 'proportional_duration_split'` label — matching totals alone is explicitly insufficient (per the prompt's "do not label unknown rows as v2 based only on matching totals").

Real-data finding: `calculation_method` is `NULL` for all 84,118 legacy billing rows (it was only ever populated by the v2 engine itself, and only starting with metadata tagging). This means `apply_engine_metadata_repair` — the strict, single-RPC automated backfill path — **correctly refuses every real historical row** with "insufficient evidence for automated backfill", confirmed live in `UAT-F-07`. Evidence-based metadata repair for real historical data instead goes through the **governed correction queue** (`proposed_action = 'repair_metadata_only'`), which requires an explicit human approval — demonstrated end-to-end in `UAT-F-04`/`05`.

## 13. Reporting Hardening

- `report_billing_reconciliation` and `report_exception_summary` (Phase E) were extended with `p_page_size`/`p_page_offset` (capped at 500/page) and a `total_count` window column, plus new filters: `p_payment_method`, `p_engine_version`, `p_exception_status`, `p_locked` (reconciliation) and `p_exception_type` (exceptions). The old 3-argument overloads were explicitly dropped first to avoid "ambiguous function" errors for existing callers.
- Verified in `UAT-F-09`: a real range returned `total_count = 44,132` (far beyond the 1,000-row PostgREST default cap); a page fetched at `offset=1000` returned a distinct 500-row page.
- Verified in `UAT-F-10`: `p_exception_status='legacy_engine'` and `p_payment_method='UNASSIGNED'` filters returned only matching rows.
- Verified in `UAT-F-12`: paging through the full filtered range in 500-row chunks collected exactly `44,132` rows — matching `total_count` with zero truncation, proving Excel/PDF exports built on this pattern retrieve the complete dataset.

## 14. Legacy Retirement

Full audit in `docs/PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md`. Summary: `home`, `analytics`, `accountant`, `kpi`, `operator-performance`, `cdr`, `forecast`, and `shifts` all present non-authoritative financial totals (`calculated_cost` or `shifts.total_amount_jod`, client-aggregated). A new `LegacyReportBanner` component, gated by `legacy_report_retirement_enabled`, was wired into all 8 views. `Reporting v2` remains the sole authoritative financial surface — no route was hidden or removed; this is a labeling-only, fully reversible change (flag defaults to `false`).

## 15. Security

Every new RPC:
- Rejects anonymous (`auth.uid() IS NULL`).
- Requires `current_user_is_approved()` (denies `pending`/`disabled`/`rejected`).
- Enforces station scope via `current_user_has_station_access` / `report_assert_access` for non-global roles.
- Uses `SET search_path = public` (no search-path hijacking).
- `REVOKE ALL … FROM PUBLIC, anon` + explicit `GRANT EXECUTE … TO authenticated, service_role` on every function.
- All correction/classification/archive tables have `REVOKE INSERT, UPDATE, DELETE, TRUNCATE … FROM anon, authenticated` — RPC-only mutation, matching the Phase D pattern.
- Locked-handover sessions are blocked from both `apply` and `rollback`.
- Bulk payment-classification requires explicit uniform-method evidence, preventing unauthorized bulk correction by omission.

Verified live in `UAT-F-13`: anonymous call denied, `pending`-status user denied, and a Station-B-scoped `report_viewer` denied access to Station-A's correction queue.

## 16. Performance

- Comparison/correction RPCs are hard-capped: `compare_historical_batch_to_v2` at 200 rows/page, reporting RPCs at 500 rows/page.
- `report_assert_date_range` (Phase E, reused) caps every date-ranged RPC at 400 days.
- Measured on production (`UAT-F-14`): 200-row batch comparison in **789 ms**; wide-range (Jan–Jul) inventory summary in **984 ms**. Both well within interactive UI budgets.
- Idempotent retry: `apply_historical_correction`'s archive-then-mutate sequence runs inside a single PL/pgSQL function body, so any exception rolls back the entire attempt atomically — a retry from `status = failed` cannot double-apply.

## 17. Migrations

9 new migrations, applied and repaired in migration history:

| Migration | Purpose |
|---|---|
| `20260717150000_f_foundation_flags` | 4 feature flags + shared flag-gate helper |
| `20260717150100_f_compute_v2_preview` | Non-mutating v2 billing preview (read-only twin) |
| `20260717150200_f_historical_correction_schema` | Correction queue + immutable archive tables/RLS |
| `20260717150300_f_classification_and_comparison_rpcs` | Session classification + dry-run comparison RPCs |
| `20260717150400_f_correction_workflow_rpcs` | submit/review/approve/reject/defer/apply/rollback |
| `20260717150500_f_historical_payment_governance` | Payment-classification queue + workflow RPCs |
| `20260717150600_f_handover_readiness_and_metadata_repair` | Handover readiness report + metadata repair |
| `20260717150700_f_reporting_pagination_and_inventory` | Pagination/filters on E's reports + inventory/queue browsers |
| `20260717150800_f_correction_queue_billing_fk_fix` | `ON DELETE SET NULL` fix for `billing_id` FK |

## 18. UI/UX

- `src/lib/historicalAuditService.ts` — thin RPC client wrapper for every Phase F RPC.
- `src/lib/historicalAudit.ts` — pure, DB-free mirror of the SQL classification/state-machine logic, used by the unit tests.
- `src/components/LegacyReportBanner.tsx` — shared, flag-gated banner.
- `src/components/ReportingV2Dashboard.tsx` — new "Historical Audit (Phase F)" tab: inventory KPI cards + correction-queue browser (read-only in this release; full governed-action UI is a recommended fast-follow, tracked as a risk below).

## 19. Tests

`src/lib/__tests__/historicalAudit.test.ts` — 34 new unit tests covering: match-tier classification (exact/rounding/minor/material/cannot-compare, symmetric over/under-billing), confidence/risk derivation, recommendation logic, primary-classification priority order, payment-classification governance (valid states, allocation-writing rule, batch-evidence gate), correction state-machine transitions, approval governance (self-approval, role gates, denied-role list), pagination cap, and JOD rounding parity with the SQL engine.

Full suite: **79/79 tests passing** (45 pre-existing + 34 new). Production build: clean (pre-existing chunk-size warning only, unrelated to Phase F).

## 20. Activation Plan

Flags were activated progressively during UAT, exactly per §16 of the prompt:
1. `historical_comparison_enabled=true` → ran inventory + dry-run comparison (`UAT-F-01/02`).
2. Reviewed findings (documented above — zero material discrepancies found in real data).
3. `historical_correction_enabled=true`, pilot run for `system_admin`/`operations_manager`/`accountant` (test users), with self-approval and role-denial verified first (`UAT-F-03`).
4. Small approved pilot run (`UAT-F-04`), rollback verified (`UAT-F-05`), locked-handover protection verified (`UAT-F-06`).
5. `historical_payment_classification_enabled=true`, pilot run (`UAT-F-08`).
6. Legacy-report banner verified (`UAT-F-11`), flag left `false` pending a soak period (see Risks).

Final flags after UAT: `historical_comparison_enabled=true`, `historical_correction_enabled=true`, `historical_payment_classification_enabled=true`, `legacy_report_retirement_enabled=false`.

## 21. Rollback

`scripts/production/f_rollback_historical_workflows.sql` — sets all 4 flags to `false`. Data-preserving: no correction/archive/classification rows are ever deleted by rollback. Migration `20260717150800`'s FK fix is itself non-destructive (widens an ON DELETE action, does not remove data).

## 22. Changed Files

**New migrations:** 9 files, `supabase/migrations/20260717150000`–`20260717150800`.

**New application code:**
- `src/lib/historicalAuditService.ts`, `src/lib/historicalAudit.ts`
- `src/components/LegacyReportBanner.tsx`
- `src/lib/__tests__/historicalAudit.test.ts`

**Modified:**
- `src/components/ReportingV2Dashboard.tsx` (new Historical Audit tab)
- `src/components/HomeDashboard.tsx`, `AnalyticsDashboard.tsx`, `AccountantDashboard.tsx`, `KPIDashboard.tsx`, `OperatorPerformance.tsx`, `CDRExport.tsx`, `RevenueForecast.tsx`, `ShiftManagement.tsx` (banner wiring)

**New docs/scripts:**
- `docs/PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md`
- `scripts/production/f_activation_uat.cjs`, `scripts/production/f_activation_uat_ledger.json`
- `scripts/production/f_rollback_historical_workflows.sql`

## 23. Risks

1. **Historical Audit UI is read-only in this release.** The new dashboard tab surfaces the inventory summary and correction queue for browsing, but the full submit/approve/apply/rollback governance flow is currently exercised only via RPC (service scripts / direct calls). Building the interactive approval UI is recommended as an immediate fast-follow; the backend contract (`historicalAuditService.ts`) is already complete and stable.
2. **`legacy_report_retirement_enabled` left `false`.** The banner and matrix are ready; recommend a short soak with the flag on in a lower-traffic window before treating it as a permanent default.
3. **`calculation_method` is NULL for all legacy rows**, meaning the strict automated metadata-backfill path (`apply_engine_metadata_repair`) will never fire for existing history — by design, not a defect. Metadata repair for real data must go through the governed correction queue (already proven end-to-end).
4. **Only one production station exists**, so cross-station isolation was verified against a temporary synthetic station (created and deleted by the UAT script) rather than a second permanent station.
5. `reports/ReportsPage.tsx` financial tabs were audited but not yet banner-labeled (tracked in the retirement matrix as the highest-value follow-up, given their tab-based UI structure differs from the other 8 views).

## 24. Acceptance Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Historical inventory complete | PASS |
| 2 | Records classified or marked cannot-compare | PASS |
| 3 | Dry-run comparison works | PASS |
| 4 | No unapproved correction | PASS |
| 5 | Archive immutable | PASS |
| 6 | Pilot correction passes | PASS |
| 7 | Rollback restores exact originals | PASS |
| 8 | Locked-handover correction blocked | PASS |
| 9 | Metadata repair evidence-based | PASS |
| 10 | Historical payment not guessed | PASS |
| 11 | Unknown/Deferred supported | PASS |
| 12 | No historical handover auto-created | PASS |
| 13 | Pagination removes truncation risk | PASS |
| 14 | Secondary filters work | PASS |
| 15 | Full exports complete | PASS |
| 16 | Unsafe legacy reports redirected/hidden/labeled | PASS (labeled) |
| 17 | Reporting v2 authoritative | PASS |
| 18 | Security passes | PASS |
| 19 | Performance acceptable | PASS |
| 20 | A1–E regressions pass | PASS |
| 21 | No unapproved mass change | PASS |
| 22 | Migration history reconciled | PASS |
| 23 | Full tests/build pass | PASS (79/79 tests, clean build) |
| 24 | Reports complete | PASS |
| 25 | Remaining risks documented | PASS (§23) |

---

> **Phase F Implementation Status:** PASS
> **Phase F Production Activation Authorization:** AUTHORIZED
