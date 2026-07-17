-- EV-A2 Migration 4/6: Replace open/duplicate RLS policies on core tables
-- STATUS: PREPARED — do not apply to live production without staging UAT.
-- WARNING: Applying this on live without verified admin backfill will lock users out.

-- Drop ALL existing policies on core tables (open + duplicates)
DO $$
DECLARE
  r RECORD;
  tables text[] := ARRAY[
    'stations','operators','import_batches','charging_sessions',
    'billing_calculations','billing_breakdown_items','shifts',
    'rate_structures','rate_periods','fixed_charges','tax_configurations',
    'system_settings','user_profiles','audit_log','user_station_access',
    'operator_schedules','maintenance_log','notifications'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ========== user_profiles ==========
CREATE POLICY "users_select_own_or_admin"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR public.current_user_is_system_admin()
  );

CREATE POLICY "users_insert_own_pending"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role IN ('report_viewer', 'station_manager', 'import_officer', 'accountant')
    AND approval_status = 'pending'
  );

CREATE POLICY "users_update_admin_only"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_users())
  WITH CHECK (public.current_user_can_manage_users());

CREATE POLICY "users_delete_admin_only"
  ON public.user_profiles FOR DELETE TO authenticated
  USING (public.current_user_can_manage_users());

-- ========== user_station_access ==========
CREATE POLICY "usa_select_own_or_admin"
  ON public.user_station_access FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
  );

CREATE POLICY "usa_mutate_admin_only"
  ON public.user_station_access FOR ALL TO authenticated
  USING (public.current_user_can_manage_users())
  WITH CHECK (public.current_user_can_manage_users());

-- ========== stations ==========
CREATE POLICY "stations_select_scoped"
  ON public.stations FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      public.current_user_is_system_admin()
      OR public.current_user_is_operations_manager()
      OR public.current_user_has_station_access(id)
    )
  );

CREATE POLICY "stations_mutate_admin_only"
  ON public.stations FOR ALL TO authenticated
  USING (public.current_user_is_system_admin())
  WITH CHECK (public.current_user_is_system_admin());

-- ========== operators ==========
CREATE POLICY "operators_select_approved"
  ON public.operators FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "operators_insert_ops"
  ON public.operators FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  );

CREATE POLICY "operators_update_ops"
  ON public.operators FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  );

CREATE POLICY "operators_delete_admin_ops"
  ON public.operators FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager'
    )
  );

-- ========== charging_sessions ==========
CREATE POLICY "sessions_select_scoped"
  ON public.charging_sessions FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND public.current_user_has_station_access(station_id)
  );

CREATE POLICY "sessions_insert_importers"
  ON public.charging_sessions FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_import(station_id)
  );

CREATE POLICY "sessions_update_ops"
  ON public.charging_sessions FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
    AND public.current_user_has_station_access(station_id)
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
    AND public.current_user_has_station_access(station_id)
  );

CREATE POLICY "sessions_delete_admin_ops"
  ON public.charging_sessions FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
    AND public.current_user_has_station_access(station_id)
  );

-- ========== billing_calculations ==========
CREATE POLICY "billing_select_scoped"
  ON public.billing_calculations FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = billing_calculations.session_id
        AND public.current_user_has_station_access(cs.station_id)
    )
  );

CREATE POLICY "billing_insert_recalc_roles"
  ON public.billing_calculations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = session_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  );

CREATE POLICY "billing_update_recalc_roles"
  ON public.billing_calculations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = billing_calculations.session_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = session_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  );

CREATE POLICY "billing_delete_recalc_roles"
  ON public.billing_calculations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.charging_sessions cs
      WHERE cs.id = billing_calculations.session_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  );

-- ========== billing_breakdown_items ==========
CREATE POLICY "bbi_select_scoped"
  ON public.billing_breakdown_items FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND EXISTS (
      SELECT 1
      FROM public.billing_calculations bc
      JOIN public.charging_sessions cs ON cs.id = bc.session_id
      WHERE bc.id = billing_breakdown_items.billing_calculation_id
        AND public.current_user_has_station_access(cs.station_id)
    )
  );

CREATE POLICY "bbi_mutate_recalc_roles"
  ON public.billing_breakdown_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.billing_calculations bc
      JOIN public.charging_sessions cs ON cs.id = bc.session_id
      WHERE bc.id = billing_breakdown_items.billing_calculation_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.billing_calculations bc
      JOIN public.charging_sessions cs ON cs.id = bc.session_id
      WHERE bc.id = billing_calculation_id
        AND public.current_user_can_recalculate_billing(cs.station_id)
    )
  );

-- ========== import_batches ==========
CREATE POLICY "import_select_approved"
  ON public.import_batches FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "import_insert_importers"
  ON public.import_batches FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager','import_officer'
    )
  );

CREATE POLICY "import_update_importers"
  ON public.import_batches FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager','import_officer'
    )
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager','import_officer'
    )
  );

CREATE POLICY "import_delete_ops"
  ON public.import_batches FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  );

-- ========== shifts ==========
CREATE POLICY "shifts_select_scoped"
  ON public.shifts FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND public.current_user_has_station_access(station_id)
  );

CREATE POLICY "shifts_mutate_ops"
  ON public.shifts FOR ALL TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager','import_officer'
    )
    AND public.current_user_has_station_access(station_id)
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager','import_officer'
    )
    AND public.current_user_has_station_access(station_id)
  );

-- ========== rates / fixed / tax ==========
CREATE POLICY "rate_structures_select_approved"
  ON public.rate_structures FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      station_id IS NULL
      OR public.current_user_has_station_access(station_id)
      OR public.current_user_can_manage_tariffs()
    )
  );

CREATE POLICY "rate_structures_mutate_admin"
  ON public.rate_structures FOR ALL TO authenticated
  USING (public.current_user_can_manage_tariffs())
  WITH CHECK (public.current_user_can_manage_tariffs());

CREATE POLICY "rate_periods_select_approved"
  ON public.rate_periods FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "rate_periods_mutate_admin"
  ON public.rate_periods FOR ALL TO authenticated
  USING (public.current_user_can_manage_tariffs())
  WITH CHECK (public.current_user_can_manage_tariffs());

CREATE POLICY "fixed_charges_select_approved"
  ON public.fixed_charges FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      station_id IS NULL
      OR public.current_user_has_station_access(station_id)
      OR public.current_user_can_manage_tariffs()
    )
  );

CREATE POLICY "fixed_charges_mutate_admin"
  ON public.fixed_charges FOR ALL TO authenticated
  USING (public.current_user_can_manage_tariffs())
  WITH CHECK (public.current_user_can_manage_tariffs());

CREATE POLICY "tax_select_approved"
  ON public.tax_configurations FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "tax_mutate_admin"
  ON public.tax_configurations FOR ALL TO authenticated
  USING (public.current_user_can_manage_tariffs())
  WITH CHECK (public.current_user_can_manage_tariffs());

-- ========== system_settings ==========
CREATE POLICY "settings_select_approved"
  ON public.system_settings FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "settings_mutate_admin"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.current_user_is_system_admin())
  WITH CHECK (public.current_user_is_system_admin());

-- ========== audit_log append-only ==========
CREATE POLICY "audit_insert_authenticated"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "audit_select_privileged"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','accountant'
    )
  );

-- no UPDATE/DELETE policies for normal roles (append-only)

-- ========== operator_schedules / maintenance / notifications ==========
CREATE POLICY "schedules_select_approved"
  ON public.operator_schedules FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      station_id IS NULL
      OR public.current_user_has_station_access(station_id)
    )
  );

CREATE POLICY "schedules_mutate_ops"
  ON public.operator_schedules FOR ALL TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
    AND (station_id IS NULL OR public.current_user_has_station_access(station_id))
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
    AND (station_id IS NULL OR public.current_user_has_station_access(station_id))
  );

CREATE POLICY "maintenance_select_approved"
  ON public.maintenance_log FOR SELECT TO authenticated
  USING (public.current_user_is_approved());

CREATE POLICY "maintenance_mutate_ops"
  ON public.maintenance_log FOR ALL TO authenticated
  USING (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  )
  WITH CHECK (
    public.current_user_role() IN (
      'system_admin','global_admin','operations_manager','company_manager','station_manager'
    )
  );

CREATE POLICY "notifications_own"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
