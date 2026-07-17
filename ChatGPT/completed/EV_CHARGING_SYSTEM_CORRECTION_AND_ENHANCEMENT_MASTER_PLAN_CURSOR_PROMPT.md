# CURSOR MASTER PROMPT — EV CHARGING SYSTEM CORRECTION AND ENHANCEMENT MASTER PLAN

## Project Location

Repository:

`C:\dev\EV-DR\EV-Daily-Report`

Sample charging-machine files:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

The sample-files folder will contain the previously reviewed files plus two newly added transaction files that have not previously been imported into the application.

You must inspect every sample file currently present in that folder, including the two new files.

---

# 1. Task Type

This is a **planning-only phase**.

Perform deep technical analysis and create a complete correction and enhancement master plan.

Do not implement the plan.

Do not modify application source code.

Do not apply SQL migrations.

Do not alter the live database.

Do not recalculate production transactions.

Do not delete OCPP code.

Do not change tariff records.

Create or update only:

`EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`

The plan will be reviewed by Sameer before any implementation prompt is issued.

---

# 2. Required Inputs

Read and use all of the following:

1. Complete application repository.
2. All SQL migrations.
3. Current generated Supabase types.
4. All billing, import, shift, operator, rate, reporting, accounting, authentication, and security code.
5. Existing audit report:

   `EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

6. Every machine transaction file in:

   `C:\dev\EV-DR\EV-Daily-Report\sample files`

7. Current implemented UI and workflow.
8. Confirmed business decisions in this prompt.

Do not treat the previous audit as automatically correct.

Verify important findings against the actual code, migrations, and new sample files.

---

# 3. Confirmed Business Workflow

The application is used for manually importing daily EV charging transactions in Jordan.

The real workflow is:

1. An officer downloads a transaction file from the charging machines.
2. One uploaded file normally belongs to one operator and one shift.
3. The user selects the station.
4. The user selects the operator.
5. The user selects or confirms the shift.
6. The file contains the charging transactions and operator card ID.
7. The operator name may appear in the filename.
8. Operator assignment is not derived from the roster.
9. The system validates and imports the transactions.
10. The system must automatically apply the correct government energy tariff.
11. The system must calculate the amount for every transaction.
12. Payment methods are:
    - Cash
    - Card
    - CliQ
13. The system must calculate the operator’s physical cash responsibility.
14. Card and CliQ amounts must not automatically be included in physical cash handover.
15. The system must generate reconciled shift, operator, station, accounting, billing, management, Excel, and PDF reports.

---

# 4. Confirmed Government Tariff Model

The active Jordan government Time-of-Use tariff contains four periods:

| Period | Time | Energy Rate |
|---|---|---:|
| Off-Peak | 05:00–14:00 | 0.183 JOD/kWh |
| Mid-Peak | 14:00–17:00 | 0.193 JOD/kWh |
| Peak | 17:00–23:00 | 0.213 JOD/kWh |
| MID | 23:00–05:00 | 0.193 JOD/kWh |

The duplicate `MID-PEAK 2` period will be removed manually by Sameer.

The plan must assume there should be exactly one active tariff covering every minute of the 24-hour day.

Use half-open interval logic:

- Start time is included.
- End time is excluded.

Examples:

- 05:00 belongs to Off-Peak.
- 14:00 belongs to Mid-Peak.
- 17:00 belongs to Peak.
- 23:00 belongs to MID.
- 00:00 belongs to MID.

---

# 5. Confirmed Demand Charge Decision

Demand Charge is not used.

The application must use only the government energy tariff measured in JOD/kWh.

The final billing rule is:

```text
Energy Charge = Energy Consumed (kWh) × Applicable Government Energy Rate (JOD/kWh)
```

No demand-charge amount may be added.

The plan must include complete removal or controlled retirement of Demand Charge from:

- Tariff UI
- Tariff templates
- Form fields
- Validation
- Application types
- Database functions
- Billing calculations
- Billing breakdowns
- Reports
- Dashboards
- Excel exports
- PDF exports
- Settings
- Tooltips
- Documentation
- Tests

The plan must inspect historical demand-charge columns and determine the safest migration strategy:

1. Immediately remove obsolete columns, or
2. First stop using them and force values to zero, then remove them in a later compatible migration.

The plan must recommend the safer option based on actual dependencies.

Do not retain Demand Charge as an active or optional Jordan billing feature.

---

# 6. Confirmed Tax Decision

No tax is applied to EV charging in this application’s Jordan workflow.

The active calculation must use:

```text
Tax = 0
```

The plan must determine whether to:

- Remove tax from the active charging workflow and UI, while retaining an inactive generic schema for future use, or
- Remove obsolete tax functionality entirely if it is unused everywhere.

Do not propose applying tax.

Do not leave tax as an unresolved business decision.

---

# 7. Current Known Tariff Defect

Current behavior:

1. Transactions are imported.
2. Billing initially shows the Off-Peak rate of `0.183 JOD/kWh`.
3. The user must open Billing.
4. The user selects all transactions.
5. The user clicks Bulk Recalculate.
6. Only after this manual action may the correct tariff be applied.

This is incorrect.

Target behavior:

- The correct tariff must be determined automatically during the controlled import/posting workflow.
- The user must not need Bulk Recalculate after a normal successful import.
- Bulk Recalculate must remain only as an authorized correction tool.
- Failed tariff matching must block financial posting and create a visible exception.
- Every stored billing result must identify the tariff structure, tariff period, applied rate, calculation version, and calculation timestamp.

The plan must identify and address both known incorrect values:

- `0.183 JOD/kWh` applied by the current import-time billing path.
- `0.150` hardcoded fallback currently stored during import.

---

# 8. Critical Overnight and Next-Day Requirement

The application must correctly understand sessions that begin on one calendar day and finish on the next day.

Mandatory example:

```text
Start: 2026-07-20 23:40:00 Asia/Amman
Finish: 2026-07-21 00:30:00 Asia/Amman
```

The system must understand that:

- The start date is 20 July.
- The finish date is 21 July.
- The finish time is not earlier than the start time.
- The session duration is 50 minutes.
- The session crosses midnight.
- Both 23:40 and 00:30 fall in the same MID tariff period under the current tariff schedule.
- The full transaction should therefore use the MID rate of `0.193 JOD/kWh`, unless the approved billing engine splits sessions for another reason.
- The system must never create a negative duration.
- The system must never incorrectly change the end date back to the start date.
- The transaction must be assigned to the correct shift date based on an explicitly defined shift-date convention.
- Daily reports must avoid losing or double-counting the session.
- Date filters must use complete timestamps, not time-of-day alone.

Mandatory additional examples:

### Same overnight tariff

```text
23:40 on Day 1 → 00:30 on Day 2
```

Expected tariff: MID for the entire session.

### Cross from MID to Off-Peak

```text
04:50 → 05:10
```

The plan must define the selected approved method:

- Start-time tariff, or
- Proportional time-based split.

Do not silently choose without documenting the current implementation and recommendation.

### Cross from Peak to MID

```text
22:50 → 23:10
```

The plan must explain handling across the 23:00 boundary.

### Multi-period long session

```text
13:50 → 17:10
```

This crosses:

- Off-Peak
- Mid-Peak
- Peak

The plan must explain how calculation, breakdown, rounding, reporting, and audit history will work.

### Same-time and invalid examples

Plan validations for:

- Stop timestamp equals start timestamp.
- Stop timestamp is genuinely before start timestamp.
- Missing timezone.
- Mixed timezone offsets.
- More than 24-hour session.
- Daylight/date boundary assumptions.
- Month-end and year-end crossings.

Jordan timezone must be handled consistently using:

`Asia/Amman`

Do not use browser-local timezone implicitly.

---

# 9. Tariff Timeline UI Bug

Current UI bug:

- The overnight period `23:00–05:00` extends outside the visible 24-hour schedule.

The plan must include a full correction for the tariff timeline.

Correct visual behavior:

- Store the overnight tariff as one logical database record.
- Render it as two visual segments:
  - `23:00–24:00`
  - `00:00–05:00`
- Keep both segments linked to the same tariff record.
- Never position a tariff block beyond hour 24.
- Eliminate accidental horizontal overflow.
- Keep hour labels aligned.
- Support responsive widths.
- Show gaps and overlaps.
- Prevent saving invalid daily coverage.
- Show a complete coverage indicator.
- Preserve accessibility and keyboard use.
- Ensure the template preview and editable timeline use identical rendering logic.

The plan must inspect the actual timeline component and identify:

- Current width formula
- Current left-position formula
- Current overnight logic
- Why the block overflows
- Which component and utility should own interval splitting
- Required unit and UI tests

---

# 10. Two New Sample Files

Two new files will be placed in:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

These files were not previously uploaded to the system.

The plan must require their use for:

- Fresh-import testing
- Duplicate testing
- Tariff testing
- Operator/card matching
- Shift assignment
- Payment-method workflow design
- Billing verification
- Report reconciliation
- UAT

Cursor must:

1. List all sample files found.
2. Identify which appear to be the two new files.
3. Inspect every row of the new files.
4. Record:
   - Filename
   - Operator implied by filename
   - Card ID
   - Transaction count
   - Start and stop timestamp ranges
   - Transactions crossing midnight
   - Transactions crossing tariff boundaries
   - Duplicate transaction IDs
   - Unknown charge points
   - Invalid SOC values
   - Missing values
   - Date/time anomalies
5. Recommend exact UAT scenarios using specific transaction IDs from those files.
6. Never import them into production during planning.
7. Use them later in a disposable or approved test environment only.

---

# 11. Planning Objectives

Create a complete correction and enhancement plan covering:

- Database schema
- SQL migrations
- Missing RPC definitions
- Import workflow
- Sample-file parsing
- Operator and card validation
- Station and shift relationships
- Duplicate protection
- File idempotency
- Transactional posting
- Automatic tariff matching
- Overnight and next-day sessions
- Tariff boundary splitting
- Tariff timeline UI
- Removal of Demand Charge
- Zero-tax Jordan workflow
- JOD decimal precision
- Payment methods
- Operator cash handover
- Financial finalization
- Historical corrections
- Security and RLS
- Roles and permissions
- Audit logs
- Reporting and reconciliation
- TypeScript errors
- Runtime errors
- Automated testing
- UAT
- Backup and rollback
- Performance
- Production hardening
- OCPP isolation as deferred

---

# 12. Planning Standards

For every recommended change, provide:

- Current behavior
- Confirmed defect or gap
- Evidence
- Root cause
- Target behavior
- Data-model impact
- SQL migration impact
- Backend impact
- Frontend impact
- Report impact
- Security impact
- Historical-data impact
- Test requirements
- UAT requirements
- Rollback requirements
- Acceptance criteria
- Dependencies
- Risks
- Business decision required, if any

Clearly distinguish:

- Confirmed fact
- Inference
- Recommendation
- Business decision
- Deferred item

Do not invent live RPC bodies.

If a function exists in the live database but not in migrations, require extraction of its real SQL definition before replacement.

---

# 13. Required Database and SQL Planning

The plan must include detailed SQL migration design, but must not execute it.

Cover at minimum:

## 13.1 Migration Reproducibility

- Capture missing RPC definitions.
- Add missing table migrations.
- Align migrations with generated Supabase types.
- Create a disposable migration verification process.
- Define migration order.
- Define rollback or compensating migrations.

## 13.2 Billing Uniqueness

Plan a safe migration for:

- Detecting duplicate `billing_calculations` records.
- Selecting the authoritative record.
- Preserving or archiving removed duplicates.
- Adding a unique constraint on `session_id`.
- Changing billing writes to UPSERT or transactional replacement.
- Preventing concurrent duplicates.

## 13.3 Payment Method

Plan fields and constraints for:

```text
cash
card
cliq
```

Determine whether payment method belongs primarily on:

- Charging session
- Payment allocation child table
- Import row
- Shift transaction allocation

The plan must support the possibility that one transaction could later have split payment, even if the first implementation uses one payment method per transaction.

Recommend the simplest safe model for current requirements without blocking future enhancement.

## 13.4 Handover

Plan fields or tables for:

- Gross billed amount
- Cash total
- Card total
- CliQ total
- Expected cash
- Actual cash
- Shortage
- Surplus
- Adjustment
- Refund
- Approval status
- Approved by
- Approved at
- Locked at
- Reopened by
- Reopen reason
- Version
- Audit history

Determine whether these should live in:

- `shifts`, or
- Dedicated `shift_handovers` and `shift_handover_adjustments` tables.

Recommend the more auditable design.

## 13.5 Tariff Versioning

Plan for:

- Effective dates
- Immutable historical versions
- Active version
- Complete 24-hour coverage
- No overlap
- No gap
- Priority if still required
- Station relationship
- Tariff period identifier
- Applied tariff snapshot on billing
- Calculation engine version

## 13.6 Remove Demand Charge

Identify all relevant columns and dependencies.

Plan safe handling for fields such as:

- `demand_charge_per_kw`
- `demand_charge`
- `max_demand_kw`

Recommend:

- Immediate drop, or
- Deprecate → zero → remove.

Include data migration, type regeneration, report cleanup, and rollback.

## 13.7 Tax

Plan the Jordan workflow with tax fixed at zero.

Do not create tax lines in active billing breakdowns.

## 13.8 Audit Log

Plan append-only audit records for:

- Import approval
- Operator override
- Card mismatch override
- Tariff calculation
- Recalculation
- Payment-method change
- Handover submission
- Approval
- Reopening
- Historical correction
- Record deletion
- Role/security changes

---

# 14. Automatic Tariff Engine Planning

The target must have one authoritative calculation engine.

The plan must compare these architecture options:

1. PostgreSQL RPC / database function
2. Supabase Edge Function
3. Trusted application backend
4. Current client-side calculation

Recommend one authoritative approach based on the existing architecture.

The authoritative engine must:

- Accept a session timestamp range.
- Use `Asia/Amman`.
- Resolve the tariff version effective on the transaction date.
- Resolve one or more tariff periods.
- Support midnight.
- Support next-day finish timestamps.
- Support month-end and year-end.
- Use exact interval boundaries.
- Produce a deterministic calculation breakdown.
- Use JOD three-decimal precision.
- Reject missing tariff coverage.
- Reject overlapping active tariff periods.
- Be idempotent.
- Store calculation version.
- Store tariff IDs and applied rates.
- Support controlled recalculation.
- Prevent recalculation after locked handover unless reopened.

## 14.1 Cross-Period Business Rule

The previous audit indicates the existing client-side engine proportionally allocates total energy by duration across tariff periods.

The plan must compare:

### Option A — Start-Time Tariff

All energy uses the tariff active when the session begins.

### Option B — Proportional Duration Split

Total energy is allocated across periods based on time spent in each period.

Example:

```text
16:50–17:10
10 minutes Mid-Peak
10 minutes Peak
Energy split 50% / 50%
```

The sample files provide total session energy, not interval meter readings.

Therefore, proportional duration splitting is an estimate when charging power varies during the session.

The plan must:

- Document current implementation.
- Document advantages and risks of each option.
- Recommend one.
- Mark final selection as requiring Sameer’s approval if not legally or contractually confirmed.
- Design the engine so the selected rule is explicit and versioned.

## 14.2 Same Overnight Period

For:

```text
23:40 Day 1 → 00:30 Day 2
```

Both timestamps are in MID.

The engine should not create two different charges merely because the calendar date changes, unless the tariff version changes at midnight.

If a tariff version becomes effective at midnight, the engine must split at the effective-date boundary.

---

# 15. Import Workflow Planning

Design the corrected import workflow:

```text
Select Station
→ Select Operator
→ Select Shift
→ Select File
→ Parse
→ Validate
→ Detect Duplicates
→ Confirm Operator/Card Match
→ Review Transactions
→ Assign Payment Method
→ Preview Tariff and Billing
→ Resolve Exceptions
→ Approve
→ Transactional Posting
→ Create/Link Shift
→ Calculate Shift Totals
→ Generate Audit Records
```

Plan:

- Original file retention
- File checksum
- Import-batch idempotency key
- Row checksum
- Duplicate detection inside file
- Duplicate detection in DB
- Concurrent import protection
- Atomic transaction
- Failure rollback
- Retry safety
- Cancel behavior
- Import draft
- Approval status
- Posting status
- Error rows
- Rejected rows
- Corrected rows
- Authorized override

## Operator/Card Rule

The file card ID must be compared with the selected operator’s registered card.

Plan configurable outcomes:

- Exact match: proceed.
- Missing registered card: require review.
- Mismatch: block by default.
- Authorized override: require permission, reason, and audit record.

Do not derive the operator from roster.

---

# 16. Payment Method Planning

The machine files do not contain payment method.

The plan must propose the simplest correct workflow.

Required capabilities:

- Bulk assign one method to selected transactions.
- Assign per transaction.
- Filter Cash/Card/CliQ/Unassigned.
- Show counts, energy, and amount by method.
- Prevent financial approval while any transaction is unassigned.
- Record who assigned or changed payment method.
- Require reason for changes after posting.
- Preserve history.

Determine whether an uploaded file can contain mixed payment methods.

If the business rule is not yet confirmed, design the UI and schema to support mixed methods safely.

---

# 17. Handover and Financial Finalization Planning

Target operator cash formula:

```text
Expected Physical Cash
= Cash Transaction Total
− Approved Cash Refunds
+ Approved Cash Adjustments
```

Card and CliQ must be displayed but excluded from physical cash.

Plan a controlled workflow such as:

```text
Draft
→ Reviewed
→ Submitted
→ Approved
→ Handed Over
→ Locked
```

Plan:

- Actual cash received
- Shortage
- Surplus
- Notes
- Approval
- Rejection
- Reopen
- Adjustment
- Locking
- Versioning
- Audit trail
- Permission matrix
- Recalculation restrictions

A locked handover must not silently change if a transaction is later recalculated.

Historical correction must create an adjustment or controlled reopen workflow.

---

# 18. Security and RLS Planning

Plan replacement of open policies such as:

```sql
USING (true)
WITH CHECK (true)
```

Define a minimum role model:

- System Administrator
- Operations Manager
- Station Manager
- Import Officer
- Accountant
- Report Viewer

Plan permissions for:

- Station access
- Import
- Operator selection
- Override
- Tariff management
- Billing recalculation
- Payment-method assignment
- Handover creation
- Handover approval
- Handover reopening
- Historical corrections
- Reports
- Exports
- User management
- Audit log viewing

Plan server-side enforcement using:

- RLS
- RPC checks
- Database constraints
- UI visibility only as secondary protection

Plan admin approval for new user accounts or removal of open self-registration.

---

# 19. Report and Reconciliation Planning

Every monetary output must use authoritative stored billing results.

Plan unified definitions for:

- Total transactions
- Total energy
- Gross billed amount
- Cash
- Card
- CliQ
- Expected cash
- Actual cash
- Shortage
- Surplus
- Adjustments
- Operator balance
- Shift total
- Station total
- Daily total
- Monthly total

Plan reports:

- Import batch report
- Transaction report
- Tariff-applied report
- Billing breakdown
- Payment-method summary
- Shift summary
- Operator handover
- Cash discrepancy
- Station summary
- Daily report
- Monthly report
- Historical correction report
- Audit report
- Exception report

Reconciliation target:

```text
Billing Total
= Cash + Card + CliQ
```

and:

```text
Expected Physical Cash
= Cash transactions adjusted by approved cash-only corrections
```

and:

```text
Screen Total
= Dashboard Total
= Report Total
= Excel Total
= PDF Total
```

Plan exact JOD rounding and reconciliation tolerance.

---

# 20. Minimum Practical Phase Strategy

The user wants the minimum sensible number of correction phases.

Do not create many tiny phases.

Group tightly connected work together while preserving safety and testability.

You must analyze dependencies and propose the minimum practical phase count.

The recommended plan should aim for approximately **5 to 7 major phases**, unless evidence proves more are essential.

Each phase must be independently reviewable and must include:

- Planning confirmation
- Implementation
- SQL migration
- Type regeneration
- Automated tests
- Runtime UAT
- Rollback
- Completion report

Consider a structure similar to:

## Possible Phase A — Safety, Schema, and Security Foundation

May include:

- Backup
- RPC extraction
- Migration reproducibility
- Billing uniqueness
- Core RLS foundation
- Types alignment

## Possible Phase B — Tariff and Billing Engine

May include:

- Tariff timeline fix
- Complete 24-hour validation
- Overnight and next-day handling
- Automatic tariff engine
- Removal of Demand Charge
- Zero-tax flow
- JOD precision

## Possible Phase C — Import and Operational Relationships

May include:

- New sample files
- Validation
- Idempotency
- Operator/card matching
- Shift assignment
- Transactional posting

## Possible Phase D — Payment and Handover

May include:

- Cash/Card/CliQ
- Handover
- Locking
- Adjustments
- Approval
- Audit trail

## Possible Phase E — Reports, UI, and Reconciliation

May include:

- KPI unification
- Reports
- Excel/PDF
- Exception screens
- Workflow usability

## Possible Phase F — Full Test, UAT, and Historical Correction

May include:

- Automated test suite
- Real sample UAT
- Security UAT
- Historical comparison
- Controlled recalculation
- Production release

This is only a candidate grouping.

Cursor must confirm or improve it based on actual code dependencies.

Do not automatically use the older 12-phase roadmap.

---

# 21. Required Plan Deliverable

Create or update only:

`EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`

---

# 22. Required Plan Structure

## 1. Executive Summary

Include:

- Current condition
- Confirmed business decisions
- Main production blockers
- Recommended minimum phase count
- Recommended implementation order

## 2. Confirmed Scope

Include:

- Daily machine-file import
- Tariff
- Billing
- Payment methods
- Handover
- Reports
- Security
- Testing
- Historical correction
- OCPP deferred

## 3. Confirmed Business Rules

Include:

- Four tariff periods
- Demand Charge removed
- Tax zero
- Cash/Card/CliQ
- One file normally one operator and one shift
- User-selected operator
- Operator card validation
- Asia/Amman
- Overnight and next-day timestamps

## 4. New Sample File Analysis

Include all existing and new files.

## 5. Current Architecture and Defect Dependency Map

Use Mermaid diagrams.

## 6. Target Architecture

Show:

- Import pipeline
- Authoritative tariff/billing engine
- Payment allocation
- Handover
- Reports
- Security

## 7. Tariff and Time Handling Design

Include:

- 24-hour coverage
- Half-open boundaries
- Overnight rendering
- Next-day session logic
- Cross-period rules
- Effective-date changes
- Timezone
- Examples

## 8. Data Model Changes

Provide proposed tables and columns.

Use tables containing:

- Object
- Current state
- Proposed state
- Reason
- Migration strategy
- Backfill
- Constraint
- Index
- RLS impact

## 9. SQL Migration Plan

For each migration provide:

- Proposed filename
- Purpose
- Dependencies
- Pre-check SQL
- Forward operations
- Data cleanup
- Constraints
- Indexes
- RLS policies
- Verification SQL
- Rollback/compensation
- Production risk

Do not write destructive executable SQL unless clearly marked as illustrative planning pseudocode.

## 10. Application Change Map

For every likely file include:

- Path
- Current responsibility
- Required change
- Refactor need
- Tests

## 11. UI/UX Plan

Include tariff timeline and import/payment/handover workflows.

## 12. Security and Permission Matrix

## 13. Reporting and Reconciliation Plan

## 14. Automated Test Plan

Include exact overnight cases.

## 15. Runtime UAT Plan

Use specific transaction IDs from the two new sample files where possible.

## 16. Historical Data Correction Strategy

Do not automatically modify historical values.

Plan:

- Detection
- Comparison
- Approval
- Recalculation
- Audit
- Rollback

## 17. Minimum Phase Roadmap

For every phase include:

- Phase code
- Name
- Objective
- Included scope
- Excluded scope
- Dependencies
- SQL migrations
- Files affected
- Automated tests
- UAT
- Acceptance criteria
- Rollback
- Risk
- Estimated complexity
- Business decisions required
- Required next prompt:
  - Planning refinement
  - Implementation
  - Runtime UAT
  - Fix/closure, if needed

## 18. Decision Register

Separate:

- Confirmed decisions
- Remaining decisions
- Recommended decisions

Do not list Demand Charge or tax as unresolved.

## 19. Risk Register

## 20. Definition of Done

## 21. Final Recommendation

State the exact first phase to implement after Sameer approves the plan.

---

# 23. Mandatory Test Cases to Include

## Tariff Boundary Tests

- 04:59:59
- 05:00:00
- 13:59:59
- 14:00:00
- 16:59:59
- 17:00:00
- 22:59:59
- 23:00:00
- 23:59:59
- 00:00:00

## Overnight Tests

- 23:40 Day 1 → 00:30 Day 2
- 22:50 Day 1 → 23:10 Day 1
- 04:50 Day 2 → 05:10 Day 2
- 23:50 at month end → 00:20 next month
- 23:50 on 31 December → 00:20 on 1 January

## Validation Tests

- End before start
- End equals start
- Missing timezone
- Invalid timestamp
- Same transaction twice in one file
- Same file uploaded twice
- Same transaction imported concurrently
- Operator/card mismatch
- Unknown station
- Unknown charge point
- Missing payment method
- NaN SOC marker
- Zero energy
- Negative energy

## Billing Tests

- One period
- Same overnight period across midnight
- Two tariff periods
- Three tariff periods
- Effective tariff version changes at midnight
- JOD three-decimal rounding
- Recalculation idempotency
- Locked handover recalculation rejection

## Handover Tests

- All cash
- All card
- All CliQ
- Mixed methods
- Exact cash
- Shortage
- Surplus
- Adjustment
- Refund
- Reopen
- Unauthorized approval

## Security Tests

- Cross-station read
- Cross-station update
- Unauthorized tariff edit
- Unauthorized recalculation
- Unauthorized handover approval
- Direct Supabase API attempts
- Disabled user
- New unapproved user

---

# 24. Final Safety Instruction

This task produces a plan only.

Do not implement.

Do not change source code.

Do not change SQL migrations.

Do not modify the database.

Do not import the two new sample files into production.

Do not recalculate historical billing.

Do not remove columns yet.

Do not modify tariff records.

Do not activate OCPP.

Create only:

`EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`

End the plan with:

> **Implementation Status: NOT STARTED**  
> This master plan is for Sameer’s review and approval. No SQL migration, source-code correction, financial recalculation, or production deployment may begin until the plan and its proposed minimum phases are approved.
