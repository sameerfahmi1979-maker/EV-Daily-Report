# EV-A2 Production Promotion Checklist

**Status:** NOT AUTHORIZED — staging UAT complete; production A2 requires Sameer’s explicit approval.

## Ordered migrations (production)

Apply only after staging sign-off and live backup:

1. `20260716230000_a2_user_approval_and_role_foundation.sql`  
   - Includes fix: drop legacy `user_profiles_role_check` before role remap.
2. `20260716230100_a2_user_station_access.sql`
3. `20260716230200_a2_authorization_helpers.sql`
4. `20260716230300_a2_core_rls_policies.sql`
5. `20260716230400_a2_financial_rpc_authorization.sql`
6. `20260716230500_a2_archive_and_audit_security.sql`

Do **not** apply `20251219000000_staging_schema_baseline.sql` to production.

## Pre-production checklist

- [ ] Staging security UAT green (`scripts/staging/security_uat.cjs`, `rpc_role_uat.cjs`)
- [ ] Staging rollback rehearsal understood
- [ ] Logical backup of production `user_profiles`, policies, grants, financial RPCs
- [ ] Confirm production still has approved admins on allow-list emails
- [ ] Confirm A1 unique billing constraint still present on production
- [ ] Maintenance window agreed
- [ ] Rollback owner assigned

## Backup checklist

- [ ] Export `pg_policies` / grants snapshot for public schema
- [ ] Export `pg_get_functiondef` for financial RPCs
- [ ] Confirm PITR / daily backup available on production project
- [ ] Optional: create `a2_backup_<date>` schema copies of `user_profiles` + policy catalog

## Admin continuity

Allow-list currently hardcoded in A2 migration 1:

- `sameer@algt.net`
- `sameer@energy-stream.net`
- `tariq@energy-stream.net`

- [ ] Verify each still active before apply
- [ ] At least one must remain `system_admin` + `approved` after remap
- [ ] Keep a service-role break-glass path for emergency profile repair

## Station assignment

- [ ] Map each non-admin user to `user_station_access` (or legacy `station_id` backfill)
- [ ] Confirm single production station ID still valid
- [ ] Operations/system admins receive all-station access via migration backfill

## Verification SQL (post-apply)

```sql
-- Admins remain
SELECT email, role, approval_status, is_active
FROM user_profiles
WHERE role = 'system_admin';

-- A2 objects
SELECT to_regclass('public.user_station_access');

-- Anon must not read sessions (run via anon key, not SQL editor service role)
-- Expect 0 rows / RLS denial in app or API test
```

## Direct API security tests (production)

Repeat staging script targets against production **only after** migrate, using temporary test users or Sameer’s session — never leave open policies.

## Rollback scripts

- Staging rehearsal: `scripts/staging/a2_rollback_rehearsal.cjs` (policy-level)
- Production rollback: restore pre-A2 policy/RPC definitions from backup snapshot; drop `user_station_access` only if safe; restore `user_profiles` role/approval columns carefully
- Expected downtime: short (minutes) for migration apply; longer if full policy restore required

## Go / no-go

**Go only if:**

1. Staging A2 status PASS  
2. Production backup confirmed  
3. Admin continuity verified  
4. Sameer explicit written approval  

**No-go if:** any staging security FAIL, missing backup, or unclear admin remap.

## Post-deployment

- [ ] Admin login works
- [ ] Pending registration blocked
- [ ] Anon financial RPC denied
- [ ] Import officer cannot recalculate
- [ ] Accountant/report viewer read paths work
- [ ] No Phase B tariff changes included
