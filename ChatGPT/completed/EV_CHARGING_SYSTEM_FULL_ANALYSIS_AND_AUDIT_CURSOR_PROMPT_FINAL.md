# CURSOR MASTER PROMPT — EV CHARGING STATION FULL SYSTEM ANALYSIS AND AUDIT

## Project Location

The application repository is located at:

`C:\dev\EV-DR\EV-Daily-Report`

The real charging-machine sample files are located at:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

You must inspect the complete repository and all sample files in that folder.

---

# 1. Project Context

This is an operational EV charging-station application used in Jordan.

The application does not currently need a functioning OCPP module.

OCPP-related code, tables, migrations, plans, routes, or unfinished components must be identified only to determine whether they create build errors, schema conflicts, security exposure, navigation confusion, or maintenance burden.

Mark all OCPP functionality as:

`Deferred / Out of Current Scope`

Do not attempt to repair, complete, activate, or redesign OCPP during this audit.

The actual business workflow is based on importing daily transaction files downloaded manually from charging machines.

---

# 2. Confirmed Real Business Workflow

The real workflow is:

1. An officer downloads transaction files from the charging machines.
2. Each uploaded file normally belongs to one operator and one shift.
3. The user selects the operator while uploading.
4. The machine file also contains the operator card ID.
5. The operator name may appear in the filename.
6. The operator is not derived automatically from the roster.
7. The file is uploaded into the system.
8. The system imports and validates the charging transactions.
9. The system must identify the correct station, charging machine, connector, operator, shift, and tariff.
10. The system must calculate the amount for each transaction automatically.
11. The system must calculate how much money the operator is responsible for handing over.
12. Payment methods include:
    - Cash
    - Card
    - CliQ
13. Card and CliQ transactions must not automatically be treated as operator cash responsibility.
14. The application must provide reliable billing, shift, operator, station, handover, accounting, and management reports.

The current known incorrect behavior is:

- Imported transactions are initially calculated using the fixed tariff of `0.183 JOD/kWh`.
- The user must go to Billing.
- The user selects all transactions.
- The user clicks Bulk Recalculate.
- Only then may the application attempt to apply another tariff.

This is incorrect.

The system should automatically determine and apply the correct tariff based on the transaction charging time and the active tariff configuration during import, validation, approval, or authoritative posting.

The audit must determine exactly where and why the default `0.183 JOD/kWh` is being applied.

---

# 3. Current Tariff Configuration to Verify

The current tariff screen contains the following periods:

| Period | Time | Energy Rate |
|---|---|---:|
| Off-Peak | 05:00–14:00 | 0.183 JOD/kWh |
| Mid-Peak | 14:00–17:00 | 0.193 JOD/kWh |
| Peak | 17:00–23:00 | 0.213 JOD/kWh |
| MID-PEAK 2 | 23:00–05:00 | 0.193 JOD/kWh |
| MID | 00:00–05:00 | 0.193 JOD/kWh |

All currently appear to apply to all days and all seasons.

Known concern:

- `MID-PEAK 2` covers 23:00–05:00.
- `MID` covers 00:00–05:00.
- These periods overlap from 00:00–05:00.

The audit must determine:

- Whether both records are active
- Whether both can match the same transaction
- Whether the code chooses one by priority, creation order, first match, last match, or unpredictably
- Whether one period is duplicate or obsolete
- Whether the overlap affects billing
- Whether overlapping active tariffs are prevented by database constraints or validation
- Whether midnight-spanning periods are handled correctly
- Whether start time, stop time, or another timestamp is used
- Whether transactions crossing multiple tariff periods are split or charged using one tariff

Do not invent the intended cross-period billing rule.

List it under `Business Decisions Required` if the current source of truth does not clearly define it.

---

# 4. Sample File Audit Requirement

Inspect every real sample file located in:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

Do not perform only a theoretical import review.

For every sample file document:

- Filename
- File type
- Sheet name
- Row count
- Column names
- Required columns
- Optional columns
- Missing columns
- Date format
- Time format
- Timezone assumptions
- Decimal format
- Transaction ID
- Charge-point or machine ID
- Connector ID
- Card ID
- Start time
- Stop time
- Duration
- Energy
- Machine-reported amount, if present
- Payment method, if present
- Operator name, if present
- Shift information, if present
- Duplicate rows
- Invalid values
- Blank values
- Unexpected values
- Cross-tariff transactions
- Transactions around midnight
- Transactions around tariff boundaries

Confirmed facts that must be verified against the actual files:

- Each file is intended to represent one operator and one shift.
- The user selects the operator during upload.
- The machine file contains a card ID.
- The operator name may be included in the filename.
- The machine file may not contain a dedicated operator-name column.
- The machine file may not contain a payment-method column.

The audit must explain whether the application compares:

- Selected operator
- Filename operator
- File card ID
- Existing operator master-data card ID

The system should not silently accept mismatches.

Identify all missing validations.

---

# 5. Primary Instruction

Perform a complete, read-only, evidence-based technical and functional audit of the full repository.

Do not implement fixes.

Do not refactor.

Do not update packages.

Do not update SQL.

Do not change migrations.

Do not change application source code.

Do not silently fix TypeScript errors.

Do not delete OCPP files.

Do not update the production database.

Create only the requested audit report.

The audit must explain:

- What the application actually does today
- How the full import-to-handover workflow operates
- Which functions are genuinely connected
- Which functions are disconnected
- Which features are complete
- Which features are partial
- Which features are broken
- Which features exist only in documentation
- Which calculations are duplicated
- Which calculations are inconsistent
- Which database relationships are missing
- Which UI controls do not match backend enforcement
- Which risks can affect money, operators, shifts, tariffs, reports, or historical data
- Which fixes should happen first
- How later correction work should be divided into controlled phases

---

# 6. Mandatory Safety Rules

## 6.1 Git Safety Check

Before running commands, record:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

After completing the audit, run:

```bash
git status --short
git diff --stat
git diff
```

The final report must confirm whether any file changed.

Only the audit report file may be created or updated.

If another file changes accidentally:

- Stop
- Document the change
- Restore it safely
- Confirm the working tree again

## 6.2 Dependency Safety

If a valid lockfile exists, prefer:

```bash
npm ci
```

Do not run an unrestricted dependency upgrade.

Do not change package versions.

Do not regenerate the lockfile.

If dependency installation would modify tracked files, stop and document it instead.

## 6.3 Database Safety

Clearly distinguish between:

- Repository migrations
- Generated Supabase types
- Local disposable database
- Development database
- Staging database
- Production database
- Unknown database state

Do not execute destructive SQL.

Do not apply migrations to production.

Do not change live data.

A migration dry-run may be performed only against a disposable local environment when safe and available.

## 6.4 Evidence Standards

For every important finding include:

- Exact file path
- Function, component, table, migration, RPC, hook, or service name
- Line number or approximate location
- Observed behavior
- Affected workflow
- Risk
- Financial effect
- Security effect
- Recommended next action
- Verification type

Use these verification labels:

- Static code verification
- Build verification
- Local runtime verification
- Local database verification
- Manual UI verification
- Sample-file verification
- Documentation-only
- Not verified

## 6.5 Separate Facts from Recommendations

Every finding must clearly separate:

1. Observed fact
2. Current implemented behavior
3. Business ambiguity
4. Risk
5. Recommendation
6. Verification status

Do not present assumptions as confirmed defects.

---

# 7. Repository Coverage Manifest

Before writing conclusions, create a repository coverage manifest containing:

- Total files discovered
- Total source files
- Total SQL migrations
- Total service files
- Total components
- Total pages/routes
- Total hooks
- Total utility files
- Total report-related files
- Total billing-related files
- Total import-related files
- Total authentication/security files
- Total sample files
- Files fully inspected
- Files partially inspected
- Files excluded
- Reason for exclusion
- Files not opened
- OCPP files marked deferred

Do not claim a full audit without showing coverage.

---

# 8. Audit Phases

# PHASE 0 — Repository and Architecture Inventory

Inspect:

- Framework
- Runtime
- Frontend architecture
- Backend architecture
- Supabase integration
- Authentication
- Database access
- Storage
- RPC functions
- Edge functions
- Build tools
- TypeScript configuration
- Environment variables
- Routes
- Layouts
- Providers
- Contexts
- Services
- Hooks
- Utilities
- Validation
- Excel parsing
- PDF generation
- Reporting
- Date/time libraries
- Currency handling
- Testing tools
- Deployment configuration
- Documentation
- Migrations

Produce:

- Architecture map
- Module inventory
- Database-object inventory
- Workflow inventory
- High-risk file list
- Large-file list
- Duplicate or dead-code list
- OCPP deferred inventory

---

# PHASE 1 — Real Sample File and Import Analysis

Inspect all files under:

`C:\dev\EV-DR\EV-Daily-Report\sample files`

Trace every import entry point.

Audit:

- Upload page
- File picker
- Drag and drop
- Excel/CSV reader
- Sheet selection
- Header mapping
- Required columns
- Date parsing
- Time parsing
- Numeric parsing
- Energy parsing
- Card ID parsing
- Machine ID parsing
- Connector parsing
- Operator selection
- Shift selection
- File-name parsing
- Error handling
- Preview
- Approval
- Posting
- Retry
- Cancellation
- Import history

Determine whether there are multiple import pathways and whether they produce identical results.

Create a sample-file matrix.

---

# PHASE 2 — Transaction Identity, Duplicate Detection, and Idempotency

Audit transaction identity.

Determine whether `Transaction ID` is globally unique.

If not, determine whether uniqueness should include:

- Station
- Charge point
- Connector
- Start time
- Stop time
- Card ID
- Import batch

Audit:

- File-level duplicate detection
- Row-level duplicate detection
- Cross-batch duplicate detection
- Soft-deleted sessions
- Re-import behavior
- Retry behavior
- Partial failure
- Browser refresh
- Double-click
- Repeated approval
- Network timeout
- RPC success with UI failure
- Duplicate handover submission

Explain false-positive and false-negative risks.

Determine whether all financial operations are idempotent.

---

# PHASE 3 — End-to-End Transaction Trace

Select representative transactions from the real sample files, including:

- Normal off-peak transaction
- Mid-peak transaction
- Peak transaction
- Transaction near 05:00
- Transaction near 14:00
- Transaction near 17:00
- Transaction near 23:00
- Transaction crossing midnight
- Transaction crossing a tariff boundary
- Long transaction
- Short transaction
- Duplicate candidate

Trace each one through:

**Source File Row  
→ Parsed Data  
→ Normalized Data  
→ Import Batch  
→ Station  
→ Machine  
→ Connector  
→ Selected Operator  
→ Card ID Check  
→ Shift  
→ Tariff Match  
→ Amount Calculation  
→ Stored Transaction  
→ Billing Screen  
→ Handover Contribution  
→ Accounting  
→ Dashboard  
→ Report  
→ Excel/PDF Export**

Document where the chain breaks, changes values, recalculates values, or loses relationships.

---

# PHASE 4 — Station, Machine, Connector, Shift, and Operator Relationships

## Station

Audit:

- Station identifiers
- Station codes
- Import matching
- User access
- Active/inactive behavior
- Reporting
- Soft delete

## Machine and Connector

Do not assume separate tables are automatically required.

Determine the actual implemented and business need.

Audit:

- Machine ID
- Charge-point ID
- Connector ID
- Station relationship
- Replacement history
- Unknown-machine behavior
- Historical preservation

## Shift

Audit:

- Shift selected during upload
- Shift records
- Shift date
- Start/end time
- Overnight shift
- Overlap
- Missing shift
- Closed shift
- Reopened shift
- Late upload
- Backdated upload

## Operator

Audit:

- Selected operator
- Operator in filename
- Card ID in file
- Card ID in operator master data
- Operator active status
- Station assignment
- Shift assignment
- Roster
- User relationship
- Financial responsibility

The operator is not currently derived from the roster.

Do not classify that fact as a defect unless it conflicts with the intended workflow.

Identify whether the application incorrectly overrides or guesses the selected operator.

---

# PHASE 5 — Tariff Model and Automatic Tariff Selection

This is financially critical.

Audit every tariff-related:

- Table
- Migration
- Form
- Type
- Service
- RPC
- Import function
- Billing function
- Report function
- Recalculation function

Document:

- Rate period
- Start time
- End time
- Overnight handling
- Energy rate
- Demand charge
- Fixed charge
- Tax
- Service fee
- Day rules
- Season
- Effective date
- Expiry date
- Priority
- Active status
- Station scope
- Charger scope
- Connector scope
- Currency
- Rounding
- Versioning

## Required Current Algorithm Trace

Provide deterministic pseudocode describing exactly how the current application selects a tariff.

For example:

```text
1. Read transaction timestamp.
2. Query active rate periods.
3. Filter by effective date.
4. Filter by station.
5. Filter by day.
6. Match time interval.
7. Resolve overlaps.
8. Select one rate.
9. Calculate amount.
10. Store rate and amount.
```

Do not describe the recommended algorithm until after documenting the current one.

## Known Defect to Trace

Find the exact source of the default `0.183 JOD/kWh`.

Determine:

- Where it is assigned
- Whether it is hardcoded
- Whether it comes from the first tariff record
- Whether it comes from a fallback
- Whether import bypasses the tariff engine
- Whether bulk recalculation uses a different calculation path
- Whether reports use stored amounts or recalculate
- Whether the wrong value affects historical records

## Overlapping Periods

Test and document the overlap between:

- 23:00–05:00
- 00:00–05:00

Determine the exact winner-selection behavior.

## Cross-Tariff Transactions

Determine current behavior for a session that spans two or more tariff periods.

Do not invent the business rule.

Document whether the current system:

- Uses start time
- Uses stop time
- Uses import time
- Uses one default rate
- Splits energy
- Splits duration
- Fails
- Produces inconsistent results

---

# PHASE 6 — Billing Engine and JOD Precision

Identify every calculation path:

- Import-time calculation
- Client-side calculation
- Database RPC
- Bulk recalculation
- Manual edit
- Dashboard aggregation
- Report calculation
- Accounting calculation
- Export calculation

Create a formula matrix for:

- Energy charge
- Fixed charge
- Demand charge
- Tax
- Gross amount
- Net amount
- Cash responsibility
- Card amount
- CliQ amount
- Handover
- Difference
- Shortage
- Surplus
- Adjustment
- Refund
- Deposit
- Outstanding balance

Determine whether there is one authoritative calculation engine.

Compare every duplicate implementation.

## JOD Precision

Audit:

- Three-decimal precision
- Database numeric types
- JavaScript floating-point usage
- Input parsing
- Excel parsing
- Rounding order
- Per-row rounding
- Final-total rounding
- Tax rounding
- Display formatting
- Export formatting

Define whether report reconciliation is:

- Exact
- Within 0.001 JOD
- Using another tolerance

Do not choose the official tolerance without evidence.

---

# PHASE 7 — Machine Amount Versus System Amount Reconciliation

Create a dedicated reconciliation section.

Determine whether the sample files contain a machine-calculated amount.

If present, compare:

- Machine energy
- Machine amount
- System tariff
- System-calculated amount
- Difference
- Difference reason
- Authoritative value
- Approval requirement

If machine amount is absent, state that clearly.

Determine whether the application currently stores both:

- Original source values
- Recalculated system values

The system must be able to explain the final amount without losing the original imported data.

---

# PHASE 8 — Payment Method and Operator Handover

Payment methods are:

- Cash
- Card
- CliQ

The machine file may not include payment method.

Audit how payment method is currently determined:

- During upload
- Per file
- Per transaction
- From another system
- Manual edit
- Default value
- Not recorded

Do not assume total sales equal operator cash responsibility.

Audit the current handover formula.

Determine whether:

```text
Expected Cash Handover
= Cash Transactions
± Approved Adjustments
− Approved Refunds
± Previous Controlled Differences
```

matches actual implemented behavior.

Do not invent the final formula.

Audit:

- Expected cash
- Card total
- CliQ total
- Actual cash handed over
- Shortage
- Surplus
- Approval
- Rejection
- Reopening
- Finalization
- Accounting posting
- Immutability
- Audit history

Card and CliQ must be excluded from cash handover unless the business workflow explicitly says otherwise.

---

# PHASE 9 — Workflow Status and Approval Separation

Determine whether these are separate controlled stages:

1. File selected
2. File parsed
3. Rows validated
4. Operator confirmed
5. Shift confirmed
6. Tariff calculated
7. Payment method confirmed
8. Import approved
9. Transactions posted
10. Shift closed
11. Handover created
12. Handover approved
13. Accounting finalized

Identify whether one approval button performs multiple unrelated stages.

Flag any workflow where data becomes financially final too early.

---

# PHASE 10 — Reports, Dashboards, and Reconciliation

Inventory every:

- Dashboard
- KPI
- Report
- Chart
- Export
- PDF
- Excel file
- CSV
- CDR output

For each item document:

- Component
- Service
- Query
- Data source
- Filters
- Date logic
- Timezone
- Station scope
- Operator scope
- Shift scope
- Payment-method handling
- Calculation source
- Rounding
- Authorization

Reconcile:

- Transaction detail
- Import batch
- Shift
- Operator
- Cash
- Card
- CliQ
- Handover
- Accounting
- Dashboard
- Daily report
- Monthly report
- Excel
- PDF

Explicitly determine whether reports use:

- Stored authoritative values
- Live recalculation
- Different formulas
- Different date boundaries

---

# PHASE 11 — Database, Migrations, Types, and Schema Drift

Inspect all migrations chronologically.

Determine whether a clean disposable environment can reproduce the required schema.

Compare:

- SQL migrations
- Generated Supabase types
- Application queries
- Forms
- Services
- Reports
- RPC return types

Create a schema-drift matrix.

Audit:

- Missing migrations
- Missing columns
- Duplicate migrations
- Conflicting migrations
- Foreign keys
- Unique constraints
- Nullability
- Numeric precision
- Indexes
- Soft delete
- Cascades
- Orphans
- Historical references
- Overlapping tariff prevention
- Transaction uniqueness

---

# PHASE 12 — Authentication, Roles, RLS, and Security

Audit:

- Login
- Registration
- Password reset
- Default user role
- Profile creation
- Disabled users
- Deleted users
- Route protection
- UI permissions
- Service permissions
- RPC permissions
- RLS
- Storage policies
- Export restrictions
- Station isolation
- Accounting access
- User management
- Audit logs

Create a full RLS matrix for each important table.

Flag broad policies such as:

```sql
USING (true)
WITH CHECK (true)
```

Determine whether client-side roles can be bypassed through direct Supabase calls.

---

# PHASE 13 — Build, TypeScript, Runtime, and Code Quality

Run and record, where safely available:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
npm test
```

Use only commands defined by the project.

Do not invent scripts.

Do not fix failures.

Document:

- Exact command
- Result
- Error category
- Affected files
- Root-cause hypothesis
- Runtime risk
- Schema-drift implication
- Build-blocking status

Review:

- Large files
- Duplicate logic
- Unsafe casts
- `any`
- Non-null assertions
- Silent catches
- Direct Supabase calls
- Hardcoded tariffs
- Hardcoded roles
- Hardcoded station/operator assumptions
- Frontend-only financial logic
- Race conditions
- Partial writes
- Missing transactions
- Missing error boundaries

---

# PHASE 14 — Testing and UAT Readiness

Separate:

- Executable tests
- Manual test documents
- Implementation reports
- UAT reports
- Fixtures
- Seed data
- Mock data

Prepare a future test matrix covering:

## Import

- Valid file
- Invalid file
- Missing columns
- Wrong headers
- Wrong dates
- Wrong decimals
- Blank rows
- Duplicate file
- Duplicate rows
- Large file
- Unknown station
- Unknown machine
- Unknown connector
- Operator/card mismatch
- Wrong shift
- Backdated import

## Tariff

- 04:59
- 05:00
- 13:59
- 14:00
- 16:59
- 17:00
- 22:59
- 23:00
- 23:59
- 00:00
- Overnight
- Overlap
- Missing rate
- Inactive rate
- Historical rate
- Cross-period transaction
- Three-decimal rounding

## Payment and Handover

- All cash
- All card
- All CliQ
- Mixed payment methods
- Shortage
- Surplus
- Refund
- Adjustment
- Reopening
- Unauthorized approval

## Security

- Cross-station read
- Cross-station update
- Unauthorized delete
- Unauthorized export
- Direct Supabase access
- Disabled user
- Default role
- RLS bypass

Do not implement tests during this audit.

---

# PHASE 15 — Production Readiness

Score each area using this exact scale:

- `0` — Not implemented
- `1` — Present but unusable
- `2` — Partially functional
- `3` — Functional with major risk
- `4` — Functional with minor gaps
- `5` — Production-ready and verified

Every score must include evidence.

Score:

1. Sample-file import
2. Duplicate protection
3. Operator assignment
4. Shift assignment
5. Automatic tariff selection
6. Billing calculation
7. JOD precision
8. Payment-method handling
9. Money handover
10. Accounting
11. Reports
12. Security
13. Database integrity
14. Testing
15. Deployment
16. OCPP — Deferred and excluded from overall score

---

# 9. Required Deliverable

Create or update only:

`EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

Do not modify any other file.

---

# 10. Required Report Structure

## 1. Executive Summary

State:

- What the application does
- Current maturity
- Major strengths
- Major risks
- Production blockers
- Whether automatic tariff calculation works
- Whether operator handover can be trusted
- Whether reports reconcile
- Whether historical values may be wrong

## 2. Audit Scope and Limitations

Include:

- Repository path
- Sample-file path
- Files inspected
- Commands run
- Database availability
- Runtime availability
- OCPP exclusion

## 3. Repository Coverage Manifest

Show exact coverage.

## 4. Architecture and Module Map

Include Mermaid diagrams.

## 5. Actual End-to-End Workflow

Document the implemented workflow, not the intended one.

## 6. Sample File Analysis

Include a matrix for every sample.

## 7. Representative Transaction Traces

Include full end-to-end traces.

## 8. Feature Status Matrix

Classify:

- Working
- Working with risk
- Partial
- Broken
- UI-only
- Database-only
- Documentation-only
- Deferred
- Cannot verify

## 9. Import and Duplicate Findings

## 10. Operator, Card ID, Shift, and Station Findings

## 11. Tariff Model and Selection Findings

Include current tariff-selection pseudocode.

## 12. Default 0.183 Root-Cause Analysis

Identify exactly why imported transactions receive this tariff.

## 13. Billing and JOD Precision Findings

## 14. Machine Amount Versus System Amount Findings

## 15. Payment Method and Handover Findings

## 16. Reports and KPI Reconciliation

## 17. Database and Schema Drift

## 18. Security and RLS

## 19. Build and TypeScript Findings

## 20. Testing Gap Analysis

## 21. OCPP Deferred Inventory

## 22. Issue Register

Use:

- ID
- Audit phase
- Severity
- Category
- Title
- Observed fact
- Evidence
- Verification status
- Business effect
- Financial effect
- Security effect
- Affected workflow
- Recommendation
- Dependency
- Complexity
- Business decision required
- Status

Severity:

- `P0` — Critical production blocker
- `P1` — High risk
- `P2` — Medium risk
- `P3` — Improvement
- `Deferred` — Out of current scope

## 23. Reconciliation Matrix

Compare:

- File rows
- Imported sessions
- Billing
- Cash
- Card
- CliQ
- Shift
- Operator
- Handover
- Accounting
- Dashboard
- Reports
- Excel
- PDF

## 24. Business Decisions Required

Do not invent answers.

At minimum ask:

- Is the tariff based on session start time, stop time, or split energy?
- How should a session crossing tariff periods be billed?
- Is `MID` duplicate and should it be removed later?
- Does the user select one payment method for the whole file or per transaction?
- How is payment method obtained if absent from the machine file?
- Which payment methods form operator cash responsibility?
- Should selected operator, filename name, and card ID all match?
- What happens when they do not match?
- Is Transaction ID globally unique?
- Can approved handovers be reopened?
- Who approves shortages and surpluses?
- What is the official JOD rounding rule?
- Should original imported values remain immutable?
- Should corrections use direct edits or adjustment records?

## 25. Recommended Correction Roadmap

Build the roadmap from evidence and dependencies.

Do not force findings into a predetermined order.

A likely structure may include:

- FIX.0 — Backup, safety freeze, and source-of-truth confirmation
- FIX.1 — Schema and migration alignment
- FIX.2 — Authentication, roles, RLS, and station isolation
- FIX.3 — Sample-file normalization, validation, duplicate protection, and idempotency
- FIX.4 — Operator, card ID, shift, station, machine, and connector relationship correction
- FIX.5 — Automatic tariff-selection engine and tariff versioning
- FIX.6 — Central billing engine and JOD precision
- FIX.7 — Payment method, cash responsibility, and handover controls
- FIX.8 — Report and KPI reconciliation
- FIX.9 — UI workflow safety
- FIX.10 — Automated tests and runtime UAT
- FIX.11 — Performance, observability, backups, and production hardening
- DEFERRED — OCPP isolation and future roadmap

For each phase include:

- Objective
- Findings included
- Dependencies
- Business decisions required
- Files likely affected
- Database impact
- Security impact
- Test requirements
- Acceptance criteria
- Risk
- Separate planning prompt required
- Separate implementation prompt required
- Separate UAT prompt required

## 26. Final Recommendation

State clearly:

- What must be fixed first
- Whether current billing can be trusted
- Whether current operator handover can be trusted
- Whether reports should be treated as final
- Whether historical transactions may require recalculation
- What data must be backed up
- What must not be changed yet

## 27. Command Log

Record all commands and results.

## 28. Git Safety Confirmation

Confirm:

- Initial working-tree state
- Final working-tree state
- Files created
- Files changed
- Whether only the audit report was modified

---

# 11. Final Safety Instruction

This is an audit-only phase.

Do not implement fixes.

Do not update source code.

Do not update SQL.

Do not apply migrations.

Do not change tariffs.

Do not recalculate production data.

Do not remove OCPP.

Do not change the Source of Truth.

Create only:

`EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

End the report with:

> **Implementation Status: NOT STARTED**  
> This report is an evidence-based analysis and recommended phased roadmap only. No correction phase may begin until the report is reviewed and approved by Sameer.
