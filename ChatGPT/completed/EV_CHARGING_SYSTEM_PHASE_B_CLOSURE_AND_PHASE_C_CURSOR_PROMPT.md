# CURSOR IMPLEMENTATION PROMPT — PHASE B PRODUCTION CLOSURE UAT + PHASE C IMPLEMENTATION

## Combined Phase Codes

- `EV-B-CLOSURE`
- `EV-C`

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Production Supabase Project

```text
Project Ref: qflxupfeyktdrpilctyo
Environment: PRIMARY / LIVE / PRODUCTION
```

## Governing Files

Read and follow:

- `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_A2_PRODUCTION_DEPLOYMENT_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_B_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

## Sample Files

Use:

- `C:\dev\EV-DR\EV-Daily-Report\sample files\2026-07-16+abo saleh.xlsx`
- `C:\dev\EV-DR\EV-Daily-Report\sample files\2026-07-16+mohammad.xlsx`

---

# 1. Combined Objective

This prompt has two strictly gated parts:

## Part 1 — Phase B Production Closure UAT

Complete the real end-to-end production verification of Phase B using the two approved sample machine files.

The closure must prove:

- Real Excel import works.
- Correct operator relationship is established.
- Overnight next-day transaction is stored correctly.
- Billing engine v2 runs automatically.
- Bulk Recalculate is not required.
- Tariff boundary splitting is correct.
- Duplicate re-import is safely prevented.
- Demand Charge remains zero.
- Tax remains zero.
- JOD totals reconcile to 0.001.
- No unrelated historical records are changed.
- Phase A1/A2 protections remain intact.

## Part 2 — Phase C Import Workflow and Relationship Integrity

Only if Phase B closure reaches `PASS`, implement Phase C.

Phase C must strengthen and complete:

- File-to-operator relationship
- Card ID/operator resolution
- Filename/operator cross-check
- Import batch ownership
- Session/import/operator/station relationships
- Duplicate-file and duplicate-transaction protection
- Import validation
- Import preview and exception handling
- Transactional posting
- Import auditability
- Re-upload safety
- Clear import status
- Safe correction paths
- Relationship integrity across reports and billing

Do not begin Phase C if Phase B closure fails or remains blocked.

---

# 2. Absolute Scope Limit

## Included

### Phase B Closure

- Production backup/checkpoint
- Controlled import of both approved sample files
- Transaction verification
- Billing verification
- Duplicate re-import test
- Overnight timeline verification
- A1/A2/B regression
- Rollback readiness
- Closure report

### Phase C

- Import parser hardening
- Operator resolution
- Card ID matching
- Filename metadata cross-check
- Import batch/session relationships
- Duplicate detection
- Idempotent import
- Transactional posting
- Import exceptions
- Import preview
- Import status model
- Safe reprocessing
- Import audit log
- Relationship and data-integrity tests
- UI improvements directly related to import workflow
- Required migrations
- Required reports

## Excluded

Do not:

- Implement Cash/Card/CliQ
- Implement cash handover
- Implement shift handover
- Change tariff rates
- Recalculate historical billing
- Activate OCPP
- Add finance/accounting modules
- Redesign unrelated pages
- Change historical operator assignments automatically
- Delete valid production data
- Modify unrelated reports
- Start Phase D

---

# 3. Execution Rules

Read the repository before editing.

Inspect actual code, migrations, RPCs, policies, and production schema.

Use migrations for database changes.

Preserve:

- Phase A1 unique billing protection
- Phase A2 RLS and RPC security
- Phase B billing engine v2
- `Asia/Amman`
- Demand Charge = 0
- Tax = 0
- JOD three-decimal precision

Use:

- Server-side authoritative persistence
- Idempotent operations
- Explicit audit entries
- Role and station-scope checks
- Transactional import posting
- Clear rollback paths
- No anonymous mutation
- No silent fallback to legacy financial logic

---

# 4. Mandatory Preflight

Before importing or modifying anything, verify:

1. Correct repository.
2. Correct Git branch/worktree.
3. Production project ref is exactly `qflxupfeyktdrpilctyo`.
4. Billing engine v2 flag is active.
5. Phase A1 duplicate billing groups = 0.
6. Phase A1 unique billing constraint exists.
7. Phase A2 open RLS policies remain removed.
8. Anonymous financial RPC execution remains blocked.
9. Three approved system administrators still exist.
10. Production backup/PITR or logical backup is available.
11. Sample files exist and are readable.
12. Target transaction IDs do not already exist, or their current status is fully understood.
13. Existing import batches with same filename/hash are inventoried.
14. No unrelated pending migration is mixed into this task.

If any critical check fails, stop.

---

# 5. Phase B Closure — Production Safety Preparation

Before importing:

- Create a backup/checkpoint of affected tables.
- Snapshot counts and IDs from:
  - `import_batches`
  - `charging_sessions`
  - `billing_calculations`
  - `billing_breakdown_items`
  - `operators`
  - `shifts`
  - `audit_log`
- Record current billing-engine flag.
- Record current tariff periods.
- Record current demand values.
- Record current tax behavior.
- Record current duplicate groups.
- Record current RLS/RPC security state.

Create a reversible import ledger containing:

- Batch ID
- File name
- File hash
- Inserted session IDs
- Billing calculation IDs
- Breakdown IDs
- Audit IDs
- Operator ID
- Station ID
- Import timestamp

Do not proceed without rollback traceability.

---

# 6. Phase B Closure — File 1: Abo Saleh

Import:

```text
2026-07-16+abo saleh.xlsx
```

Expected operator/card context:

```text
Operator: Abo Saleh
Card ending: 6424
```

Critical transaction:

```text
Transaction ID: 1573323579
Start: 2026-07-15 23:53:32
End:   2026-07-16 00:37:05
Energy: 38.000 kWh
Expected tariff: MID
Expected rate: 0.193 JOD/kWh
Expected total: 7.334 JOD
```

Verify:

- End date is next day.
- Duration is positive and correct.
- No date collapse.
- Session links to correct operator.
- Session links to correct station.
- Session links to correct import batch.
- Billing is created automatically.
- No manual Bulk Recalculate required.
- Exactly one billing calculation exists.
- Breakdown reconciles.
- Demand = 0.
- Tax = 0.
- Engine version is v2.
- Billing source is import.
- Audit entries exist.
- Import batch billing status is successful.

---

# 7. Phase B Closure — File 2: Mohammad

Import:

```text
2026-07-16+mohammad.xlsx
```

Expected operator/card context:

```text
Operator: Mohammad
Card ending: 6443
```

Critical boundary transaction IDs:

- `1409778499`
- `1613808371`
- `445488588`
- `1201532186`
- `696086752`
- `2046279491`

For each:

- Read exact timestamps and energy from the file.
- Calculate expected proportional split at 14:00.
- Compare:
  - Segment duration
  - Segment energy
  - Applied rate
  - Segment amount
  - Final rounded total
- Verify SQL result matches TypeScript preview.
- Verify billing was automatic.
- Verify uniqueness.
- Verify no demand/tax contribution.
- Verify operator and batch relationships.

Produce an expected-vs-actual table.

---

# 8. Phase B Closure — Duplicate Re-import Test

After successful initial import, attempt to import each file again.

Required behavior:

- Duplicate file is detected before creating duplicate sessions, or
- Duplicate transactions are safely skipped with clear explanation.

Must not:

- Create duplicate charging sessions.
- Create duplicate billing rows.
- Create orphan breakdown rows.
- Change existing billing totals.
- Create a second operational batch without explicit user confirmation.
- Silently overwrite original records.

Record:

- Detection mechanism
- User message
- Database result
- Audit result

---

# 9. Phase B Closure — Timeline UI Verification

Open tariff timeline and confirm:

- MID is represented as two visual segments.
- 23:00–24:00 displays correctly.
- 00:00–05:00 displays correctly.
- No negative width.
- No overflow.
- No duplicated logical tariff record.
- Full-day coverage indicator is correct.
- Demand Charge is absent from active UI.
- Tax is absent from active billing UI.

Capture findings in the report.

---

# 10. Phase B Closure — Regression Checks

Verify after both imports:

- Duplicate billing groups = 0.
- A1 archives unchanged.
- A2 RLS still enforced.
- Anonymous session/billing access blocked.
- Anonymous v2 RPC execution blocked.
- Admin workflows still function.
- Historical billing rows outside imported batches unchanged.
- No global recalculation occurred.
- Billing engine flag remains enabled.
- Current tariff rates unchanged.
- Demand remains zero.
- Tax remains zero.

If all pass, mark Phase B closure `PASS`.

If not, stop before Phase C.

---

# 11. Phase C — Business Workflow

The real workflow is:

1. Officer downloads one machine file.
2. One file normally belongs to one operator and one shift.
3. User selects the operator before import.
4. File may contain card ID.
5. Filename may contain operator name.
6. System validates these sources.
7. User reviews parsed transactions.
8. System posts the batch.
9. Sessions are linked to operator, station, and batch.
10. Billing engine v2 runs automatically.
11. Exceptions are shown clearly.
12. Duplicate re-upload is controlled.

The operator is not roster-derived.

Do not infer operator from a shift roster.

---

# 12. Phase C — Operator Resolution Model

Implement authoritative resolution using:

## Primary

User-selected operator.

## Supporting Checks

- Card ID in file
- Operator card ID stored in ERP
- Operator name parsed from filename
- Existing operator aliases if repository supports them

Required outcomes:

### Match

Selected operator, card ID, and filename agree.

Result:

```text
Ready to import
```

### Warning

Selected operator matches card ID but filename differs.

Result:

```text
User may proceed after explicit confirmation
```

### Conflict

Selected operator conflicts with file card ID.

Result:

```text
Block posting until corrected or approved by authorized role
```

### Unknown Card

Card ID not mapped.

Result:

```text
Require operator selection and authorized mapping workflow
```

Do not silently create a new operator.

Do not silently reassign an existing card.

---

# 13. Phase C — Operator Card Integrity

Add or verify:

- Card ID normalized consistently
- Unique active card mapping where business rules require
- Card history if reassignment is needed later
- No duplicate active card assignment
- Audit trail for card changes
- Station scope for operator/card access
- Safe handling of masked card values

If only the last four digits are present, do not pretend it is globally unique without additional validation.

Document collision handling.

---

# 14. Phase C — File Identity

Add reliable file identity:

- Original filename
- Normalized filename
- SHA-256 hash
- File size
- Sheet name
- Row count
- Parsed transaction count
- Parser version
- Uploaded by
- Uploaded at
- Station
- Selected operator
- Detected card ID
- Filename operator text
- Import status

Use file hash as a strong duplicate signal.

Do not rely only on filename.

---

# 15. Phase C — Transaction Identity

Determine authoritative duplicate identity from actual file structure.

Prefer stable machine transaction ID where available.

Required:

- Unique machine transaction ID within appropriate scope
- Fallback composite only if transaction ID is missing
- Collision logging
- No silent overwrite
- Clear duplicate status

Possible fallback composite:

```text
station + card + start_timestamp + end_timestamp + energy
```

Use only after confirming actual data quality.

---

# 16. Phase C — Import Status Model

Implement clear statuses such as:

- `uploaded`
- `parsed`
- `validation_failed`
- `review_required`
- `ready_to_post`
- `posting`
- `partially_posted`
- `posted`
- `billing_failed`
- `completed`
- `duplicate`
- `cancelled`
- `rolled_back`

Use repository conventions if status names differ.

Statuses must reflect reality.

Do not mark completed if billing failed.

---

# 17. Phase C — Import Preview

Before posting, show:

- File name
- Detected operator text
- Detected card ID
- Selected operator
- Match/warning/conflict status
- Station
- Date range
- Transaction count
- Total energy
- Overnight count
- Boundary-crossing count
- Duplicate transaction count
- Invalid row count
- Expected billing readiness

Allow filtering:

- Valid
- Warning
- Conflict
- Duplicate
- Invalid
- Overnight
- Cross-period

Do not post automatically before review unless the existing approved workflow explicitly requires it.

---

# 18. Phase C — Row Validation

Validate each row for:

- Transaction ID
- Start timestamp
- End timestamp
- Positive duration
- Correct next-day handling
- Energy >= 0
- Required card data
- Supported date format
- Station context
- Operator context
- Duplicate state
- Tariff coverage availability
- Billing readiness

Invalid rows must:

- Not silently disappear
- Show row number
- Show original values
- Show error code
- Show human-readable message

---

# 19. Phase C — Transactional Posting

Posting must be atomic where possible.

Recommended flow:

1. Lock batch for posting.
2. Revalidate file hash.
3. Revalidate operator/card relationship.
4. Insert valid sessions.
5. Link sessions to batch/operator/station.
6. Run billing engine v2.
7. Persist breakdown.
8. Update batch status.
9. Write audit entries.
10. Commit.

On failure:

- Roll back inserted sessions/billing, or
- Mark explicit partial state with recoverable ledger.

Avoid ambiguous partial success.

---

# 20. Phase C — Import Batch Relationships

Every posted session must link to:

- Import batch
- Station
- Operator
- Source transaction ID
- Source row number if possible
- Original file identity
- Parser version

Every billing calculation must link to:

- Session
- Import batch
- Engine version
- Billing source

No orphan relationships.

Add foreign keys/indexes as needed.

---

# 21. Phase C — Reprocessing and Correction

Support safe reprocessing:

- Re-run parser without posting
- Correct selected operator before posting
- Resolve card conflict
- Retry failed billing
- Resume recoverable batch
- Cancel unposted batch
- Roll back authorized test batch where safe

Do not allow casual deletion of completed financial imports.

Use soft cancellation/audit where appropriate.

---

# 22. Phase C — UI/UX

Keep current enterprise UI conventions.

Required:

- Clear import wizard or drawer
- Operator selector
- Card match indicator
- Filename match indicator
- Preview table
- Validation summary
- Exception panel
- Post button with confirmation
- Progress state
- Final result summary
- Duplicate warning
- Safe retry action

Do not redesign unrelated pages.

---

# 23. Phase C — Security

Preserve A2.

Required permissions:

- System Administrator: full
- Operations Manager: authorized all-station import
- Station Manager: import/manage within assigned station if allowed
- Import Officer: upload, validate, and post within assigned station
- Accountant: read-only financial result
- Report Viewer: read-only
- Pending/disabled/rejected: denied

Every RPC must:

- Reject anon
- Require approved user
- Check role
- Check station scope
- Use safe search path
- Write audit
- Avoid trusting client station/operator IDs

---

# 24. Phase C — Suggested Database Changes

Create migration files as needed, such as:

1. `*_c_import_file_identity.sql`
2. `*_c_operator_card_integrity.sql`
3. `*_c_import_status_and_validation.sql`
4. `*_c_session_source_relationships.sql`
5. `*_c_transactional_import_posting.sql`
6. `*_c_import_rpc_security_and_audit.sql`

Possible fields:

## import_batches

- `file_hash`
- `file_size_bytes`
- `parser_version`
- `selected_operator_id`
- `detected_card_id`
- `detected_operator_name`
- `operator_match_status`
- `validation_summary`
- `posting_started_at`
- `posting_completed_at`
- `posted_by`
- `failure_reason`

## charging_sessions

- `source_transaction_id`
- `source_row_number`
- `source_import_batch_id`
- `source_file_hash`

Use actual schema conventions.

Do not duplicate fields unnecessarily.

---

# 25. Phase C — Automated Tests

Add tests for:

## File Identity

- Same filename/different hash
- Different filename/same hash
- Exact duplicate file

## Operator Matching

- Selected operator/card/name all match
- Filename mismatch warning
- Card conflict block
- Unknown card
- Duplicate active card mapping

## Timestamps

- Same-day
- Overnight
- Month-end
- Year-end
- Invalid negative duration

## Transactions

- Duplicate machine transaction
- Missing transaction ID
- Composite fallback collision
- Zero energy
- Invalid row

## Posting

- Full success
- Billing failure rollback
- Partial-state prevention
- Retry
- Duplicate re-import
- Unauthorized post
- Cross-station denial

## Relationships

- No orphan sessions
- No orphan billing
- Correct operator
- Correct station
- Correct batch

---

# 26. Phase C — Runtime UAT

Run:

## UAT-C-01 — Abo Saleh Import

- Select Abo Saleh
- Card 6424 match
- Filename match
- Preview
- Post
- Verify overnight transaction
- Verify billing

## UAT-C-02 — Mohammad Import

- Select Mohammad
- Card 6443 match
- Preview
- Post
- Verify boundary transactions

## UAT-C-03 — Duplicate File

- Re-upload same file
- Confirm duplicate control

## UAT-C-04 — Wrong Operator

- Select wrong operator
- Confirm card conflict blocks posting

## UAT-C-05 — Filename Warning

- Simulate filename mismatch with correct card
- Confirm warning and authorized confirmation

## UAT-C-06 — Unknown Card

- Confirm safe exception path

## UAT-C-07 — Unauthorized User

- Report viewer cannot post
- Pending user cannot access

## UAT-C-08 — A1/A2/B Regression

- Uniqueness intact
- RLS intact
- v2 billing intact
- demand/tax zero
- no historical recalc

---

# 27. Production Rollout

Use controlled activation.

Recommended:

1. Deploy schema.
2. Deploy parser/preview changes.
3. Keep posting disabled by feature flag.
4. Test preview with sample files.
5. Enable posting for admin only.
6. Test one controlled batch.
7. Verify relationships and billing.
8. Expand to import officer role.
9. Monitor exceptions.
10. Keep rollback path.

Use a feature flag such as:

```text
import_workflow_v2_enabled
```

Do not remove old import path until soak completes.

---

# 28. Required Deliverables

Create:

1. `EV_CHARGING_SYSTEM_PHASE_B_PRODUCTION_CLOSURE_UAT_REPORT.md`
2. `EV_CHARGING_SYSTEM_PHASE_C_IMPLEMENTATION_AND_UAT_REPORT.md`
3. Migration files
4. Import validation tests
5. Production verification scripts
6. Rollback scripts
7. Updated database types
8. Import workflow documentation

---

# 29. Phase B Closure Report Structure

## 1. Executive Summary

## 2. Preflight

## 3. Backup and Rollback Ledger

## 4. Abo Saleh Import Results

## 5. Mohammad Import Results

## 6. Boundary Calculation Table

## 7. Duplicate Re-import Results

## 8. Timeline Verification

## 9. Security Regression

## 10. Data Integrity

## 11. Remaining Risks

## 12. Acceptance Checklist

## 13. Final Status

End with:

> **Phase B Production Closure Status:** PASS / FAIL / BLOCKED  
> **Phase C Start Authorization:** AUTHORIZED / NOT AUTHORIZED

---

# 30. Phase C Report Structure

## 1. Executive Summary

## 2. Phase B Gate Result

## 3. Existing Import Architecture

## 4. Target Import Workflow

## 5. Operator Resolution

## 6. Card Integrity

## 7. File Identity and Duplicate Detection

## 8. Transaction Identity

## 9. Import Status Model

## 10. Preview and Validation

## 11. Transactional Posting

## 12. Relationship Integrity

## 13. Reprocessing and Corrections

## 14. Security

## 15. SQL Migrations

## 16. UI/UX

## 17. Automated Tests

## 18. Runtime UAT

## 19. A1/A2/B Regression

## 20. Production Rollout

## 21. Rollback

## 22. Changed Files

## 23. Remaining Risks

## 24. Acceptance Checklist

## 25. Recommended Next Step

End with:

> **Phase C Status:** PASS / FAIL / BLOCKED  
> **Phase D Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.

---

# 31. Phase B Closure Acceptance Criteria

Phase B closure passes only when:

1. Both files import through the real workflow.
2. Correct operators are linked.
3. Overnight TXN `1573323579` equals 7.334 JOD.
4. Mohammad boundary transactions are correct.
5. Billing is automatic.
6. No Bulk Recalculate is required.
7. Duplicate re-import is controlled.
8. Demand = 0.
9. Tax = 0.
10. JOD precision reconciles.
11. Timeline renders correctly.
12. A1/A2 protections remain intact.
13. No unrelated historical rows change.
14. Rollback ledger is complete.

---

# 32. Phase C Acceptance Criteria

Phase C passes only when:

1. File hash identity works.
2. Duplicate file detection works.
3. Transaction duplicate detection works.
4. User-selected operator is authoritative.
5. Card ID is validated.
6. Filename operator text is cross-checked.
7. Conflicts block posting.
8. Warnings require confirmation.
9. Unknown cards have a safe path.
10. Import preview is complete.
11. Invalid rows are visible.
12. Posting is transactional.
13. Session relationships are complete.
14. Billing relationships are complete.
15. Import statuses are accurate.
16. Reprocessing is safe.
17. Unauthorized users are blocked.
18. Cross-station access is blocked.
19. A1/A2/B regressions pass.
20. Full report is complete.

---

# 33. Stop Conditions

Stop immediately if:

- Production backup cannot be verified.
- Sample transaction IDs already exist unexpectedly.
- Import would duplicate real production data.
- Phase B billing result differs from expected.
- Duplicate re-import creates duplicates.
- A1 uniqueness breaks.
- A2 security breaks.
- Historical rows change unexpectedly.
- Operator/card conflict cannot be resolved safely.
- SQL/TypeScript billing parity fails.
- Transactional rollback is unavailable.
- Phase B closure is not PASS.

Do not continue to Phase C after a failed Phase B closure.

---

# 34. Final Instruction

Execute Phase B production closure first.

Only after Phase B closure reaches PASS, implement Phase C.

Do not start Phase D.

Do not implement payments.

Do not implement handover.

Do not recalculate historical billing.

Do not activate OCPP.

Do not weaken RLS or RPC security.
