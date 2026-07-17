-- EV-A2 Migration 3/6: Authorization helpers
-- STATUS: PREPARED — do not apply to live production without staging UAT.
-- Uses SECURITY DEFINER + fixed search_path to avoid RLS recursion.
-- Reads trusted user_profiles rows keyed by auth.uid() (not user_metadata).

CREATE OR REPLACE FUNCTION public.current_user_profile()
RETURNS public.user_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.approval_status = 'approved'
      AND COALESCE(up.is_active, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.role
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
    AND up.approval_status = 'approved'
    AND COALESCE(up.is_active, false) = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.approval_status = 'approved'
      AND COALESCE(up.is_active, false) = true
      AND up.role IN ('system_admin', 'global_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_operations_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.approval_status = 'approved'
      AND COALESCE(up.is_active, false) = true
      AND up.role IN ('operations_manager', 'company_manager', 'system_admin', 'global_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_station_access(p_station_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN p_station_id IS NULL THEN false
      WHEN public.current_user_is_system_admin() THEN true
      WHEN public.current_user_role() IN ('operations_manager', 'company_manager') THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.user_station_access usa
        JOIN public.user_profiles up ON up.id = usa.user_id
        WHERE usa.user_id = auth.uid()
          AND usa.station_id = p_station_id
          AND usa.is_active = true
          AND up.approval_status = 'approved'
          AND COALESCE(up.is_active, false) = true
      )
    END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_tariffs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('system_admin', 'global_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_recalculate_billing(p_station_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_approved()
    AND public.current_user_role() IN (
      'system_admin', 'global_admin',
      'operations_manager', 'company_manager',
      'station_manager'
    )
    AND public.current_user_has_station_access(p_station_id);
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_import(p_station_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_approved()
    AND public.current_user_role() IN (
      'system_admin', 'global_admin',
      'operations_manager', 'company_manager',
      'station_manager', 'import_officer'
    )
    AND public.current_user_has_station_access(p_station_id);
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_users()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_is_system_admin();
$$;

-- Lock down helper execution
REVOKE ALL ON FUNCTION public.current_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_approved() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_system_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_operations_manager() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_station_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_manage_tariffs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_recalculate_billing(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_import(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_manage_users() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_operations_manager() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_station_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_tariffs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_recalculate_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_import(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_users() TO authenticated;
