# CURSOR IMPLEMENTATION PROMPT — EV CHARGING SYSTEM PHASE A1

## Phase Code

`EV-A1`

## Phase Name

**Safety, Live RPC Capture, Schema Reproducibility, Billing Duplicate Analysis, Archive, and Unique Billing Protection**

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Governing Planning File

Read and follow:

`EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`

## Existing Audit File

Read and use:

`EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

---

# 1. Execution Instruction

Read this prompt carefully before modifying anything.

Take your time.

Inspect the repository and live Supabase database before implementation.

Do not assume the current migrations represent the live database.

Do not rewrite live financial functions before capturing their exact definitions.

Do not delete any billing record without first archiving it.

Do not recalculate historical billing.

Do not change tariffs.

Do not implement payment methods.

Do not implement handover changes.

Do not modify the tariff timeline.

Do not remove Demand Charge yet.

Do not modify tax behavior.

Do not tighten full RLS in this sub-phase.

Do not activate OCPP.

This phase is limited to the A1 foundation work defined below.

All work must be:

- Backward-compatible where reasonably possible
- Migration-driven
- Idempotent where possible
- Auditable
- Reversible
- Tested in a disposable or approved non-production environment first
- Verified against the live schema before production application

---

# 2. Phase Objective

Make the system safe and reproducible before any billing-engine correction begins.

This phase must:

1. Capture the exact live SQL definitions of undocumented RPCs.
2. Compare the live database with repository migrations and generated types.
3. Produce a reproducible schema baseline plan and migrations for missing critical objects.
4. Analyze all duplicate `billing_calculations` rows.
5. Archive duplicate candidates before removing anything.
6. Select the authoritative billing row using evidence, not only the newest timestamp.
7. Remove duplicate billing rows safely.
8. Add database-level unique protection so one session cannot have multiple authoritative billing records.
9. Update application billing write paths to respect the uniqueness rule.
10. Regenerate Supabase TypeScript types.
11. Add automated verification for duplicate prevention and migration reproducibility.
12. Produce a detailed implementation and UAT report.

---

# 3. Confirmed Scope

## Included

- Full backup verification
- Git safety
- Live database metadata inspection
- Live RPC extraction
- Missing migration discovery
- Core schema reproducibility analysis
- Duplicate billing analysis
- Duplicate archive table
- Safe duplicate cleanup
- Unique constraint or unique index on `billing_calculations.session_id`
- Billing write-path correction to avoid creating duplicates
- Generated Supabase type refresh
- Migration verification
- Focused automated tests
- Runtime UAT in staging or disposable database
- Implementation report
- Source-of-truth update only if the repository uses one and the plan requires it

## Excluded

- Tariff engine rewrite
- Automatic TOU correction
- Demand Charge removal
- Tax changes
- Payment methods
- Cash/Card/CliQ
- Handover workflow
- Report redesign
- Full RLS role rollout
- Historical billing recalculation
- OCPP work
- UI redesign

---

# 4. Mandatory Safety Gates

## 4.1 Git Safety

Before work:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
git log -1 --oneline
```

Record all results.

Create a dedicated branch if the repository workflow permits:

```text
phase/ev-a1-foundation
```

Do not overwrite uncommitted user work.

After implementation:

```bash
git status --short
git diff --stat
git diff
```

Document every changed file.

## 4.2 Database Safety

Before any migration:

- Confirm database environment.
- Confirm whether it is local, staging, development, or production.
- Do not run destructive operations against production without explicit approval.
- Produce a verified backup or snapshot reference.
- Record row counts for all affected tables.
- Record duplicate counts before changes.
- Record current RPC definitions and hashes.
- Run migrations first against a disposable or staging database.
- Confirm rollback steps before production application.

## 4.3 Backup Requirements

At minimum preserve:

- `billing_calculations`
- `billing_breakdown_items`
- `charging_sessions`
- `import_batches`
- `shifts`
- `rate_structures`
- `rate_periods`
- All function definitions being captured

Record:

- Backup method
- Backup timestamp
- Environment
- Backup identifier or path
- Restore verification result

Do not claim backup success without a restore or validation check.

---

# 5. Live RPC Capture

The previous plan identified these live functions as missing from migrations:

- `calculate_batch_billing`
- `delete_import_batch`
- `recalculate_shift_totals`
- `recalculate_all_shift_totals`

Capture their exact live SQL definitions using PostgreSQL metadata such as:

```sql
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = '<function_name>';
```

For overloaded functions, capture:

- Function name
- Argument types
- Return type
- Security mode
- Volatility
- Search path
- Owner
- Grants
- Full body

Also inspect dependent functions, triggers, views, or policies.

## Required output

Create a migration or archival SQL file that preserves the exact current live definitions before any later rewrite.

Suggested migration:

`supabase/migrations/<timestamp>_capture_live_financial_rpc_baseline.sql`

The captured migration must be:

- Functionally identical to live behavior
- Clearly commented as a baseline snapshot
- Not silently improved
- Safe to run in a clean environment
- Ordered correctly against required tables and types

If dependent tables are missing from migrations, do not create an invalid migration order. Instead add prerequisite baseline migrations or document the dependency.

---

# 6. Schema Reproducibility Audit and Correction

Compare:

- Live database schema
- All migrations
- `src/lib/database.types.ts`
- Actual application queries
- RPC signatures
- Constraints
- Indexes
- Triggers
- RLS policies
- Grants

Identify all critical objects used by the active non-OCPP workflow that are not reproducible from migrations.

At minimum inspect:

- `stations`
- `operators`
- `import_batches`
- `charging_sessions`
- `billing_calculations`
- `billing_breakdown_items`
- `shifts`
- `rate_structures`
- `rate_periods`
- `fixed_charges`
- `tax_configurations`
- `system_settings`
- `user_profiles`
- `audit_log`
- Relevant views
- Relevant triggers
- Relevant RPCs

Do not create broad speculative migrations.

Create only the minimum baseline migrations needed so the active application can be reproduced safely.

Use idempotent guards only when appropriate. Avoid hiding schema drift with excessive `IF NOT EXISTS` if it would allow incompatible definitions to pass silently.

For each missing object:

- Compare the live definition with application expectations.
- Add an exact or controlled baseline migration.
- Add comments documenting origin and capture date.
- Verify a fresh disposable database can apply all migrations in order.

---

# 7. Duplicate Billing Analysis

The plan reported hundreds of duplicate billing rows. Recalculate the exact live count.

Use queries that identify:

- Sessions with more than one billing row
- Number of duplicate rows
- Billing totals by duplicate group
- Breakdown-item presence
- Calculation timestamps
- Tariff structure references
- Rates
- Total amounts
- Calculation method or metadata if available
- Shift linkage
- Handover state
- Import batch
- Whether `charging_sessions.has_billing_calculation` is accurate
- Whether reports currently use `DISTINCT ON`
- Whether duplicates affect current totals

## Mandatory duplicate classification

For every duplicate group classify:

1. Exact duplicates
2. Same session, same total, different timestamps
3. Same session, different totals
4. Same session, different tariff/rate
5. One row with breakdown and one without
6. One likely legacy RPC result and one likely Bulk Recalculate result
7. Rows connected to closed, handed-over, or locked shifts
8. Ambiguous groups requiring manual review

Do not choose the latest row automatically.

---

# 8. Authoritative Billing Row Selection Rules

Design and implement a deterministic selection procedure.

Recommended evidence order:

1. Preserve any row explicitly referenced by authoritative downstream records, if such references exist.
2. Prefer a row with complete valid breakdown items over one without.
3. Prefer a row whose tariff references are valid.
4. Prefer a row whose total equals the sum of its breakdown items within JOD tolerance.
5. Prefer a row produced by the known corrected calculation path, if identifiable.
6. Prefer a row with a valid calculation timestamp.
7. Use latest timestamp only as a final tie-breaker.
8. Mark materially conflicting groups for manual review instead of silently deleting.

Because the current historical billing may already be wrong, this phase must not attempt to select the financially “correct” tariff result by recalculation.

This phase only enforces one authoritative existing row per session.

## Manual review handling

For ambiguous duplicate groups:

- Archive all rows.
- Produce a conflict report.
- Do not delete until an explicit deterministic rule or approval is available.
- If the unique constraint cannot be safely added because conflicts remain, isolate and resolve them in a controlled migration step with clear evidence.

---

# 9. Duplicate Archive Design

Create an archive table for removed billing rows.

Suggested name:

`billing_calculations_duplicate_archive`

Include enough information to restore and audit:

- Archive ID
- Original billing calculation ID
- Session ID
- Full original row data
- Selection group ID
- Selected authoritative billing ID
- Archive reason
- Classification
- Original created/calculated timestamps
- Archived at
- Archived by or migration identifier
- Source environment
- JSON snapshot of related breakdown rows where practical
- Restore status

Also archive related `billing_breakdown_items` for removed billing rows, either:

- In a child archive table, or
- In a structured JSON snapshot with enough fidelity to restore

Prefer normalized archive tables when straightforward.

Archive tables must not be exposed broadly through the client.

---

# 10. Safe Cleanup Migration

Create a dedicated migration for duplicate cleanup and unique protection.

Suggested name:

`supabase/migrations/<timestamp>_archive_dedupe_billing_and_add_unique_session.sql`

The migration must include:

1. Precondition checks
2. Archive-table creation
3. Duplicate classification
4. Archive insertion
5. Controlled deletion of non-authoritative rows
6. Breakdown cleanup or archival
7. Validation that no duplicate session IDs remain
8. Unique index or constraint creation
9. Postcondition checks
10. Clear failure behavior

Prefer a transaction where PostgreSQL permits it.

Do not use cascading deletion without confirming archive completion.

## Unique protection

Add:

```sql
UNIQUE (session_id)
```

or an equivalent unique index.

If historical null session IDs exist, inspect and decide whether they should be blocked or separately handled.

Name the constraint clearly.

Example:

```text
billing_calculations_one_per_session_key
```

---

# 11. Billing Write-Path Correction

Inspect every code path that creates or replaces billing rows.

At minimum inspect:

- Import-time billing call
- Individual calculation
- Bulk Recalculate
- Calculate All Pending
- Shift recalculation
- RPC billing functions
- Any report-side inserts
- Any admin repair utility

Update write logic so the unique constraint is respected.

Recommended model:

- One authoritative server-side operation owns replacement.
- Use `INSERT ... ON CONFLICT (session_id) DO UPDATE`, or
- Delete and recreate within one database transaction.

Do not use a client-side delete followed by insert without transaction protection.

Because Phase B will later replace the tariff algorithm, keep A1 changes minimal:

- Prevent duplicate billing
- Preserve current financial behavior
- Do not rewrite tariff selection yet

If current import and Bulk Recalculate paths call different engines, keep behavior unchanged while making persistence idempotent.

---

# 12. Generated Types

After migrations are finalized:

- Regenerate Supabase TypeScript types from the actual target schema.
- Replace stale `database.types.ts`.
- Do not manually edit generated types unless the project explicitly requires a wrapper.
- Resolve type errors directly caused by A1 schema changes.
- Do not attempt unrelated full-project type cleanup in this phase.

Record the exact generation command.

---

# 13. Automated Tests

Add the minimum focused test infrastructure required for A1 if none exists.

Test:

1. One billing row can be inserted for a session.
2. A second insert for the same session is rejected or upserted deterministically.
3. Bulk recalculation does not create duplicates.
4. Concurrent attempts do not create duplicates.
5. Duplicate archive retains original rows.
6. Related breakdown rows are preserved in archive or handled correctly.
7. Migration fails safely when preconditions are violated.
8. Restore procedure can recover archived rows.
9. Clean database migration order succeeds.
10. Captured RPC signatures match expected application calls.

Do not build the full Phase B tariff boundary test suite yet.

---

# 14. Runtime UAT

Run UAT in staging or a disposable environment.

## UAT-A1-01 — Clean Migration

- Start from a clean database.
- Apply all migrations in order.
- Confirm required active tables and RPCs exist.
- Confirm application connects.
- Confirm no migration depends on undocumented live-only objects.

## UAT-A1-02 — Duplicate Fixture

Create controlled duplicate billing rows in a disposable environment.

Verify:

- Classification
- Archive
- Authoritative selection
- Cleanup
- Unique constraint
- Restoration

## UAT-A1-03 — Existing Data Simulation

Use a sanitized subset of real duplicate groups.

Verify materially different duplicate rows are not silently discarded.

## UAT-A1-04 — Write-Path Idempotency

Run:

- Import billing call twice
- Bulk recalculation twice
- Concurrent recalculation attempts

Confirm exactly one billing row remains per session.

## UAT-A1-05 — Application Smoke

Verify:

- Billing page opens
- Import flow still reaches current billing path
- Reports still read billing rows
- Shift totals still operate
- No tariff behavior has changed

---

# 15. SQL Verification Queries

Include exact verification queries in the report.

At minimum:

```sql
-- Duplicate groups
SELECT session_id, COUNT(*)
FROM billing_calculations
GROUP BY session_id
HAVING COUNT(*) > 1;

-- Total rows
SELECT COUNT(*) FROM billing_calculations;

-- Unique protection
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'billing_calculations';

-- Orphan breakdowns
SELECT COUNT(*)
FROM billing_breakdown_items bbi
LEFT JOIN billing_calculations bc
  ON bc.id = bbi.billing_calculation_id
WHERE bc.id IS NULL;

-- Archive count
SELECT COUNT(*)
FROM billing_calculations_duplicate_archive;
```

Add checks for constraints, RPCs, and schema reproducibility.

---

# 16. Rollback Plan

Document and test rollback.

Rollback must include:

- Drop or disable unique constraint if restoration requires it
- Restore archived billing rows
- Restore breakdown rows
- Restore original RPC definitions
- Restore generated types if needed
- Restore database snapshot if migration-level rollback is insufficient

Do not delete archive tables after successful deployment.

Keep them until Phase F historical correction is complete and formally closed.

---

# 17. Required Files

Likely files may include:

- New SQL migrations under `supabase/migrations/`
- Billing persistence service files
- Generated database types
- Focused test files
- Migration verification scripts
- Implementation report
- Source-of-truth update if applicable

Do not modify unrelated UI files.

---

# 18. Required Deliverable

Create:

`EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`

The report must include:

## 1. Executive Summary

- What was changed
- What was not changed
- Whether production data was touched
- Whether tariff behavior changed
- Final duplicate count
- Unique protection status
- Migration reproducibility status

## 2. Environment and Safety

- Git state
- Database environment
- Backup details
- Restore verification
- Branch/commit

## 3. Live RPC Capture

For each RPC:

- Signature
- Definition source
- Migration path
- Dependency notes
- Hash or verification

## 4. Schema Drift Findings

- Missing objects
- Added migrations
- Remaining deferred drift

## 5. Duplicate Analysis

- Exact initial counts
- Classification counts
- Conflict groups
- Authoritative-selection rules
- Archive counts
- Deleted counts
- Remaining duplicates

## 6. SQL Migrations

For each migration:

- Filename
- Purpose
- Forward behavior
- Safety checks
- Rollback
- Verification

## 7. Application Changes

- File path
- Change
- Reason
- Risk

## 8. Type Generation

- Command
- Result
- Changed types

## 9. Automated Tests

- Test names
- Results
- Failures
- Coverage relevant to A1

## 10. Runtime UAT

- Scenario
- Steps
- Expected result
- Actual result
- Evidence
- Status

## 11. Verification Queries

Include before and after results.

## 12. Rollback Test

- Procedure
- Result

## 13. Remaining Risks

Especially:

- Historical billing may still be financially wrong
- Tariff engine not yet corrected
- Open RLS not yet fully corrected
- Payment methods not implemented

## 14. Changed Files

List all modified and created files.

## 15. Phase Acceptance Checklist

Use Pass / Fail / Blocked.

## 16. Recommended Next Step

State whether Phase A1 is ready to close and whether Phase A2 may begin.

---

# 19. Acceptance Criteria

Phase A1 is complete only when:

1. Verified backup exists.
2. Live RPC definitions are captured exactly.
3. Critical active schema objects are reproducible from migrations or clearly documented as remaining blockers.
4. Every duplicate billing row selected for removal is archived first.
5. Ambiguous materially conflicting duplicates are not silently discarded.
6. No duplicate `billing_calculations.session_id` groups remain.
7. Database-level unique protection exists.
8. Billing write paths cannot create new duplicates.
9. Related breakdown rows are preserved correctly.
10. Supabase types are regenerated.
11. Focused automated tests pass.
12. Migration verification passes on a clean disposable database.
13. Application smoke tests pass.
14. Tariff behavior remains unchanged in A1.
15. No historical recalculation occurs.
16. Implementation report is complete.
17. Git diff contains only approved A1 changes.

---

# 20. Stop Conditions

Stop implementation and report the blocker if:

- Backup cannot be verified.
- Live RPC definitions cannot be captured.
- Database environment cannot be identified.
- Duplicate groups contain unresolved materially different financial values that cannot be selected safely.
- Archive verification fails.
- Clean migration cannot be reproduced.
- Unique constraint would break required current behavior.
- Production is the only available test environment.
- Uncommitted user changes would be overwritten.

Do not bypass these conditions.

---

# 21. Final Instruction

Implement Phase A1 only.

Do not proceed to Phase A2.

Do not implement Phase B.

Do not change the tariff algorithm.

Do not apply Demand Charge removal yet.

Do not recalculate historical billing.

Do not introduce payment methods.

Do not change handover logic.

Do not activate OCPP.

End the implementation report with:

> **Phase A1 Status:** PASS / FAIL / BLOCKED  
> **Phase A2 Authorization:** NOT STARTED — requires Sameer’s review and approval.
