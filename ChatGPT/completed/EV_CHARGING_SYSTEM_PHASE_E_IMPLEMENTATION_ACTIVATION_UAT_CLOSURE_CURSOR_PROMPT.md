# CURSOR IMPLEMENTATION PROMPT — EV CHARGING SYSTEM PHASE E IMPLEMENTATION + PRODUCTION ACTIVATION + UAT + FINAL CLOSURE

## Phase Code

`EV-E`

## Phase Name

**Authoritative Reporting, Reconciliation, Dashboards, Locked-Handover Outputs, Excel/PDF Export Integrity, and Production Closure**

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Production Supabase Project

```text
Project Ref: qflxupfeyktdrpilctyo
Environment: PRIMARY / LIVE / PRODUCTION
Timezone: Asia/Amman
Currency: JOD
```

## Governing Files

Read and follow:

- `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_A2_PRODUCTION_DEPLOYMENT_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_B_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_B_PRODUCTION_CLOSURE_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_C_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_C_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_D_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_D_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_D_FINAL_GAP_CLOSURE_UAT_REPORT.md`
- All current migrations, RPCs, reports, dashboards, export utilities, generated types, audit events, feature flags, and rollback scripts

---

# 1. Combined Objective

This prompt must complete Phase E in one controlled sequence:

```text
Phase E audit and design confirmation
→ Phase E implementation
→ production-safe activation
→ automated and runtime UAT
→ reconciliation verification
→ export verification
→ closure if and only if every gate passes
```

Phase E must deliver:

1. One authoritative reporting layer.
2. Correct dashboards and summary KPIs.
3. Payment-method reporting for Cash, Card, and CliQ.
4. Physical cash-handover reporting.
5. Shortage, surplus, and adjustment reporting.
6. Locked-handover reporting.
7. Import and billing reconciliation.
8. Shift/operator/station reconciliation.
9. Excel and PDF export integrity.
10. Drill-down from summaries to source transactions.
11. Role and station-scoped reporting.
12. Historical-vs-v2 separation.
13. Exception and unreconciled-data reporting.
14. No reliance on unsafe mutable summary fields.
15. Production activation, UAT, and closure in this same prompt.

Do not start Phase F.

---

# 2. Mandatory Phase D Closure Gate

Before changing anything, verify:

1. Phase D final closure report status is `PASS`.
2. A1 duplicate billing groups remain zero.
3. A2 RLS and RPC security remain active.
4. Billing engine v2 remains enabled.
5. Import workflow v2 remains enabled.
6. Payment workflow remains enabled.
7. Handover workflow remains enabled.
8. Demand Charge remains zero.
9. Tax remains zero.
10. Current production project is exactly `qflxupfeyktdrpilctyo`.
11. Production backup/PITR is available.
12. No unresolved production incident exists.
13. Current report pages and export paths are inventoried.
14. Current report queries are traced to their real source tables.
15. No report change is allowed to alter authoritative financial data.

If any critical prerequisite fails, stop and produce a blocker report.

---

# 3. Absolute Scope Limit

## Included

- Report architecture audit
- Authoritative reporting views/RPCs
- Dashboard KPI corrections
- Billing/payment/handover reconciliation
- Cash/Card/CliQ reporting
- Shortage/surplus reporting
- Adjustment reporting
- Locked-handover reporting
- Import/billing/payment exception reports
- Role/station report security
- Excel export
- PDF export
- Drill-down links
- Date/operator/station/payment/status filters
- Historical/v2 distinction
- Runtime UAT
- Production activation
- Closure report
- Specific correction of mutable shift-summary use in reports

## Excluded

Do not:

- Recalculate historical billing
- Rewrite historical payment allocations
- Auto-create historical handovers
- Activate OCPP
- Add tax
- Add Demand Charge
- Add new payment methods
- Implement external bank settlement integration
- Implement card gateway reconciliation APIs
- Implement CliQ API integration
- Build a full accounting ledger
- Start Phase F historical correction
- Redesign unrelated operational modules

---

# 4. Core Reporting Principle

Every report must identify and use the correct authoritative source.

## Authoritative Financial Sources

### Energy and Billing

Use:

- `charging_sessions`
- `billing_calculations`
- `billing_breakdown_items`

Do not use stale calculated-cost fallbacks.

### Payment Methods

Use:

- `session_payment_allocations`

Do not infer payment method from RFID/card identity.

### Cash Handover

Use:

- `cash_handovers`
- `cash_handover_sessions`
- `cash_handover_adjustments`
- `cash_handover_events`

### Import Integrity

Use:

- `import_batches`
- session source relationships
- file hash
- source transaction ID
- parser/import status

### User/Station Scope

Use:

- `user_profiles`
- `user_station_access`
- approved role and station-scope helpers

## Mutable Shift Totals Warning

`shifts.total_kwh` and `shifts.total_amount_jod` may be mutable operational aggregates.

Do not use them as the authoritative financial source for locked-handover or final revenue reports.

For locked financial reporting, derive from the locked handover snapshot and linked billing/payment allocations.

If shift totals are displayed, clearly label them as operational aggregates and reconcile them against authoritative sources.

---

# 5. Phase E Current-State Audit

Before implementation, inspect:

- All dashboard components
- All report pages
- All report services
- All export utilities
- All PDF generators
- All Excel/CSV generators
- All summary RPCs
- All chart data sources
- All accountant/operator reports
- All shift reports
- All legacy demand/tax fields
- All direct reads from mutable summary columns
- All hardcoded rates/labels
- All client-side aggregation
- All places that may double-count joined rows
- All places that may omit overnight/next-day sessions
- All role/station filters
- All date filters
- All timezone conversions
- All places where historical legacy billing and v2 billing are mixed

Create an audit matrix:

| Report/Widget | Current Source | Risk | Correct Source | Action |
|---|---|---|---|---|

Do not implement until the audit is documented.

---

# 6. Authoritative Reporting Layer

Create server-side reporting views and/or RPCs.

Recommended components:

- `report_revenue_summary`
- `report_payment_method_summary`
- `report_cash_handover_summary`
- `report_handover_detail`
- `report_operator_shift_summary`
- `report_station_daily_summary`
- `report_import_reconciliation`
- `report_billing_reconciliation`
- `report_payment_reconciliation`
- `report_exception_summary`
- `report_locked_handover_snapshot`
- `report_historical_engine_comparison`

Names may follow repository conventions.

All reporting objects must:

- Respect RLS or enforce authorization in RPC body
- Use safe `search_path`
- Reject anonymous where appropriate
- Enforce approved role
- Enforce station scope
- Avoid N+1 query patterns
- Support pagination
- Support date range
- Use `Asia/Amman`
- Use JOD three-decimal precision
- Avoid duplicate counting
- Avoid direct client-side financial aggregation where server results are available

---

# 7. Dashboard KPIs

Implement authoritative dashboard KPIs.

Required cards:

- Total energy
- Total billed revenue
- Cash revenue
- Card revenue
- CliQ revenue
- Expected physical cash
- Actual cash received
- Shortage
- Surplus
- Approved adjustments
- Unassigned payment count
- Unreconciled handover count
- Billing failure count
- Import exception count
- Locked handover count
- Pending approval count

Each KPI must:

- Show selected date range
- Show selected station/operator where applicable
- Use authoritative source
- Show loading/error/empty states
- Support drill-down
- Avoid double-counting sessions across joins

Do not show Demand Charge or tax.

---

# 8. Revenue Reconciliation

For every selected scope:

```text
Authoritative Billing Total
= Cash Total + Card Total + CliQ Total + Unassigned Payment Total
```

For finalized/locked scope:

```text
Unassigned Payment Total = 0
```

For handover scope:

```text
Expected Physical Cash
= Cash Allocations
+ Approved Positive Cash Adjustments
- Approved Negative Cash Adjustments
```

```text
Difference
= Actual Cash Received - Expected Physical Cash
```

```text
Shortage = max(Expected - Actual, 0)
Surplus  = max(Actual - Expected, 0)
```

Display reconciliation state:

- Reconciled
- Unassigned
- Payment mismatch
- Billing missing
- Handover missing
- Handover pending
- Handover rejected
- Locked
- Historical legacy
- Exception

---

# 9. Required Report Set

## 9.1 Daily Station Summary

Include date, station, session count, energy, billing, Cash, Card, CliQ, unassigned, expected cash, actual cash, shortage, surplus, and handover status.

## 9.2 Operator Shift Report

Include operator, shift, start/end, sessions, energy, billing, payment breakdown, expected/actual cash, shortage/surplus, adjustments, handover number/status/version, and lock details.

## 9.3 Payment Method Report

Include transaction, session date/time, operator, station, billing amount, payment method, reference, assignment source, assignment actor/time, and handover number/status.

## 9.4 Cash Handover Report

Include handover number, station/operator/shift, billing total, Cash/Card/CliQ, expected cash, actual cash, shortage/surplus, adjustments, submit/approve/lock/reopen history, version, included sessions, and locked snapshot.

## 9.5 Import Reconciliation Report

Include file name, hash, batch, operator/card match, parsed count, posted count, duplicate count, invalid count, billed count, billing failures, batch status, and exception details.

## 9.6 Billing Reconciliation Report

Include session/transaction ID, engine version, billing source, billing total, breakdown sum, difference, demand, tax, payment assignment, handover link, and exception status.

## 9.7 Exceptions Report

Include missing billing, missing payment method, payment mismatch, missing operator, missing station, invalid import relationship, billing failure, handover mismatch, locked-report discrepancy, legacy engine record, non-zero demand, and non-zero tax.

---

# 10. Locked Handover Reporting

Locked-handover reports must use the locked snapshot.

Required:

- Snapshot session list
- Snapshot payment method
- Snapshot amount
- Locked expected cash
- Locked actual cash
- Locked shortage/surplus
- Locked adjustment values
- Version
- Actor/date history

Do not refresh a locked report from mutable live allocations in a way that changes historical locked results.

If current live values differ from the locked snapshot, show:

```text
Current value differs from locked snapshot
```

Do not silently replace the snapshot.

---

# 11. Historical Data Handling

Do not combine historical legacy and v2 data without labeling.

Add/report:

- `legacy`
- `ev-b-v2.0.0`
- unknown/missing version

Historical reports should:

- Show engine version
- Show unassigned payment status
- Exclude unclassified history from finalized payment/handover totals
- Allow read-only comparison
- Avoid automatic correction

Phase F will handle historical correction.

---

# 12. Filters and Drill-Down

Required filters:

- Date range
- Station
- Operator
- Shift
- Payment method
- Handover status
- Import status
- Billing engine version
- Exception type
- Locked/unlocked
- Reconciled/unreconciled

Required drill-down:

```text
Dashboard KPI
→ report summary
→ operator/shift/handover
→ transaction/session
→ billing breakdown/payment allocation/audit
```

Preserve filter context where practical.

---

# 13. Timezone and Date Rules

Use `Asia/Amman`.

Requirements:

- Correct local-date grouping
- Overnight sessions handled correctly
- Shift date follows approved Phase D convention
- No UTC date drift
- Inclusive/exclusive date-range behavior documented
- Month-end and year-end correct

Add tests for overnight, month-end, and year-end.

---

# 14. Excel Export

Create professional Excel exports with:

- Correct filtered dataset
- Report title
- Generated timestamp
- Timezone
- Currency
- Filter summary
- Column headers
- Three-decimal JOD formatting
- Date/time formatting
- Freeze header row
- Auto-filter
- Reasonable column widths
- Totals row
- Reconciliation row
- No Demand Charge
- No tax
- Locked snapshot indication
- Engine version
- Exception indicators

For multi-section reports, use separate worksheets for Summary, Transactions, Payment Methods, Handover, Adjustments, Exceptions, and Audit History.

Do not export secret or service-role-only fields.

---

# 15. PDF Export

Create professional A4 PDF outputs with:

- Clear title
- Station/operator/shift/date scope
- Generated timestamp
- Timezone
- Currency
- Filter summary
- Summary totals
- Payment breakdown
- Expected/actual cash
- Shortage/surplus
- Adjustment summary
- Handover status/version
- Lock/reopen details
- Page numbering
- Repeated table headers
- Three-decimal values
- No clipped columns
- No Demand Charge
- No tax
- Clear exception labels

Locked handover PDF must state:

```text
Locked Financial Snapshot
```

Do not show staging watermark in production.

---

# 16. Report Security Matrix

- System Administrator: all reports and stations
- Operations Manager: authorized stations, operational/handover reports, reconciliation, reopen history
- Accountant: financial/handover reports, payment reconciliation, locked outputs
- Station Manager: assigned station only
- Import Officer: import/operational reports within assigned station and limited payment/handover visibility
- Report Viewer: read-only reports within scope
- Pending/Disabled/Rejected/Anonymous: denied

Enforce server-side.

---

# 17. Performance and Scalability

Reports must support production growth:

- Server-side pagination
- Indexed filters
- Date-range limits where needed
- No loading all sessions into the browser
- Avoid Cartesian joins
- Explain query plans for large reports
- Add indexes only where evidence supports
- Use materialized views only with a safe refresh strategy
- Never use stale materialized data for locked financial reporting without a visible refresh state

Test at current production scale and with safe synthetic larger ranges.

---

# 18. Phase E Feature Flag

Create/use:

```text
reporting_v2_enabled=false
```

Activation plan:

1. Deploy reporting schema.
2. Deploy frontend.
3. Enable for System Administrator only.
4. Compare old and new reports.
5. Verify totals.
6. Enable for Accountant/Operations Manager.
7. Enable for scoped viewers.
8. Keep rollback to old reports temporarily.
9. Remove old report path only after closure approval.

---

# 19. Suggested SQL Migrations

Create controlled migrations such as:

1. `*_e_reporting_foundation.sql`
2. `*_e_revenue_reconciliation_views.sql`
3. `*_e_handover_reporting_views.sql`
4. `*_e_import_billing_exception_views.sql`
5. `*_e_reporting_rpcs_security.sql`
6. `*_e_reporting_indexes.sql`
7. `*_e_reporting_feature_flag.sql`
8. `*_e_locked_shift_aggregate_guard_or_label.sql`

The last migration must ensure mutable shift totals are not treated as authoritative financial totals.

---

# 20. Automated Tests

Add tests for:

- Billing/payment/handover reconciliation
- Cash-only expected cash
- Positive/negative adjustments
- Shortage/surplus
- No duplicate counting
- Multi-adjustment handovers
- Reopened versions
- Multiple batches in one shift
- Multiple shifts in one batch
- Overnight/month-end/year-end
- Cross-station denial
- Report Viewer read-only
- Pending/anonymous denial
- Legacy/v2 labeling
- Excel/PDF total and filter parity
- Locked snapshot labels

---

# 21. Production UAT Dataset

Use existing authoritative fixtures read-only where safe:

- Overnight transaction `1573323579`
- Mohammad boundary transactions
- Phase C transactional import soak batch
- Phase D mixed-payment handover
- Phase D shortage/surplus/adjustment/reopen fixtures

Do not alter these records.

---

# 22. Production Activation UAT

Run:

- UAT-E-01 Dashboard totals vs direct SQL
- UAT-E-02 Payment reconciliation
- UAT-E-03 Locked handover snapshot
- UAT-E-04 Shortage/surplus
- UAT-E-05 Adjustments
- UAT-E-06 Import reconciliation
- UAT-E-07 Billing reconciliation
- UAT-E-08 Overnight/boundary local-date grouping
- UAT-E-09 Excel export parity
- UAT-E-10 PDF export and visual layout
- UAT-E-11 Role matrix
- UAT-E-12 Cross-station isolation
- UAT-E-13 Performance
- UAT-E-14 A1/A2/B/C/D regression

---

# 23. Direct SQL Reconciliation Evidence

For every major report, produce:

- Report total
- Direct SQL total
- Difference
- Expected tolerance
- Pass/fail

Money tolerance:

```text
0.001 JOD
```

Counts must match exactly.

---

# 24. Excel/PDF Closure Evidence

For each export record:

- Source report
- Applied filters
- Row count
- SQL row count
- Total
- SQL total
- Difference
- File generated
- Opened successfully
- No clipped/missing critical fields
- No Demand Charge
- No tax
- Correct timezone/currency
- Locked snapshot label where relevant

---

# 25. Rollback

Prepare:

```text
scripts/production/e_disable_reporting_v2.sql
scripts/production/e_reporting_activation_ledger.json
scripts/production/e_reconciliation_verification.sql
```

Rollback must disable `reporting_v2_enabled`, restore prior report navigation, preserve new views/evidence, and never alter billing/payment/handover records.

Test disable and re-enable.

---

# 26. Required Deliverables

Create:

1. `EV_CHARGING_SYSTEM_PHASE_E_IMPLEMENTATION_AND_UAT_REPORT.md`
2. `EV_CHARGING_SYSTEM_PHASE_E_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
3. Reporting migrations
4. Reporting services/components
5. Excel export utilities
6. PDF export utilities
7. Automated tests
8. Direct SQL reconciliation scripts
9. Performance evidence
10. Activation ledger
11. Rollback script
12. Updated generated database types
13. Report architecture documentation

---

# 27. Phase E Implementation Report Structure

1. Executive Summary
2. Phase D Gate
3. Current-State Audit
4. Authoritative Source Matrix
5. Reporting Architecture
6. Dashboard KPIs
7. Revenue Reconciliation
8. Required Report Set
9. Locked Handover Reporting
10. Historical Data Handling
11. Filters and Drill-Down
12. Timezone Handling
13. Excel Export
14. PDF Export
15. Security
16. Performance
17. SQL Migrations
18. UI/UX
19. Automated Tests
20. Production Activation Plan
21. Rollback
22. Changed Files
23. Remaining Risks
24. Acceptance Checklist

End with:

> **Phase E Implementation Status:** PASS / FAIL / BLOCKED  
> **Phase E Production Activation Authorization:** AUTHORIZED / NOT AUTHORIZED

---

# 28. Phase E Closure Report Structure

1. Executive Summary
2. Implementation Gate
3. Production Preflight
4. Activation
5. Dashboard Reconciliation
6. Payment Method Reconciliation
7. Cash Handover Reconciliation
8. Shortage/Surplus/Adjustments
9. Import Reconciliation
10. Billing Reconciliation
11. Locked Snapshot Verification
12. Historical/Legacy Labeling
13. Overnight/Timezone Verification
14. Excel Export Verification
15. PDF Export Verification
16. Role and Station Security
17. Performance
18. A1/A2/B/C/D Regression
19. Rollback Verification
20. Fixes Applied
21. Changed Production Objects
22. Remaining Risks
23. Acceptance Checklist
24. Final Recommendation

End with:

> **Phase E Final Closure Status:** PASS / FAIL / BLOCKED  
> **Phase F Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.

---

# 29. Phase E Acceptance Criteria

Phase E may close only when:

1. Authoritative report source matrix completed
2. No financial report relies on stale `calculated_cost`
3. Locked reports use locked snapshots
4. Mutable shift totals are not used as authoritative financial totals
5. Dashboard totals match SQL
6. Billing reconciliation matches to 0.001
7. Payment reconciliation matches to 0.001
8. Cash handover totals match to 0.001
9. Shortage/surplus reports match
10. Adjustments report correctly
11. Import reconciliation matches
12. Exception reporting works
13. Historical legacy data is clearly labeled
14. Overnight/local-date grouping is correct
15. Excel exports match report and SQL
16. PDF exports match report and SQL
17. No Demand Charge appears
18. No tax appears
19. Role/station security passes
20. Anonymous/pending access denied
21. Pagination/performance acceptable
22. Feature-flag rollback passes
23. A1/A2/B/C/D regressions pass
24. No historical mass change
25. Both reports complete

---

# 30. Stop Conditions

Stop immediately if:

- Production backup unavailable
- Wrong project reference
- Phase D closure not PASS
- Report totals differ from SQL beyond tolerance
- Locked reports change when live allocations change
- Duplicate joins inflate totals
- Card/CliQ enter physical cash
- Demand Charge or tax reappears
- Cross-station reporting leaks data
- Anonymous or pending user can access protected reports
- Export totals differ from on-screen totals
- Historical rows are modified
- Any Phase A1/A2/B/C/D regression occurs
- Rollback unavailable

---

# 31. Final Instruction

Execute Phase E implementation, controlled production activation, full UAT, and closure in this one prompt.

Close Phase E only if every acceptance criterion passes.

Do not start Phase F.

Do not recalculate historical billing.

Do not assign historical payment methods automatically.

Do not create historical handovers automatically.

Do not activate OCPP.

Do not add tax.

Do not add Demand Charge.

Do not weaken security, audit, or locked financial snapshots.
