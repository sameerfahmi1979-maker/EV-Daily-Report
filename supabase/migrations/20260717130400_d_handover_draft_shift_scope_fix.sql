-- EV-D-FINAL-CLOSURE fix: create_handover_draft must only include sessions explicitly
-- linked to the target shift (shift_id = p_shift_id), never the whole import batch.
--
-- Defect found during final gap-closure UAT: the original OR import_batch_id condition
-- meant that two different shifts sharing one import batch would each pull ALL of that
-- batch's sessions into their own handover, double-counting revenue and cash
-- responsibility across operators/shifts. This violates the Phase D scope requirement
-- that "one handover cannot accidentally include another operator or station" (and, by
-- extension, another shift).

CREATE OR REPLACE FUNCTION public.create_handover_draft(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_id uuid;
  v_num text;
  v_session RECORD;
  v_alloc public.session_payment_allocations%ROWTYPE;
  v_billing public.billing_calculations%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();

  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D shift not found'; END IF;
  IF v_shift.station_id IS NULL OR v_shift.operator_id IS NULL THEN
    RAISE EXCEPTION 'EV-D shift missing station/operator';
  END IF;
  IF NOT public.current_user_can_import(v_shift.station_id) THEN
    RAISE EXCEPTION 'EV-D denied: cannot create handover' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cash_handovers h
    WHERE h.shift_id = p_shift_id AND h.status NOT IN ('cancelled', 'rejected')
  ) THEN
    RAISE EXCEPTION 'EV-D active handover already exists for shift';
  END IF;

  v_num := 'HO-' || to_char(now() AT TIME ZONE 'Asia/Amman', 'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO cash_handovers (
    handover_number, station_id, operator_id, shift_id, shift_date, status, created_by
  ) VALUES (
    v_num, v_shift.station_id, v_shift.operator_id, p_shift_id, v_shift.shift_date, 'draft', auth.uid()
  ) RETURNING id INTO v_id;

  -- Scoped strictly to this shift's own sessions (not the whole import batch).
  FOR v_session IN
    SELECT * FROM charging_sessions
    WHERE shift_id = p_shift_id
  LOOP
    SELECT * INTO v_billing FROM billing_calculations
    WHERE session_id = v_session.id
    ORDER BY calculated_at DESC NULLS LAST, created_at DESC LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT * INTO v_alloc FROM session_payment_allocations
    WHERE session_id = v_session.id AND is_active LIMIT 1;

    INSERT INTO cash_handover_sessions (
      handover_id, session_id, billing_calculation_id, payment_allocation_id,
      payment_method, amount_jod
    ) VALUES (
      v_id, v_session.id, v_billing.id, v_alloc.id,
      coalesce(v_alloc.payment_method, 'UNASSIGNED'),
      public.round_jod3(v_billing.total_amount)
    )
    ON CONFLICT (handover_id, session_id) DO NOTHING;
  END LOOP;

  PERFORM public.refresh_handover_totals(v_id);

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id)
  VALUES (v_id, NULL, 'draft', 'create_draft', auth.uid());

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'handover_create_draft', 'cash_handovers', v_id,
    jsonb_build_object('shift_id', p_shift_id, 'handover_number', v_num));

  RETURN jsonb_build_object('ok', true, 'handover_id', v_id, 'handover_number', v_num);
END;
$$;

REVOKE ALL ON FUNCTION public.create_handover_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_handover_draft(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_handover_draft(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_handover_draft(uuid) IS
  'EV-D-FINAL-CLOSURE: scoped strictly to charging_sessions.shift_id = p_shift_id (fixed 2026-07-17; previously also matched by import_batch_id, which double-counted sessions across shifts sharing one batch).';
