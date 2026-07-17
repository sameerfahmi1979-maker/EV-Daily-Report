# CURSOR IMPLEMENTATION PROMPT — PHASE C PRODUCTION ACTIVATION & CLOSURE UAT + PHASE D IMPLEMENTATION + PHASE D PRODUCTION ACTIVATION & CLOSURE UAT

## Combined Phase Codes

- `EV-C-ACTIVATION-CLOSURE`
- `EV-D`
- `EV-D-ACTIVATION-CLOSURE`

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
- `docs/IMPORT_WORKFLOW_V2.md`
- All existing A1/A2/B/C migrations, reports, tests, rollback scripts, generated types, and feature-flag code

---

# 1. Combined Objective and Strict Gates

This is one execution prompt containing three sequential and strictly gated parts.

## Part 1 — Phase C Production Activation and Closure UAT

Activate the already implemented import workflow v2 in a controlled production soak, complete browser/runtime testing, reconcile migration history, post one genuinely new small machine file through the transactional RPC, verify all relationships and billing, expand access to the Import Officer role only after administrator soak passes, and formally close Phase C.

## Part 2 — Phase D Implementation

Only if Phase C production closure reaches `PASS`, implement:

- Payment methods: Cash, Card, CliQ
- Mixed payment methods within one imported file/shift
- Batch-level default payment method with transaction-level override
- Payment allocation validation and reconciliation
- Operator physical cash responsibility
- Shift/operator handover
- Expected cash, actual cash, shortage, and surplus
- Submission, review, approval, rejection, lock, controlled reopen
- Adjustments and audit trail
- Restrictions on recalculation and financial mutation after locking
- Role/station security
- Basic payment and handover views required for workflow operation
- Feature-flagged production rollout

## Part 3 — Phase D Production Activation and Closure UAT

Only after Phase D implementation tests pass, activate the Phase D workflow in production using controlled test/soak records, verify mixed Cash/Card/CliQ scenarios, confirm cash handover excludes Card and CliQ, verify approvals and locking, verify reopen controls, and formally close Phase D.

Do not start Phase E.

---

# 2. Confirmed Business Rules

These rules are authoritative.

## 2.1 Payment Methods

Only:

```text
Cash
Card
CliQ
```

No other payment method is active in this phase.

## 2.2 Physical Cash Responsibility

```text
Expected Physical Cash
= Sum of Cash transaction amounts
+ Approved cash-increasing adjustments
- Approved cash-decreasing adjustments
```

Card and CliQ must never be included automatically in physical cash handover.

## 2.3 Revenue Reconciliation

For the relevant shift/import/operator scope:

```text
Billing Total
= Cash Total + Card Total + CliQ Total
```

Tolerance:

```text
0.001 JOD
```

No payment allocation may create or destroy revenue.

## 2.4 Mixed Methods

Mixed payment methods within one file and one shift are supported.

Recommended UI behavior:

- Select a default payment method for the import/batch.
- Apply it to all eligible transactions.
- Permit per-transaction override before handover lock.
- Show unassigned and reconciliation counts.

## 2.5 Operator Responsibility

The operator linked through the approved import/session relationship is responsible for the physical cash amount of Cash transactions only.

Operator assignment remains user-selected and card-validated. It is not roster-derived.

## 2.6 Approval Matrix

Use this default unless existing approved repository rules are stricter:

- Operator or Import Officer may prepare/submit a handover.
- Accountant may review, approve, reject, and lock.
- Operations Manager may review, approve, reject, lock, and reopen with reason.
- System Administrator may perform all actions, including emergency reopen with reason.
- Station Manager may review within assigned station and may approve only if the application’s permission model explicitly grants that authority.
- Report Viewer is read-only.
- Pending, disabled, and rejected users are denied.

An approver cannot approve their own handover unless they are System Administrator performing an emergency action with mandatory reason and audit entry.

## 2.7 Shift Date

Use the shift start date in `Asia/Amman` as the operational shift date unless the existing implemented shift model has a stronger approved convention.

Do not collapse next-day sessions into incorrect timestamps.

## 2.8 Financial Precision

- Currency: JOD
- Stored/displayed money: 3 decimals
- Rounding: same approved Phase B policy
- No Demand Charge
- Tax = 0

---

# 3. Absolute Scope Limit

## Included

### Phase C Closure

- Frontend deployment/readiness verification
- Supabase migration history reconciliation
- Controlled flag activation
- Admin soak
- New-file transactional post
- Import Officer authorization test
- Operator/card/filename validation
- Duplicate-file/hash behavior
- Transaction duplicate behavior
- Relationship verification
- Billing v2 verification
- Rollback test/readiness
- Closure report

### Phase D

- Payment allocation
- Payment method UI/UX
- Payment reconciliation
- Handover data model
- Expected/actual cash
- Shortage/surplus
- Submission/review/approval/rejection
- Lock/reopen
- Adjustments
- Recalculation restrictions
- Audit
- Security
- Tests
- Production feature flag
- Activation UAT
- Closure report

## Excluded

Do not:

- Redesign all reports
- Implement full Phase E KPI/Excel/PDF reconciliation
- Recalculate historical billing
- Retroactively assign payment methods to all historical sessions automatically
- Change tariff rates or billing engine mathematics
- Reintroduce Demand Charge
- Add tax
- Activate OCPP
- Build an accounting general ledger
- Add external payment-gateway integration
- Add card settlement-bank reconciliation beyond basic entered references
- Add CliQ API integration
- Delete valid production financial records
- Start Phase E or F

---

# 4. Execution Rules

- Inspect before editing.
- Use production-safe, migration-driven changes.
- Preserve A1 uniqueness.
- Preserve A2 RLS/RPC security.
- Preserve Phase B engine v2.
- Preserve Phase C source relationships.
- Use feature flags for activation.
- Keep old import path available during C soak.
- Keep Phase D UI hidden until implementation passes.
- Use server-authoritative RPCs for posting, handover submission, approval, lock, reopen, and financial adjustments.
- Reject anonymous access.
- Validate role and station scope server-side.
- Use safe `search_path`.
- Write auditable events for every financial state change.
- Do not rely on client totals.
- Never silently repair financial discrepancies.
- Stop on unexpected production mutation.

---

# PART 1 — PHASE C PRODUCTION ACTIVATION AND CLOSURE UAT

# 5. Phase C Preflight

Before activation, verify:

1. Production project ref is exactly `qflxupfeyktdrpilctyo`.
2. Correct repository and branch.
3. A1 duplicate billing groups = 0.
4. A2 RLS remains active.
5. Anonymous mutation RPCs remain denied.
6. Billing engine v2 is enabled.
7. `import_workflow_v2_enabled=false` before soak.
8. All seven Phase C migrations exist in repository.
9. Production Phase C schema objects exist.
10. Migration history is reconciled accurately.
11. Frontend build includes:
    - Integrity panel
    - Hash calculation
    - Operator/card/name status
    - v2 workflow flag handling
12. A new small machine file is available that has never been posted.
13. File transaction IDs are absent from production.
14. Backup/PITR or logical rollback checkpoint exists.
15. A working approved System Administrator login is available.
16. A safe Import Officer test account exists or can be created and station-scoped.

Stop if the new file is not genuinely new.

Do not use the two already imported July 16 sample files as the net-new success fixture.

---

# 6. Reconcile Supabase Migration History

Phase C migrations were applied through direct SQL.

Inspect:

- Actual production schema
- `supabase_migrations.schema_migrations`
- Local migration files
- Checksums/version ordering
- Applied SQL objects

Use `supabase migration repair` only when verified appropriate.

Do not mark an unapplied migration as applied.

Do not re-run destructive or duplicate DDL blindly.

Create:

```text
scripts/production/c_migration_history_reconciliation.md
```

Record:

- Local version
- Production object evidence
- History status before
- Repair action
- History status after

---

# 7. Deploy and Smoke the Phase C Frontend

Build and verify:

- No TypeScript errors
- No test failures
- Correct production Supabase URL
- Integrity panel visible
- Environment is not labeled staging
- File hash generated
- Selected operator shown
- Detected card shown
- Filename name shown
- Match/warning/conflict states display
- Preview counts display
- Invalid rows display
- Post action respects feature flag
- Network requests target production only

Do not enable v2 posting until preview smoke passes.

---

# 8. Phase C Admin Soak Activation

Set:

```text
import_workflow_v2_enabled=true
```

Initially restrict actual v2 posting to:

```text
system_admin
```

If the current flag is global, implement a safe temporary role-gate or admin-only rollout control.

Record activation timestamp and actor.

Keep rollback ready:

```sql
UPDATE system_settings
SET value='false'
WHERE key='import_workflow_v2_enabled';
```

---

# 9. Phase C Net-New File UAT

Using one new small machine file:

1. Select correct station.
2. Select correct operator.
3. Upload file.
4. Verify hash.
5. Verify filename/operator/card result.
6. Review preview.
7. Confirm row validation.
8. Confirm duplicate count = 0.
9. Post through `post_import_batch_v2`.
10. Confirm billing engine v2 runs automatically.

Verify database relationships:

- One import batch
- Correct file hash
- Correct normalized filename
- Correct parser version
- Correct operator
- Correct station
- Correct uploader/poster
- Correct session source rows
- Correct source transaction IDs
- Correct source row numbers
- Correct source file hash
- Correct billing links
- Correct engine version
- No orphan session
- No orphan billing
- No duplicate billing
- Batch status reflects reality

Verify totals:

- Parsed count = posted count + rejected/skipped count
- Billing count = posted billable sessions
- Demand = 0
- Tax = 0
- JOD reconciliation within 0.001

---

# 10. Phase C Conflict and Duplicate UAT

## Wrong Operator

Select an operator whose full normalized card conflicts.

Expected:

- Posting blocked
- Clear conflict message
- No batch/session/billing mutation
- Audit/validation record where designed

## Filename Warning

Use or safely simulate a filename mismatch with correct card.

Expected:

- Warning shown
- Explicit confirmation required
- Authorized user may proceed
- Confirmation and reason recorded if required

## Unknown Card

Expected:

- No silent operator creation
- Safe review path
- Selected operator remains explicit
- Mapping requires authorization

## Exact Duplicate File

Re-upload the successful net-new file.

Expected:

- Hash duplicate detected
- No duplicate sessions
- No duplicate billing
- Clear duplicate status/message

## Duplicate Transactions in Different File

Expected:

- Existing machine IDs skipped or blocked according to design
- No silent overwrite
- Accurate counts

---

# 11. Phase C Import Officer Soak

After System Administrator soak passes:

- Grant/confirm `import_officer` role.
- Scope the user to the production station.
- Confirm the user can upload, preview, and post within assigned station.
- Confirm the user cannot:
  - Manage users
  - Change tariffs
  - Recalculate unrestricted history
  - Access another station
  - Approve/reopen future handovers unless separately permitted
- Confirm Report Viewer and pending user cannot post.

---

# 12. Phase C Rollback Verification

Do not delete valid successful UAT data unless it was explicitly created as disposable and rollback is authorized.

Verify flag rollback:

1. Set `import_workflow_v2_enabled=false`.
2. Confirm v2 posting is disabled.
3. Confirm production app remains usable.
4. Re-enable only after verification.
5. Record duration and result.

If v2 posting caused incorrect financial data, use the exact import ledger and approved rollback.

---

# 13. Phase C Closure Gate

Phase C closes only when:

1. Frontend deployed and smoke-tested.
2. Migration history reconciled.
3. Admin flag-on soak passed.
4. Net-new file posted transactionally.
5. Operator/card/filename resolution passed.
6. Hash duplicate detection passed.
7. Transaction duplicate protection passed.
8. Billing v2 automatic result passed.
9. Relationships passed.
10. Import Officer role passed.
11. Unauthorized roles denied.
12. Rollback flag test passed.
13. A1/A2/B regressions passed.

If any item fails, do not begin Phase D.

Create:

```text
EV_CHARGING_SYSTEM_PHASE_C_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md
```

End it with:

> **Phase C Production Closure Status:** PASS / FAIL / BLOCKED  
> **Phase D Implementation Authorization:** AUTHORIZED / NOT AUTHORIZED

---

# PART 2 — PHASE D IMPLEMENTATION

# 14. Phase D Current-State Audit

Before designing schema, inspect:

- Existing `charging_sessions`
- Existing `billing_calculations`
- Existing `shifts`
- Existing handover tables/components/services
- Existing payment fields
- Existing shift totals
- Existing accounting pages
- Existing report queries
- Existing lock/finalization behavior
- Existing audit actions
- Existing recalculation RPCs
- Existing permissions

Do not assume old handover code is reliable merely because UI exists.

Document current reusable objects and defects in the Phase D report.

---

# 15. Payment Allocation Model

Each billable charging session must have exactly one active payment allocation:

```text
Cash | Card | CliQ
```

Recommended design:

- `payment_method` on an allocation/transaction-payment table, or on the session only if audit/version requirements are still satisfied.
- Prefer a normalized payment-allocation table if reassignment and history are required.
- One active allocation per session.
- Allocation amount must equal authoritative billing total.
- Store billing calculation/version reference.
- Store assigned by/at.
- Store source:
  - import_default
  - manual_override
  - correction
- Store optional payment reference:
  - Card terminal/reference
  - CliQ reference
  - Cash receipt/reference
- Store notes where needed.

Do not duplicate billing total as a second uncontrolled source of truth.

---

# 16. Payment Assignment UX

Implement:

## Batch Default

During import preview or post-import payment preparation:

- Choose default Cash/Card/CliQ.
- Apply to all unassigned sessions.
- Show affected count and total.

## Transaction Override

Allow per-transaction override before handover lock.

Display:

- Transaction ID
- Timestamp
- Operator
- Billing total
- Payment method
- Optional reference
- Validation state

## Summary

Always display:

- Billing total
- Cash total
- Card total
- CliQ total
- Unassigned total
- Difference

Posting/handover submission is blocked unless:

```text
Billing Total = Cash + Card + CliQ
```

within 0.001 JOD and unassigned count = 0.

---

# 17. Shift and Handover Scope

One handover should represent a defined operational scope, preferably:

```text
station + operator + shift
```

and include linked import batches/sessions.

If actual existing shift design differs, preserve valid relationships while ensuring one handover cannot accidentally include another operator or station.

The handover must store snapshots sufficient for audit.

---

# 18. Handover Data Model

Create or enhance tables such as:

## `cash_handovers`

Suggested fields:

- `id`
- `handover_number`
- `station_id`
- `operator_id`
- `shift_id`
- `shift_date`
- `status`
- `currency`
- `billing_total`
- `cash_total`
- `card_total`
- `cliq_total`
- `expected_cash`
- `actual_cash_received`
- `shortage_amount`
- `surplus_amount`
- `net_adjustments`
- `submitted_by`
- `submitted_at`
- `reviewed_by`
- `reviewed_at`
- `approved_by`
- `approved_at`
- `locked_by`
- `locked_at`
- `rejected_by`
- `rejected_at`
- `rejection_reason`
- `reopened_by`
- `reopened_at`
- `reopen_reason`
- `version`
- `created_at`
- `updated_at`

## `cash_handover_sessions`

Link included sessions and snapshot:

- Handover ID
- Session ID
- Billing calculation ID
- Payment allocation ID
- Payment method snapshot
- Amount snapshot

## `cash_handover_adjustments`

- Handover ID
- Adjustment type
- Cash impact direction
- Amount
- Reason
- Evidence/reference
- Requested by
- Approved by
- Status
- Created/approved timestamps

Use actual repository naming conventions.

---

# 19. Handover Status Workflow

Recommended statuses:

```text
draft
ready_to_submit
submitted
under_review
approved
locked
rejected
reopened
cancelled
```

Valid transitions must be enforced server-side.

Examples:

```text
draft → ready_to_submit → submitted → under_review
under_review → approved → locked
under_review → rejected
rejected → draft
locked → reopened (authorized only)
reopened → under_review → approved → locked
```

Do not permit arbitrary direct status updates from the client.

---

# 20. Expected Cash, Actual Cash, Shortage, Surplus

Authoritative formulas:

```text
Expected Cash
= Cash payment allocations
+ approved positive cash adjustments
- approved negative cash adjustments
```

```text
Difference
= Actual Cash Received - Expected Cash
```

```text
Shortage
= max(Expected Cash - Actual Cash Received, 0)
```

```text
Surplus
= max(Actual Cash Received - Expected Cash, 0)
```

Use numeric arithmetic and three-decimal rounding.

Require explanation when shortage or surplus is non-zero.

Optional configurable tolerance may be added, default:

```text
0.000 JOD
```

Do not auto-write off differences.

---

# 21. Adjustments

Supported adjustment categories may include:

- Cash correction
- Refund
- Approved cash expense
- Counting correction
- Other approved cash-only adjustment

Every adjustment must:

- Have amount
- Have direction
- Have reason
- Have creator
- Require authorized approval before affecting expected cash
- Be immutable after locked except through reopen/version workflow
- Be audited

Card or CliQ corrections should not alter physical cash unless explicitly represented as a cash-impacting approved adjustment.

---

# 22. Submission, Review, Approval, and Lock

## Submit

Before submission, validate:

- All sessions have payment methods
- Payment reconciliation passes
- Billing records exist
- No duplicate sessions in another locked handover
- Correct operator/station/shift
- No unresolved billing failure
- Expected cash calculated server-side
- Actual cash entered
- Difference reason entered when needed

## Review

Reviewer sees:

- Shift/operator/station
- Included sessions
- Billing/payment summary
- Expected vs actual cash
- Shortage/surplus
- Adjustments
- Audit history

## Approve

Authorized reviewer confirms correctness.

## Lock

Lock must freeze:

- Payment allocation changes
- Included session set
- Billing recalculation affecting included sessions
- Operator reassignment
- Shift reassignment
- Adjustments
- Handover totals

Any later correction requires controlled reopen.

---

# 23. Reopen

Only Operations Manager or System Administrator by default.

Requirements:

- Mandatory reason
- Original locked snapshot retained
- Version increment
- Audit entry
- Reopened status
- Affected payment/billing changes visible
- Reapproval and relock required

Do not delete the previous handover history.

---

# 24. Recalculation Restrictions

Modify or wrap:

- Session recalculation
- Batch recalculation
- Shift recalculation
- Any billing replacement RPC
- Import deletion/cancellation

Required:

- If a session belongs to a locked handover, deny mutation.
- Return a clear error with handover number/status.
- Allow only after authorized reopen.
- Audit denied attempts where appropriate.

Do not simply disable buttons; enforce in database/RPC.

---

# 25. Historical Data Strategy

Do not auto-assign Cash to all history.

For pre-Phase-D sessions:

- Mark payment assignment as unassigned/legacy.
- Permit controlled future classification.
- Exclude unclassified history from finalized handover until reviewed.
- Provide a comparison/count report.
- Do not lock historical handovers automatically.

Historical correction remains later approval work.

---

# 26. Phase D Security Matrix

## System Administrator

- Full access
- Emergency reopen with reason
- Cannot bypass audit

## Operations Manager

- View/manage assigned organization/stations
- Approve/lock
- Reopen with reason
- Review adjustments

## Accountant

- Review
- Approve/reject
- Lock
- Manage actual cash receipt
- Cannot alter tariffs/import identity

## Station Manager

- Prepare/review station scope
- Approval only if explicit permission exists
- Cannot cross station

## Import Officer

- Assign payment methods within permitted workflow before submission
- Prepare handover if authorized
- Cannot approve own handover
- Cannot reopen locked handover

## Report Viewer

- Read only

## Pending/Disabled/Rejected/Anon

- Denied

Enforce with RLS and RPC authorization.

---

# 27. Phase D UI/UX

Implement focused workflow screens/components:

## Payment Assignment

- Batch/shift selector
- Default payment method action
- Transaction table with override
- Cash/Card/CliQ totals
- Unassigned count
- Reconciliation indicator
- Validation errors

## Handover Draft

- Operator, station, shift
- Included batches/sessions
- Billing total
- Payment totals
- Expected cash
- Actual cash input
- Shortage/surplus
- Adjustment section
- Submit action

## Review and Approval

- Readable summary
- Differences highlighted
- Evidence/references
- Audit history
- Approve/reject/lock actions based on permission

## Locked View

- Immutable badge
- Lock actor/date
- Reopen action for authorized roles
- Version history

Keep enterprise styling and avoid unrelated redesign.

---

# 28. Suggested Phase D Migrations

Create controlled migrations such as:

1. `*_d_payment_method_foundation.sql`
2. `*_d_payment_allocations.sql`
3. `*_d_handover_tables.sql`
4. `*_d_handover_state_machine.sql`
5. `*_d_handover_calculation_rpcs.sql`
6. `*_d_locked_financial_guards.sql`
7. `*_d_handover_rls_and_grants.sql`
8. `*_d_phase_d_feature_flags.sql`

For every migration include:

- Preconditions
- Forward operations
- Constraints
- Indexes
- RLS
- Grants
- Verification
- Rollback/compensation
- Production risk

Regenerate database types.

---

# 29. Recommended RPCs

Names may follow repository standards:

- `assign_session_payment_method`
- `apply_batch_default_payment_method`
- `create_handover_draft`
- `refresh_handover_totals`
- `submit_handover`
- `review_handover`
- `approve_handover`
- `reject_handover`
- `lock_handover`
- `reopen_handover`
- `create_handover_adjustment`
- `approve_handover_adjustment`

All must be:

- Authenticated
- Role checked
- Station scoped
- Transactional
- Audited
- Safe search path
- Non-anonymous
- Idempotent where appropriate

---

# 30. Feature Flags

Create/use:

```text
payment_workflow_v1_enabled=false
handover_workflow_v1_enabled=false
```

After implementation tests:

- Enable for System Administrator soak only.
- Then Accountant/Operations Manager.
- Then operational roles.

Do not globally expose incomplete workflow.

Rollback must be possible by disabling flags without destroying data.

---

# 31. Phase D Automated Tests

Add tests for:

## Payments

- All Cash
- All Card
- All CliQ
- Mixed methods
- Default method apply
- Per-session override
- Unassigned blocked
- Allocation total mismatch blocked
- Duplicate allocation blocked
- JOD rounding

## Expected Cash

- Cash only included
- Card excluded
- CliQ excluded
- Positive adjustment
- Negative adjustment
- Shortage
- Surplus
- Zero difference

## Handover Workflow

- Draft
- Submit
- Review
- Approve
- Reject
- Lock
- Reopen
- Relock
- Invalid transition blocked
- Self-approval blocked
- Unauthorized reopen blocked

## Locked Guards

- Payment change denied
- Billing recalc denied
- Operator change denied
- Shift change denied
- Import deletion denied
- Adjustment mutation denied

## Security

- Anon denied
- Pending denied
- Report Viewer read-only
- Import Officer cannot approve
- Accountant cannot cross station
- Admin allowed with audit

## Regression

- A1 uniqueness
- A2 security
- B billing v2
- C transactional import
- Demand 0
- Tax 0
- No historical recalculation

---

# 32. Phase D Implementation Report

Create:

```text
EV_CHARGING_SYSTEM_PHASE_D_IMPLEMENTATION_AND_UAT_REPORT.md
```

Required sections:

1. Executive Summary
2. Phase C Gate
3. Current-State Audit
4. Payment Model
5. Mixed Payment Workflow
6. Handover Data Model
7. Expected Cash Formula
8. Adjustments
9. State Machine
10. Lock and Reopen
11. Recalculation Restrictions
12. Security Matrix
13. SQL Migrations
14. RPCs
15. UI/UX
16. Automated Tests
17. Production Rollout Plan
18. Rollback
19. Changed Files
20. Remaining Risks
21. Acceptance Checklist
22. Activation Recommendation

End with:

> **Phase D Implementation Status:** PASS / FAIL / BLOCKED  
> **Phase D Production Activation Authorization:** AUTHORIZED / NOT AUTHORIZED

Do not activate Phase D if implementation status is not PASS.

---

# PART 3 — PHASE D PRODUCTION ACTIVATION AND CLOSURE UAT

# 33. Phase D Activation Preflight

Before enabling flags:

1. Phase C closure = PASS.
2. Phase D implementation = PASS.
3. All migrations applied and history reconciled.
4. Frontend deployed.
5. Database types current.
6. Automated tests pass.
7. Backup/PITR verified.
8. RLS/RPC tests pass.
9. A safe controlled set of sessions exists for UAT.
10. UAT sessions are not already in a locked handover.
11. Authorized test users exist:
    - System Administrator
    - Accountant or Operations Manager
    - Import Officer
    - Report Viewer
12. Rollback scripts ready.

---

# 34. Phase D Controlled UAT Dataset

Prefer a small new shift/import created after Phase C closure.

If using existing recent sessions:

- Do not alter already finalized real operator cash responsibilities without explicit authorization.
- Create controlled UAT scope.
- Record all affected IDs.
- Do not use unrelated historical sessions.

Prepare at least these scenarios:

## Scenario A — All Cash

Billing total example determined from actual sessions.

Expected:

```text
Expected cash = full billing total
```

## Scenario B — All Card

Expected:

```text
Expected cash = 0
```

## Scenario C — All CliQ

Expected:

```text
Expected cash = 0
```

## Scenario D — Mixed

Example logical allocation:

```text
Cash: 10.000
Card: 6.500
CliQ: 3.500
Billing total: 20.000
Expected cash: 10.000
```

Use actual production values, not fabricated billing amounts, while preserving the formula.

## Scenario E — Shortage

```text
Actual cash < expected cash
```

Require reason.

## Scenario F — Surplus

```text
Actual cash > expected cash
```

Require reason.

## Scenario G — Approved Adjustment

Verify expected cash changes only after adjustment approval.

---

# 35. Admin-Only Activation

Enable:

```text
payment_workflow_v1_enabled=true
handover_workflow_v1_enabled=true
```

Initially allow System Administrator only.

Verify:

- UI visible
- Payment assignment works
- Totals server-calculated
- No cross-station leakage
- No anonymous access

---

# 36. Payment Assignment UAT

For controlled sessions:

1. Apply default method.
2. Override selected transactions.
3. Confirm totals.
4. Confirm one active allocation per session.
5. Confirm allocation equals billing amount.
6. Confirm references/notes where entered.
7. Confirm audit entries.
8. Confirm reconciliation:

```text
Billing = Cash + Card + CliQ
```

9. Attempt unassigned submission and confirm block.
10. Attempt mismatch and confirm block.

---

# 37. Handover UAT

## Draft

- Correct operator/station/shift
- Correct sessions
- Correct payment summary
- Correct expected cash

## Submit

- Enter actual cash
- Enter discrepancy reason if needed
- Submit by preparer

## Review/Approve

- Accountant or Operations Manager reviews
- Self-approval restriction verified
- Approve
- Lock

## Locked State

Verify all are denied:

- Payment method change
- Session removal/addition
- Billing recalculation
- Operator reassignment
- Shift reassignment
- Import deletion affecting included sessions
- Adjustment edit
- Direct API bypass

## Reopen

- Authorized role provides reason
- Version increments
- Prior snapshot retained
- Correction made
- Reapproval and relock completed

---

# 38. Role Expansion UAT

After admin soak:

## Import Officer

- Can assign/prepare within station
- Cannot approve/lock/reopen

## Accountant

- Can review/approve/reject/lock
- Cannot cross station
- Cannot alter tariff/import identity

## Operations Manager

- Can approve/lock/reopen within authorized scope

## Report Viewer

- Read-only

## Pending/Disabled/Rejected/Anon

- Denied

---

# 39. Direct API Security UAT

Test with real role sessions/tokens without exposing secrets.

Verify:

- Anon mutation denied
- Pending denied
- Cross-station denied
- Import Officer approval denied
- Report Viewer mutation denied
- Accountant allowed only approved actions
- Reopen restricted
- Locked financial mutation denied
- Direct table update cannot bypass RPC state machine

Document HTTP status and response.

---

# 40. Data Integrity and Regression

After activation:

- Duplicate billing groups = 0.
- Billing values unchanged by payment assignment.
- Cash/Card/CliQ sum to billing.
- Expected cash uses Cash only plus approved cash adjustments.
- Demand = 0.
- Tax = 0.
- No historical mass assignment.
- No historical recalculation.
- A2 RLS intact.
- C import workflow remains operational.
- Locked handovers cannot be bypassed.
- Audit history complete.

---

# 41. Phase D Rollback

Rollback levels:

## UI/Workflow Disable

Set flags false.

## Permission Rollback

Restore prior grants/policies if required.

## Data Rollback

Only for controlled disposable UAT records and only using the activation ledger.

Do not delete legitimate locked financial handovers casually.

Prefer:

- Cancel draft
- Reopen and reverse through audited adjustment
- Preserve history

Create:

```text
scripts/production/d_disable_workflow.sql
scripts/production/d_activation_ledger.json
scripts/production/d_verify_locked_guards.sql
```

---

# 42. Phase D Closure Report

Create:

```text
EV_CHARGING_SYSTEM_PHASE_D_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md
```

Required structure:

1. Executive Summary
2. Phase C Closure Gate
3. Phase D Implementation Gate
4. Production Preflight
5. Backup and Activation Ledger
6. Feature-Flag Activation
7. Payment Assignment Results
8. Cash/Card/CliQ Reconciliation
9. Mixed Payment Scenario
10. Expected vs Actual Cash
11. Shortage/Surplus
12. Adjustment Results
13. Submit/Review/Approve/Lock
14. Locked Mutation Guards
15. Reopen and Relock
16. Role and Station Security
17. Direct API Tests
18. A1/A2/B/C Regression
19. Data Integrity
20. Rollback Verification
21. Changed Production Objects
22. Remaining Risks
23. Acceptance Checklist
24. Recommended Next Step

End with:

> **Phase D Production Closure Status:** PASS / FAIL / BLOCKED  
> **Phase E Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.

---

# 43. Phase C Closure Acceptance Criteria

Phase C production closure passes only when:

1. Migration history reconciled.
2. Frontend integrity UI deployed.
3. Admin flag-on soak passes.
4. Net-new file posts transactionally.
5. Correct operator/card/filename validation.
6. File hash stored.
7. Exact duplicate file controlled.
8. Duplicate transactions controlled.
9. Relationships complete.
10. Billing automatic and correct.
11. Import Officer role passes.
12. Unauthorized roles denied.
13. Rollback flag verified.
14. A1/A2/B regressions pass.

---

# 44. Phase D Implementation Acceptance Criteria

Phase D implementation passes only when:

1. Cash/Card/CliQ are the only active methods.
2. Mixed methods supported.
3. One active allocation per session.
4. Allocations equal billing total.
5. Unassigned sessions block submission.
6. Expected cash excludes Card and CliQ.
7. Adjustments are approval-controlled.
8. Actual cash supported.
9. Shortage/surplus calculated correctly.
10. State transitions enforced server-side.
11. Self-approval prevented.
12. Lock freezes financial inputs.
13. Reopen requires authorization/reason/versioning.
14. Locked billing recalculation denied.
15. Role/station security enforced.
16. Audit trail complete.
17. Automated tests pass.
18. Feature flags and rollback exist.
19. No historical mass classification.
20. Implementation report complete.

---

# 45. Phase D Production Closure Acceptance Criteria

Phase D closes only when:

1. Frontend deployed.
2. Flags activated safely.
3. All-Cash scenario passes.
4. All-Card scenario passes.
5. All-CliQ scenario passes.
6. Mixed scenario passes.
7. Billing = Cash + Card + CliQ.
8. Expected physical cash includes Cash only.
9. Shortage scenario passes.
10. Surplus scenario passes.
11. Adjustment approval passes.
12. Submission/review/approval/lock passes.
13. Locked mutation guards pass.
14. Reopen/reapproval/relock passes.
15. Role matrix passes.
16. Direct API security passes.
17. A1/A2/B/C regressions pass.
18. No historical mass change.
19. Rollback/disable path verified.
20. Closure report complete.

---

# 46. Stop Conditions

Stop immediately if:

- Production project cannot be confirmed.
- Backup/PITR cannot be verified.
- Phase C closure fails.
- A1 uniqueness breaks.
- A2 security weakens.
- B billing totals change unexpectedly.
- C import relationships break.
- Migration history cannot be safely reconciled.
- New-file C soak cannot be performed safely.
- Payment allocation changes authoritative billing.
- Billing does not reconcile to payment methods.
- Card or CliQ enters expected physical cash.
- Locked data can be mutated.
- Unauthorized role can approve/reopen.
- Historical records are mass-updated.
- Direct API bypass exists.
- Rollback is unavailable.

Do not continue to the next part after a failed gate.

---

# 47. Final Instruction

Execute in this exact sequence:

```text
Phase C Production Activation and Closure UAT
→ only if PASS:
Phase D Implementation
→ only if PASS:
Phase D Production Activation and Closure UAT
```

Do not start Phase E.

Do not recalculate historical billing.

Do not activate OCPP.

Do not add Demand Charge.

Do not add tax.

Do not weaken RLS or RPC security.

Do not claim closure when activation/runtime tests remain pending.
