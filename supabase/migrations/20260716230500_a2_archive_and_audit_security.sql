-- EV-A2 Migration 6/6: Secure A1 archives + harden audit append-only
-- STATUS: PREPARED — do not apply to live production without staging UAT.

-- Ensure RLS on A1 objects
ALTER TABLE IF EXISTS public.billing_calculations_duplicate_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_breakdown_items_duplicate_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.billing_duplicate_conflict_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.a1_rpc_baseline_catalog ENABLE ROW LEVEL SECURITY;

-- Drop broad policies if any non-service were added later
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'billing_calculations_duplicate_archive',
        'billing_breakdown_items_duplicate_archive',
        'billing_duplicate_conflict_report',
        'a1_rpc_baseline_catalog'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Archives: admin/ops/accountant read; no client writes/deletes
CREATE POLICY "archive_billing_select_privileged"
  ON public.billing_calculations_duplicate_archive FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','accountant'
    )
  );

CREATE POLICY "archive_breakdown_select_privileged"
  ON public.billing_breakdown_items_duplicate_archive FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','accountant'
    )
  );

CREATE POLICY "conflict_report_select_privileged"
  ON public.billing_duplicate_conflict_report FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','accountant'
    )
  );

CREATE POLICY "rpc_catalog_admin_select"
  ON public.a1_rpc_baseline_catalog FOR SELECT TO authenticated
  USING (public.current_user_is_system_admin());

-- service_role retain full for migrations/restore
CREATE POLICY "archive_billing_service_all"
  ON public.billing_calculations_duplicate_archive FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "archive_breakdown_service_all"
  ON public.billing_breakdown_items_duplicate_archive FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "conflict_report_service_all"
  ON public.billing_duplicate_conflict_report FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "rpc_catalog_service_all"
  ON public.a1_rpc_baseline_catalog FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Backup schema: revoke public/client access if present
DO $$
BEGIN
  IF to_regnamespace('a1_backup_20260716') IS NOT NULL THEN
    REVOKE ALL ON SCHEMA a1_backup_20260716 FROM PUBLIC, anon, authenticated;
    EXECUTE 'GRANT USAGE ON SCHEMA a1_backup_20260716 TO postgres, service_role';
    EXECUTE 'GRANT ALL ON ALL TABLES IN SCHEMA a1_backup_20260716 TO postgres, service_role';
  END IF;
END $$;

-- Audit: ensure no UPDATE/DELETE for authenticated
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND cmd IN ('UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_log', r.policyname);
  END LOOP;
END $$;
