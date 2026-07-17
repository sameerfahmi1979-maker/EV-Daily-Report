# CURSOR PRODUCTION DEPLOYMENT PROMPT — APPLY EV CHARGING SYSTEM PHASE A2 MIGRATIONS TO LIVE SUPABASE

## Task Type

Controlled production deployment, security migration, direct API verification, rollback readiness, and closure reporting.

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
- `EV_CHARGING_SYSTEM_PHASE_A2_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_STAGING_SUPABASE_SETUP_AND_UAT_REPORT.md`
- `docs/staging/EV_A2_PRODUCTION_PROMOTION_CHECKLIST.md`
- `docs/a2/EV_A2_ROLE_MAPPING.md`

## A2 Migration Files

Apply only these six A2 migrations, in this exact order:

1. `supabase/migrations/20260716230000_a2_user_approval_and_role_foundation.sql`
2. `supabase/migrations/20260716230100_a2_user_station_access.sql`
3. `supabase/migrations/20260716230200_a2_authorization_helpers.sql`
4. `supabase/migrations/20260716230300_a2_core_rls_policies.sql`
5. `supabase/migrations/20260716230400_a2_financial_rpc_authorization.sql`
6. `supabase/migrations/20260716230500_a2_archive_and_audit_security.sql`

The first migration must include the corrected logic discovered during staging:

```text
Drop the existing legacy user_profiles_role_check constraint before remapping legacy roles, then add the expanded target-role constraint.
```

Do not use an older uncorrected version.

---

# 1. Deployment Objective

Apply the previously prepared and staging-verified Phase A2 security migrations to the live production Supabase project without changing billing logic, tariff logic, payment logic, handover logic, historical amounts, or OCPP.

This deployment must:

1. Preserve administrator access.
2. Convert approved legacy administrators safely.
3. Activate user approval controls.
4. Add station-access relationships.
5. activate authorization helpers.
6. Remove open and duplicate RLS policies.
7. enforce role and station scope server-side.
8. revoke anonymous access to financial mutation RPCs.
9. protect A1 archive and conflict objects.
10. verify direct API enforcement.
11. verify application continuity.
12. support immediate rollback.
13. produce a complete production deployment and UAT report.

---

# 2. Absolute Scope Limit

## Included

- Production backup verification
- Pre-deployment inventory
- Apply the six approved A2 migrations
- Existing-user approval mapping
- Role remapping
- Station-access backfill
- Authorization helper functions
- Core RLS replacement
- Financial RPC grants and authorization
- Archive and audit protection
- Supabase type regeneration if schema changed
- Direct API security tests
- Admin continuity checks
- Runtime smoke testing
- Rollback readiness
- Deployment report

## Excluded

Do not:

- Change the tariff algorithm
- Fix the 0.183 import defect
- Remove Demand Charge
- Change tax behavior
- Add Cash/Card/CliQ
- Change operator handover
- Recalculate historical billing
- Import sample files
- Change reports
- Activate OCPP
- Delete A1 archives
- Modify production charging sessions or billing amounts
- Apply Phase B changes
- Apply unrelated migrations

---

# 3. Mandatory Production Safety Gate

Before applying anything, verify and record:

## Git

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
git log -1 --oneline
```

Confirm:

- Correct repository
- Correct branch
- No unreviewed local changes
- A2 migration files match staging-tested versions
- Production project reference is correct
- No staging project reference remains in the active deployment command

## Database

Confirm:

- Connected project is exactly `qflxupfeyktdrpilctyo`
- Environment is production
- Current PostgreSQL version
- Current migration history
- Current role constraint
- Current user profiles
- Current RLS policies
- Current RPC grants
- A1 unique billing constraint exists
- Duplicate billing groups remain zero
- A1 archive objects exist
- At least one working current administrator account is confirmed

## Backup

Before migration, require one of:

- Supabase dashboard backup / PITR checkpoint, or
- Verified full logical backup with restore instructions

At minimum preserve:

- `user_profiles`
- `user_station_access` if it already exists
- `stations`
- `operators`
- `import_batches`
- `charging_sessions`
- `billing_calculations`
- `billing_breakdown_items`
- `shifts`
- `rate_structures`
- `rate_periods`
- `audit_log`
- Existing RLS policies
- Existing grants
- Critical RPC definitions
- A1 archive tables
- A1 backup schema

Record:

- Backup timestamp
- Backup method
- Backup identifier
- Restore verification
- Responsible operator

If backup cannot be verified, stop.

---

# 4. Existing Production User Continuity

The previously inventoried production users are:

- `sameer@algt.net`
- `sameer@energy-stream.net`
- `tariq@energy-stream.net`

All were previously legacy `global_admin`.

Before migration:

1. Verify these users still exist.
2. Verify their current profiles.
3. Verify at least one can currently log in.
4. Confirm exact UUIDs.
5. Confirm no unexpected users were added.
6. Produce a review table.

During migration:

- Map approved `global_admin` users to `system_admin`.
- Set `approval_status = approved`.
- Preserve active status.
- Do not approve unknown users automatically.
- Do not alter authentication passwords.
- Do not allow self-approval paths.
- Ensure at least one System Administrator remains functional after each security step.

If the expected admin profiles differ materially from the prepared migration, stop.

---

# 5. Pre-Deployment Snapshot

Export and save:

- Current `pg_policies`
- Current table grants
- Current function grants
- Current function definitions
- Current `user_profiles`
- Current station assignments
- Current role constraint definition
- Current A1 object state
- Current migration history

Create rollback artifacts such as:

- `scripts/production/a2_restore_predeployment_policies.sql`
- `scripts/production/a2_restore_predeployment_grants.sql`
- `scripts/production/a2_restore_predeployment_role_constraint.sql`
- `scripts/production/a2_emergency_admin_restore.sql`

Do not expose secrets.

---

# 6. Go / No-Go Checklist

Proceed only if all are true:

- Backup verified
- Correct production project confirmed
- Correct migrations confirmed
- Corrected migration 1 confirmed
- Existing admin users verified
- At least one admin login verified
- Rollback scripts prepared
- Current policies exported
- Current RPC grants exported
- A1 duplicate count = 0
- A1 unique billing constraint exists
- No unresolved migration error
- Maintenance window approved
- Sameer has explicitly authorized production A2 deployment

If any are false, stop and report `BLOCKED`.

---

# 7. Apply Migration 1 — User Approval and Role Foundation

Apply:

`20260716230000_a2_user_approval_and_role_foundation.sql`

Mandatory checks:

- Drop old `user_profiles_role_check` first.
- Add approval fields.
- Add expanded role constraint.
- Remap approved legacy roles.
- Approve only verified legitimate users.
- Preserve at least one System Administrator.
- New default must not grant operational access.
- Unknown roles must not become broad administrators.

Immediately verify:

- All expected admin profiles exist.
- Expected role mapping succeeded.
- `approval_status = approved` for verified admins.
- No user has an invalid role.
- Role constraint accepts target values.
- Existing admin login still works.
- No operational tables were modified.

Stop and roll back if admin continuity fails.

---

# 8. Apply Migration 2 — User Station Access

Apply:

`20260716230100_a2_user_station_access.sql`

Verify:

- Join table created.
- Constraints and indexes exist.
- Approved System Administrators receive required access.
- Station-scoped users are not granted all stations accidentally.
- Duplicate assignments are prevented.
- No production session or billing rows changed.
- Current app still loads station data for verified admin.

Because production currently has one station, still keep the model multi-station ready.

Do not hardcode permanent one-station assumptions.

---

# 9. Apply Migration 3 — Authorization Helpers

Apply:

`20260716230200_a2_authorization_helpers.sql`

Verify each helper:

- Uses `auth.uid()`
- Uses trusted `user_profiles`
- Uses safe `search_path`
- Avoids policy recursion
- Does not trust user-editable metadata
- Returns false for anonymous
- Returns false for pending/disabled/rejected users
- Returns correct role for approved users
- Enforces station scope correctly

Test directly with:

- Anonymous
- System Administrator
- Pending test profile if safely available
- Station-scoped test profile if safely available

Do not proceed if a helper effectively grants universal access.

---

# 10. Apply Migration 4 — Core RLS Policies

Apply:

`20260716230300_a2_core_rls_policies.sql`

This is the highest lockout-risk step.

Apply during the approved maintenance window.

Immediately after application:

1. Confirm open policies were removed.
2. Confirm no duplicate broad fallback policy remains.
3. Confirm approved System Administrator can:
   - Read stations
   - Read operators
   - Read sessions
   - Read billing
   - Read shifts
   - Read tariffs
4. Confirm anonymous cannot read operational tables.
5. Confirm pending users cannot read operational tables.
6. Confirm station scope works.
7. Confirm reports still read permitted data.
8. Confirm no table unintentionally has zero valid access paths for admin.

At minimum verify:

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

If verified admin access fails, immediately apply emergency rollback.

Do not continue to migration 5 until migration 4 passes.

---

# 11. Apply Migration 5 — Financial RPC Authorization

Apply:

`20260716230400_a2_financial_rpc_authorization.sql`

Audit and verify:

- `calculate_batch_billing`
- `replace_session_billing`
- `delete_import_batch`
- `recalculate_shift_totals`
- `recalculate_all_shift_totals`
- `turbo_bulk_calculate_billing`
- `turbo_calculate_all_pending`

Required outcomes:

- No anonymous execute on financial mutation RPCs.
- No PUBLIC execute where unsafe.
- Unauthorized roles denied.
- Station-scoped authorization enforced.
- System Administrator / authorized Operations Manager still allowed.
- Existing billing logic remains unchanged.
- No historical billing recalculation occurs during testing.
- No production amount is changed as part of authorization verification.

For mutation tests, prefer:

- Read-only permission introspection
- Transaction-wrapped rollback
- Controlled test fixture
- Non-financial dummy fixture

Do not mutate real historical financial rows merely to prove access.

---

# 12. Apply Migration 6 — Archive and Audit Security

Apply:

`20260716230500_a2_archive_and_audit_security.sql`

Verify:

- A1 archive tables are protected.
- Normal users cannot update or delete archives.
- Conflict report access is limited.
- RPC baseline catalog access is limited.
- Backup schema is not exposed to client roles.
- Audit log is append-only for normal users.
- System Administrator can perform required audit review.
- No archive or backup row was deleted.

---

# 13. Direct API Security UAT

Run direct API tests against production after all migrations.

Do not rely only on the UI.

## Anonymous

Expected:

- Cannot read charging sessions
- Cannot read billing
- Cannot read shifts
- Cannot read archives
- Cannot execute financial mutation RPCs

## Pending User

Expected:

- Cannot read operational or financial data
- Cannot execute mutation RPCs

## System Administrator

Expected:

- Can access all required operational data
- Can manage users
- Can access all stations
- Can execute authorized financial RPCs
- Cannot bypass append-only audit restrictions improperly

## Station-Scoped User

If a safe existing or temporary test user is available:

- Can read assigned station
- Cannot read other station data
- Cannot manage tariffs unless role allows
- Cannot execute unauthorized RPCs

## Accountant / Report Viewer

If safe test users exist:

- Read access only according to role
- No import or tariff mutation
- No financial mutation RPC execution unless explicitly allowed

Document every request, expected result, actual result, HTTP status, and error message.

Do not expose tokens.

---

# 14. Application Runtime Smoke Test

Run the application against production after migration.

Verify:

- Login
- Admin continuity
- Dashboard
- Stations
- Operators
- Charging sessions
- Billing
- Shifts
- Tariff pages
- Reports
- User management
- Logout

Verify:

- No blank screens
- No RLS-related infinite loaders
- No unexpected 401/403 for valid admin
- Clear forbidden state for unauthorized roles
- No production write unrelated to A2
- No tariff calculation behavior change
- No billing total change
- No shift total change

Use browser developer tools to review failed network calls.

---

# 15. A1 Regression Verification

Confirm:

- Duplicate billing groups remain zero.
- `billing_calculations_one_per_session_key` still exists.
- `replace_session_billing` still works for authorized users.
- A1 archive tables remain intact.
- A1 conflict report remains intact.
- No orphan breakdown rows.
- No historical recalculation occurred.

---

# 16. Production Rollback

Prepare and test the rollback plan before deployment.

Rollback triggers include:

- Admin lockout
- Operational tables inaccessible to valid admin
- Critical RPC unavailable to authorized users
- Broad unintended access
- Application cannot load
- User profile corruption
- Station-access corruption
- Unexpected financial mutation

Rollback order should safely reverse:

1. Archive/audit security policies
2. Financial RPC grants/auth wrappers
3. Core RLS policies
4. Authorization helpers
5. User-station access enforcement
6. Approval/role constraints only if necessary

Prefer restoring previous policies and grants rather than dropping newly added data columns immediately.

Do not delete audit evidence.

Emergency admin restore must be available.

---

# 17. Production Closure Report

Create:

`EV_CHARGING_SYSTEM_PHASE_A2_PRODUCTION_DEPLOYMENT_AND_UAT_REPORT.md`

Required structure:

## 1. Executive Summary

- Deployment status
- Production touched?
- Backup status
- Admin continuity
- RLS status
- RPC security status
- Direct API status
- Runtime status
- Rollback status

## 2. Authorization and Maintenance Window

## 3. Git and Environment Verification

## 4. Backup and Restore Point

## 5. Pre-Deployment User Inventory

## 6. Migration-by-Migration Log

For each:

- Filename
- Start time
- End time
- Result
- Verification
- Errors
- Rollback readiness

## 7. Role Mapping Results

## 8. User Approval Results

## 9. Station Access Results

## 10. RLS Before-and-After Matrix

## 11. RPC Grants and Authorization Matrix

## 12. Direct API Security Tests

## 13. Application Runtime Smoke Test

## 14. A1 Regression Results

## 15. Production Data Integrity

Confirm no tariff, billing, shift, or historical amount changes.

## 16. Audit Log Verification

## 17. Rollback Verification

## 18. Changed Files

## 19. Remaining Risks

Especially:

- Tariff algorithm remains wrong until Phase B.
- Demand Charge still present until Phase B.
- Payment methods not implemented.
- Handover not implemented.
- Historical billing not corrected.

## 20. Acceptance Checklist

## 21. Recommended Next Step

State whether A2 may close and whether Phase B may start.

---

# 18. Acceptance Criteria

Production A2 is complete only when:

1. Backup/restore point verified.
2. Correct production project confirmed.
3. Corrected migration 1 used.
4. Existing legitimate administrators remain functional.
5. New users default to pending.
6. Pending/disabled/rejected users are denied server-side.
7. Open core RLS policies are removed.
8. Role and station scope are enforced server-side.
9. Anonymous financial RPC execution is blocked.
10. Unauthorized financial RPC execution is blocked.
11. Authorized admin workflows still function.
12. A1 uniqueness and archives remain intact.
13. No tariff behavior changed.
14. No billing amounts changed.
15. No historical recalculation occurred.
16. Direct API security tests pass.
17. Application runtime smoke test passes.
18. Rollback plan is ready and verified.
19. Deployment report is complete.
20. Sameer can review the results before Phase B.

---

# 19. Stop Conditions

Stop immediately if:

- Backup cannot be verified.
- Correct production project cannot be confirmed.
- Corrected migration 1 is not present.
- Admin profile mapping differs from expected.
- At least one admin login cannot be verified.
- A migration fails.
- Admin access breaks after any migration.
- Open access remains unexpectedly after migration 4.
- RPC grants are not enforceable.
- Financial data changes unexpectedly.
- Production application becomes unusable.
- Rollback scripts are unavailable.

Do not continue past a failed migration.

---

# 20. Final Instruction

Apply Phase A2 migrations to production only.

Do not start Phase B.

Do not change tariff logic.

Do not remove Demand Charge yet.

Do not change tax behavior.

Do not add payment methods.

Do not change handover.

Do not recalculate historical billing.

Do not import sample files.

Do not activate OCPP.

End the production report with:

> **Phase A2 Production Status:** PASS / FAIL / BLOCKED  
> **Phase B Authorization:** NOT STARTED — requires Sameer’s review and explicit approval.
