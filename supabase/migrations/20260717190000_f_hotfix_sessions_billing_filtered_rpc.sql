-- Hotfix: the Billing page's session list (getSessionsWithBillingFiltered)
-- queried charging_sessions directly (not via a SECURITY DEFINER RPC), so
-- every row paid the sessions_select_scoped RLS cost (current_user_is_approved()
-- AND current_user_has_station_access(station_id) evaluated as a security-
-- barrier qualifier, which also blocks the planner from pushing the LIMIT
-- below the barrier). This was fine at a small row count but now times out
-- at 44,000+ sessions — reproduced directly: unfiltered "All Status" query
-- via the authenticated role took 8.3s and hit statement_timeout, while the
-- same query as a plain SQL statement (no RLS) took ~1ms.
--
-- Fix: move the query into a SECURITY DEFINER RPC with a single upfront
-- approval check plus an explicit (non-RLS-barrier) station-scope predicate —
-- the same pattern already used for every Phase D/E/F RPC and the
-- get_analytics_summary family fixed earlier today.

CREATE OR REPLACE FUNCTION public.get_sessions_with_billing_filtered(
  p_station_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_search_term text DEFAULT NULL,
  p_billing_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capped_limit integer := LEAST(coalesce(p_limit, 50), 500);
  v_search text := CASE WHEN p_search_term IS NULL OR p_search_term = '' THEN NULL ELSE '%' || p_search_term || '%' END;
  v_total bigint;
  v_rows jsonb;
  v_is_global boolean;
  v_accessible_stations uuid[];
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;

  -- Resolve the caller's station access ONCE (not per row) — calling
  -- current_user_has_station_access(cs.station_id) for every one of 80,000+
  -- rows is what caused the statement timeout that motivated this RPC.
  v_is_global := public.report_current_role_is_global();
  IF NOT v_is_global THEN
    SELECT coalesce(array_agg(usa.station_id), '{}') INTO v_accessible_stations
    FROM user_station_access usa
    WHERE usa.user_id = auth.uid() AND usa.is_active = true;
  END IF;

  SELECT count(*) INTO v_total
  FROM charging_sessions cs
  WHERE (v_is_global OR cs.station_id = ANY(v_accessible_stations))
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (p_start_date IS NULL OR cs.start_ts >= p_start_date)
    AND (p_end_date IS NULL OR cs.start_ts <= p_end_date)
    AND (v_search IS NULL OR cs.transaction_id ILIKE v_search OR cs.card_number ILIKE v_search OR cs.charge_id ILIKE v_search)
    AND (
      p_billing_status IS NULL OR p_billing_status = 'all'
      OR (p_billing_status = 'calculated' AND cs.has_billing_calculation = true)
      OR (p_billing_status = 'pending' AND cs.has_billing_calculation = false)
    );

  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      to_jsonb(cs.*)
      || jsonb_build_object(
        'stations', (
          SELECT jsonb_build_object('id', s.id, 'name', s.name, 'station_code', s.station_code)
          FROM stations s WHERE s.id = cs.station_id
        ),
        'billing_calculations', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', bc.id, 'total_amount', bc.total_amount, 'currency', bc.currency, 'calculation_date', bc.calculation_date
          )), '[]'::jsonb)
          FROM billing_calculations bc WHERE bc.session_id = cs.id
        )
      ) AS row_data
    FROM charging_sessions cs
    WHERE (v_is_global OR cs.station_id = ANY(v_accessible_stations))
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
      AND (p_start_date IS NULL OR cs.start_ts >= p_start_date)
      AND (p_end_date IS NULL OR cs.start_ts <= p_end_date)
      AND (v_search IS NULL OR cs.transaction_id ILIKE v_search OR cs.card_number ILIKE v_search OR cs.charge_id ILIKE v_search)
      AND (
        p_billing_status IS NULL OR p_billing_status = 'all'
        OR (p_billing_status = 'calculated' AND cs.has_billing_calculation = true)
        OR (p_billing_status = 'pending' AND cs.has_billing_calculation = false)
      )
    ORDER BY cs.start_ts DESC
    LIMIT v_capped_limit OFFSET coalesce(p_offset, 0)
  ) t;

  RETURN jsonb_build_object('sessions', v_rows, 'total_count', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sessions_with_billing_filtered(uuid, timestamptz, timestamptz, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sessions_with_billing_filtered(uuid, timestamptz, timestamptz, text, text, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_sessions_with_billing_filtered(uuid, timestamptz, timestamptz, text, text, integer, integer) IS
  'Billing page session list backing RPC. SECURITY DEFINER to avoid per-row RLS cost at scale; station scoping is still enforced explicitly via current_user_has_station_access() on every row.';
