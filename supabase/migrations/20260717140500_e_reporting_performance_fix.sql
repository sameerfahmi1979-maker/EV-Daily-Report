-- EV-E Migration 6/6: Performance fix.
--
-- report_v_latest_billing used row_number() OVER (PARTITION BY session_id) across the
-- ENTIRE billing_calculations table (84k+ rows) on every call, because Postgres cannot
-- push a date-range filter on charging_sessions through a window function computed over
-- an unrelated view. Every report_* RPC that joined it timed out at production scale
-- (confirmed: statement timeout on a full-history query).
--
-- Fix: replace every "latest billing per session" lookup with a LATERAL subquery scoped
-- to one session_id at a time, using the (session_id, calculated_at DESC) index added in
-- the foundation migration. Verified via EXPLAIN ANALYZE: an index-scan nested loop,
-- <1ms for a 17-day/84k-session production date range. Same fix applied to the
-- breakdown-sum lookup (previously report_v_billing_breakdown_check, grouped over the
-- whole table) — now a LATERAL aggregate scoped to one billing_id.

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
  LEFT JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount, bc.calculation_engine_version
    FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id
    ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    LIMIT 1
  ) lb ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  GROUP BY cs.start_date, cs.station_id, st.name
  ORDER BY cs.start_date, st.name;
END;
$$;

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
  JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount
    FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id
    ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    LIMIT 1
  ) lb ON true
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id));
END;
$$;

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
    JOIN LATERAL (
      SELECT bc.id AS billing_id, bc.total_amount
      FROM public.billing_calculations bc
      WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
      LIMIT 1
    ) lb ON true
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
    JOIN LATERAL (
      SELECT bc.id AS billing_id, bc.total_amount
      FROM public.billing_calculations bc
      WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
      LIMIT 1
    ) lb ON true
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
  LEFT JOIN LATERAL (
    SELECT
      count(cs.id) AS session_count,
      coalesce(sum(cs.energy_consumed_kwh), 0) AS energy_kwh,
      coalesce(sum(lb.total_amount), 0) AS billing_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Cash'), 0) AS cash_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'Card'), 0) AS card_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.payment_method = 'CliQ'), 0) AS cliq_total,
      coalesce(sum(lb.total_amount) FILTER (WHERE spa.id IS NULL), 0) AS unassigned_total
    FROM public.charging_sessions cs
    LEFT JOIN LATERAL (
      SELECT bc.id AS billing_id, bc.total_amount
      FROM public.billing_calculations bc
      WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
      LIMIT 1
    ) lb ON true
    LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    WHERE cs.shift_id = s.id
  ) sb ON true
  LEFT JOIN LATERAL (
    SELECT h.id AS handover_id, h.handover_number, h.status, h.version,
           h.expected_cash, h.actual_cash_received, h.shortage_amount, h.surplus_amount, h.net_adjustments
    FROM public.cash_handovers h
    WHERE h.shift_id = s.id
    ORDER BY h.created_at DESC
    LIMIT 1
  ) lh ON true
  WHERE s.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR s.station_id = p_station_id)
    AND (p_operator_id IS NULL OR s.operator_id = p_operator_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(s.station_id))
  ORDER BY s.shift_date DESC, op.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_import_reconciliation(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  batch_id uuid,
  filename text,
  file_hash text,
  station_id uuid,
  station_name text,
  operator_name text,
  detected_operator_name text,
  operator_match_status text,
  status text,
  records_total integer,
  records_success integer,
  records_failed integer,
  records_skipped integer,
  billed_count bigint,
  billing_failed_count bigint,
  created_at timestamptz,
  posting_completed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    b.id,
    b.filename,
    b.file_hash,
    b.station_id,
    st.name,
    op.name,
    b.detected_operator_name,
    b.operator_match_status,
    b.status,
    b.records_total,
    b.records_success,
    b.records_failed,
    b.records_skipped,
    coalesce(bs.billed_count, 0),
    coalesce(bs.billing_failed_count, 0),
    b.created_at,
    b.posting_completed_at
  FROM public.import_batches b
  LEFT JOIN public.stations st ON st.id = b.station_id
  LEFT JOIN public.operators op ON op.id = b.selected_operator_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE lb.billing_id IS NOT NULL) AS billed_count,
      count(*) FILTER (WHERE lb.billing_id IS NULL) AS billing_failed_count
    FROM public.charging_sessions cs
    LEFT JOIN LATERAL (
      SELECT bc.id AS billing_id
      FROM public.billing_calculations bc
      WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
      LIMIT 1
    ) lb ON true
    WHERE cs.import_batch_id = b.id
  ) bs ON true
  WHERE b.created_at::date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR b.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR b.station_id IS NULL OR public.current_user_has_station_access(b.station_id))
  ORDER BY b.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_billing_reconciliation(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  session_id uuid,
  transaction_id text,
  station_id uuid,
  start_ts timestamptz,
  engine_version text,
  billing_source text,
  billing_total numeric,
  breakdown_sum numeric,
  difference numeric,
  demand_charge_sum numeric,
  taxes numeric,
  payment_method text,
  handover_id uuid,
  handover_number text,
  exception_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    cs.id,
    cs.transaction_id,
    cs.station_id,
    cs.start_ts,
    lb.calculation_engine_version,
    lb.billing_source,
    public.round_jod3(lb.total_amount),
    public.round_jod3(bbc.breakdown_sum),
    public.round_jod3(lb.total_amount - bbc.breakdown_sum),
    public.round_jod3(bbc.demand_charge_sum),
    public.round_jod3(lb.taxes),
    coalesce(spa.payment_method, 'UNASSIGNED'),
    chs.handover_id,
    h.handover_number,
    CASE
      WHEN lb.billing_id IS NULL THEN 'billing_missing'
      WHEN abs(lb.total_amount - bbc.breakdown_sum) > 0.001 THEN 'breakdown_mismatch'
      WHEN coalesce(bbc.demand_charge_sum, 0) > 0 THEN 'non_zero_demand'
      WHEN coalesce(lb.taxes, 0) > 0 THEN 'non_zero_tax'
      WHEN lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2' THEN 'legacy_engine'
      WHEN spa.id IS NULL THEN 'unassigned_payment'
      ELSE 'reconciled'
    END AS exception_status
  FROM public.charging_sessions cs
  JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount, bc.taxes, bc.calculation_engine_version, bc.billing_source
    FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id
    ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    LIMIT 1
  ) lb ON true
  LEFT JOIN LATERAL (
    SELECT
      coalesce(sum(bbi.demand_charge), 0) AS demand_charge_sum,
      coalesce(sum(bbi.energy_charge), 0) + coalesce(sum(bbi.demand_charge), 0) AS breakdown_sum
    FROM public.billing_breakdown_items bbi
    WHERE bbi.billing_calculation_id = lb.billing_id
  ) bbc ON true
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
  LEFT JOIN public.cash_handovers h ON h.id = chs.handover_id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  ORDER BY cs.start_ts DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_exception_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  exception_type text,
  station_id uuid,
  session_id uuid,
  transaction_id text,
  batch_id uuid,
  handover_id uuid,
  detail text,
  amount numeric,
  occurred_on date
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    'missing_billing'::text, cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL::uuid,
    'Session has no billing calculation'::text, NULL::numeric, cs.start_date
  FROM public.charging_sessions cs
  LEFT JOIN LATERAL (
    SELECT bc.id AS billing_id FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
  ) lb ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND lb.billing_id IS NULL

  UNION ALL
  SELECT
    'missing_operator', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Session has no operator assigned', NULL, cs.start_date
  FROM public.charging_sessions cs
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND cs.operator_id IS NULL

  UNION ALL
  SELECT
    'missing_payment_method', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, chs.handover_id,
    'Billed session has no active payment allocation', public.round_jod3(lb.total_amount), cs.start_date
  FROM public.charging_sessions cs
  JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
  ) lb ON true
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND spa.id IS NULL

  UNION ALL
  SELECT
    'billing_failure', b.station_id, NULL, NULL, b.id, NULL,
    coalesce(b.failure_reason, 'Batch billing_status indicates failure'), NULL, b.created_at::date
  FROM public.import_batches b
  WHERE b.created_at::date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR b.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR b.station_id IS NULL OR public.current_user_has_station_access(b.station_id))
    AND b.status IN ('billing_failed', 'validation_failed', 'failed')

  UNION ALL
  SELECT
    'handover_pending', h.station_id, NULL, NULL, NULL, h.id,
    format('Handover %s has %s unassigned session(s)', h.handover_number, h.unassigned_count), NULL, h.shift_date
  FROM public.cash_handovers h
  WHERE h.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR h.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(h.station_id))
    AND h.unassigned_count > 0
    AND h.status NOT IN ('cancelled', 'rejected')

  UNION ALL
  SELECT
    'handover_rejected', h.station_id, NULL, NULL, NULL, h.id,
    coalesce(h.rejection_reason, 'Handover rejected'), NULL, h.shift_date
  FROM public.cash_handovers h
  WHERE h.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR h.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(h.station_id))
    AND h.status = 'rejected'

  UNION ALL
  SELECT
    'legacy_engine', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    coalesce('Engine: ' || lb.calculation_engine_version, 'Engine version missing'), public.round_jod3(lb.total_amount), cs.start_date
  FROM public.charging_sessions cs
  JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount, bc.calculation_engine_version FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
  ) lb ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND (lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2')

  UNION ALL
  SELECT
    'non_zero_demand', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Billing breakdown has non-zero demand charge', public.round_jod3(bbc.demand_charge_sum), cs.start_date
  FROM public.charging_sessions cs
  JOIN LATERAL (
    SELECT bc.id AS billing_id FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
  ) lb ON true
  JOIN LATERAL (
    SELECT coalesce(sum(bbi.demand_charge), 0) AS demand_charge_sum
    FROM public.billing_breakdown_items bbi WHERE bbi.billing_calculation_id = lb.billing_id
  ) bbc ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND coalesce(bbc.demand_charge_sum, 0) > 0

  UNION ALL
  SELECT
    'non_zero_tax', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Billing has non-zero tax', public.round_jod3(lb.taxes), cs.start_date
  FROM public.charging_sessions cs
  JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.taxes FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
  ) lb ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND coalesce(lb.taxes, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_historical_engine_comparison(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS TABLE (
  engine_label text,
  session_count bigint,
  billing_total numeric,
  avg_amount numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    CASE
      WHEN lb.billing_id IS NULL THEN 'missing'
      WHEN lb.calculation_engine_version IS NULL THEN 'unknown'
      WHEN lb.calculation_engine_version ~ '^ev-b-v2' THEN lb.calculation_engine_version
      ELSE 'legacy'
    END AS engine_label,
    count(*) AS session_count,
    public.round_jod3(coalesce(sum(lb.total_amount), 0)) AS billing_total,
    public.round_jod3(coalesce(avg(lb.total_amount), 0)) AS avg_amount
  FROM public.charging_sessions cs
  LEFT JOIN LATERAL (
    SELECT bc.id AS billing_id, bc.total_amount, bc.calculation_engine_version
    FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id
    ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    LIMIT 1
  ) lb ON true
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  GROUP BY 1
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_shift_totals_reconciliation(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_billing_total numeric;
  v_energy numeric;
BEGIN
  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-E shift not found';
  END IF;

  PERFORM public.report_assert_access(v_shift.station_id);

  SELECT coalesce(sum(lb.total_amount), 0), coalesce(sum(cs.energy_consumed_kwh), 0)
  INTO v_billing_total, v_energy
  FROM public.charging_sessions cs
  LEFT JOIN LATERAL (
    SELECT bc.total_amount
    FROM public.billing_calculations bc
    WHERE bc.session_id = cs.id
    ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC
    LIMIT 1
  ) lb ON true
  WHERE cs.shift_id = p_shift_id;

  RETURN jsonb_build_object(
    'shift_id', p_shift_id,
    'operational_total_amount_jod', public.round_jod3(coalesce(v_shift.total_amount_jod, 0)),
    'operational_total_kwh', public.round_jod3(coalesce(v_shift.total_kwh, 0)),
    'authoritative_billing_total', public.round_jod3(v_billing_total),
    'authoritative_energy_kwh', public.round_jod3(v_energy),
    'amount_reconciled', abs(coalesce(v_shift.total_amount_jod, 0) - v_billing_total) <= 0.001,
    'energy_reconciled', abs(coalesce(v_shift.total_kwh, 0) - v_energy) <= 0.001,
    'label', 'Operational aggregate — reconcile against authoritative billing before financial use'
  );
END;
$$;

-- The unfiltered windowed views are no longer referenced by any function; drop them.
DROP VIEW IF EXISTS public.report_v_latest_billing;
DROP VIEW IF EXISTS public.report_v_billing_breakdown_check;
