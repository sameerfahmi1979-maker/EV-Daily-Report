-- EV-E Migration 2/6: Revenue, payment-method, payment reconciliation, and
-- station-daily-summary reporting RPCs. All derive money from
-- report_v_latest_billing (billing_calculations) and session_payment_allocations —
-- never from shifts.total_* or charging_sessions.calculated_cost.

CREATE OR REPLACE FUNCTION public.report_revenue_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  report_date date,
  station_id uuid,
  station_name text,
  session_count bigint,
  energy_kwh numeric,
  billing_total numeric,
  legacy_count bigint,
  v2_count bigint,
  unknown_engine_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    cs.start_date AS report_date,
    cs.station_id,
    st.name AS station_name,
    count(*) AS session_count,
    public.round_jod3(coalesce(sum(cs.energy_consumed_kwh), 0)) AS energy_kwh,
    public.round_jod3(coalesce(sum(lb.total_amount), 0)) AS billing_total,
    count(*) FILTER (WHERE lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2') AS legacy_count,
    count(*) FILTER (WHERE lb.calculation_engine_version ~ '^ev-b-v2') AS v2_count,
    count(*) FILTER (WHERE lb.billing_id IS NULL) AS unknown_engine_count
  FROM public.charging_sessions cs
  JOIN public.stations st ON st.id = cs.station_id
  LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  GROUP BY cs.start_date, cs.station_id, st.name
  ORDER BY cs.start_date, st.name;
END;
$$;

REVOKE ALL ON FUNCTION public.report_revenue_summary(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_revenue_summary(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_revenue_summary(date, date, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_payment_method_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  billing_total numeric,
  cash_total numeric,
  card_total numeric,
  cliq_total numeric,
  unassigned_total numeric,
  session_count bigint,
  cash_count bigint,
  card_count bigint,
  cliq_count bigint,
  unassigned_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    public.round_jod3(coalesce(sum(lb.total_amount), 0)) AS billing_total,
    public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Cash'), 0)) AS cash_total,
    public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Card'), 0)) AS card_total,
    public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'CliQ'), 0)) AS cliq_total,
    public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.id IS NULL), 0)) AS unassigned_total,
    count(*) AS session_count,
    count(*) FILTER (WHERE spa.payment_method = 'Cash') AS cash_count,
    count(*) FILTER (WHERE spa.payment_method = 'Card') AS card_count,
    count(*) FILTER (WHERE spa.payment_method = 'CliQ') AS cliq_count,
    count(*) FILTER (WHERE spa.id IS NULL) AS unassigned_count
  FROM public.charging_sessions cs
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id));
END;
$$;

REVOKE ALL ON FUNCTION public.report_payment_method_summary(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_payment_method_summary(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_payment_method_summary(date, date, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_payment_reconciliation(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  report_date date,
  station_id uuid,
  station_name text,
  billing_total numeric,
  cash_total numeric,
  card_total numeric,
  cliq_total numeric,
  unassigned_total numeric,
  difference numeric,
  reconciled boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  WITH agg AS (
    SELECT
      cs.start_date AS report_date,
      cs.station_id,
      public.round_jod3(coalesce(sum(lb.total_amount), 0)) AS billing_total,
      public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Cash'), 0)) AS cash_total,
      public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Card'), 0)) AS card_total,
      public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'CliQ'), 0)) AS cliq_total,
      public.round_jod3(coalesce(sum(lb.total_amount) FILTER (WHERE spa.id IS NULL), 0)) AS unassigned_total
    FROM public.charging_sessions cs
    JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
    LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    WHERE cs.start_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
      AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    GROUP BY cs.start_date, cs.station_id
  )
  SELECT
    agg.report_date,
    agg.station_id,
    st.name AS station_name,
    agg.billing_total,
    agg.cash_total,
    agg.card_total,
    agg.cliq_total,
    agg.unassigned_total,
    public.round_jod3(agg.billing_total - (agg.cash_total + agg.card_total + agg.cliq_total + agg.unassigned_total)) AS difference,
    (abs(agg.billing_total - (agg.cash_total + agg.card_total + agg.cliq_total + agg.unassigned_total)) <= 0.001) AS reconciled
  FROM agg
  JOIN public.stations st ON st.id = agg.station_id
  ORDER BY agg.report_date, st.name;
END;
$$;

REVOKE ALL ON FUNCTION public.report_payment_reconciliation(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_payment_reconciliation(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_payment_reconciliation(date, date, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_station_daily_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  report_date date,
  station_id uuid,
  station_name text,
  session_count bigint,
  energy_kwh numeric,
  billing_total numeric,
  cash_total numeric,
  card_total numeric,
  cliq_total numeric,
  unassigned_total numeric,
  expected_cash numeric,
  actual_cash numeric,
  shortage numeric,
  surplus numeric,
  handover_count bigint,
  locked_handover_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  WITH sess AS (
    SELECT
      cs.start_date AS report_date,
      cs.station_id,
      count(*) AS session_count,
      coalesce(sum(cs.energy_consumed_kwh), 0) AS energy_kwh,
      coalesce(sum(lb.total_amount), 0) AS billing_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Cash'), 0) AS cash_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Card'), 0) AS card_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'CliQ'), 0) AS cliq_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.id IS NULL), 0) AS unassigned_total
    FROM public.charging_sessions cs
    JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
    LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    WHERE cs.start_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
      AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    GROUP BY cs.start_date, cs.station_id
  ),
  ho AS (
    SELECT
      h.shift_date AS report_date,
      h.station_id,
      coalesce(sum(h.expected_cash), 0) AS expected_cash,
      coalesce(sum(h.actual_cash_received), 0) AS actual_cash,
      coalesce(sum(h.shortage_amount), 0) AS shortage,
      coalesce(sum(h.surplus_amount), 0) AS surplus,
      count(*) AS handover_count,
      count(*) FILTER (WHERE h.status = 'locked') AS locked_handover_count
    FROM public.cash_handovers h
    WHERE h.shift_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR h.station_id = p_station_id)
      AND (public.report_current_role_is_global() OR public.current_user_has_station_access(h.station_id))
    GROUP BY h.shift_date, h.station_id
  )
  SELECT
    coalesce(sess.report_date, ho.report_date) AS report_date,
    coalesce(sess.station_id, ho.station_id) AS station_id,
    st.name AS station_name,
    coalesce(sess.session_count, 0) AS session_count,
    public.round_jod3(coalesce(sess.energy_kwh, 0)) AS energy_kwh,
    public.round_jod3(coalesce(sess.billing_total, 0)) AS billing_total,
    public.round_jod3(coalesce(sess.cash_total, 0)) AS cash_total,
    public.round_jod3(coalesce(sess.card_total, 0)) AS card_total,
    public.round_jod3(coalesce(sess.cliq_total, 0)) AS cliq_total,
    public.round_jod3(coalesce(sess.unassigned_total, 0)) AS unassigned_total,
    public.round_jod3(coalesce(ho.expected_cash, 0)) AS expected_cash,
    public.round_jod3(coalesce(ho.actual_cash, 0)) AS actual_cash,
    public.round_jod3(coalesce(ho.shortage, 0)) AS shortage,
    public.round_jod3(coalesce(ho.surplus, 0)) AS surplus,
    coalesce(ho.handover_count, 0) AS handover_count,
    coalesce(ho.locked_handover_count, 0) AS locked_handover_count
  FROM sess
  FULL OUTER JOIN ho ON ho.report_date = sess.report_date AND ho.station_id = sess.station_id
  JOIN public.stations st ON st.id = coalesce(sess.station_id, ho.station_id)
  ORDER BY 1, 3;
END;
$$;

REVOKE ALL ON FUNCTION public.report_station_daily_summary(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_station_daily_summary(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_station_daily_summary(date, date, uuid) TO authenticated, service_role;
