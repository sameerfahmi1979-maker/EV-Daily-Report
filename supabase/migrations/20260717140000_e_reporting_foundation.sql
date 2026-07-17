-- EV-E Migration 1/6: Reporting foundation — feature flag, shared access helper,
-- internal "latest billing per session" view, and indexes new query patterns need.

INSERT INTO public.system_settings (key, value, category)
SELECT 'reporting_v2_enabled', 'false', 'import'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'reporting_v2_enabled');

-- Shared authorization gate for every report_* RPC in this phase.
-- Global roles (admin/ops/company manager) may query across stations (p_station_id NULL).
-- Station-scoped roles must supply a station they have access to.
CREATE OR REPLACE FUNCTION public.report_assert_access(p_station_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-E denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'EV-E denied: user not approved' USING ERRCODE = '42501';
  END IF;

  v_role := public.current_user_role();
  IF v_role IS NULL OR NOT (v_role = ANY (ARRAY[
    'system_admin', 'global_admin', 'operations_manager', 'company_manager',
    'station_manager', 'accountant', 'import_officer', 'report_viewer'
  ])) THEN
    RAISE EXCEPTION 'EV-E denied: role not permitted for reporting' USING ERRCODE = '42501';
  END IF;

  IF v_role IN ('system_admin', 'global_admin', 'operations_manager', 'company_manager') THEN
    RETURN;
  END IF;

  IF p_station_id IS NULL THEN
    RAISE EXCEPTION 'EV-E denied: station is required for this role' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_has_station_access(p_station_id) THEN
    RAISE EXCEPTION 'EV-E denied: station scope' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_assert_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_assert_access(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_assert_access(uuid) TO authenticated, service_role;

-- Internal helper: does the current role have global (cross-station) reporting scope?
CREATE OR REPLACE FUNCTION public.report_current_role_is_global()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.current_user_role(), '') IN (
    'system_admin', 'global_admin', 'operations_manager', 'company_manager'
  );
$$;

REVOKE ALL ON FUNCTION public.report_current_role_is_global() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_current_role_is_global() FROM anon;
GRANT EXECUTE ON FUNCTION public.report_current_role_is_global() TO authenticated, service_role;

-- Internal-only view: the single latest billing_calculations row per session.
-- Not granted to anon/authenticated directly — only usable from inside the
-- SECURITY DEFINER report_* functions below (which execute with the owning
-- role's privileges), keeping "latest billing per session" logic in one place
-- instead of repeating a DISTINCT ON / window function in every report query.
CREATE OR REPLACE VIEW public.report_v_latest_billing AS
SELECT
  bc.session_id,
  bc.id AS billing_id,
  bc.total_amount,
  bc.taxes,
  bc.fees,
  bc.subtotal,
  bc.calculation_engine_version,
  bc.billing_source,
  bc.calculated_at,
  bc.created_at,
  bc.applied_rate_summary,
  bc.source_import_batch_id
FROM (
  SELECT
    bc.*,
    row_number() OVER (
      PARTITION BY bc.session_id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    ) AS rn
  FROM public.billing_calculations bc
) bc
WHERE bc.rn = 1;

REVOKE ALL ON public.report_v_latest_billing FROM PUBLIC;
REVOKE ALL ON public.report_v_latest_billing FROM anon, authenticated;

-- Internal-only view: non-zero demand/tax + breakdown-sum reconciliation per billing row,
-- used by the exception and billing-reconciliation reports.
CREATE OR REPLACE VIEW public.report_v_billing_breakdown_check AS
SELECT
  bc.id AS billing_id,
  bc.session_id,
  bc.total_amount,
  bc.taxes,
  coalesce(sum(bbi.demand_charge), 0) AS demand_charge_sum,
  coalesce(sum(bbi.energy_charge), 0) + coalesce(sum(bbi.demand_charge), 0) AS breakdown_sum,
  count(bbi.id) AS breakdown_row_count
FROM public.billing_calculations bc
LEFT JOIN public.billing_breakdown_items bbi ON bbi.billing_calculation_id = bc.id
GROUP BY bc.id, bc.session_id, bc.total_amount, bc.taxes;

REVOKE ALL ON public.report_v_billing_breakdown_check FROM PUBLIC;
REVOKE ALL ON public.report_v_billing_breakdown_check FROM anon, authenticated;

-- Indexes new reporting query patterns benefit from (idempotent).
CREATE INDEX IF NOT EXISTS idx_charging_sessions_station_start_date
  ON public.charging_sessions (station_id, start_date);

CREATE INDEX IF NOT EXISTS idx_billing_calculations_session_calculated
  ON public.billing_calculations (session_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chs_session_id
  ON public.cash_handover_sessions (session_id);

CREATE INDEX IF NOT EXISTS idx_cash_handover_adjustments_handover_status
  ON public.cash_handover_adjustments (handover_id, status);

COMMENT ON FUNCTION public.report_assert_access(uuid) IS
  'EV-E shared authorization gate for all report_* reporting RPCs. Global roles may omit station; station-scoped roles must supply an authorized station.';
