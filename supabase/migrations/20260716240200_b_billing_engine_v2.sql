-- EV-B Migration 3/6: Authoritative billing engine v2
-- Preserves v1 calculate_batch_billing for rollback.
-- Asia/Amman, proportional duration split, demand=0, tax=0, ROUND half-up 3dp.

CREATE OR REPLACE FUNCTION public.b_round_jod3(p_value numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(p_value, 3);
$$;

CREATE OR REPLACE FUNCTION public.b_local_minutes(p_ts timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT EXTRACT(HOUR FROM (p_ts AT TIME ZONE 'Asia/Amman'))::int * 60
       + EXTRACT(MINUTE FROM (p_ts AT TIME ZONE 'Asia/Amman'))::int;
$$;

CREATE OR REPLACE FUNCTION public.b_local_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (p_ts AT TIME ZONE 'Asia/Amman')::date;
$$;

CREATE OR REPLACE FUNCTION public.b_local_dow(p_ts timestamptz)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(to_char(p_ts AT TIME ZONE 'Asia/Amman', 'FMDay'));
$$;

CREATE OR REPLACE FUNCTION public.b_amman_at(p_date date, p_minutes int)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT ((p_date + make_interval(mins => p_minutes))::timestamp)
         AT TIME ZONE 'Asia/Amman';
$$;

CREATE OR REPLACE FUNCTION public.b_find_structure(
  p_station_id uuid,
  p_ts timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_local date := public.b_local_date(p_ts);
BEGIN
  SELECT rs.id INTO v_id
  FROM rate_structures rs
  WHERE rs.station_id = p_station_id
    AND COALESCE(rs.is_active, false) = true
    AND rs.effective_from <= v_local
    AND (rs.effective_to IS NULL OR rs.effective_to >= v_local)
  ORDER BY rs.effective_from DESC
  LIMIT 1;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.b_find_period(
  p_structure_id uuid,
  p_ts timestamptz
)
RETURNS rate_periods
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row rate_periods;
  v_min int := public.b_local_minutes(p_ts);
  v_dow text := public.b_local_dow(p_ts);
  v_start int;
  v_end int;
BEGIN
  FOR v_row IN
    SELECT *
    FROM rate_periods rp
    WHERE rp.rate_structure_id = p_structure_id
      AND v_dow = ANY (rp.days_of_week)
    ORDER BY COALESCE(rp.priority, 0) DESC, rp.start_time
  LOOP
    v_start := public.b_time_to_minutes(v_row.start_time);
    v_end := public.b_time_to_minutes(v_row.end_time);
    IF v_end = 0 AND v_start > 0 THEN
      v_end := 1440;
    END IF;

    IF v_end > v_start THEN
      IF v_min >= v_start AND v_min < v_end THEN
        RETURN v_row;
      END IF;
    ELSIF v_end < v_start THEN
      IF v_min >= v_start OR v_min < v_end THEN
        RETURN v_row;
      END IF;
    ELSE
      RETURN v_row;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_session_billing_v2(
  p_session_id uuid,
  p_source text DEFAULT 'manual_recalculate',
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
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
  v_seg jsonb;
  v_billing_id uuid;
  v_subtotal numeric := 0;
  v_summary text := '';
  v_engine text := 'ev-b-v2.0.0';
  r RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-B denied: authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM charging_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;
  IF v_session.station_id IS NULL THEN
    RAISE EXCEPTION 'Session % has no station_id', p_session_id;
  END IF;

  IF p_source = 'import' THEN
    IF NOT public.current_user_can_import(v_session.station_id)
       AND NOT public.current_user_can_recalculate_billing(v_session.station_id) THEN
      RAISE EXCEPTION 'EV-B denied: not permitted to bill this station' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.current_user_can_recalculate_billing(v_session.station_id) THEN
      RAISE EXCEPTION 'EV-B denied: recalculate billing not permitted for this station'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_session.end_ts <= v_session.start_ts THEN
    RAISE EXCEPTION 'Invalid session duration for %', p_session_id;
  END IF;

  v_cursor := v_session.start_ts;
  v_end := v_session.end_ts;
  v_total_energy := v_session.energy_consumed_kwh;

  WHILE v_cursor < v_end LOOP
    v_structure_id := public.b_find_structure(v_session.station_id, v_cursor);
    IF v_structure_id IS NULL THEN
      RAISE EXCEPTION 'EV-B: no active rate structure at % for station %', v_cursor, v_session.station_id;
    END IF;

    v_period := public.b_find_period(v_structure_id, v_cursor);
    IF v_period IS NULL THEN
      RAISE EXCEPTION 'EV-B: no rate period covers %', v_cursor;
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
      v_period_end_m := 1440; -- overnight: before midnight
    ELSE
      v_period_end_m := v_end_m; -- overnight: after midnight
    END IF;

    v_next_midnight := public.b_amman_at(v_local_date + 1, 0);
    v_candidates := ARRAY[v_end, v_next_midnight];

    IF v_period_end_m >= 1440 THEN
      v_candidates := v_candidates || v_next_midnight;
    ELSE
      v_candidates := v_candidates || public.b_amman_at(v_local_date, v_period_end_m);
    END IF;

    SELECT min(c) INTO v_seg_end
    FROM unnest(v_candidates) c
    WHERE c > v_cursor;

    IF v_seg_end IS NULL OR v_seg_end <= v_cursor THEN
      RAISE EXCEPTION 'EV-B: failed to advance segment at %', v_cursor;
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

  IF v_total_duration <= 0 THEN
    RAISE EXCEPTION 'EV-B: zero duration for session %', p_session_id;
  END IF;

  -- Allocate energy proportionally; demand=0; tax=0
  v_segments := (
    SELECT jsonb_agg(
      seg || jsonb_build_object(
        'energy_kwh', public.b_round_jod3(v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration),
        'energy_charge', public.b_round_jod3(
          (v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration)
          * (seg->>'rate_per_kwh')::numeric
        ),
        'demand_kw', 0,
        'demand_charge', 0,
        'line_total', public.b_round_jod3(
          (v_total_energy * (seg->>'duration_minutes')::numeric / v_total_duration)
          * (seg->>'rate_per_kwh')::numeric
        ),
        'calculation_engine_version', v_engine
      )
    )
    FROM jsonb_array_elements(v_segments) seg
  );

  IF (
    SELECT count(DISTINCT (s->>'rate_per_kwh')::numeric) = 1
    FROM jsonb_array_elements(v_segments) s
  ) THEN
    v_subtotal := public.b_round_jod3(
      v_total_energy * (v_segments->0->>'rate_per_kwh')::numeric
    );
    IF jsonb_array_length(v_segments) = 1 THEN
      v_segments := jsonb_set(v_segments, '{0,line_total}', to_jsonb(v_subtotal));
      v_segments := jsonb_set(v_segments, '{0,energy_charge}', to_jsonb(v_subtotal));
      v_segments := jsonb_set(v_segments, '{0,energy_kwh}', to_jsonb(public.b_round_jod3(v_total_energy)));
    END IF;
  ELSE
    SELECT COALESCE(SUM((s->>'line_total')::numeric), 0) INTO v_subtotal
    FROM jsonb_array_elements(v_segments) s;
    v_subtotal := public.b_round_jod3(v_subtotal);
  END IF;

  SELECT string_agg(DISTINCT (s->>'period_name') || '@' || (s->>'rate_per_kwh'), ', ')
  INTO v_summary
  FROM jsonb_array_elements(v_segments) s;

  -- Persist via uniqueness-safe delete+insert (A1 UNIQUE(session_id) preserved)
  DELETE FROM billing_breakdown_items bbi
  USING billing_calculations bc
  WHERE bbi.billing_calculation_id = bc.id
    AND bc.session_id = p_session_id;

  DELETE FROM billing_calculations WHERE session_id = p_session_id;

  INSERT INTO billing_calculations (
    session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency, breakdown,
    calculation_engine_version, calculated_at, calculation_method, applied_rate_summary,
    recalculation_reason, recalculated_by, source_import_batch_id, billing_source
  ) VALUES (
    p_session_id,
    (v_segments->0->>'rate_structure_id')::uuid,
    v_subtotal,
    0,
    0,
    v_subtotal,
    'JOD',
    jsonb_build_object(
      'engine', v_engine,
      'method', 'proportional_duration_split',
      'segments', v_segments
    ),
    v_engine,
    now(),
    'proportional_duration_split',
    v_summary,
    p_reason,
    auth.uid(),
    v_session.import_batch_id,
    p_source
  )
  RETURNING id INTO v_billing_id;

  FOR r IN SELECT * FROM jsonb_array_elements(v_segments)
  LOOP
    INSERT INTO billing_breakdown_items (
      billing_calculation_id, rate_period_id, rate_structure_id, period_name,
      start_time, end_time, duration_minutes,
      energy_kwh, rate_per_kwh, demand_kw, demand_charge, energy_charge, line_total,
      calculation_engine_version
    ) VALUES (
      v_billing_id,
      (r.value->>'rate_period_id')::uuid,
      (r.value->>'rate_structure_id')::uuid,
      r.value->>'period_name',
      (r.value->>'start_time')::timestamptz,
      (r.value->>'end_time')::timestamptz,
      (r.value->>'duration_minutes')::numeric,
      (r.value->>'energy_kwh')::numeric,
      (r.value->>'rate_per_kwh')::numeric,
      0,
      0,
      (r.value->>'energy_charge')::numeric,
      (r.value->>'line_total')::numeric,
      v_engine
    );
  END LOOP;

  UPDATE charging_sessions
  SET has_billing_calculation = true,
      calculated_cost = v_subtotal
  WHERE id = p_session_id;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'billing_calculation_v2', 'charging_sessions', p_session_id,
    jsonb_build_object(
      'engine', v_engine,
      'source', p_source,
      'total', v_subtotal,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'billing_id', v_billing_id,
    'session_id', p_session_id,
    'total_amount', v_subtotal,
    'engine', v_engine,
    'segments', jsonb_array_length(v_segments)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_batch_billing_v2(
  p_batch_id uuid,
  p_station_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_ok int := 0;
  v_fail int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-B denied: authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_can_import(p_station_id)
     AND NOT public.current_user_can_recalculate_billing(p_station_id) THEN
    RAISE EXCEPTION 'EV-B denied: not permitted for station' USING ERRCODE = '42501';
  END IF;

  FOR v_session IN
    SELECT id FROM charging_sessions
    WHERE import_batch_id = p_batch_id
      AND station_id = p_station_id
  LOOP
    BEGIN
      v_result := public.calculate_session_billing_v2(v_session.id, 'import', 'import_batch_billing_v2');
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'session_id', v_session.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  -- import_batches billing_* columns updated in 20260716240400 after columns exist
  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'billed', v_ok,
    'failed', v_fail,
    'errors', v_errors,
    'engine', 'ev-b-v2.0.0'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_session_billing_v2(
  p_session_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'EV-B: recalculation reason required';
  END IF;
  RETURN public.calculate_session_billing_v2(p_session_id, 'manual_recalculate', p_reason);
END;
$$;
