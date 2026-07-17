-- Adds true server-side pagination to the Shift Management list.
--
-- Same pattern as get_sessions_with_billing_filtered (20260717190000): a
-- SECURITY DEFINER RPC that resolves the caller's station access ONCE
-- instead of relying on the shifts_select_scoped RLS policy evaluating
-- current_user_has_station_access(station_id) per row. shifts is currently
-- small (~400 rows) so this isn't urgent for performance today, but it
-- removes the same 1000-row silent-truncation risk and RLS-at-scale risk
-- before the table grows, and lets search work across the full filtered set
-- rather than only the currently-loaded page.

CREATE OR REPLACE FUNCTION public.get_shifts_paginated(
  p_station_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_handover_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
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
  v_search text := CASE WHEN p_search IS NULL OR p_search = '' THEN NULL ELSE '%' || p_search || '%' END;
  v_total bigint;
  v_rows jsonb;
  v_is_global boolean;
  v_accessible_stations uuid[];
  v_total_revenue numeric;
  v_total_kwh numeric;
  v_pending_count bigint;
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;

  v_is_global := public.report_current_role_is_global();
  IF NOT v_is_global THEN
    SELECT coalesce(array_agg(usa.station_id), '{}') INTO v_accessible_stations
    FROM user_station_access usa
    WHERE usa.user_id = auth.uid() AND usa.is_active = true;
  END IF;

  SELECT
    count(*),
    coalesce(sum(sh.total_amount_jod), 0),
    coalesce(sum(sh.total_kwh), 0),
    count(*) FILTER (WHERE sh.handover_status = 'pending')
  INTO v_total, v_total_revenue, v_total_kwh, v_pending_count
  FROM shifts sh
  LEFT JOIN stations s ON s.id = sh.station_id
  LEFT JOIN operators o ON o.id = sh.operator_id
  WHERE (v_is_global OR sh.station_id = ANY(v_accessible_stations))
    AND (p_station_id IS NULL OR sh.station_id = p_station_id)
    AND (p_operator_id IS NULL OR sh.operator_id = p_operator_id)
    AND (p_handover_status IS NULL OR sh.handover_status = p_handover_status)
    AND (p_date_from IS NULL OR sh.shift_date >= p_date_from)
    AND (p_date_to IS NULL OR sh.shift_date <= p_date_to)
    AND (
      v_search IS NULL
      OR s.name ILIKE v_search
      OR o.name ILIKE v_search
      OR sh.shift_date::text ILIKE v_search
    );

  SELECT coalesce(jsonb_agg(row_data), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      to_jsonb(sh.*)
      || jsonb_build_object(
        'stations', (SELECT jsonb_build_object('name', s.name) FROM stations s WHERE s.id = sh.station_id),
        'operators', (SELECT jsonb_build_object('name', o.name, 'card_number', o.card_number) FROM operators o WHERE o.id = sh.operator_id)
      ) AS row_data
    FROM shifts sh
    LEFT JOIN stations s ON s.id = sh.station_id
    LEFT JOIN operators o ON o.id = sh.operator_id
    WHERE (v_is_global OR sh.station_id = ANY(v_accessible_stations))
      AND (p_station_id IS NULL OR sh.station_id = p_station_id)
      AND (p_operator_id IS NULL OR sh.operator_id = p_operator_id)
      AND (p_handover_status IS NULL OR sh.handover_status = p_handover_status)
      AND (p_date_from IS NULL OR sh.shift_date >= p_date_from)
      AND (p_date_to IS NULL OR sh.shift_date <= p_date_to)
      AND (
        v_search IS NULL
        OR s.name ILIKE v_search
        OR o.name ILIKE v_search
        OR sh.shift_date::text ILIKE v_search
      )
    ORDER BY sh.shift_date DESC, sh.start_time DESC
    LIMIT v_capped_limit OFFSET coalesce(p_offset, 0)
  ) t;

  RETURN jsonb_build_object(
    'shifts', v_rows,
    'total_count', v_total,
    'total_revenue', v_total_revenue,
    'total_kwh', v_total_kwh,
    'pending_count', v_pending_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shifts_paginated(uuid, uuid, text, date, date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shifts_paginated(uuid, uuid, text, date, date, text, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_shifts_paginated(uuid, uuid, text, date, date, text, integer, integer) IS
  'Shift Management list backing RPC with true server-side pagination and search. SECURITY DEFINER to resolve station access once instead of per row.';
