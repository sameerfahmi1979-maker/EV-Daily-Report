# CURSOR IMPLEMENTATION PROMPT — EV CHARGING SYSTEM PHASE A2

## Phase Code

`EV-A2`

## Phase Name

**Authentication Approval, Role Foundation, Baseline RLS Hardening, RPC Authorization, and Security UAT**

## Repository

`C:\dev\EV-DR\EV-Daily-Report`

## Governing Files

Read and follow:

- `EV_CHARGING_SYSTEM_CORRECTION_AND_ENHANCEMENT_MASTER_PLAN.md`
- `EV_CHARGING_SYSTEM_PHASE_A1_IMPLEMENTATION_AND_UAT_REPORT.md`
- `EV_CHARGING_SYSTEM_FULL_ANALYSIS_AND_AUDIT_REPORT.md`

---

# 1. Execution Instruction

Read this prompt carefully before modifying anything.

This phase must secure the application without breaking the current operational workflow.

Inspect the repository, live schema, current policies, current users, current roles, station assignments, RPC grants, and application access patterns before implementation.

Do not assume UI role checks provide security.

Do not assume existing RLS policies are correct.

Do not remove access broadly before verifying the impact.

Do not use `USING (true)` or `WITH CHECK (true)` on financial or operational tables.

Do not rely on user-editable metadata for authorization.

Do not change tariff calculation.

Do not change Demand Charge yet.

Do not change tax behavior.

Do not implement payment methods.

Do not change handover calculations.

Do not recalculate historical billing.

Do not activate OCPP.

Do not proceed if A1 safety prerequisites cannot be verified.

All changes must be:

- Migration-driven
- Least-privilege
- Backward-compatible where reasonably possible
- Tested first in a disposable or approved staging environment
- Auditable
- Reversible
- Enforced server-side
- Verified through direct Supabase API attempts, not UI checks only

---

# 2. Mandatory A1 Closure Gate

Before implementing A2, verify:

1. `billing_calculations_one_per_session_key` exists.
2. Duplicate billing groups remain zero.
3. `replace_session_billing` exists and is working.
4. The A1 logical backup and archive tables still exist.
5. No unresolved live migration failure exists.
6. The application can still:
   - Open
   - Authenticate
   - Read stations
   - Read operators
   - Read sessions
   - Read billing
   - Run the current billing persistence path
7. The current Git branch and worktree are safe.
8. The current database environment is identified.
9. A verified backup or restore point exists before security migration.

If any item fails, stop and create a blocker report.

Do not repair unrelated A1 issues silently inside A2.

---

# 3. Phase Objective

Build a safe security foundation for the active EV charging application.

This phase must:

1. Inventory all existing users, roles, profiles, station links, RLS policies, grants, and RPC permissions.
2. Remove duplicate and fully open RLS policies from active core tables.
3. Introduce a controlled role model.
4. Add administrator approval for new users.
5. Restrict station-level data where applicable.
6. Protect financial operations.
7. Add server-side authorization checks to critical RPCs.
8. Preserve required current workflows for approved users.
9. Add auditable permission-change events.
10. Add automated and runtime security tests.
11. Produce a detailed implementation and UAT report.

---

# 4. Confirmed Minimum Role Model

Use these roles unless actual schema constraints require a compatible mapping:

- `system_admin`
- `operations_manager`
- `station_manager`
- `import_officer`
- `accountant`
- `report_viewer`

Map current roles carefully.

Do not silently overwrite existing roles.

Produce a role-mapping table before migration.

Potential legacy examples may include:

- `global_admin`
- `company_manager`
- `station_manager`
- `accountant`
- Other values found in production

For unknown values:

- Preserve them temporarily.
- Flag them.
- Do not grant broad access automatically.

---

# 5. Approval Model

New user accounts must not receive operational or financial access automatically.

Implement an approval state such as:

- `pending`
- `approved`
- `disabled`
- `rejected`

Recommended fields on `user_profiles`:

- `approval_status`
- `approved_by`
- `approved_at`
- `disabled_at`
- `disabled_by`
- `disable_reason`

If equivalent fields already exist, reuse them.

Do not create duplicate concepts.

## Required behavior

- New account: `pending`
- Pending user: no access to operational or financial data
- Approved user: access based on role and station assignment
- Disabled user: no active access
- Rejected user: no active access
- System administrator: can approve, disable, change role, and assign station scope
- All approval and role changes must be audited

Do not allow users to approve themselves.

---

# 6. Station Scope Model

Inspect the current schema and actual usage.

Determine whether station access is represented by:

- One station on `user_profiles`
- A user-station join table
- Application-only state
- No real relationship

Recommend and implement the minimum safe model.

If users may access multiple stations, use a join table such as:

`user_station_access`

Suggested fields:

- `id`
- `user_id`
- `station_id`
- `access_level`
- `is_active`
- `created_at`
- `created_by`

Do not force a one-station design if current business operations need multiple stations.

## Required station rules

- Station-scoped roles can access only assigned stations.
- System Administrator may access all stations.
- Operations Manager may access all stations unless Sameer later limits this.
- Accountant may read financial information across authorized stations.
- Report Viewer may read only assigned or approved reporting scope.
- Import Officer may import only for assigned stations.
- Station Manager may manage operational data only for assigned stations.

---

# 7. Permission Matrix

Implement server-side enforcement for at least the following:

| Action | System Admin | Operations Manager | Station Manager | Import Officer | Accountant | Report Viewer |
|---|---:|---:|---:|---:|---:|---:|
| View all stations | Yes | Yes | No | No | As assigned / approved | As assigned |
| View assigned station | Yes | Yes | Yes | Yes | Yes | Yes |
| Import files | Yes | Yes | Yes | Yes | No | No |
| Create/edit operator | Yes | Yes | Assigned station | Limited / No | No | No |
| View charging sessions | Yes | Yes | Assigned station | Assigned station | Assigned / approved | Read-only assigned |
| Modify charging sessions | Yes | Yes | Limited | Limited import workflow only | No | No |
| View billing | Yes | Yes | Assigned station | Limited | Yes | Read-only |
| Recalculate billing | Yes | Yes | Assigned station if authorized | No | No | No |
| Manage tariffs | Yes | Yes | No | No | No | No |
| View shifts | Yes | Yes | Assigned station | Assigned station | Yes | Read-only |
| Modify shifts | Yes | Yes | Assigned station | Limited | No | No |
| Approve handover | Not yet implemented in A2 | Not yet implemented | Not yet implemented | No | Not yet implemented | No |
| Manage users | Yes | No | No | No | No | No |
| Approve users | Yes | No | No | No | No | No |
| View audit log | Yes | Yes | Limited | No | Yes | No |
| Export reports | Yes | Yes | Assigned station | Limited | Yes | Yes |

For workflows not yet implemented, secure the current equivalent tables and actions without inventing future UI.

---

# 8. RLS Audit

Inspect all active non-OCPP tables.

At minimum:

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
- A1 archive tables
- A1 conflict-report tables

For each table document:

- RLS enabled?
- Existing policies
- Duplicate policies
- Open policies
- Role grants
- Current client operations
- Required role
- Required station scope
- Required SELECT/INSERT/UPDATE/DELETE rules

Remove or replace duplicate open policies.

Do not leave broad fallback policies that bypass new controls.

---

# 9. Authorization Helper Functions

Create carefully designed helper functions where needed.

Possible helpers:

- `current_user_is_approved()`
- `current_user_role()`
- `current_user_has_station_access(station_id uuid)`
- `current_user_is_system_admin()`
- `current_user_can_manage_tariffs()`
- `current_user_can_recalculate_billing(station_id uuid)`

Security requirements:

- Prefer stable SQL helpers where appropriate.
- Avoid recursion through policies.
- Avoid reading user-controlled metadata.
- Use `auth.uid()`.
- Use trusted profile or app metadata.
- Set safe `search_path`.
- Minimize `SECURITY DEFINER`.
- Revoke unnecessary PUBLIC execution.
- Grant only to authenticated users when required.
- Test direct invocation.

Do not create a single helper that effectively returns true for all approved users.

---

# 10. Critical RPC Authorization

Audit all active RPCs, especially:

- `calculate_batch_billing`
- `replace_session_billing`
- `delete_import_batch`
- `recalculate_shift_totals`
- `recalculate_all_shift_totals`
- `turbo_bulk_calculate_billing`
- `turbo_calculate_all_pending`
- Analytics/report RPCs
- Any user-management RPCs

For each RPC inspect:

- `SECURITY DEFINER` or `SECURITY INVOKER`
- Owner
- Search path
- PUBLIC grants
- Authenticated grants
- Anonymous grants
- Internal authorization checks
- Station-scope validation
- Mutation impact

## Required controls

- Anonymous users must not execute financial mutation RPCs.
- Approved but unauthorized roles must not execute financial mutation RPCs.
- Station-scoped users must not mutate another station.
- `replace_session_billing` must validate the caller’s permission and target station.
- `delete_import_batch` must validate role and station.
- Recalculation RPCs must validate role and station.
- Full-fleet recalculation must be limited to System Administrator or Operations Manager.
- Read-only analytics functions must respect station scope where applicable.

Do not rewrite tariff algorithms in A2.

Only add authorization and safe execution controls.

---

# 11. A1 Archive Security

A1 created:

- `billing_calculations_duplicate_archive`
- `billing_breakdown_items_duplicate_archive`
- `billing_duplicate_conflict_report`
- `a1_rpc_baseline_catalog`
- Backup schema `a1_backup_20260716`

Secure them.

Recommended behavior:

- Client users cannot directly read backup schema.
- Only System Administrator and possibly Operations Manager/Accountant can read conflict reports.
- No normal client role can update or delete archives.
- Archive tables are append-only.
- RPC baseline catalog is admin-read only.
- Backup schema should not be exposed via PostgREST.

Do not delete these objects.

---

# 12. User Registration and Login Flow

Inspect:

- `AuthContext.tsx`
- Sign-up UI
- Login UI
- Protected routes
- Profile creation
- Role initialization
- Email verification behavior
- Password-reset flow
- Disabled-user behavior

Target:

- Sign-up may create auth identity.
- Operational profile defaults to `pending`.
- Pending users see a clear pending-approval screen.
- Rejected or disabled users cannot access the application.
- Approved users receive permissions based on role and station assignment.
- Role checks in UI mirror server security but are not the authority.

Do not automatically assign administrator or manager roles.

---

# 13. Audit Logging

Add append-only audit events for:

- User created
- User approved
- User rejected
- User disabled
- User re-enabled
- Role changed
- Station assignment added
- Station assignment removed
- Critical RPC denied
- Tariff-management access attempt
- Billing recalculation attempt
- Import deletion
- Archive access if practical

Audit fields should include:

- Actor user ID
- Action
- Entity type
- Entity ID
- Old value
- New value
- Station ID
- Timestamp
- Request context if available
- Reason

Do not allow normal users to update or delete audit records.

---

# 14. Migration Plan

Create migrations in controlled order.

Suggested structure:

1. `*_a2_user_approval_and_role_foundation.sql`
2. `*_a2_user_station_access.sql`
3. `*_a2_authorization_helpers.sql`
4. `*_a2_core_rls_policies.sql`
5. `*_a2_financial_rpc_authorization.sql`
6. `*_a2_archive_and_audit_security.sql`

Each migration must include:

- Preconditions
- Existing-policy inventory
- Safe data backfill
- Forward operations
- Validation
- Rollback or compensating strategy
- Comments
- No destructive user-role assumptions

## Existing users

Before enforcing approval:

- Inventory all existing users.
- Mark current legitimate active users as approved through an explicit migration data set or controlled script.
- Do not approve unknown users automatically.
- Produce a review list.
- Prevent lockout of the current System Administrator.
- Confirm at least one working admin account before final enforcement.

---

# 15. Application Changes

Likely files:

- `src/contexts/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- User-management components
- User service
- Station access service
- Role/permission utilities
- Supabase client wrappers
- Billing service RPC calls
- Import service
- Shift service
- Report services
- Generated database types
- New security test helpers

Required UI behavior:

- Pending approval screen
- Disabled/rejected access screen
- Role-aware navigation
- Station-aware selectors
- Clear forbidden messages
- No silent blank screens
- No client-only bypass

Do not redesign unrelated UI.

---

# 16. Automated Security Tests

Add focused tests for:

## Authentication

- Anonymous user cannot read operational tables.
- Pending user cannot read operational tables.
- Rejected user cannot read operational tables.
- Disabled user cannot read operational tables.
- Approved user can authenticate.

## Role Access

- System Admin access.
- Operations Manager access.
- Station Manager assigned station only.
- Import Officer assigned station only.
- Accountant permitted financial reads.
- Report Viewer read-only access.

## Station Isolation

- User assigned to Station A cannot read Station B sessions.
- User assigned to Station A cannot update Station B.
- Direct Supabase calls are blocked.

## RPC Authorization

- Unauthorized role cannot call `replace_session_billing`.
- Unauthorized role cannot call `delete_import_batch`.
- Unauthorized role cannot call recalculation RPCs.
- Authorized role can act only within station scope.
- Anonymous execution denied.

## Archive Security

- Normal users cannot update/delete archive records.
- Only approved authorized roles can read conflict reports.
- Backup schema is not client-accessible.

## User Approval

- New user defaults pending.
- Pending user sees approval state.
- Admin approval enables access.
- User cannot approve self.
- Disabling immediately blocks access.

---

# 17. Runtime UAT

Run in staging or disposable environment first.

If no staging/disposable environment exists, stop before applying RLS changes to live production and report the blocker.

## UAT-A2-01 — Admin Continuity

- Confirm current admin can log in.
- Confirm admin can access all stations.
- Confirm admin can manage users.
- Confirm admin can approve a pending user.

## UAT-A2-02 — Pending User

- Create a test account.
- Confirm status is pending.
- Confirm operational data access is denied.
- Approve the user.
- Confirm access becomes available according to assigned role.

## UAT-A2-03 — Station Isolation

- Create or use test users assigned to different stations.
- Confirm cross-station reads and writes fail through direct API requests.

## UAT-A2-04 — Role Boundaries

Test each role against the permission matrix.

## UAT-A2-05 — RPC Security

Call critical RPCs directly using test user sessions.

Confirm unauthorized calls fail.

## UAT-A2-06 — Application Smoke

Verify:

- Login
- Pending screen
- Dashboard
- Stations
- Operators
- File upload access for Import Officer
- Billing view
- Recalculation access
- Reports
- Logout

## UAT-A2-07 — A1 Regression

Confirm:

- Billing uniqueness still works.
- `replace_session_billing` works for authorized user.
- Duplicate count remains zero.
- A1 archive remains intact.

---

# 18. Stop Conditions

Stop and report if:

- No staging or disposable environment is available for RLS testing.
- Current admin identity cannot be confirmed.
- Existing users cannot be mapped safely.
- Applying approval state would lock out legitimate users.
- Station assignments are missing or ambiguous.
- Critical RPCs cannot be secured without breaking required workflows.
- Backup/restore point is not verified.
- A1 duplicate count is no longer zero.
- Uncommitted user work would be overwritten.
- A policy change causes broad unexpected denial.

Do not apply experimental RLS directly to live production.

---

# 19. Required Deliverable

Create:

`EV_CHARGING_SYSTEM_PHASE_A2_IMPLEMENTATION_AND_UAT_REPORT.md`

The report must include:

## 1. Executive Summary

- What was secured
- What remains open
- Whether live database was touched
- Whether any user was locked out
- Whether direct API bypass was prevented

## 2. A1 Prerequisite Verification

## 3. Current User and Role Inventory

Do not expose passwords, tokens, or secrets.

## 4. Role Mapping

## 5. Station Access Model

## 6. RLS Before-and-After Matrix

For every active table.

## 7. RPC Authorization Matrix

## 8. Migration Details

For every migration:

- Filename
- Purpose
- Backfill
- Policies
- Grants
- Rollback
- Verification

## 9. Application Changes

## 10. Automated Tests

## 11. Runtime UAT

## 12. Direct API Security Tests

## 13. Audit Logging Verification

## 14. Remaining Risks

Especially:

- Tariff algorithm remains wrong until Phase B.
- Payment methods remain missing.
- Handover remains incomplete.
- Historical billing remains uncorrected.

## 15. Changed Files

## 16. Phase Acceptance Checklist

## 17. Rollback Test

## 18. Recommended Next Step

State whether A2 is ready to close and whether Phase B may begin.

---

# 20. Acceptance Criteria

Phase A2 is complete only when:

1. Existing legitimate users are inventoried.
2. At least one verified System Administrator remains functional.
3. New users default to pending.
4. Pending, rejected, and disabled users cannot access operational data.
5. Open core-table policies are removed.
6. Role and station scope are enforced server-side.
7. Critical RPCs perform authorization checks.
8. Anonymous financial mutation is impossible.
9. Cross-station direct API access is blocked.
10. Archive and backup objects are protected.
11. Audit records are append-only for normal users.
12. Automated security tests pass.
13. Runtime UAT passes in staging/disposable environment.
14. A1 functionality remains intact.
15. No tariff calculation behavior changes.
16. No historical recalculation occurs.
17. Rollback procedure is documented and tested.
18. Implementation report is complete.

---

# 21. Final Instruction

Implement Phase A2 only.

Do not proceed to Phase B.

Do not change tariff calculation.

Do not remove Demand Charge yet.

Do not change tax behavior.

Do not implement payment methods.

Do not change handover calculations.

Do not recalculate historical billing.

Do not activate OCPP.

End the report with:

> **Phase A2 Status:** PASS / FAIL / BLOCKED  
> **Phase B Authorization:** NOT STARTED — requires Sameer’s review and approval.
