-- EV-E Migration 4/6: Import reconciliation, billing reconciliation, exception
-- summary, and historical-engine-comparison reporting RPCs.

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
    count(cs.id) FILTER (WHERE lb.billing_id IS NOT NULL) AS billed_count,
    count(cs.id) FILTER (WHERE lb.billing_id IS NULL) AS billing_failed_count,
    b.created_at,
    b.posting_completed_at
  FROM public.import_batches b
  LEFT JOIN public.stations st ON st.id = b.station_id
  LEFT JOIN public.operators op ON op.id = b.selected_operator_id
  LEFT JOIN public.charging_sessions cs ON cs.import_batch_id = b.id
  LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE b.created_at::date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR b.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR b.station_id IS NULL OR public.current_user_has_station_access(b.station_id))
  GROUP BY b.id, st.name, op.name
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.report_import_reconciliation(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_import_reconciliation(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_import_reconciliation(date, date, uuid) TO authenticated, service_role;

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
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  LEFT JOIN public.report_v_billing_breakdown_check bbc ON bbc.billing_id = lb.billing_id
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
  LEFT JOIN public.cash_handovers h ON h.id = chs.handover_id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  ORDER BY cs.start_ts DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.report_billing_reconciliation(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_billing_reconciliation(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_billing_reconciliation(date, date, uuid) TO authenticated, service_role;

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
  -- Missing billing
  SELECT
    'missing_billing'::text, cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL::uuid,
    'Session has no billing calculation'::text, NULL::numeric, cs.start_date
  FROM public.charging_sessions cs
  LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND lb.billing_id IS NULL

  UNION ALL
  -- Missing operator
  SELECT
    'missing_operator', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Session has no operator assigned', NULL, cs.start_date
  FROM public.charging_sessions cs
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND cs.operator_id IS NULL

  UNION ALL
  -- Unassigned payment method (billed but no active allocation)
  SELECT
    'missing_payment_method', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, chs.handover_id,
    'Billed session has no active payment allocation', public.round_jod3(lb.total_amount), cs.start_date
  FROM public.charging_sessions cs
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
  LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND spa.id IS NULL

  UNION ALL
  -- Billing failure at import-batch level
  SELECT
    'billing_failure', b.station_id, NULL, NULL, b.id, NULL,
    coalesce(b.failure_reason, 'Batch billing_status indicates failure'), NULL, b.created_at::date
  FROM public.import_batches b
  WHERE b.created_at::date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR b.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR b.station_id IS NULL OR public.current_user_has_station_access(b.station_id))
    AND b.status IN ('billing_failed', 'validation_failed', 'failed')

  UNION ALL
  -- Handover pending reconciliation (unassigned sessions remain)
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
  -- Handover rejected
  SELECT
    'handover_rejected', h.station_id, NULL, NULL, NULL, h.id,
    coalesce(h.rejection_reason, 'Handover rejected'), NULL, h.shift_date
  FROM public.cash_handovers h
  WHERE h.shift_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR h.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(h.station_id))
    AND h.status = 'rejected'

  UNION ALL
  -- Legacy engine record
  SELECT
    'legacy_engine', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    coalesce('Engine: ' || lb.calculation_engine_version, 'Engine version missing'), public.round_jod3(lb.total_amount), cs.start_date
  FROM public.charging_sessions cs
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND (lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2')

  UNION ALL
  -- Non-zero demand (should never occur post Phase B; explicit alarm if it does)
  SELECT
    'non_zero_demand', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Billing breakdown has non-zero demand charge', public.round_jod3(bbc.demand_charge_sum), cs.start_date
  FROM public.charging_sessions cs
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  JOIN public.report_v_billing_breakdown_check bbc ON bbc.billing_id = lb.billing_id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND coalesce(bbc.demand_charge_sum, 0) > 0

  UNION ALL
  -- Non-zero tax (should never occur post Phase B; explicit alarm if it does)
  SELECT
    'non_zero_tax', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
    'Billing has non-zero tax', public.round_jod3(lb.taxes), cs.start_date
  FROM public.charging_sessions cs
  JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
    AND coalesce(lb.taxes, 0) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.report_exception_summary(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_exception_summary(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_exception_summary(date, date, uuid) TO authenticated, service_role;

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
  LEFT JOIN public.report_v_latest_billing lb ON lb.session_id = cs.id
  WHERE cs.start_date BETWEEN p_start AND p_end
    AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    AND (public.report_current_role_is_global() OR public.current_user_has_station_access(cs.station_id))
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.report_historical_engine_comparison(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_historical_engine_comparison(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_historical_engine_comparison(date, date, uuid) TO authenticated, service_role;
