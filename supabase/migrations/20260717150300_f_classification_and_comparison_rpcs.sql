-- EV-F Migration 4/9: Session-level classification + dry-run v2 comparison RPCs.
-- All read-only. Comparison results are never written into billing_calculations
-- or billing_breakdown_items.

CREATE OR REPLACE FUNCTION public.f_classify_historical_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.charging_sessions%ROWTYPE;
  v_billing_count int;
  v_billing public.billing_calculations%ROWTYPE;
  v_breakdown_sum numeric;
  v_demand_sum numeric;
  v_orphan_count int;
  v_has_allocation boolean;
  v_has_handover boolean;
  v_types text[] := '{}';
  v_primary text;
BEGIN
  SELECT * INTO v_session FROM charging_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('primary_classification', 'cannot_compare', 'exception_types', ARRAY['cannot_compare'], 'reason', 'session_not_found');
  END IF;

  SELECT count(*) INTO v_billing_count FROM billing_calculations WHERE session_id = p_session_id;

  IF v_billing_count = 0 THEN
    v_types := array_append(v_types, 'missing_billing');
  ELSIF v_billing_count > 1 THEN
    v_types := array_append(v_types, 'duplicate_billing');
  END IF;

  IF v_billing_count >= 1 THEN
    SELECT * INTO v_billing FROM billing_calculations WHERE session_id = p_session_id
      ORDER BY calculated_at DESC NULLS LAST, created_at DESC LIMIT 1;

    SELECT coalesce(sum(bbi.energy_charge), 0) + coalesce(sum(bbi.demand_charge), 0),
           coalesce(sum(bbi.demand_charge), 0)
    INTO v_breakdown_sum, v_demand_sum
    FROM billing_breakdown_items bbi WHERE bbi.billing_calculation_id = v_billing.id;

    IF NOT EXISTS (SELECT 1 FROM billing_breakdown_items WHERE billing_calculation_id = v_billing.id) THEN
      v_types := array_append(v_types, 'orphan_breakdown');
    ELSIF abs(v_billing.total_amount - v_breakdown_sum) > 0.001 THEN
      v_types := array_append(v_types, 'breakdown_mismatch');
    END IF;

    IF coalesce(v_demand_sum, 0) > 0 THEN v_types := array_append(v_types, 'non_zero_demand'); END IF;
    IF coalesce(v_billing.taxes, 0) > 0 THEN v_types := array_append(v_types, 'non_zero_tax'); END IF;

    IF v_billing.calculation_engine_version IS NULL THEN
      v_types := array_append(v_types, 'legacy_unknown');
    ELSIF v_billing.calculation_engine_version ~ '^ev-b-v2' THEN
      v_types := array_append(v_types, 'v2_verified');
    ELSE
      v_types := array_append(v_types, 'legacy_calculated');
    END IF;
  END IF;

  SELECT count(*) INTO v_orphan_count
  FROM billing_breakdown_items bbi
  LEFT JOIN billing_calculations bc ON bc.id = bbi.billing_calculation_id
  WHERE bc.id IS NULL AND bbi.billing_calculation_id IN (
    SELECT id FROM billing_calculations WHERE session_id = p_session_id
  );

  IF v_session.operator_id IS NULL THEN v_types := array_append(v_types, 'operator_relationship_issue'); END IF;
  IF v_session.station_id IS NULL THEN v_types := array_append(v_types, 'station_relationship_issue'); END IF;

  SELECT EXISTS (SELECT 1 FROM session_payment_allocations WHERE session_id = p_session_id AND is_active = true) INTO v_has_allocation;
  IF NOT v_has_allocation AND v_billing_count >= 1 THEN v_types := array_append(v_types, 'payment_unassigned'); END IF;

  SELECT EXISTS (SELECT 1 FROM cash_handover_sessions WHERE session_id = p_session_id) INTO v_has_handover;
  IF NOT v_has_handover AND v_billing_count >= 1 THEN v_types := array_append(v_types, 'handover_unavailable'); END IF;

  -- Primary classification: first match in priority order.
  v_primary := (
    SELECT t FROM unnest(ARRAY[
      'missing_billing', 'duplicate_billing', 'orphan_breakdown',
      'station_relationship_issue', 'operator_relationship_issue',
      'non_zero_demand', 'non_zero_tax', 'breakdown_mismatch',
      'legacy_unknown', 'legacy_calculated', 'v2_verified'
    ]) t
    WHERE t = ANY(v_types)
    LIMIT 1
  );
  IF v_primary IS NULL THEN v_primary := 'cannot_compare'; END IF;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'primary_classification', v_primary,
    'exception_types', to_jsonb(v_types)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_classify_historical_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_classify_historical_session(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_classify_historical_session(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compare_historical_session_to_v2(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_billing public.billing_calculations%ROWTYPE;
  v_preview jsonb;
  v_diff numeric;
  v_match_tier text;
  v_classification jsonb;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_comparison_enabled');
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'EV-F denied: user not approved' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.current_user_role() = ANY(ARRAY[
    'system_admin', 'global_admin', 'operations_manager', 'company_manager',
    'accountant', 'station_manager', 'import_officer', 'report_viewer'
  ])) THEN
    RAISE EXCEPTION 'EV-F denied: role not permitted' USING ERRCODE = '42501';
  END IF;

  v_classification := public.f_classify_historical_session(p_session_id);

  SELECT * INTO v_billing FROM billing_calculations WHERE session_id = p_session_id
    ORDER BY calculated_at DESC NULLS LAST, created_at DESC LIMIT 1;

  v_preview := public.f_compute_v2_billing_preview(p_session_id);

  IF NOT FOUND OR v_billing.id IS NULL THEN
    RETURN jsonb_build_object(
      'session_id', p_session_id,
      'classification', v_classification,
      'current_total', null,
      'expected_total', (v_preview->>'expected_total_amount')::numeric,
      'difference', null,
      'match_tier', 'cannot_compare',
      'cannot_compare_reason', coalesce(v_preview->>'cannot_compare_reason', 'no_current_billing_to_compare'),
      'preview', v_preview
    );
  END IF;

  IF (v_preview->>'ok')::boolean IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'session_id', p_session_id,
      'classification', v_classification,
      'current_total', v_billing.total_amount,
      'expected_total', null,
      'difference', null,
      'match_tier', 'cannot_compare',
      'cannot_compare_reason', v_preview->>'cannot_compare_reason',
      'preview', v_preview
    );
  END IF;

  v_diff := public.round_jod3(v_billing.total_amount - (v_preview->>'expected_total_amount')::numeric);
  v_match_tier := CASE
    WHEN v_diff = 0 THEN 'exact'
    WHEN abs(v_diff) <= 0.001 THEN 'rounding_only'
    WHEN abs(v_diff) <= 1.000 THEN 'minor'
    ELSE 'material'
  END;

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'classification', v_classification,
    'current_total', v_billing.total_amount,
    'current_engine_version', v_billing.calculation_engine_version,
    'current_billing_source', v_billing.billing_source,
    'expected_total', (v_preview->>'expected_total_amount')::numeric,
    'expected_engine_version', v_preview->>'expected_engine_version',
    'expected_applied_rate_summary', v_preview->>'expected_applied_rate_summary',
    'difference', v_diff,
    'demand_difference', 0 - coalesce((
      SELECT sum(bbi.demand_charge) FROM billing_breakdown_items bbi WHERE bbi.billing_calculation_id = v_billing.id
    ), 0),
    'tax_difference', 0 - coalesce(v_billing.taxes, 0),
    'metadata_difference', jsonb_build_object(
      'engine_version_missing', v_billing.calculation_engine_version IS NULL,
      'engine_version_mismatch', v_billing.calculation_engine_version IS NOT NULL AND v_billing.calculation_engine_version <> (v_preview->>'expected_engine_version')
    ),
    'match_tier', v_match_tier,
    'confidence', CASE WHEN v_match_tier IN ('exact', 'rounding_only') THEN 'high' WHEN v_match_tier = 'minor' THEN 'medium' ELSE 'low' END,
    'risk', CASE WHEN v_match_tier IN ('exact', 'rounding_only') THEN 'low' WHEN v_match_tier = 'minor' THEN 'medium' ELSE 'high' END,
    'recommendation', CASE
      WHEN v_match_tier = 'exact' AND v_billing.calculation_engine_version IS NULL THEN 'repair_metadata_only'
      WHEN v_match_tier IN ('exact', 'rounding_only') THEN 'no_action_required'
      WHEN v_match_tier = 'minor' THEN 'manual_review'
      ELSE 'manual_review'
    END,
    'preview', v_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.compare_historical_session_to_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compare_historical_session_to_v2(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.compare_historical_session_to_v2(uuid) TO authenticated, service_role;

-- Paginated batch/range comparison with a strict per-call row cap (never the
-- whole database in one request; callers must page through history).
CREATE OR REPLACE FUNCTION public.compare_historical_batch_to_v2(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid,
  transaction_id text,
  current_total numeric,
  expected_total numeric,
  difference numeric,
  match_tier text,
  primary_classification text,
  cannot_compare_reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_limit integer := LEAST(coalesce(p_limit, 50), 200);
  v_session RECORD;
  v_result jsonb;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_comparison_enabled');
  PERFORM public.report_assert_access(p_station_id);
  PERFORM public.report_assert_date_range(p_start, p_end);

  FOR v_session IN
    SELECT cs.id, cs.transaction_id
    FROM charging_sessions cs
    WHERE cs.start_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
    ORDER BY cs.start_ts
    LIMIT v_capped_limit OFFSET coalesce(p_offset, 0)
  LOOP
    v_result := public.compare_historical_session_to_v2(v_session.id);
    session_id := v_session.id;
    transaction_id := v_session.transaction_id;
    current_total := (v_result->>'current_total')::numeric;
    expected_total := (v_result->>'expected_total')::numeric;
    difference := (v_result->>'difference')::numeric;
    match_tier := v_result->>'match_tier';
    primary_classification := v_result->'classification'->>'primary_classification';
    cannot_compare_reason := v_result->>'cannot_compare_reason';
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.compare_historical_batch_to_v2(date, date, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compare_historical_batch_to_v2(date, date, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.compare_historical_batch_to_v2(date, date, uuid, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.compare_historical_batch_to_v2(date, date, uuid, integer, integer) IS
  'EV-F: paginated, capped (max 200/page) dry-run comparison. Never mutates billing data. Callers must page through large ranges.';
