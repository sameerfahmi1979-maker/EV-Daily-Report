-- EV-C Migration 5/6: Transactional import posting RPC

CREATE OR REPLACE FUNCTION public.resolve_operator_match_status(
  p_selected_operator_id uuid,
  p_detected_card text,
  p_detected_operator_name text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op public.operators%ROWTYPE;
  v_card text;
  v_name_norm text;
  v_detected_norm text;
  v_card_owner uuid;
BEGIN
  IF p_selected_operator_id IS NULL THEN
    RETURN 'pending';
  END IF;

  SELECT * INTO v_op FROM public.operators WHERE id = p_selected_operator_id;
  IF NOT FOUND THEN
    RETURN 'pending';
  END IF;

  v_card := public.normalize_operator_card(p_detected_card);
  -- lower() before stripping; [^a-z0-9] would erase uppercase if applied first
  v_name_norm := regexp_replace(lower(coalesce(p_detected_operator_name, '')), '[^a-z0-9]+', '', 'g');
  v_detected_norm := regexp_replace(lower(coalesce(v_op.name, '')), '[^a-z0-9]+', '', 'g');

  IF v_card IS NULL THEN
    IF v_name_norm <> '' AND v_detected_norm <> '' AND position(v_name_norm in v_detected_norm) = 0
       AND position(v_detected_norm in v_name_norm) = 0 THEN
      RETURN 'warning';
    END IF;
    RETURN 'no_card';
  END IF;

  SELECT id INTO v_card_owner
  FROM public.operators
  WHERE card_number_normalized = v_card
    AND coalesce(status, 'active') = 'active'
  ORDER BY CASE WHEN id = p_selected_operator_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_card_owner IS NULL THEN
    RETURN 'unknown_card';
  END IF;

  IF v_card_owner <> p_selected_operator_id THEN
    RETURN 'conflict';
  END IF;

  IF v_name_norm <> '' AND v_detected_norm <> ''
     AND position(v_name_norm in v_detected_norm) = 0
     AND position(v_detected_norm in v_name_norm) = 0 THEN
    RETURN 'warning';
  END IF;

  RETURN 'match';
END;
$$;

CREATE OR REPLACE FUNCTION public.post_import_batch_v2(
  p_batch_id uuid,
  p_station_id uuid,
  p_operator_id uuid,
  p_file_hash text,
  p_sessions jsonb,
  p_allow_filename_warning boolean DEFAULT false,
  p_allow_conflict_override boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.import_batches%ROWTYPE;
  v_match text;
  v_flag text;
  v_row jsonb;
  v_inserted int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_billing jsonb;
  v_txn text;
  v_exists boolean;
  v_start timestamptz;
  v_end timestamptz;
  v_energy numeric;
  v_duration int;
  v_session_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-C denied: authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_can_import(p_station_id) THEN
    RAISE EXCEPTION 'EV-C denied: not permitted for station' USING ERRCODE = '42501';
  END IF;

  SELECT value INTO v_flag
  FROM public.system_settings
  WHERE key = 'import_workflow_v2_enabled'
  LIMIT 1;

  IF coalesce(v_flag, 'false') <> 'true' THEN
    RAISE EXCEPTION 'EV-C denied: import_workflow_v2_enabled is not true' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_batch
  FROM public.import_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-C batch not found';
  END IF;

  IF v_batch.status IN ('posted', 'completed', 'completed_with_errors', 'posting') THEN
    RAISE EXCEPTION 'EV-C batch already posted or in progress: %', v_batch.status;
  END IF;

  IF p_file_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.import_batches b
    WHERE b.file_hash = p_file_hash
      AND b.id <> p_batch_id
      AND b.status IN ('posted', 'completed', 'completed_with_errors', 'billing_failed', 'partially_posted')
  ) THEN
    UPDATE public.import_batches
    SET status = 'duplicate',
        failure_reason = 'Duplicate file hash already posted',
        operator_match_status = coalesce(operator_match_status, 'pending')
    WHERE id = p_batch_id;
    RETURN jsonb_build_object('ok', false, 'status', 'duplicate', 'reason', 'file_hash');
  END IF;

  v_match := public.resolve_operator_match_status(
    p_operator_id,
    v_batch.detected_card_id,
    v_batch.detected_operator_name
  );

  IF v_match = 'conflict' AND NOT p_allow_conflict_override THEN
    UPDATE public.import_batches
    SET status = 'review_required',
        operator_match_status = 'conflict',
        failure_reason = 'Selected operator conflicts with file card ID'
    WHERE id = p_batch_id;
    RETURN jsonb_build_object('ok', false, 'status', 'review_required', 'operator_match_status', 'conflict');
  END IF;

  IF v_match = 'conflict' AND p_allow_conflict_override AND NOT public.current_user_is_system_admin() THEN
    RAISE EXCEPTION 'EV-C denied: conflict override requires system_admin' USING ERRCODE = '42501';
  END IF;

  IF v_match = 'warning' AND NOT p_allow_filename_warning THEN
    UPDATE public.import_batches
    SET status = 'review_required',
        operator_match_status = 'warning',
        failure_reason = 'Filename operator mismatch requires confirmation'
    WHERE id = p_batch_id;
    RETURN jsonb_build_object('ok', false, 'status', 'review_required', 'operator_match_status', 'warning');
  END IF;

  UPDATE public.import_batches
  SET status = 'posting',
      posting_started_at = now(),
      posted_by = auth.uid(),
      selected_operator_id = p_operator_id,
      station_id = p_station_id,
      file_hash = coalesce(file_hash, p_file_hash),
      operator_match_status = v_match,
      workflow_version = coalesce(workflow_version, 'ev-c-v1.0.0'),
      failure_reason = NULL
  WHERE id = p_batch_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb))
  LOOP
    BEGIN
      v_txn := nullif(trim(v_row->>'transaction_id'), '');
      IF v_txn IS NULL THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row->>'source_row_number',
          'error', 'missing_transaction_id'
        ));
        CONTINUE;
      END IF;

      SELECT EXISTS (
        SELECT 1 FROM public.charging_sessions cs WHERE cs.transaction_id = v_txn
      ) INTO v_exists;

      IF v_exists THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_start := (v_row->>'start_ts')::timestamptz;
      v_end := (v_row->>'end_ts')::timestamptz;
      v_energy := (v_row->>'energy_consumed_kwh')::numeric;

      IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start OR v_energy IS NULL OR v_energy < 0 THEN
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row->>'source_row_number',
          'transaction_id', v_txn,
          'error', 'invalid_timestamps_or_energy'
        ));
        CONTINUE;
      END IF;

      v_duration := greatest(0, round(extract(epoch FROM (v_end - v_start)) / 60.0)::int);

      INSERT INTO public.charging_sessions (
        transaction_id, charge_id, card_number,
        start_date, start_time, start_ts,
        end_date, end_time, end_ts,
        duration_minutes, energy_consumed_kwh, calculated_cost,
        station_code, max_demand_kw, user_identifier,
        import_batch_id, station_id, operator_id,
        connector_number, connector_type, duration_text,
        co2_reduction_kg, start_soc_percent, end_soc_percent,
        source_row_number, source_file_hash, source_transaction_id
      ) VALUES (
        v_txn,
        coalesce(nullif(v_row->>'charge_id', ''), v_txn),
        coalesce(nullif(v_row->>'card_number', ''), 'UNKNOWN'),
        (v_start AT TIME ZONE 'Asia/Amman')::date,
        (v_start AT TIME ZONE 'Asia/Amman')::time,
        v_start,
        (v_end AT TIME ZONE 'Asia/Amman')::date,
        (v_end AT TIME ZONE 'Asia/Amman')::time,
        v_end,
        v_duration,
        v_energy,
        coalesce((v_row->>'calculated_cost')::numeric, 0),
        nullif(v_row->>'station_code', ''),
        nullif(v_row->>'max_demand_kw', '')::numeric,
        nullif(v_row->>'user_identifier', ''),
        p_batch_id,
        p_station_id,
        p_operator_id,
        nullif(v_row->>'connector_number', ''),
        nullif(v_row->>'connector_type', ''),
        nullif(v_row->>'duration_text', ''),
        nullif(v_row->>'co2_reduction_kg', '')::numeric,
        nullif(v_row->>'start_soc_percent', '')::numeric,
        nullif(v_row->>'end_soc_percent', '')::numeric,
        nullif(v_row->>'source_row_number', '')::int,
        p_file_hash,
        v_txn
      )
      RETURNING id INTO v_session_id;

      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'row', v_row->>'source_row_number',
        'transaction_id', v_txn,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  IF v_inserted = 0 AND v_skipped > 0 AND v_failed = 0 THEN
    UPDATE public.import_batches
    SET status = 'duplicate',
        records_success = 0,
        records_skipped = v_skipped,
        records_failed = 0,
        posting_completed_at = now(),
        failure_reason = 'All transactions already exist',
        validation_summary = jsonb_build_object(
          'inserted', v_inserted, 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors
        )
    WHERE id = p_batch_id;

    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'import_post_duplicate', 'import_batch', p_batch_id,
      jsonb_build_object('skipped', v_skipped, 'file_hash', p_file_hash)
    );

    RETURN jsonb_build_object(
      'ok', true, 'status', 'duplicate',
      'inserted', v_inserted, 'skipped', v_skipped, 'failed', v_failed
    );
  END IF;

  IF v_inserted > 0 THEN
    BEGIN
      v_billing := public.calculate_batch_billing_v2(p_batch_id, p_station_id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.import_batches
      SET status = 'billing_failed',
          records_success = v_inserted,
          records_skipped = v_skipped,
          records_failed = v_failed,
          posting_completed_at = now(),
          failure_reason = SQLERRM,
          validation_summary = jsonb_build_object(
            'inserted', v_inserted, 'skipped', v_skipped, 'failed', v_failed, 'errors', v_errors
          )
      WHERE id = p_batch_id;
      RAISE;
    END;
  END IF;

  UPDATE public.import_batches
  SET status = CASE
        WHEN v_failed > 0 AND v_inserted > 0 THEN 'partially_posted'
        WHEN v_failed > 0 AND v_inserted = 0 THEN 'validation_failed'
        WHEN v_inserted > 0 THEN 'posted'
        ELSE 'failed'
      END,
      records_success = v_inserted,
      records_skipped = v_skipped,
      records_failed = v_failed,
      posting_completed_at = now(),
      validation_summary = jsonb_build_object(
        'inserted', v_inserted,
        'skipped', v_skipped,
        'failed', v_failed,
        'errors', v_errors,
        'billing', v_billing,
        'operator_match_status', v_match
      )
  WHERE id = p_batch_id;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'import_post_v2', 'import_batch', p_batch_id,
    jsonb_build_object(
      'inserted', v_inserted,
      'skipped', v_skipped,
      'failed', v_failed,
      'operator_id', p_operator_id,
      'station_id', p_station_id,
      'file_hash', p_file_hash,
      'operator_match_status', v_match,
      'billing', v_billing
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'status', (SELECT status FROM public.import_batches WHERE id = p_batch_id),
    'inserted', v_inserted,
    'skipped', v_skipped,
    'failed', v_failed,
    'errors', v_errors,
    'billing', v_billing,
    'operator_match_status', v_match
  );
END;
$$;
