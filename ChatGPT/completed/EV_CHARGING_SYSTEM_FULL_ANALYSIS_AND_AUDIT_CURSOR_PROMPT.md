# CURSOR MASTER PROMPT — EV CHARGING STATION SYSTEM FULL ANALYSIS AND AUDIT

## Project Context

You are auditing an existing EV charging-station operational application used in Jordan.

The application is not currently intended to operate as a live OCPP platform. Any OCPP-related database structures, files, documents, migrations, plans, or unfinished modules must be identified but excluded from the current functional scope.

The actual business workflow is:

1. Charging machines produce daily transaction data.
2. Transactions are grouped or received per operator shift.
3. Users import the charging transaction files into the application.
4. The application must validate and process the imported transactions.
5. Each transaction must be linked to the correct charging station, machine, charger, connector, shift, and operator.
6. The system must identify the correct tariff based on configured tariff settings and transaction date/time.
7. The system must calculate the correct charging amount and related financial values.
8. The system must determine how much money each operator is required to hand over.
9. Shift, operator, transaction, station, and financial information must remain connected and reconcilable.
10. The system must generate correct operational, financial, accounting, operator, shift, station, and management reports.
11. The system must support review, correction, traceability, auditability, and testing.

The purpose of this task is not to implement fixes immediately.

The purpose is to perform a complete, evidence-based analysis and audit of the entire application so that the owner and Cursor can later agree on a phased correction, integration, testing, and enhancement plan.

---

# Primary Instruction

Perform a full-system, read-only technical and functional audit of the complete repository.

Do not immediately refactor, redesign, delete, migrate, or implement features.

Do not make speculative changes.

Do not assume that documents, implementation reports, planning files, UI screens, database migrations, services, or components prove that a feature is working.

Inspect the actual code paths, database structure, queries, functions, calculations, forms, permissions, imports, relationships, reports, and application behavior.

The audit must explain:

- What the system currently does
- How every major workflow operates
- Which parts are connected
- Which parts are disconnected
- Which functionality is complete
- Which functionality is partial
- Which functionality is broken
- Which functionality exists only in documentation
- Which calculations are reliable
- Which calculations are duplicated or inconsistent
- Which database structures are missing or mismatched
- Which UI actions do not match backend behavior
- Which risks can affect money, operators, shifts, reports, or historical records
- Which fixes should be performed first
- How the correction work should be divided into controlled phases

---

# Mandatory Execution Rules

## 1. Read Before Editing

Inspect the entire repository before preparing conclusions.

Do not modify application files during this audit.

Do not silently fix errors.

Do not regenerate migrations.

Do not change the database schema.

Do not update package versions.

Do not delete OCPP files.

Do not implement missing functions.

Do not create production code.

You may create only the requested audit report file.

## 2. Evidence-Based Findings

Every important finding must include evidence wherever possible:

- Exact file path
- Relevant function, component, type, table, RPC, migration, or query name
- Line number or approximate code location
- Description of the behavior
- Description of the risk
- Explanation of the affected workflow
- Recommended next action

Do not use vague statements such as:

- “The code may have issues”
- “Security should be improved”
- “Reports need testing”
- “Some functions might be disconnected”

State exactly what was inspected and what was found.

## 3. No Trust in Documentation Alone

The repository may contain planning documents, implementation reports, phase reports, audit notes, or completion claims.

Treat those only as reference material.

Verify every claim against actual source code and database migrations.

Classify each feature as:

- Confirmed implemented and connected
- Implemented but not fully connected
- Partially implemented
- UI-only
- Database-only
- Documentation-only
- Broken
- Deprecated
- Out of current scope
- Cannot be verified

## 4. OCPP Scope Exclusion

OCPP is not required in the current business workflow.

Therefore:

- Do not spend the audit attempting to make OCPP operational.
- Do not recommend OCPP as a prerequisite for the current system.
- Do not include unfinished OCPP functionality in the current production-readiness score for the daily-import workflow.
- Identify OCPP-related files, tables, migrations, services, routes, or documentation.
- Mark all OCPP items as “Deferred / Out of Current Scope.”
- Identify only whether OCPP code causes side effects, build errors, security exposure, schema conflicts, navigation confusion, or maintenance burden.
- Recommend isolation or feature-flagging later if appropriate.
- Do not delete OCPP structures during this audit.

---

# Business Source of Truth

The core system must be audited according to this operational chain:

**Machine Transaction File  
→ Import Batch  
→ Raw Transaction Validation  
→ Duplicate Detection  
→ Station / Charger / Connector Identification  
→ Shift Identification  
→ Operator Identification  
→ Tariff Selection  
→ Charging Amount Calculation  
→ Operator Collection Responsibility  
→ Money Handover / Reconciliation  
→ Accounting and Management Reports  
→ Audit Trail and Historical Traceability**

Every step must be inspected.

The audit must determine whether the chain is complete, deterministic, secure, testable, and financially reconcilable.

---

# Audit Phases

The audit must be structured phase by phase.

Do not combine everything into one unstructured issue list.

---

# PHASE 0 — Repository Orientation and System Inventory

Perform a complete repository inventory.

Document:

- Framework and runtime
- Frontend architecture
- Backend architecture
- Supabase usage
- Authentication approach
- Database access approach
- Storage usage
- RPC functions
- Edge functions, if any
- Build tooling
- TypeScript configuration
- Environment variables
- Main routes
- Main layouts
- Main providers and contexts
- Services
- Hooks
- Utility layers
- Validation libraries
- Export libraries
- Report libraries
- Excel parsing libraries
- PDF generation libraries
- Date and timezone libraries
- Testing tools
- Deployment configuration
- Documentation files
- Database migration files

Produce:

1. Repository architecture map
2. Main module inventory
3. Main database-object inventory
4. Main workflow inventory
5. List of very large or high-risk files
6. List of dead, duplicate, experimental, or unclear files
7. List of OCPP-related items marked as deferred

---

# PHASE 1 — End-to-End Functional Workflow Analysis

Trace the real operational workflow from start to finish.

## 1.1 Import Entry Points

Identify every place where users can import or upload transaction data.

Inspect:

- Upload pages
- Drag-and-drop components
- Excel/CSV readers
- File validation
- File-size validation
- File-type validation
- Sheet selection
- Column mapping
- Header recognition
- Date parsing
- Time parsing
- Numeric parsing
- JOD amount parsing
- Charger identifiers
- Station identifiers
- Connector identifiers
- Operator identifiers
- Shift identifiers
- Error handling
- Partial import behavior
- Retry behavior
- Import cancellation
- Import preview
- Import approval
- Import history

Determine whether there are multiple import pathways and whether they behave consistently.

## 1.2 Import Batch Lifecycle

Identify how an import batch is created and tracked.

Determine:

- When the batch record is created
- When the batch becomes approved
- Whether the import is transactional
- Whether partial failures are possible
- Whether the batch can be reprocessed
- Whether the batch can be deleted
- Whether imported sessions can be edited
- Whether edits preserve the original source data
- Whether source files are stored
- Whether row-level errors are stored
- Whether rejected rows are recoverable
- Whether the batch has an immutable checksum or source reference
- Whether the same file can be imported twice

## 1.3 Duplicate Detection

Audit duplicate prevention in detail.

Identify:

- Duplicate keys
- Session ID matching
- Charger transaction ID matching
- Date/time matching
- Station matching
- Connector matching
- Energy matching
- File-level duplicate detection
- Row-level duplicate detection
- Cross-batch duplicate detection
- Soft-deleted record behavior
- Manual override behavior
- False-positive risk
- False-negative risk

Explain exactly how duplicates are identified today.

Create example scenarios showing where duplicate detection succeeds or fails.

## 1.4 Transaction Lifecycle

Trace one imported transaction through all affected tables and services.

Document:

- Raw imported fields
- Normalized fields
- Derived fields
- Tariff fields
- Calculated fields
- Operator fields
- Shift fields
- Station fields
- Billing fields
- Handover fields
- Audit fields
- Report fields

Determine which table or record is the authoritative source of truth.

Identify whether the system duplicates the same values across multiple tables and whether those copies can become inconsistent.

---

# PHASE 2 — Station, Machine, Charger, Connector, Shift, and Operator Relationships

Audit all operational master data and relationships.

## 2.1 Station Structure

Inspect:

- Station table
- Station status
- Station identifiers
- Station codes
- Station names
- Location
- Ownership
- Company relationship
- User access
- Soft delete
- Active/inactive behavior
- Report filtering
- Import matching

Determine whether station matching is based on:

- Database ID
- Station code
- File value
- Charger ID
- Manual selection
- Hardcoded logic

## 2.2 Machine / Charger / Connector Structure

Determine whether chargers and connectors have proper database records.

Inspect:

- Unique identifiers
- Serial numbers
- External machine IDs
- Connector numbers
- Charger-station relationship
- Active status
- Effective dates
- Replacement handling
- Historical transaction relationship
- Missing-machine behavior
- Unknown-machine behavior

Identify whether imported transactions can be incorrectly assigned due to weak identifiers.

## 2.3 Shift Structure

Audit how shifts are defined.

Inspect:

- Shift names
- Start times
- End times
- Overnight shifts
- Date boundaries
- Grace periods
- Timezone
- Shift schedules
- Shift assignment
- Shift opening
- Shift closing
- Shift approval
- Shift status
- Shift corrections
- Shift handover
- Shift reports

Test conceptually:

- A shift that starts before midnight and ends after midnight
- A transaction exactly at shift start
- A transaction exactly at shift end
- Missing shift
- Overlapping shifts
- Two operators on one shift
- Operator replacement during shift
- Late upload
- Backdated upload

Determine whether the shift is taken from the uploaded file, derived from transaction time, selected manually, or linked by roster.

## 2.4 Operator Structure

Audit:

- Operator master data
- Operator status
- Station assignment
- Shift assignment
- Roster
- Attendance
- Operator replacement
- Multiple stations
- Multiple shifts
- Inactive operators
- Deleted operators
- User-account relationship
- Financial responsibility
- Handover responsibility

Determine exactly how each imported transaction becomes associated with an operator.

Identify every fallback behavior.

Flag any workflow where the system guesses an operator without explicit review.

## 2.5 Relationship Integrity

Build a relationship map covering:

- Station
- Charger
- Connector
- Operator
- Shift
- Roster
- Attendance
- Import batch
- Transaction/session
- Tariff
- Billing result
- Handover
- Accounting record
- Report

Identify:

- Missing foreign keys
- Nullable critical relationships
- Text-based relationships
- Orphan risks
- Cascading-delete risks
- Soft-delete conflicts
- Duplicate master records
- Historical relationship loss

---

# PHASE 3 — Tariff Configuration and Tariff Selection Audit

This phase is financially critical.

## 3.1 Tariff Data Model

Inspect all tariff-related tables, types, forms, services, RPCs, and settings.

Document:

- Tariff name
- Tariff code
- Energy rate
- Fixed charge
- Demand charge
- Tax
- Service fee
- Time-of-use period
- Weekday/weekend rules
- Holiday rules
- Station-specific tariffs
- Charger-specific tariffs
- Connector-specific tariffs
- Effective date
- Expiry date
- Priority
- Active status
- Currency
- Rounding
- Versioning

Determine whether tariff changes preserve historical tariff versions.

## 3.2 Tariff Selection Algorithm

Trace exactly how the application chooses a tariff for a transaction.

Identify:

- Input date used
- Input time used
- Timezone used
- Station filters
- Charger filters
- Connector filters
- Operator filters, if any
- Effective-date filters
- Active filters
- Priority handling
- Overlapping rate periods
- Missing tariff behavior
- Multiple matching tariff behavior
- Fallback tariff behavior
- Manual override behavior

Determine whether the selection logic exists in:

- Frontend code
- Database RPC
- SQL function
- Import service
- Billing service
- Report service
- Multiple places

Compare all implementations.

## 3.3 Tariff Boundary Scenarios

The report must include a test matrix for:

- Exact rate start time
- Exact rate end time
- Midnight
- Overnight tariff period
- Weekend transition
- Month-end
- Year-end
- Effective-date transition
- Backdated transaction
- Future-dated transaction
- Missing rate
- Two active overlapping rates
- Inactive rate
- Station-specific override
- Rounding to three decimal places
- Zero energy
- Negative energy
- Extremely large energy value

## 3.4 Historical Integrity

Determine:

- Whether recalculation uses the original tariff snapshot
- Whether editing a tariff changes previous reports
- Whether historical sessions store the applied rate
- Whether historical sessions store the tariff ID
- Whether historical sessions store calculation components
- Whether the system can explain how an amount was produced
- Whether authorized recalculation is controlled
- Whether adjustments are logged

Flag any case where historical money can change silently.

---

# PHASE 4 — Billing and Financial Calculation Audit

This phase must be treated as production-critical.

## 4.1 Calculation Paths

Identify every calculation path, including:

- Import-time calculation
- Client-side calculation
- Database RPC calculation
- Recalculation function
- Manual edit
- Report-side calculation
- Dashboard-side aggregation
- Accounting calculation
- Export calculation

Create a matrix showing which files/functions calculate:

- Energy amount
- Fixed charge
- Demand charge
- Tax
- Gross amount
- Net amount
- Operator collection
- Handover amount
- Difference
- Adjustment
- Refund
- Deposit
- Outstanding balance

## 4.2 One Source of Truth

Determine whether the system has one authoritative financial calculation engine.

If multiple calculation engines exist:

- Compare formulas
- Compare rounding
- Compare null behavior
- Compare tax behavior
- Compare date behavior
- Compare tariff selection
- Compare error handling

Identify all situations where two screens could show different money values for the same transactions.

## 4.3 Currency and Precision

Audit Jordanian dinar handling.

Verify:

- Three-decimal precision
- Database numeric types
- JavaScript floating-point risks
- Input parsing
- Excel parsing
- Display formatting
- PDF formatting
- CSV formatting
- Summation
- Tax calculation
- Rounding sequence
- Final rounding
- Aggregation rounding

Determine whether the application uses unsafe JavaScript floating-point arithmetic for authoritative financial values.

Recommend a future correction approach, but do not implement it.

## 4.4 Financial Exceptions

Check how the system handles:

- Cancelled sessions
- Failed sessions
- Zero-energy sessions
- Partial sessions
- Duplicate sessions
- Refunded sessions
- Adjusted sessions
- Free charging
- Complimentary sessions
- Operator mistakes
- Cash shortages
- Cash surpluses
- Incorrect tariff
- Late corrections
- Deleted records
- Imported negative values
- Missing amount
- Machine-provided amount differing from system amount

---

# PHASE 5 — Operator Money Handover and Reconciliation Audit

This is one of the main business functions.

## 5.1 Handover Workflow

Document the exact current workflow for:

- Calculated operator responsibility
- Shift closing
- Operator declaration
- Cash collected
- Electronic payment
- Deposit
- Expected amount
- Actual handed-over amount
- Difference
- Shortage
- Surplus
- Approval
- Rejection
- Correction
- Reopening
- Finalization
- Accounting posting

Identify whether the application currently supports each step.

## 5.2 Expected Amount Formula

Determine exactly how the expected handover amount is calculated.

Inspect whether it includes or excludes:

- All shift transactions
- Cash transactions
- Card transactions
- Online transactions
- Free sessions
- Refunded sessions
- Failed sessions
- Adjustments
- Taxes
- Service fees
- Previous shortages
- Previous advances
- Station expenses
- Manual deductions

Do not assume that total sales equal operator cash responsibility.

## 5.3 Reconciliation Integrity

Determine whether totals reconcile across:

- Transaction details
- Shift totals
- Operator totals
- Handover records
- Accounting dashboard
- Station totals
- Daily reports
- Monthly reports
- Exported Excel
- PDF output

Create a formal reconciliation equation based on actual implemented fields.

Identify missing controls.

## 5.4 Approval and Auditability

Inspect:

- Who can create a handover
- Who can approve it
- Who can edit it
- Who can reopen it
- Who can delete it
- Whether changes are logged
- Whether previous values are retained
- Whether an approved handover is immutable
- Whether approvals can be bypassed from Supabase
- Whether station managers can access other stations

---

# PHASE 6 — Reports, Dashboards, Exports, and KPI Reconciliation

## 6.1 Report Inventory

List every report, dashboard, card, chart, export, and KPI.

For each item record:

- UI location
- Component
- Service
- Query
- Database table or RPC
- Filters
- Date handling
- Station handling
- Operator handling
- Shift handling
- Calculation source
- Export availability
- Known risk

## 6.2 KPI Definitions

Define the current implemented meaning of:

- Total sessions
- Successful sessions
- Failed sessions
- Total energy
- Total revenue
- Gross revenue
- Net revenue
- Fixed charges
- Tax
- Average transaction
- Average tariff
- Operator collections
- Expected handover
- Actual handover
- Difference
- Station performance
- Charger utilization
- Operator performance
- Daily revenue
- Shift revenue
- Monthly revenue
- CO₂ savings
- Uptime, if present

Identify inconsistent definitions.

## 6.3 Report Reconciliation

Compare multiple report paths for identical date ranges.

Determine whether:

- Dashboard totals equal transaction totals
- Operator totals equal shift totals
- Shift totals equal station totals
- Daily totals equal monthly detail totals
- Excel totals equal screen totals
- PDF totals equal screen totals
- Accounting totals equal billing totals
- Deleted or cancelled sessions are consistently excluded
- Time filters use the same timezone and inclusive/exclusive boundaries

## 6.4 Export Audit

Inspect:

- Excel exports
- CSV exports
- PDF exports
- CDR exports
- File naming
- Data completeness
- Arabic support
- Currency formatting
- Date formatting
- Timezone
- Totals
- Hidden data exposure
- Role restrictions
- Station restrictions

---

# PHASE 7 — Database Schema, Migrations, Supabase Types, and Data Integrity

## 7.1 Migration Reproducibility

Inspect all migrations in chronological order.

Determine whether a new Supabase project can reproduce the complete required schema.

Identify:

- Missing table migrations
- Missing columns
- Duplicate migrations
- Conflicting migrations
- Out-of-order dependencies
- Manual database changes not represented in migrations
- Deprecated tables
- Unused tables
- OCPP-only tables
- Missing indexes
- Missing constraints
- Weak numeric types
- Incorrect nullability
- Missing foreign keys

## 7.2 Schema Drift

Compare:

- SQL migrations
- Generated Supabase TypeScript types
- Application queries
- Forms
- Services
- Reports
- RPC response types

Create a schema-drift table with:

- Referenced object
- Application expectation
- Generated type
- Migration definition
- Actual inconsistency
- Affected feature
- Severity

## 7.3 Data Integrity

Inspect constraints for:

- Unique transaction IDs
- Unique import keys
- Valid energy values
- Valid financial values
- Valid station relationships
- Valid operator relationships
- Valid shifts
- Valid tariff periods
- No overlapping active tariffs, if required
- Non-negative amounts
- Valid statuses
- Required timestamps
- Soft-delete handling
- Historical references

## 7.4 Database Performance

Review:

- Indexes
- Large-table queries
- Date filters
- Station filters
- Operator filters
- Shift filters
- Report aggregations
- Duplicate searches
- Pagination
- Sorting
- Full-table reads
- N+1 queries
- Excessive browser-side aggregation

Do not optimize yet. Document risks and recommendations.

---

# PHASE 8 — Authentication, Authorization, RLS, and Security Audit

## 8.1 Authentication

Inspect:

- Login
- Registration
- Password reset
- Session handling
- Profile creation
- Default role
- Email verification
- Disabled users
- Deleted users
- Logout
- Refresh tokens

## 8.2 Authorization

Compare intended permissions against actual enforcement.

Inspect:

- Route protection
- Component protection
- Button visibility
- Service-level checks
- RPC authorization
- Database RLS
- Storage policies
- Export permissions
- Report permissions
- Station-level access
- Operator-level access
- Accounting access
- User-management access

## 8.3 RLS

Produce a full RLS policy matrix.

For every important table list:

- SELECT policy
- INSERT policy
- UPDATE policy
- DELETE policy
- Role condition
- Station condition
- Company condition
- Ownership condition
- Security concern

Flag any `USING (true)` or equivalent broad access.

## 8.4 Secrets and Configuration

Inspect:

- Environment files
- Supabase keys
- Service-role exposure
- API keys
- Hardcoded credentials
- Debug data
- Sensitive logs
- Production URLs
- Development fallbacks

Do not expose secret values in the audit report. Report only their location and risk.

---

# PHASE 9 — UI/UX and Operational Control Audit

The purpose is not visual redesign.

Audit whether the interface supports correct operations.

Inspect:

- Import clarity
- Validation messages
- Error recovery
- Duplicate review
- Tariff review
- Operator confirmation
- Shift confirmation
- Handover confirmation
- Approval status
- Financial warnings
- Missing-data warnings
- Destructive-action warnings
- Locked records
- Historical changes
- Search
- Filtering
- Pagination
- Sorting
- Large data volume
- Mobile behavior
- Accessibility
- Arabic/English behavior
- Date and time display
- Currency display

Identify workflows where a normal user could accidentally produce incorrect money or reporting results.

---

# PHASE 10 — Code Quality, Build, Type Safety, and Runtime Risk

Run and document, where available:

- Dependency installation status
- TypeScript typecheck
- Lint
- Production build
- Existing tests
- Static analysis
- Import-cycle checks
- Unused-code review

Do not fix failures.

For every failure category, document:

- Error pattern
- Affected files
- Likely root cause
- Affected module
- Whether it blocks build
- Whether it can cause runtime failure
- Whether it indicates schema drift

Review:

- Very large files
- Duplicate logic
- Mixed UI/business/database logic
- Unsafe casts
- `any`
- Non-null assertions
- Silent catches
- Inconsistent error handling
- Direct Supabase calls from many components
- Hardcoded statuses
- Hardcoded tariff rules
- Hardcoded station or operator assumptions
- Frontend-only financial logic
- Race conditions
- Partial update risks

---

# PHASE 11 — Testing and UAT Readiness Audit

## 11.1 Current Test Inventory

Identify all existing:

- Unit tests
- Integration tests
- Database tests
- RLS tests
- End-to-end tests
- Manual test plans
- UAT documents
- Fixtures
- Seed data
- Mock files

Distinguish real executable tests from documentation.

## 11.2 Required Test Strategy

Prepare a future testing strategy covering:

### Import Tests

- Valid file
- Invalid file
- Missing columns
- Additional columns
- Incorrect date
- Incorrect time
- Incorrect decimal
- Blank rows
- Duplicate file
- Duplicate rows
- Partial failure
- Large file
- Unknown station
- Unknown charger
- Unknown operator
- Unknown shift

### Tariff Tests

- Normal rate
- Time-of-use
- Boundary times
- Overnight rate
- Effective-date transition
- Overlap
- Missing tariff
- Station override
- Three-decimal rounding

### Operator and Shift Tests

- Correct operator
- Incorrect operator
- Missing roster
- Replacement operator
- Overnight shift
- Overlapping shift
- Closed shift
- Reopened shift

### Handover Tests

- Exact handover
- Shortage
- Surplus
- Cash/card split
- Approval
- Rejection
- Correction
- Locked handover
- Unauthorized access

### Reporting Tests

- Transaction-to-report reconciliation
- Shift-to-daily reconciliation
- Daily-to-monthly reconciliation
- Screen-to-Excel reconciliation
- Screen-to-PDF reconciliation
- Station isolation
- Operator isolation
- Timezone boundaries

### Security Tests

- Cross-station access
- Cross-role access
- Direct Supabase access
- Unauthorized insert
- Unauthorized update
- Unauthorized delete
- Unauthorized export
- Disabled user
- New user default role

Do not implement the tests during this audit.

---

# PHASE 12 — Production Readiness and Operational Risk

Assess:

- Data backup
- Restore procedure
- Audit logs
- Error monitoring
- User activity logs
- Financial adjustment history
- Import file retention
- Data retention
- Disaster recovery
- Deployment reproducibility
- Environment separation
- Staging environment
- Production migration process
- Rollback process
- Release versioning
- Support diagnostics

Provide production-readiness scoring separately for:

1. Daily transaction import
2. Tariff calculation
3. Operator assignment
4. Shift management
5. Money handover
6. Accounting
7. Reports
8. Security
9. Database integrity
10. Testing
11. Deployment
12. OCPP, marked deferred and not counted in the current total

---

# Required Audit Deliverable

Create or update the following file only:

`EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

Do not modify application code.

The report must contain the following sections.

---

# Report Structure

## 1. Executive Summary

Explain:

- What the system is
- What the real operational workflow is
- Overall maturity
- Major strengths
- Major risks
- Production blockers
- Whether core calculations can currently be trusted
- Whether reports can currently be reconciled
- Whether operator handover can currently be trusted

## 2. Audit Scope

Clearly state:

- Included modules
- Excluded OCPP scope
- Files inspected
- Commands run
- Limitations

## 3. Current Architecture

Include:

- Architecture diagram in Mermaid
- Module map
- Service map
- Database map
- Data-flow map

## 4. Current End-to-End Workflow

Document the actual implemented workflow, not the intended workflow.

Use a Mermaid sequence diagram from upload to handover and reporting.

## 5. Feature Status Matrix

For every feature classify:

- Working
- Working with risk
- Partial
- Broken
- UI-only
- Database-only
- Documentation-only
- Deferred
- Cannot verify

## 6. Database and Relationship Map

Include all key entities and relationships.

## 7. Import Workflow Findings

Include exact code evidence and risks.

## 8. Duplicate Detection Findings

Include exact implemented matching rules.

## 9. Station, Charger, Connector, Shift, and Operator Findings

Explain relationship and assignment behavior.

## 10. Tariff Findings

Explain the tariff model and selection algorithm.

## 11. Billing Findings

Explain every calculation pathway.

## 12. Money Handover Findings

Explain expected versus actual handover calculations and controls.

## 13. Reports and KPI Findings

Explain inconsistent or duplicated calculations.

## 14. Database and Schema-Drift Findings

Include a detailed mismatch table.

## 15. Security and RLS Findings

Include a policy matrix.

## 16. UI/UX Operational Findings

Focus on correctness and user error prevention.

## 17. Build, TypeScript, and Code-Quality Findings

Include command results and error categories.

## 18. Testing Gap Analysis

Separate executable tests from test documentation.

## 19. OCPP Deferred Inventory

List OCPP items and any current side effects, but do not propose implementation now.

## 20. Issue Register

Create a comprehensive issue table with:

- ID
- Phase
- Severity
- Category
- Title
- Evidence
- Business effect
- Financial effect
- Security effect
- Affected workflow
- Recommended correction
- Dependency
- Estimated complexity
- Requires business decision
- Status

Use severity:

- P0 — Critical production blocker
- P1 — High risk
- P2 — Medium risk
- P3 — Improvement
- Deferred — Out of current scope

## 21. Reconciliation Matrix

Show whether totals reconcile between:

- Sessions
- Imports
- Shifts
- Operators
- Handovers
- Accounting
- Dashboards
- Reports
- Excel
- PDF

## 22. Business Decisions Required

List questions that must be answered by the owner before implementation.

Examples:

- What transaction field uniquely identifies a machine session?
- Does the machine file include operator or shift?
- How is an operator selected when two operators overlap?
- Which payment methods are the operator responsible for?
- Are tariffs inclusive or exclusive of tax?
- Should old sessions retain the original tariff forever?
- Can approved handovers be reopened?
- Who approves shortages?
- What is the official JOD rounding rule?
- How should unknown chargers be handled?
- How should backdated imports be handled?

Do not invent answers.

## 23. Recommended Correction Roadmap

Propose a phased roadmap only after completing the audit.

The roadmap should likely follow this order, but adjust it based on evidence:

- FIX.0 — Safety freeze, backups, and source-of-truth confirmation
- FIX.1 — Schema alignment and migration reproducibility
- FIX.2 — Authentication, roles, RLS, and station isolation
- FIX.3 — Import normalization and duplicate integrity
- FIX.4 — Station, charger, shift, roster, and operator relationship correction
- FIX.5 — Central tariff engine and historical tariff versioning
- FIX.6 — Central billing engine and JOD precision
- FIX.7 — Operator handover and reconciliation controls
- FIX.8 — Reports and KPI unification
- FIX.9 — UI workflow safety and error handling
- FIX.10 — Automated tests and UAT
- FIX.11 — Performance, observability, backup, and production hardening
- DEFERRED — OCPP isolation and future roadmap

For every proposed phase include:

- Objective
- Included findings
- Dependencies
- Files likely affected
- Database impact
- Security impact
- Test requirements
- Acceptance criteria
- Risk
- Whether a separate planning prompt is required
- Whether a separate implementation prompt is required
- Whether a separate runtime UAT prompt is required

## 24. Final Recommendation

State clearly:

- What must be fixed first
- What should not be changed yet
- What data must be backed up
- What business decisions are needed
- Whether the application should be used for authoritative operator handover today
- Whether reports should be considered final today
- Whether historical data may require correction

---

# Required Analysis Standards

The analysis must be:

- Deep
- Technical
- Functional
- Financially aware
- Evidence-based
- Phase-oriented
- Conservative
- Reproducible
- Honest about uncertainty
- Focused on the real daily-import business workflow

Do not provide a superficial code review.

Do not focus only on TypeScript errors.

Do not focus only on UI.

Do not focus only on security.

Do not focus only on database structure.

The report must connect all layers:

**File Import  
→ Validation  
→ Database  
→ Relationships  
→ Tariff  
→ Calculation  
→ Operator  
→ Shift  
→ Handover  
→ Accounting  
→ Reports  
→ Permissions  
→ Audit Trail**

---

# Required Command and Verification Log

Include a table of all commands executed, such as:

- Dependency installation
- Typecheck
- Lint
- Build
- Test commands
- Search commands
- Migration inspection
- Schema comparison

For every command record:

- Command
- Result
- Errors
- Interpretation
- Affected modules

Do not claim runtime verification unless the application was actually run.

Do not claim database verification unless the relevant database or local Supabase environment was available.

Clearly distinguish:

- Static verification
- Build verification
- Local runtime verification
- Database verification
- Manual UI verification
- Not verified

---

# Final Safety Instruction

This is an audit-only phase.

Do not implement the correction roadmap.

Do not update source code.

Do not update SQL.

Do not update migrations.

Do not remove OCPP.

Do not rewrite services.

Do not change calculations.

Do not update the Source of Truth unless specifically instructed in a later prompt.

Create only:

`EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

At the end of the report, include:

> **Implementation Status: NOT STARTED**  
> This report is an evidence-based analysis and recommended phased roadmap only. No correction phase should begin until the report is reviewed and approved by Sameer.
