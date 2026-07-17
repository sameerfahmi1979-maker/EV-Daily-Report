# CURSOR IMPLEMENTATION PROMPT — EV CHARGING SYSTEM PHASE F

## Phase Code
`EV-F`

## Phase Name
Historical audit, governed correction, legacy classification, reporting hardening, production UAT, and final closure.

## Repository
`C:\dev\EV-DR\EV-Daily-Report`

## Production
- Supabase project: `qflxupfeyktdrpilctyo`
- Environment: Production
- Timezone: `Asia/Amman`
- Currency: JOD

## Governing Files
Read all A1–E implementation, activation, UAT, and closure reports; the master plan; `docs/PHASE_E_REPORTING_AUDIT.md`; all migrations, RPCs, feature flags, rollback scripts, generated types, and UAT ledgers.

---

# 1. Objective

Complete Phase F in one strictly gated execution:

1. Historical inventory and classification
2. Dry-run v2 comparison
3. Correction queue and approval workflow
4. Controlled approved pilot correction
5. Exact rollback verification
6. Historical payment classification governance
7. Historical handover-readiness reporting
8. Engine-version metadata repair
9. Reporting v2 pagination and filters
10. Legacy report retirement/redirect
11. Production activation and UAT
12. Final stabilization and closure

Do not begin by changing historical financial rows. Audit and dry-run comparison come first.

---

# 2. Mandatory Preflight

Verify before any work:

- Production project is exactly `qflxupfeyktdrpilctyo`
- Phase E final closure = PASS
- A1 duplicate billing groups = 0
- A2 RLS/RPC security active
- Billing v2 enabled
- Import v2 enabled
- Payment and handover workflows enabled
- Reporting v2 enabled
- Demand Charge = 0
- Tax = 0
- Backup/PITR available
- Current counts captured for sessions, billing, breakdown, payments, handovers, engine versions, legacy/unknown rows
- Current report routes and legacy dashboards inventoried
- No unrelated migration/refactor included

Stop if any critical gate fails.

---

# 3. Absolute Scope Limit

## Included
- Historical audit and classification
- Read-only v2 comparison
- Correction queue
- Approval/rejection/defer workflow
- Correction archive and rollback
- Evidence-based engine metadata repair
- Historical payment classification governance
- Historical handover-readiness reports
- Reporting pagination and missing filters
- Export hardening
- Legacy report redirect/hide/deprecation
- Full security/performance/regression UAT
- Final closure reports

## Excluded
- Guessing historical Cash/Card/CliQ
- Auto-creating historical handovers
- Unapproved mass correction
- Deleting original financial history
- Changing tariff mathematics
- Adding tax or Demand Charge
- Adding payment methods
- OCPP activation
- External bank/card/CliQ integrations
- Full accounting ledger
- Unrelated redesign

---

# 4. Historical Classification

Classify records using one or more of:

- `v2_verified`
- `v2_metadata_missing`
- `legacy_calculated`
- `legacy_unknown`
- `missing_billing`
- `breakdown_mismatch`
- `tariff_mismatch`
- `non_zero_demand`
- `non_zero_tax`
- `duplicate_billing`
- `orphan_breakdown`
- `operator_relationship_issue`
- `station_relationship_issue`
- `payment_unassigned`
- `handover_unavailable`
- `cannot_compare`
- `correction_approved`
- `correction_applied`
- `correction_rejected`
- `correction_deferred`
- `correction_rolled_back`

Do not modify raw financial values merely to classify them.

---

# 5. Historical Inventory and Audit

Create secured, paginated reporting RPCs/views for:

- Total sessions/billing/breakdown
- Engine-version distribution
- Billing-source distribution
- Missing billing
- Missing or duplicate breakdown
- Breakdown sum mismatch
- Non-zero demand/tax
- Missing operator/station/import relationship
- Missing calculation metadata
- Legacy/unknown engine rows
- Unassigned historical payments
- Handover readiness/blockers
- Correction queue status

Support date range, station, operator, exception, engine version, correction status, sorting, pagination, and export.

---

# 6. Dry-Run v2 Comparison

Implement non-mutating comparison RPCs, such as:

- `compare_historical_session_to_v2(session_id)`
- Paginated batch/range comparison with strict limits

Return:

- Current stored total
- Current breakdown sum
- Expected v2 total
- Expected v2 breakdown
- Difference
- Historical tariff used
- Demand/tax difference
- Metadata difference
- Confidence
- Risk
- Recommendation
- `cannot_compare` reason where applicable

Never write comparison results into active billing tables.

Use JOD tolerance `0.001` and classify results as exact match, rounding-only, minor, material, or cannot compare.

Respect historical effective tariff, `Asia/Amman`, overnight sessions, next-day endings, and proportional cross-period splitting. Never apply today’s tariff to old sessions without explicit assumption labeling.

---

# 7. Correction Queue

Create a governed correction queue containing:

- Session/billing/comparison IDs
- Exception types
- Current/proposed amount
- Difference
- Confidence/risk
- Proposed action
- Status
- Evidence
- Reason
- Submitted/reviewed/approved/applied actors and timestamps

Statuses:

`identified`, `review_required`, `approved`, `rejected`, `deferred`, `applying`, `applied`, `failed`, `rolled_back`.

No correction can run unless status is `approved`.

---

# 8. Approval Governance

Roles:

- System Administrator: full
- Operations Manager: review/approve within scope
- Accountant: financial review/approve within scope
- Station Manager: review only unless explicit permission exists
- Import Officer: evidence support only
- Report Viewer: read-only
- Pending/disabled/rejected/anonymous: denied

Prevent non-admin self-approval.

Require reason, evidence, impact, current/proposed amounts, and rollback readiness.

---

# 9. Controlled Correction

Implement secured RPCs such as:

- `approve_historical_correction`
- `reject_historical_correction`
- `apply_historical_correction`
- `rollback_historical_correction`

Apply flow:

1. Lock correction/session
2. Revalidate comparison
3. Verify approval and scope
4. Block locked-handover sessions
5. Archive original billing and breakdown
6. Apply through approved v2 replacement path
7. Set source `historical_correction`
8. Store reason, actor, engine version
9. Verify uniqueness and reconciliation
10. Commit and audit

Do not correct sessions in locked handovers unless formally reopened.

---

# 10. Immutable Correction Archive

Archive:

- Original billing
- Original breakdown
- Comparison
- Approval
- Applied result
- Rollback result

Normal users cannot update/delete archives. Protect with RLS and RPC-only mutation.

Rollback must restore exact original values and retain all correction history.

---

# 11. Historical Payment Governance

Do not default history to Cash.

Supported historical states:

- Cash
- Card
- CliQ
- Unknown
- Not Applicable
- Deferred

Rules:

- Evidence required
- Batch-level proposal only when evidence proves one method
- Mixed batches require transaction-level review
- Bulk operation requires preview, counts, totals, approval
- Store evidence source, confidence, notes, actor/time
- Preserve prior classification history
- Unknown/Deferred excluded from finalized physical cash

If reliable evidence is unavailable, leave records Unknown/Deferred.

---

# 12. Historical Handover Readiness

Provide reports for:

- Payment assigned/unassigned
- Eligible for handover
- Blocked by missing shift/operator/payment/billing
- Already included in handover
- Corrected billing
- Unresolved discrepancies

Do not auto-create historical handovers.

---

# 13. Engine-Version Metadata Repair

Investigate NULL engine versions and classify:

- Truly legacy
- v2 with missing metadata
- Path omitted metadata
- Pre-metadata import
- Cannot determine

Backfill only when evidence is sufficient. Store inference basis, confidence, actor, timestamp, and reason.

Do not label unknown rows as v2 based only on matching totals.

---

# 14. Reporting v2 Hardening

Implement true server-side pagination for:

- Billing Reconciliation
- Exceptions
- Historical Comparison
- Correction Queue
- Historical Payment Classification

Remove the default 1,000-row truncation risk.

Add server-side UI filters for:

- Payment method
- Handover status
- Import status
- Engine version
- Locked/unlocked
- Reconciled/unreconciled
- Exception type
- Correction status
- Risk
- Confidence

Ensure Excel/PDF exports retrieve the full filtered dataset without truncation.

---

# 15. Legacy Report Retirement

Audit each old dashboard/report/export and decide:

- keep
- redirect to Reporting v2
- label `Legacy / Operational Only`
- hide
- deprecate
- remove after soak

Any route using `calculated_cost`, mutable `shifts.total_*` as authoritative finance, stale client aggregation, Demand Charge, or tax must not remain presented as authoritative.

Keep rollback path during soak.

Create `docs/PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md`.

---

# 16. Feature Flags

Create/use:

- `historical_comparison_enabled=false`
- `historical_correction_enabled=false`
- `historical_payment_classification_enabled=false`
- `legacy_report_retirement_enabled=false`

Activation:

1. Enable comparison only
2. Run inventory/dry-run
3. Review findings
4. Enable correction for System Administrator only
5. Run small approved pilot
6. Verify rollback
7. Expand correction roles
8. Enable historical payment classification
9. Activate legacy report redirects
10. Close only after all UAT passes

---

# 17. Pilot Correction UAT

Select a small approved pilot:

- One metadata-only repair
- One exact/rounding-only comparison
- One material difference
- One missing-billing case
- One anomaly case if present
- One deferred/cannot-compare case
- One correction rollback

Do not use locked-handover sessions unless formally reopened.

For each: compare, review, approve, apply, reconcile, audit, and rollback where designated.

---

# 18. Historical Payment Pilot

Use only evidence-backed records.

Test where available:

- All-Cash batch
- All-Card batch
- All-CliQ batch
- Mixed batch
- Unknown/Deferred
- Rejected classification
- Bulk preview
- Reclassification/rollback

If evidence is unavailable, mark blocked rather than guessing.

---

# 19. Security

All new RPCs must:

- Reject anonymous
- Require approved role
- Enforce station scope
- Use safe `search_path`
- Revoke PUBLIC/anon execute
- Audit actions
- Prevent forged IDs
- Respect locked handovers
- Prevent unauthorized bulk correction
- Prevent direct-table workflow bypass

---

# 20. Performance

Do not process the whole database in one synchronous request.

Require:

- Server pagination
- Date/range caps
- Configurable chunk size
- Progress tracking
- Resume support
- Timeout-safe processing
- Query-plan evidence
- Index review
- Idempotent retries

Document tested safe batch size and timings.

---

# 21. Automated Tests

Add tests for:

- Every classification
- Exact/rounding/material/cannot-compare
- Overnight/effective-date boundary
- Missing tariff
- Unapproved correction blocked
- Approved correction and archive
- Locked handover blocked
- Exact rollback
- Duplicate correction blocked
- Idempotent retry
- Unknown historical payment
- Evidence requirement
- Bulk preview
- Pagination beyond 1,000 rows
- Secondary filters
- Full export without truncation
- Legacy redirects
- Anonymous/pending/cross-station denial
- A1–E regression

Run the full test suite and production build.

---

# 22. Production UAT

Run:

- `UAT-F-01` Historical inventory vs direct SQL
- `UAT-F-02` Dry-run comparison
- `UAT-F-03` Approval and self-approval restrictions
- `UAT-F-04` Controlled correction
- `UAT-F-05` Exact rollback
- `UAT-F-06` Locked-handover protection
- `UAT-F-07` Evidence-based metadata repair
- `UAT-F-08` Historical payment pilot
- `UAT-F-09` Pagination beyond 1,000 rows
- `UAT-F-10` Secondary filters
- `UAT-F-11` Legacy report retirement
- `UAT-F-12` Full Excel/PDF export
- `UAT-F-13` Role/station/direct API security
- `UAT-F-14` Performance/chunking
- `UAT-F-15` A1–E regression

Use direct SQL evidence for counts and JOD totals. Tolerance: `0.001 JOD`; counts exact.

---

# 23. Final Stabilization

Before closure:

- Reconcile migration history
- Regenerate database types
- Verify no secrets committed
- Remove active staging references
- Clean/deactivate UAT users/fixtures while preserving audit references
- Verify final feature flags
- Verify report navigation
- Verify full build/test suite
- Verify rollback scripts
- Verify no historical mass change outside approved pilot

---

# 24. Deliverables

Create:

1. `EV_CHARGING_SYSTEM_PHASE_F_IMPLEMENTATION_AND_UAT_REPORT.md`
2. `EV_CHARGING_SYSTEM_PHASE_F_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
3. Historical inventory report
4. Comparison RPCs/schema
5. Correction queue and archive
6. Approval/correction/rollback RPCs
7. Historical payment governance
8. Handover-readiness reports
9. Metadata-repair workflow
10. Pagination and filters
11. Export hardening
12. Legacy retirement matrix
13. Tests
14. Performance evidence
15. Activation ledger
16. Rollback scripts
17. Migration-history reconciliation
18. Final stabilization checklist

---

# 25. Implementation Report Structure

1. Executive Summary
2. Phase E Gate
3. Historical Inventory
4. Classification
5. Comparison Architecture
6. Correction Queue
7. Approval Governance
8. Correction Application
9. Archive and Rollback
10. Payment Governance
11. Handover Readiness
12. Metadata Repair
13. Reporting Hardening
14. Legacy Retirement
15. Security
16. Performance
17. Migrations
18. UI/UX
19. Tests
20. Activation Plan
21. Rollback
22. Changed Files
23. Risks
24. Acceptance Checklist

End:

> **Phase F Implementation Status:** PASS / FAIL / BLOCKED  
> **Phase F Production Activation Authorization:** AUTHORIZED / NOT AUTHORIZED

---

# 26. Closure Report Structure

1. Executive Summary
2. Implementation Gate
3. Production Preflight
4. Inventory Results
5. Comparison Results
6. Pilot Corrections
7. Rollback
8. Locked-Handover Protection
9. Metadata Repair
10. Historical Payment Pilot
11. Pagination and Filters
12. Legacy Retirement
13. Export Verification
14. Security
15. Performance
16. A1–E Regression
17. Migration History
18. Final Feature Flags
19. Fixes
20. Changed Production Objects
21. Remaining Risks
22. Acceptance Checklist
23. Final Recommendation

End:

> **Phase F Final Closure Status:** PASS / FAIL / BLOCKED  
> **EV Charging System Program Status:** PRODUCTION CLOSED / REQUIRES FURTHER WORK

---

# 27. Acceptance Criteria

Phase F closes only when:

1. Historical inventory complete
2. Records classified or marked cannot-compare
3. Dry-run comparison works
4. No unapproved correction
5. Archive immutable
6. Pilot correction passes
7. Rollback restores exact originals
8. Locked-handover correction blocked
9. Metadata repair evidence-based
10. Historical payment not guessed
11. Unknown/Deferred supported
12. No historical handover auto-created
13. Pagination removes truncation risk
14. Secondary filters work
15. Full exports complete
16. Unsafe legacy reports redirected/hidden/labeled
17. Reporting v2 authoritative
18. Security passes
19. Performance acceptable
20. A1–E regressions pass
21. No unapproved mass change
22. Migration history reconciled
23. Full tests/build pass
24. Reports complete
25. Remaining risks documented

---

# 28. Stop Conditions

Stop if:

- Backup unavailable
- Wrong production project
- Phase E not closed
- Dry-run mutates financial data
- Historical tariff evidence insufficient
- Approval queue can be bypassed
- Unapproved correction succeeds
- Locked handover can be changed
- Original history not preserved
- Payment method would be guessed
- Safe chunking unavailable
- Export truncation remains
- Unsafe legacy reports remain authoritative
- Any A1–E regression occurs
- Rollback unavailable

---

# 29. Final Instruction

Implement Phase F audit, comparison, governed correction, payment-classification governance, reporting hardening, legacy retirement, production activation, UAT, and closure in this one prompt.

Close Phase F only when every acceptance criterion passes.

Do not guess historical payment methods.
Do not auto-create historical handovers.
Do not mass-correct without explicit approval.
Do not activate OCPP.
Do not add tax or Demand Charge.
Do not weaken security, audit, archives, or locked financial protections.
