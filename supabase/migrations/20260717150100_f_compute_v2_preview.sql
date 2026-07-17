-- EV-F Migration 2/9: Non-mutating v2 billing preview computation.
--
-- Deliberately a SEPARATE, read-only twin of calculate_session_billing_v2's
-- segment-splitting/allocation logic (Phase B), rather than a refactor of the
-- live write-path function. This avoids any risk of subtly changing live
-- billing behavior while giving Phase F an accurate, safe "what would v2
-- produce" computation for dry-run comparison. It performs NO INSERT/UPDATE/
-- DELETE and writes nothing to billing_calculations/billing_breakdown_items/
-- charging_sessions. If the live engine's math ever changes, this function
-- must be updated to match (documented here and in the Phase F report).

CREATE OR REPLACE FUNCTION public.f_compute_v2_billing_preview(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session charging_sessions%ROWTYPE;
  v_cursor timestamptz;
  v_end timestamptz;
  v_seg_end timestamptz;
  v_structure_id uuid;
  v_period rate_periods;
  v_local_date date;
  v_start_m int;
  v_end_m int;
  v_period_end_m int;
  v_next_midnight timestamptz;
  v_candidates timestamptz[];
  v_total_energy numeric;
  v_total_duration numeric := 0;
  v_segments jsonb := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_summary text := '';
  v_engine text := 'ev-b-v2.0.0';
BEGIN
  SELECT * INTO v_session FROM charging_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'session_not_found');
  END IF;
  IF v_session.station_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'missing_station_relationship');
  END IF;
  IF v_session.end_ts IS NULL OR v_session.start_ts IS NULL OR v_session.end_ts <= v_session.start_ts THEN
    RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'invalid_session_duration');
  END IF;

  v_cursor := v_session.start_ts;
  v_end := v_session.end_ts;
  v_total_energy := v_session.energy_consumed_kwh;

  BEGIN
    WHILE v_cursor < v_end LOOP
      v_structure_id := public.b_find_structure(v_session.station_id, v_cursor);
      IF v_structure_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'no_active_rate_structure_at_historical_time');
      END IF;

      v_period := public.b_find_period(v_structure_id, v_cursor);
      IF v_period IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'no_rate_period_covers_historical_time');
      END IF;

      v_local_date := public.b_local_date(v_cursor);
      v_start_m := public.b_local_minutes(v_cursor);
      v_end_m := public.b_time_to_minutes(v_period.end_time);
      IF v_end_m = 0 AND public.b_time_to_minutes(v_period.start_time) > 0 THEN
        v_end_m := 1440;
      END IF;

      IF v_end_m > public.b_time_to_minutes(v_period.start_time) THEN
        v_period_end_m := v_end_m;
      ELSIF v_start_m >= public.b_time_to_minutes(v_period.start_time) THEN
        v_period_end_m := 1440;
      ELSE
        v_period_end_m := v_end_m;
      END IF;

      v_next_midnight := public.b_amman_at(v_local_date + 1, 0);
      v_candidates := ARRAY[v_end, v_next_midnight];

      IF v_period_end_m >= 1440 THEN
        v_candidates := v_candidates || v_next_midnight;
      ELSE
        v_candidates := v_candidates || public.b_amman_at(v_local_date, v_period_end_m);
      END IF;

      SELECT min(c) INTO v_seg_end FROM unnest(v_candidates) c WHERE c > v_cursor;

      IF v_seg_end IS NULL OR v_seg_end <= v_cursor THEN
        RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'segment_advance_failure');
      END IF;

      v_segments := v_segments || jsonb_build_array(jsonb_build_object(
        'rate_structure_id', v_structure_id,
        'rate_period_id', v_period.id,
        'period_name', v_period.period_name,
        'start_time', v_cursor,
        'end_time', v_seg_end,
        'duration_minutes', EXTRACT(EPOCH FROM (v_seg_end - v_cursor)) / 60.0,
        'rate_per_kwh', v_period.energy_rate_per_kwh,
        'demand_charge', 0,
        'tax', 0
      ));

      v_total_duration := v_total_duration + EXTRACT(EPOCH FROM (v_seg_end - v_cursor)) / 60.0;
      v_cursor := v_seg_end;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'computation_error: ' || SQLERRM);
  END;

  IF v_total_duration <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'cannot_compare_reason', 'zero_duration');
  END IF;

  v_segments := (
    SELECT jsonb_agg(
      seg || jsonb_build_object(
        'energy_kwh', public.b_round_jod3(v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration),
        'energy_charge', public.b_round_jod3(
          (v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration) * (seg->>'rate_per_kwh')::numeric
        ),
        'demand_kw', 0,
        'demand_charge', 0,
        'line_total', public.b_round_jod3(
          (v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration) * (seg->>'rate_per_kwh')::numeric
        ),
        'calculation_engine_version', v_engine
      )
    )
    FROM jsonb_array_elements(v_segments) seg
  );

  IF (SELECT count(DISTINCT (s->>'rate_per_kwh')::numeric) = 1 FROM jsonb_array_elements(v_segments) s) THEN
    v_subtotal := public.b_round_jod3(v_total_energy * (v_segments->0->>'rate_per_kwh')::numeric);
    IF jsonb_array_length(v_segments) = 1 THEN
      v_segments := jsonb_set(v_segments, '{0,line_total}', to_jsonb(v_subtotal));
      v_segments := jsonb_set(v_segments, '{0,energy_charge}', to_jsonb(v_subtotal));
      v_segments := jsonb_set(v_segments, '{0,energy_kwh}', to_jsonb(public.b_round_jod3(v_total_energy)));
    END IF;
  ELSE
    SELECT COALESCE(SUM((s->>'line_total')::numeric), 0) INTO v_subtotal FROM jsonb_array_elements(v_segments) s;
    v_subtotal := public.b_round_jod3(v_subtotal);
  END IF;

  SELECT string_agg(DISTINCT (s->>'period_name') || '@' || (s->>'rate_per_kwh'), ', ')
  INTO v_summary
  FROM jsonb_array_elements(v_segments) s;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'expected_total_amount', v_subtotal,
    'expected_demand_charge', 0,
    'expected_tax', 0,
    'expected_engine_version', v_engine,
    'expected_applied_rate_summary', v_summary,
    'expected_segments', v_segments,
    'expected_rate_structure_id', (v_segments->0->>'rate_structure_id')::uuid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_compute_v2_billing_preview(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_compute_v2_billing_preview(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_compute_v2_billing_preview(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.f_compute_v2_billing_preview(uuid) IS
  'EV-F: pure, non-mutating recomputation of what calculate_session_billing_v2 would produce for a session, using the historically-effective rate structure/periods. Never writes to any table.';
