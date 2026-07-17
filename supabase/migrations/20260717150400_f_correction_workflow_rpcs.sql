-- EV-F Migration 5/9: Governed correction workflow — submit, review, approve,
-- reject, defer, apply, rollback. No correction can run unless status='approved'.

CREATE OR REPLACE FUNCTION public.f_assert_correction_role(p_require_approver boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-F denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'EV-F denied: user not approved' USING ERRCODE = '42501';
  END IF;
  v_role := public.current_user_role();
  IF p_require_approver THEN
    IF NOT (v_role = ANY(ARRAY['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'accountant'])) THEN
      RAISE EXCEPTION 'EV-F denied: role cannot approve/reject/apply/rollback corrections' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT (v_role = ANY(ARRAY[
      'system_admin', 'global_admin', 'operations_manager', 'company_manager',
      'accountant', 'station_manager', 'import_officer'
    ])) THEN
      RAISE EXCEPTION 'EV-F denied: role cannot submit corrections' USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.f_assert_correction_role(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.f_assert_correction_role(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.f_assert_correction_role(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_historical_correction(
  p_session_id uuid,
  p_proposed_action text,
  p_reason text,
  p_evidence jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.charging_sessions%ROWTYPE;
  v_comparison jsonb;
  v_id uuid;
  v_reason text;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(false);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'EV-F reason required to submit a correction';
  END IF;
  IF p_proposed_action NOT IN ('replace_billing_with_v2', 'repair_metadata_only', 'no_action_required', 'defer', 'manual_review') THEN
    RAISE EXCEPTION 'EV-F invalid proposed_action';
  END IF;

  SELECT * INTO v_session FROM charging_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-F session not found';
  END IF;

  IF v_session.station_id IS NOT NULL AND NOT public.current_user_has_station_access(v_session.station_id)
     AND NOT public.report_current_role_is_global() THEN
    RAISE EXCEPTION 'EV-F denied: station scope' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM historical_correction_queue
    WHERE session_id = p_session_id AND status IN ('identified', 'review_required', 'approved', 'applying')
  ) THEN
    RAISE EXCEPTION 'EV-F denied: an active correction already exists for this session' USING ERRCODE = '23505';
  END IF;

  v_comparison := public.compare_historical_session_to_v2(p_session_id);

  INSERT INTO historical_correction_queue (
    session_id, billing_id, station_id, classification, exception_types,
    current_amount, proposed_amount, difference, match_tier, confidence, risk,
    proposed_action, status, comparison_snapshot, evidence, reason, submitted_by
  ) VALUES (
    p_session_id,
    (SELECT id FROM billing_calculations WHERE session_id = p_session_id ORDER BY calculated_at DESC NULLS LAST, created_at DESC LIMIT 1),
    v_session.station_id,
    v_comparison->'classification'->>'primary_classification',
    coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(v_comparison->'classification'->'exception_types') x), '{}'),
    (v_comparison->>'current_total')::numeric,
    (v_comparison->>'expected_total')::numeric,
    (v_comparison->>'difference')::numeric,
    v_comparison->>'match_tier',
    coalesce(v_comparison->>'confidence', 'medium'),
    coalesce(v_comparison->>'risk', 'medium'),
    p_proposed_action,
    'identified',
    v_comparison,
    coalesce(p_evidence, '{}'::jsonb),
    v_reason,
    auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_correction_submit', 'historical_correction_queue', v_id,
    jsonb_build_object('session_id', p_session_id, 'proposed_action', p_proposed_action, 'match_tier', v_comparison->>'match_tier'));

  RETURN jsonb_build_object('ok', true, 'correction_id', v_id, 'status', 'identified', 'comparison', v_comparison);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_historical_correction(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_historical_correction(uuid, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_historical_correction(uuid, text, text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.review_historical_correction(p_correction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(false);

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;
  IF v_row.status <> 'identified' THEN
    RAISE EXCEPTION 'EV-F invalid status for review: %', v_row.status;
  END IF;

  UPDATE historical_correction_queue
  SET status = 'review_required', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = p_correction_id;

  RETURN jsonb_build_object('ok', true, 'status', 'review_required');
END;
$$;

REVOKE ALL ON FUNCTION public.review_historical_correction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_historical_correction(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.review_historical_correction(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_historical_correction(p_correction_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(true);

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;

  IF v_row.submitted_by = auth.uid() AND NOT public.current_user_is_system_admin() THEN
    RAISE EXCEPTION 'EV-F denied: cannot approve own submitted correction' USING ERRCODE = '42501';
  END IF;
  IF v_row.status NOT IN ('identified', 'review_required') THEN
    RAISE EXCEPTION 'EV-F invalid status for approve: %', v_row.status;
  END IF;

  UPDATE historical_correction_queue
  SET status = 'approved', approved_by = auth.uid(), approved_at = now(),
      reason = coalesce(p_reason, reason), version = version + 1, updated_at = now()
  WHERE id = p_correction_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_correction_approve', 'historical_correction_queue', p_correction_id,
    jsonb_build_object('session_id', v_row.session_id));

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_historical_correction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_historical_correction(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_historical_correction(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_historical_correction(p_correction_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
  v_reason text;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(true);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F rejection reason required'; END IF;

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;
  IF v_row.status NOT IN ('identified', 'review_required') THEN
    RAISE EXCEPTION 'EV-F invalid status for reject: %', v_row.status;
  END IF;

  UPDATE historical_correction_queue
  SET status = 'rejected', rejection_reason = v_reason, updated_at = now()
  WHERE id = p_correction_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_correction_reject', 'historical_correction_queue', p_correction_id,
    jsonb_build_object('session_id', v_row.session_id, 'reason', v_reason));

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_historical_correction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_historical_correction(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_historical_correction(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.defer_historical_correction(p_correction_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
  v_reason text;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(false);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F defer reason required'; END IF;

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;
  IF v_row.status NOT IN ('identified', 'review_required') THEN
    RAISE EXCEPTION 'EV-F invalid status for defer: %', v_row.status;
  END IF;

  UPDATE historical_correction_queue
  SET status = 'deferred', defer_reason = v_reason, updated_at = now()
  WHERE id = p_correction_id;

  RETURN jsonb_build_object('ok', true, 'status', 'deferred');
END;
$$;

REVOKE ALL ON FUNCTION public.defer_historical_correction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.defer_historical_correction(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.defer_historical_correction(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_historical_correction(p_correction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
  v_billing_before jsonb;
  v_breakdown_before jsonb;
  v_fresh_comparison jsonb;
  v_apply_result jsonb;
  v_new_billing public.billing_calculations%ROWTYPE;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(true);

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;
  IF v_row.status NOT IN ('approved', 'failed') THEN
    RAISE EXCEPTION 'EV-F invalid status for apply: %', v_row.status;
  END IF;

  IF public.session_in_locked_handover(v_row.session_id) THEN
    RAISE EXCEPTION 'EV-F denied: session is in a locked handover; reopen the handover before correcting' USING ERRCODE = '55000';
  END IF;

  UPDATE historical_correction_queue SET status = 'applying', updated_at = now() WHERE id = p_correction_id;

  BEGIN
    -- Archive original billing/breakdown BEFORE any mutation.
    SELECT to_jsonb(bc) INTO v_billing_before FROM billing_calculations bc WHERE bc.session_id = v_row.session_id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1;
    SELECT coalesce(jsonb_agg(to_jsonb(bbi)), '[]'::jsonb) INTO v_breakdown_before
    FROM billing_breakdown_items bbi
    WHERE bbi.billing_calculation_id = (v_billing_before->>'id')::uuid;

    v_fresh_comparison := public.compare_historical_session_to_v2(v_row.session_id);

    INSERT INTO historical_correction_archive (
      correction_id, session_id, original_billing_calculation, original_breakdown_items,
      comparison_snapshot, approval_snapshot, archived_event, actor_id
    ) VALUES (
      p_correction_id, v_row.session_id, v_billing_before, v_breakdown_before,
      v_fresh_comparison,
      jsonb_build_object('approved_by', v_row.approved_by, 'approved_at', v_row.approved_at, 'reason', v_row.reason),
      'pre_apply', auth.uid()
    );

    IF v_row.proposed_action = 'replace_billing_with_v2' THEN
      v_apply_result := public.calculate_session_billing_v2(v_row.session_id, 'historical_correction', v_row.reason);
    ELSIF v_row.proposed_action = 'repair_metadata_only' THEN
      UPDATE billing_calculations
      SET calculation_engine_version = v_fresh_comparison->>'expected_engine_version',
          recalculation_reason = v_row.reason,
          recalculated_by = auth.uid()
      WHERE id = (v_billing_before->>'id')::uuid;
      SELECT to_jsonb(bc) INTO v_apply_result FROM billing_calculations bc WHERE bc.id = (v_billing_before->>'id')::uuid;
    ELSE
      v_apply_result := jsonb_build_object('no_change', true, 'proposed_action', v_row.proposed_action);
    END IF;

    INSERT INTO historical_correction_archive (
      correction_id, session_id, applied_result, archived_event, actor_id
    ) VALUES (
      p_correction_id, v_row.session_id, v_apply_result, 'post_apply', auth.uid()
    );

    UPDATE historical_correction_queue
    SET status = 'applied', applied_by = auth.uid(), applied_at = now(), updated_at = now(), failure_reason = NULL
    WHERE id = p_correction_id;

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'historical_correction_apply', 'historical_correction_queue', p_correction_id,
      jsonb_build_object('session_id', v_row.session_id, 'proposed_action', v_row.proposed_action, 'result', v_apply_result));

    RETURN jsonb_build_object('ok', true, 'status', 'applied', 'result', v_apply_result);
  EXCEPTION WHEN OTHERS THEN
    UPDATE historical_correction_queue
    SET status = 'failed', failure_reason = SQLERRM, updated_at = now()
    WHERE id = p_correction_id;
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_historical_correction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_historical_correction(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_historical_correction(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rollback_historical_correction(p_correction_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_correction_queue%ROWTYPE;
  v_archive historical_correction_archive%ROWTYPE;
  v_original_billing jsonb;
  v_original_breakdown jsonb;
  v_new_billing_id uuid;
  v_reason text;
  v_item jsonb;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_correction_enabled');
  PERFORM public.f_assert_correction_role(true);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F rollback reason required'; END IF;

  SELECT * INTO v_row FROM historical_correction_queue WHERE id = p_correction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F correction not found'; END IF;
  IF v_row.status <> 'applied' THEN
    RAISE EXCEPTION 'EV-F can only roll back an applied correction (status=%)', v_row.status;
  END IF;

  IF public.session_in_locked_handover(v_row.session_id) THEN
    RAISE EXCEPTION 'EV-F denied: session is in a locked handover; reopen the handover before rolling back' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_archive FROM historical_correction_archive
  WHERE correction_id = p_correction_id AND archived_event = 'pre_apply'
  ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-F cannot roll back: no pre-apply archive found';
  END IF;

  v_original_billing := v_archive.original_billing_calculation;
  v_original_breakdown := v_archive.original_breakdown_items;

  IF v_row.proposed_action = 'repair_metadata_only' AND v_original_billing IS NOT NULL AND EXISTS (
    SELECT 1 FROM billing_calculations WHERE session_id = v_row.session_id AND id = (v_original_billing->>'id')::uuid
  ) THEN
    -- Metadata-only correction only ever UPDATEd calculation_engine_version /
    -- recalculation_reason / recalculated_by in place — restore those same
    -- fields in place too, rather than delete+reinsert (which would needlessly
    -- churn the row's id and any FKs pointing at it, e.g. session_payment_allocations).
    UPDATE billing_calculations
    SET calculation_engine_version = v_original_billing->>'calculation_engine_version',
        recalculation_reason = v_original_billing->>'recalculation_reason',
        recalculated_by = (v_original_billing->>'recalculated_by')::uuid
    WHERE id = (v_original_billing->>'id')::uuid;
    v_new_billing_id := (v_original_billing->>'id')::uuid;
  ELSE
    -- Restore exact original values (A1-safe delete+insert; UNIQUE(session_id) preserved).
    DELETE FROM billing_breakdown_items bbi
    USING billing_calculations bc
    WHERE bbi.billing_calculation_id = bc.id AND bc.session_id = v_row.session_id;
    DELETE FROM billing_calculations WHERE session_id = v_row.session_id;

    IF v_original_billing IS NOT NULL THEN
    INSERT INTO billing_calculations (
      session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency, breakdown,
      calculation_engine_version, calculated_at, calculation_method, applied_rate_summary,
      recalculation_reason, recalculated_by, source_import_batch_id, billing_source
    ) VALUES (
      v_row.session_id,
      (v_original_billing->>'rate_structure_id')::uuid,
      (v_original_billing->>'subtotal')::numeric,
      (v_original_billing->>'taxes')::numeric,
      (v_original_billing->>'fees')::numeric,
      (v_original_billing->>'total_amount')::numeric,
      coalesce(v_original_billing->>'currency', 'JOD'),
      v_original_billing->'breakdown',
      v_original_billing->>'calculation_engine_version',
      (v_original_billing->>'calculated_at')::timestamptz,
      v_original_billing->>'calculation_method',
      v_original_billing->>'applied_rate_summary',
      'EV-F rollback: ' || v_reason,
      auth.uid(),
      (v_original_billing->>'source_import_batch_id')::uuid,
      v_original_billing->>'billing_source'
    ) RETURNING id INTO v_new_billing_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(v_original_breakdown, '[]'::jsonb))
    LOOP
      INSERT INTO billing_breakdown_items (
        billing_calculation_id, rate_period_id, rate_structure_id, period_name,
        start_time, end_time, duration_minutes, energy_kwh, rate_per_kwh,
        demand_kw, demand_charge, energy_charge, line_total, calculation_engine_version
      ) VALUES (
        v_new_billing_id,
        (v_item->>'rate_period_id')::uuid,
        (v_item->>'rate_structure_id')::uuid,
        v_item->>'period_name',
        (v_item->>'start_time')::timestamptz,
        (v_item->>'end_time')::timestamptz,
        (v_item->>'duration_minutes')::numeric,
        (v_item->>'energy_kwh')::numeric,
        (v_item->>'rate_per_kwh')::numeric,
        coalesce((v_item->>'demand_kw')::numeric, 0),
        coalesce((v_item->>'demand_charge')::numeric, 0),
        (v_item->>'energy_charge')::numeric,
        (v_item->>'line_total')::numeric,
        v_item->>'calculation_engine_version'
      );
    END LOOP;

    UPDATE charging_sessions
    SET calculated_cost = (v_original_billing->>'total_amount')::numeric, has_billing_calculation = true
    WHERE id = v_row.session_id;
    END IF;
  END IF;

  INSERT INTO historical_correction_archive (
    correction_id, session_id, rollback_result, archived_event, actor_id
  ) VALUES (
    p_correction_id, v_row.session_id,
    jsonb_build_object('restored_billing_id', v_new_billing_id, 'reason', v_reason),
    'post_rollback', auth.uid()
  );

  UPDATE historical_correction_queue
  SET status = 'rolled_back', rolled_back_by = auth.uid(), rolled_back_at = now(), updated_at = now()
  WHERE id = p_correction_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_correction_rollback', 'historical_correction_queue', p_correction_id,
    jsonb_build_object('session_id', v_row.session_id, 'reason', v_reason, 'restored_billing_id', v_new_billing_id));

  RETURN jsonb_build_object('ok', true, 'status', 'rolled_back', 'restored_total_amount', v_original_billing->>'total_amount');
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_historical_correction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_historical_correction(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rollback_historical_correction(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_historical_correction(uuid) IS
  'EV-F: only runs when status=approved (or retrying a failed attempt). Archives original billing/breakdown before any mutation; blocks locked-handover sessions.';
COMMENT ON FUNCTION public.rollback_historical_correction(uuid, text) IS
  'EV-F: restores the exact original billing_calculations/billing_breakdown_items values from the pre_apply archive. Retains full correction history (never deletes archive rows).';
