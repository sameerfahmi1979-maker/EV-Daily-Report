-- EV-E Migration 3/6: Cash handover, locked-snapshot, and operator/shift reporting RPCs.

CREATE OR REPLACE FUNCTION public.report_cash_handover_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS TABLE (
  handover_id uuid,
  handover_number text,
  station_id uuid,
  station_name text,
  operator_id uuid,
  operator_name text,
  shift_id uuid,
  shift_date date,
  status text,
  billing_total numeric,
  cash_total numeric,
  card_total numeric,
  cliq_total numeric,
  expected_cash numeric,
  actual_cash_received numeric,
  shortage_amount numeric,
  surplus_amount numeric,
  net_adjustments numeric,
  unassigned_count integer,
  version integer,
  discrepancy_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  locked_at timestamptz,
  reopened_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    h.id,
    h.handover_number,
    h.station_id,
    st.name,
    h.operator_id,
    op.name,
    h.shift_id,
    h.shift_date,
    h.status,
    h.billing_total,
    h.cash_total,
    h.card_total,
    h.cliq_total,
    h.expected_cash,
    h.actual_cash_received,
    h.shortage_amount,
    h.surplus_amount,
    h.net_adjustments,
    h.unassigned_count,
    h.version,
    h.discrepancy_reason,
    h.submitted_at,
    h.approved_at,
    h.locked_at,
    h.reopened_at
  FROM public.cash_handovers h
  JOIN public.stations st ON st.id = h.station_id
  JOIN public.operators op ON op.id = h.operator_id
  WHERE h.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR h.station_id = p_station_id)
    AND (p_status IS NULL OR h.status = p_status)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(h.station_id))
  ORDER BY h.shift_date DESC, h.handover_number;
END;
$$;

REVOKE ALL ON FUNCTION public.report_cash_handover_summary(date, date, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_cash_handover_summary(date, date, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_cash_handover_summary(date, date, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_handover_detail(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_h FROM public.cash_handovers WHERE id = p_handover_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-E handover not found';
  END IF;

  PERFORM public.report_assert_access(v_h.station_id);

  SELECT jsonb_build_object(
    'header', to_jsonb(v_h),
    'sessions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', chs.session_id,
        'transaction_id', cs.transaction_id,
        'start_ts', cs.start_ts,
        'end_ts', cs.end_ts,
        'energy_kwh', cs.energy_consumed_kwh,
        'amount_jod', chs.amount_jod,
        'payment_method', chs.payment_method,
        'billing_calculation_id', chs.billing_calculation_id,
        'payment_allocation_id', chs.payment_allocation_id
      ) ORDER BY cs.start_ts)
      FROM public.cash_handover_sessions chs
      JOIN public.charging_sessions cs ON cs.id = chs.session_id
      WHERE chs.handover_id = p_handover_id
    ), '[]'::jsonb),
    'adjustments', coalesce((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at)
      FROM public.cash_handover_adjustments a
      WHERE a.handover_id = p_handover_id
    ), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at)
      FROM public.cash_handover_events e
      WHERE e.handover_id = p_handover_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_handover_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_handover_detail(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_handover_detail(uuid) TO authenticated, service_role;

-- Locked-handover snapshot report: returns the frozen snapshot plus an explicit
-- comparison against CURRENT live allocations. Never overwrites the snapshot —
-- purely read-only comparison so a locked report cannot silently drift.
CREATE OR REPLACE FUNCTION public.report_locked_handover_snapshot(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_result jsonb;
  v_diff_count int;
BEGIN
  SELECT * INTO v_h FROM public.cash_handovers WHERE id = p_handover_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-E handover not found';
  END IF;

  PERFORM public.report_assert_access(v_h.station_id);

  SELECT count(*) INTO v_diff_count
  FROM public.cash_handover_sessions chs
  LEFT JOIN public.session_payment_allocations spa
    ON spa.session_id = chs.session_id AND spa.is_active = true
  WHERE chs.handover_id = p_handover_id
    AND (
      coalesce(spa.payment_method, 'UNASSIGNED') IS DISTINCT FROM chs.payment_method
      OR public.round_jod3(coalesce(spa.amount_jod, chs.amount_jod)) IS DISTINCT FROM public.round_jod3(chs.amount_jod)
    );

  SELECT jsonb_build_object(
    'is_locked', v_h.status = 'locked',
    'snapshot', jsonb_build_object(
      'handover_number', v_h.handover_number,
      'status', v_h.status,
      'version', v_h.version,
      'billing_total', v_h.billing_total,
      'cash_total', v_h.cash_total,
      'card_total', v_h.card_total,
      'cliq_total', v_h.cliq_total,
      'expected_cash', v_h.expected_cash,
      'actual_cash_received', v_h.actual_cash_received,
      'shortage_amount', v_h.shortage_amount,
      'surplus_amount', v_h.surplus_amount,
      'net_adjustments', v_h.net_adjustments,
      'discrepancy_reason', v_h.discrepancy_reason,
      'locked_at', v_h.locked_at,
      'locked_by', v_h.locked_by
    ),
    'sessions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', chs.session_id,
        'transaction_id', cs.transaction_id,
        'snapshot_payment_method', chs.payment_method,
        'snapshot_amount_jod', chs.amount_jod,
        'live_payment_method', spa.payment_method,
        'live_amount_jod', spa.amount_jod,
        'differs_from_snapshot', (
          coalesce(spa.payment_method, 'UNASSIGNED') IS DISTINCT FROM chs.payment_method
          OR public.round_jod3(coalesce(spa.amount_jod, chs.amount_jod)) IS DISTINCT FROM public.round_jod3(chs.amount_jod)
        )
      ) ORDER BY cs.start_ts)
      FROM public.cash_handover_sessions chs
      JOIN public.charging_sessions cs ON cs.id = chs.session_id
      LEFT JOIN public.session_payment_allocations spa
        ON spa.session_id = chs.session_id AND spa.is_active = true
      WHERE chs.handover_id = p_handover_id
    ), '[]'::jsonb),
    'live_differs_from_snapshot', v_diff_count > 0,
    'live_diff_session_count', v_diff_count,
    'warning', CASE WHEN v_diff_count > 0
      THEN 'Current value differs from locked snapshot'
      ELSE NULL
    END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_locked_handover_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_locked_handover_snapshot(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_locked_handover_snapshot(uuid) TO authenticated, service_role;

-- Operator shift summary (9.2): authoritative billing/payment per shift, plus its
-- most recent handover's status/version/lock details (never shifts.total_*).
CREATE OR REPLACE FUNCTION public.report_operator_shift_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL
)
RETURNS TABLE (
  shift_id uuid,
  station_id uuid,
  station_name text,
  operator_id uuid,
  operator_name text,
  shift_date date,
  start_time timestamptz,
  end_time timestamptz,
  session_count bigint,
  energy_kwh numeric,
  billing_total numeric,
  cash_total numeric,
  card_total numeric,
  cliq_total numeric,
  unassigned_total numeric,
  expected_cash numeric,
  actual_cash_received numeric,
  shortage_amount numeric,
  surplus_amount numeric,
  approved_adjustment_total numeric,
  handover_id uuid,
  handover_number text,
  handover_status text,
  handover_version integer,
  operational_total_amount_jod numeric,
  operational_reconciled boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  WITH shift_billing AS (
    SELECT
      s.id AS shift_id,
      count(cs.id) AS session_count,
      coalesce(sum(cs.energy_consumed_kwh), 0) AS energy_kwh,
      coalesce(sum(lb.total_amount), 0) AS billing_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Cash'), 0) AS cash_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Card'), 0) AS card_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'CliQ'), 0) AS cliq_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.id IS NULL), 0) AS unassigned_total
    FROM public.shifts s
    LEFT JOIN public.charging_sessions cs ON cs.shift_id = s.id
    LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
    LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    GROUP BY s.id
  ),
  latest_handover AS (
    SELECT DISTINCT ON (h.shift_id)
      h.shift_id, h.id AS handover_id, h.handover_number, h.status, h.version,
      h.expected_cash, h.actual_cash_received, h.shortage_amount, h.surplus_amount, h.net_adjustments
    FROM public.cash_handovers h
    ORDER BY h.shift_id, h.created_at DESC
  )
  SELECT
    s.id,
    s.station_id,
    st.name,
    s.operator_id,
    op.name,
    s.shift_date,
    s.start_time,
    s.end_time,
    coalesce(sb.session_count, 0),
    public.round_jod3(coalesce(sb.energy_kwh, 0)),
    public.round_jod3(coalesce(sb.billing_total, 0)),
    public.round_jod3(coalesce(sb.cash_total, 0)),
    public.round_jod3(coalesce(sb.card_total, 0)),
    public.round_jod3(coalesce(sb.cliq_total, 0)),
    public.round_jod3(coalesce(sb.unassigned_total, 0)),
    public.round_jod3(coalesce(lh.expected_cash, 0)),
    public.round_jod3(coalesce(lh.actual_cash_received, 0)),
    public.round_jod3(coalesce(lh.shortage_amount, 0)),
    public.round_jod3(coalesce(lh.surplus_amount, 0)),
    public.round_jod3(coalesce(lh.net_adjustments, 0)),
    lh.handover_id,
    lh.handover_number,
    lh.status,
    lh.version,
    public.round_jod3(coalesce(s.total_amount_jod, 0)) AS operational_total_amount_jod,
    (abs(coalesce(s.total_amount_jod, 0) - coalesce(sb.billing_total, 0)) <= 0.001) AS operational_reconciled
  FROM public.shifts s
  JOIN public.stations st ON st.id = s.station_id
  JOIN public.operators op ON op.id = s.operator_id
  LEFT JOIN shift_billing sb ON sb.shift_id = s.id
  LEFT JOIN latest_handover lh ON lh.shift_id = s.id
  WHERE s.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR s.station_id = p_station_id)
    AND (p_operator_id IS NULL OR s.operator_id = p_operator_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(s.station_id))
  ORDER BY s.shift_date DESC, op.name;
END;
$$;

REVOKE ALL ON FUNCTION public.report_operator_shift_summary(date, date, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_operator_shift_summary(date, date, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_operator_shift_summary(date, date, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.report_operator_shift_summary(date, date, uuid, uuid) IS
  'EV-E: authoritative billing/payment per shift from billing_calculations/session_payment_allocations. operational_total_amount_jod (shifts.total_amount_jod) is included only as a labeled operational aggregate with an explicit operational_reconciled flag — never treated as authoritative.';
