# CURSOR UAT PROMPT — EV CHARGING SYSTEM PHASE D FINAL GAP-CLOSURE UAT

## Phase Code

`EV-D-FINAL-CLOSURE`

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
- `EV_CHARGING_SYSTEM_PHASE_C_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_D_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_PHASE_D_PRODUCTION_ACTIVATION_AND_CLOSURE_UAT_REPORT.md`
- All Phase D migrations, RPCs, UI components, tests, feature flags, rollback scripts, and activation ledgers

---

# 1. Objective

Perform a focused production gap-closure UAT for Phase D.

Do not redesign or extend Phase D.

Do not start Phase E.

The purpose is to verify the Phase D scenarios that were not fully proven in the previous production closure report:

1. Real shortage case
2. Real surplus case
3. Mandatory discrepancy reason
4. Approved cash adjustment
5. Adjustment rejection
6. Adjustment lock protection
7. Full reopen → correct → reapprove → relock cycle
8. Role separation
9. Cross-station denial where testable
10. Read-only role enforcement
11. Pending/disabled/rejected denial
12. Locked payment-allocation mutation denial
13. Locked operator reassignment denial
14. Locked shift reassignment denial
15. Locked import deletion/cancellation denial
16. Locked session membership change denial
17. Locked adjustment mutation denial
18. Direct API enforcement
19. Audit-log completeness
20. A1/A2/B/C regression

---

# 2. Absolute Scope Limit

## Included

- Controlled Phase D production UAT
- Safe test records
- Role-based direct API tests
- Shortage and surplus scenarios
- Adjustment workflow
- Reopen/reapprove/relock
- Locked financial mutation guards
- Audit verification
- Feature-flag rollback verification
- Closure report

## Excluded

Do not:

- Implement Phase E
- Redesign reports
- Change tariff logic
- Recalculate historical billing
- Change historical payment classifications
- Modify unrelated production handovers
- Activate OCPP
- Add Demand Charge
- Add tax
- Add new payment methods
- Add bank/card gateway integrations
- Delete legitimate financial history
- Weaken RLS or RPC security

---

# 3. Mandatory Preflight

Before any UAT action, verify:

1. Correct repository and branch
2. Correct production project ref
3. `payment_workflow_v1_enabled=true`
4. `handover_workflow_v1_enabled=true`
5. `import_workflow_v2_enabled=true`
6. `billing_engine_v2_enabled=true`
7. A1 duplicate billing groups = 0
8. A2 anonymous mutation blocked
9. Phase C import workflow remains operational
10. Phase D tables and RPCs exist
11. At least one unlocked controlled shift/batch is available
12. No selected UAT session belongs to a legitimate locked handover
13. Backup/PITR or rollback checkpoint exists
14. Activation ledger will capture every affected ID
15. Test users/roles are available or can be safely created:
    - System Administrator
    - Operations Manager
    - Accountant
    - Import Officer
    - Report Viewer
    - Pending user
    - Disabled user
    - Rejected user
16. No unrelated migration is included

Stop if any critical item fails.

---

# 4. Controlled UAT Dataset

Use a small, clearly identified UAT-only scope.

Preferred:

```text
One station
One operator
One shift
Four to eight sessions
One import batch
```

Record:

- Station ID
- Operator ID
- Shift ID
- Batch ID
- Session IDs
- Billing calculation IDs
- Payment allocation IDs
- Handover IDs
- Adjustment IDs
- User IDs
- Audit IDs

Create:

```text
scripts/production/d_final_closure_uat_ledger.json
```

Do not use unrelated historical sessions.

---

# 5. Scenario A — Real Shortage

Prepare a handover where:

```text
Expected Cash > Actual Cash Received
```

Use actual production-calculated totals.

Verify:

- Shortage calculated server-side
- Shortage stored to 3 decimals
- Surplus remains zero
- Discrepancy reason is mandatory
- Submission without reason is rejected
- Submission with reason succeeds
- Audit event contains actor, timestamp, amount, and reason
- Card and CliQ remain excluded from expected physical cash

---

# 6. Scenario B — Real Surplus

Prepare a separate controlled handover where:

```text
Actual Cash Received > Expected Cash
```

Verify:

- Surplus calculated correctly
- Shortage remains zero
- Reason required
- Submission without reason rejected
- Submission with reason succeeds
- Audit event complete

---

# 7. Scenario C — Approved Positive Cash Adjustment

Create a positive cash adjustment.

Before approval:

- Expected cash must not change
- Adjustment status is pending
- Normal preparer cannot self-approve unless explicitly permitted

After approval by authorized reviewer:

- Expected cash increases exactly by the approved amount
- Handover summary refreshes
- Audit records creator and approver
- Adjustment amount uses JOD 3 decimals

---

# 8. Scenario D — Approved Negative Cash Adjustment

Create a negative cash adjustment.

Before approval:

- No expected-cash effect

After approval:

- Expected cash decreases exactly by the approved amount
- No negative expected cash unless explicitly valid

---

# 9. Scenario E — Rejected Adjustment

Create an adjustment and reject it.

Verify:

- Expected cash does not change
- Rejection reason required
- Rejected adjustment remains visible in history
- No deletion of audit trail
- Rejected adjustment cannot affect totals without a new controlled action

---

# 10. Scenario F — Adjustment Lock Protection

After handover lock, attempt:

- Create adjustment
- Edit adjustment
- Approve pending adjustment
- Delete adjustment
- Change amount
- Change direction

Expected:

- All prohibited mutations denied
- Clear handover-locked error
- No database change
- Audit denial where designed

---

# 11. Scenario G — Full Reopen Cycle

Perform:

```text
draft
→ submitted
→ approved
→ locked
→ reopened
→ corrected
→ submitted again
→ approved again
→ locked again
```

Verify:

- Reopen reason mandatory
- Reopen restricted to authorized role
- Handover version increments
- Previous locked snapshot remains available
- Payment/actual-cash correction recorded
- Reapproval uses an authorized reviewer
- Final relock succeeds
- Full event history retained
- Original history is not silently overwritten

---

# 12. Scenario H — Self-Approval Restriction

Using a non-admin preparer:

- Create/submit handover
- Attempt to approve own handover

Expected:

- Denied

Then use authorized Accountant or Operations Manager:

- Approval succeeds

If System Administrator emergency self-approval is allowed:

- Mandatory reason
- Emergency audit event
- Explicit indication in report

---

# 13. Role Matrix UAT

## Import Officer

Expected:

- Can assign payment methods within station if permitted
- Can prepare/submit handover if permitted
- Cannot approve
- Cannot lock
- Cannot reopen
- Cannot cross station

## Accountant

Expected:

- Can review
- Can approve/reject
- Can lock
- Can enter/confirm actual cash
- Cannot change tariffs
- Cannot alter import identity
- Cannot cross station

## Operations Manager

Expected:

- Can review
- Can approve/reject
- Can lock
- Can reopen with reason
- Cannot bypass audit

## Report Viewer

Expected:

- Read-only
- Cannot assign payment
- Cannot submit
- Cannot approve
- Cannot lock
- Cannot reopen

## Pending / Disabled / Rejected

Expected:

- No operational or financial mutation access

## Anonymous

Expected:

- No read or mutation access to protected Phase D objects

Document actual API results.

---

# 14. Cross-Station Security

If production has only one station, create a safe temporary second-station fixture only if it does not disturb operations.

Otherwise:

- Validate policy predicates directly
- Use transaction-wrapped test fixtures
- Do not claim full runtime PASS without evidence

Test:

- Station-scoped user cannot read another station’s handover
- Cannot assign payment to another station’s session
- Cannot approve/lock another station’s handover
- Cannot call RPC with forged station ID

---

# 15. Locked Mutation Guard Matrix

After locking a handover, attempt through UI and direct API:

1. Change payment method
2. Change payment reference
3. Change payment amount
4. Add/remove session from handover
5. Recalculate session billing
6. Recalculate batch billing
7. Recalculate shift totals
8. Replace session billing
9. Reassign operator
10. Reassign shift
11. Delete/cancel import batch
12. Delete session
13. Modify actual cash
14. Modify expected cash
15. Modify adjustment
16. Direct table update bypass

Expected:

- Denied server-side
- Clear error
- No data mutation
- No partial update
- Audit denial where applicable

Create a result matrix with action, role, method, expected, actual, error, and database state.

---

# 16. Payment Reconciliation Regression

Verify for every controlled handover:

```text
Billing Total = Cash Total + Card Total + CliQ Total
```

Tolerance:

```text
0.001 JOD
```

Also verify:

- One active allocation per session
- No unassigned session at submit
- Allocation amount equals authoritative billing total
- Card and CliQ never enter expected physical cash
- No duplicate allocation
- No negative payment amount
- No unauthorized manual amount override

---

# 17. Audit Log Verification

Verify an audit/event record for:

- Payment assignment
- Payment override
- Handover creation
- Submit
- Approve
- Reject
- Lock
- Reopen
- Relock
- Shortage reason
- Surplus reason
- Adjustment create
- Adjustment approve
- Adjustment reject
- Denied locked recalculation
- Denied unauthorized approval
- Feature-flag disable/enable where audited

Audit should include actor, role, timestamp, entity ID, action, old/new state where applicable, reason, station, and handover version.

---

# 18. Direct API Security UAT

Use real role sessions/tokens without exposing secrets.

Test:

- Anonymous mutation denied
- Pending mutation denied
- Report Viewer mutation denied
- Import Officer approval denied
- Accountant reopen denied if not allowed
- Operations Manager reopen allowed
- Cross-station forged request denied
- Locked direct update denied
- RPC cannot trust client-provided operator/station IDs
- PUBLIC/anon EXECUTE absent from mutation RPCs

Record HTTP status and database effect.

---

# 19. A1/A2/B/C Regression

Verify:

## A1

- Duplicate billing groups = 0
- Unique billing constraint intact
- Archive intact

## A2

- Open RLS not reintroduced
- Anonymous financial mutation denied
- Pending/disabled/rejected denied

## B

- Billing engine v2 enabled
- Demand = 0
- Tax = 0
- Asia/Amman preserved
- No billing totals changed by payment/handover UAT

## C

- Import workflow v2 enabled
- File/hash relationships intact
- Transaction duplicate protection intact
- Source relationships intact

No historical recalculation.

---

# 20. Feature-Flag Rollback Test

Verify:

1. Disable `payment_workflow_v1_enabled`
2. Disable `handover_workflow_v1_enabled`
3. Confirm new payment/handover mutations are blocked or UI hidden
4. Confirm existing locked history remains readable
5. Confirm billing/import workflows remain operational
6. Re-enable flags
7. Confirm Phase D workflow returns
8. Record timing and result

Do not delete handover history.

---

# 21. Required Fixes

If a gap is found:

- Fix only the specific Phase D defect
- Add migration if database behavior changes
- Add regression test
- Re-run affected UAT
- Document before/after
- Preserve production safety

Do not broaden scope.

---

# 22. Required Deliverable

Create:

```text
EV_CHARGING_SYSTEM_PHASE_D_FINAL_GAP_CLOSURE_UAT_REPORT.md
```

Required structure:

1. Executive Summary
2. Preflight
3. Controlled Dataset and Ledger
4. Shortage Scenario
5. Surplus Scenario
6. Positive Adjustment
7. Negative Adjustment
8. Rejected Adjustment
9. Adjustment Lock Protection
10. Full Reopen/Reapprove/Relock Cycle
11. Self-Approval Restriction
12. Role Matrix
13. Cross-Station Security
14. Locked Mutation Guard Matrix
15. Payment Reconciliation
16. Audit Verification
17. Direct API Security
18. A1/A2/B/C Regression
19. Feature-Flag Rollback
20. Fixes Applied
21. Changed Files
22. Remaining Risks
23. Acceptance Checklist
24. Final Recommendation

End with:

> **Phase D Final Closure Status:** PASS / FAIL / BLOCKED  
> **Phase E Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.

---

# 23. Acceptance Criteria

Phase D final closure passes only when:

1. Real shortage tested
2. Real surplus tested
3. Discrepancy reasons enforced
4. Positive approved adjustment works
5. Negative approved adjustment works
6. Rejected adjustment has no effect
7. Locked adjustment mutation denied
8. Full reopen/reapprove/relock cycle passes
9. Self-approval restriction passes
10. Import Officer restrictions pass
11. Accountant permissions pass
12. Operations Manager reopen passes
13. Report Viewer is read-only
14. Pending/disabled/rejected denied
15. Cross-station protection verified or honestly marked blocked
16. All locked mutation guards pass
17. Payment reconciliation passes
18. Card/CliQ excluded from physical cash
19. Audit trail complete
20. Direct API security passes
21. A1/A2/B/C regressions pass
22. Feature-flag rollback passes
23. No historical mass change
24. Report complete

---

# 24. Stop Conditions

Stop immediately if:

- Backup/PITR unavailable
- Wrong production project
- Selected UAT sessions belong to legitimate locked financial records
- Billing totals change unexpectedly
- Cash/Card/CliQ reconciliation fails
- Card or CliQ affects expected physical cash
- Locked mutation succeeds
- Unauthorized approval/reopen succeeds
- Audit history is missing for critical financial action
- Historical data is mass-updated
- A1 uniqueness breaks
- A2 security weakens
- Phase B engine changes
- Phase C import relationships break
- Rollback is unavailable

---

# 25. Final Instruction

Perform only the Phase D final gap-closure UAT.

Fix only confirmed Phase D defects required to pass the closure criteria.

Do not start Phase E.

Do not recalculate historical billing.

Do not activate OCPP.

Do not add tax.

Do not add Demand Charge.

Do not weaken RLS, RPC authorization, audit, or locked-financial protections.
