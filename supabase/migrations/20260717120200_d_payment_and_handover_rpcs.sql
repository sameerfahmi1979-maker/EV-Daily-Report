-- EV-D Migration 3: Payment + handover RPCs, flags, locked guards

INSERT INTO public.system_settings (key, value, category)
SELECT 'payment_workflow_v1_enabled', 'false', 'import'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'payment_workflow_v1_enabled');

INSERT INTO public.system_settings (key, value, category)
SELECT 'handover_workflow_v1_enabled', 'false', 'import'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings WHERE key = 'handover_workflow_v1_enabled');

CREATE OR REPLACE FUNCTION public.d_assert_payment_workflow()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-D denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF coalesce((SELECT value FROM system_settings WHERE key='payment_workflow_v1_enabled'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'EV-D denied: payment_workflow_v1_enabled is not true' USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.d_assert_handover_workflow()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-D denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF coalesce((SELECT value FROM system_settings WHERE key='handover_workflow_v1_enabled'), 'false') <> 'true' THEN
    RAISE EXCEPTION 'EV-D denied: handover_workflow_v1_enabled is not true' USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.session_in_locked_handover(p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cash_handover_sessions chs
    JOIN public.cash_handovers h ON h.id = chs.handover_id
    WHERE chs.session_id = p_session_id
      AND h.status = 'locked'
  );
$$;

CREATE OR REPLACE FUNCTION public.round_jod3(p numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT round(coalesce(p, 0)::numeric, 3);
$$;

CREATE OR REPLACE FUNCTION public.assign_session_payment_method(
  p_session_id uuid,
  p_payment_method text,
  p_payment_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'manual_override'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.charging_sessions%ROWTYPE;
  v_billing public.billing_calculations%ROWTYPE;
  v_id uuid;
BEGIN
  PERFORM public.d_assert_payment_workflow();

  IF p_payment_method NOT IN ('Cash', 'Card', 'CliQ') THEN
    RAISE EXCEPTION 'EV-D invalid payment method';
  END IF;

  SELECT * INTO v_session FROM charging_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D session not found'; END IF;

  IF NOT public.current_user_has_station_access(v_session.station_id) THEN
    RAISE EXCEPTION 'EV-D denied: station scope' USING ERRCODE = '42501';
  END IF;

  IF public.session_in_locked_handover(p_session_id) THEN
    RAISE EXCEPTION 'EV-D denied: session is in a locked handover' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_billing
  FROM billing_calculations
  WHERE session_id = p_session_id
  ORDER BY calculated_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-D session has no billing calculation';
  END IF;

  UPDATE session_payment_allocations
  SET is_active = false, updated_at = now()
  WHERE session_id = p_session_id AND is_active = true;

  INSERT INTO session_payment_allocations (
    session_id, billing_calculation_id, payment_method, amount_jod,
    assignment_source, payment_reference, notes, assigned_by
  ) VALUES (
    p_session_id, v_billing.id, p_payment_method, public.round_jod3(v_billing.total_amount),
    coalesce(p_source, 'manual_override'), p_payment_reference, p_notes, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'assign_payment_method', 'charging_sessions', p_session_id,
    jsonb_build_object('method', p_payment_method, 'amount', v_billing.total_amount, 'allocation_id', v_id));

  RETURN jsonb_build_object('ok', true, 'allocation_id', v_id, 'amount', public.round_jod3(v_billing.total_amount));
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_batch_default_payment_method(
  p_batch_id uuid,
  p_payment_method text,
  p_only_unassigned boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session RECORD;
  v_ok int := 0;
  v_skip int := 0;
BEGIN
  PERFORM public.d_assert_payment_workflow();
  IF p_payment_method NOT IN ('Cash', 'Card', 'CliQ') THEN
    RAISE EXCEPTION 'EV-D invalid payment method';
  END IF;

  FOR v_session IN
    SELECT cs.id, cs.station_id
    FROM charging_sessions cs
    WHERE cs.import_batch_id = p_batch_id
  LOOP
    IF NOT public.current_user_has_station_access(v_session.station_id) THEN
      RAISE EXCEPTION 'EV-D denied: station scope' USING ERRCODE = '42501';
    END IF;
    IF p_only_unassigned AND EXISTS (
      SELECT 1 FROM session_payment_allocations spa
      WHERE spa.session_id = v_session.id AND spa.is_active
    ) THEN
      v_skip := v_skip + 1;
      CONTINUE;
    END IF;
    PERFORM public.assign_session_payment_method(v_session.id, p_payment_method, NULL, NULL, 'batch_default');
    v_ok := v_ok + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'assigned', v_ok, 'skipped', v_skip);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_handover_totals(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_billing numeric := 0;
  v_cash numeric := 0;
  v_card numeric := 0;
  v_cliq numeric := 0;
  v_adj numeric := 0;
  v_unassigned int := 0;
  v_expected numeric := 0;
  v_actual numeric;
  v_shortage numeric := 0;
  v_surplus numeric := 0;
BEGIN
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  SELECT
    coalesce(sum(chs.amount_jod), 0),
    coalesce(sum(chs.amount_jod) FILTER (WHERE chs.payment_method = 'Cash'), 0),
    coalesce(sum(chs.amount_jod) FILTER (WHERE chs.payment_method = 'Card'), 0),
    coalesce(sum(chs.amount_jod) FILTER (WHERE chs.payment_method = 'CliQ'), 0)
  INTO v_billing, v_cash, v_card, v_cliq
  FROM cash_handover_sessions chs
  WHERE chs.handover_id = p_handover_id;

  SELECT coalesce(sum(
    CASE WHEN cash_impact = 'increase' THEN amount_jod ELSE -amount_jod END
  ), 0)
  INTO v_adj
  FROM cash_handover_adjustments
  WHERE handover_id = p_handover_id AND status = 'approved';

  SELECT count(*) INTO v_unassigned
  FROM cash_handover_sessions chs
  JOIN charging_sessions cs ON cs.id = chs.session_id
  WHERE chs.handover_id = p_handover_id
    AND NOT EXISTS (
      SELECT 1 FROM session_payment_allocations spa
      WHERE spa.session_id = cs.id AND spa.is_active
    );

  v_expected := public.round_jod3(v_cash + v_adj);
  v_actual := v_h.actual_cash_received;
  IF v_actual IS NOT NULL THEN
    v_shortage := public.round_jod3(greatest(v_expected - v_actual, 0));
    v_surplus := public.round_jod3(greatest(v_actual - v_expected, 0));
  END IF;

  UPDATE cash_handovers SET
    billing_total = public.round_jod3(v_billing),
    cash_total = public.round_jod3(v_cash),
    card_total = public.round_jod3(v_card),
    cliq_total = public.round_jod3(v_cliq),
    net_adjustments = public.round_jod3(v_adj),
    expected_cash = v_expected,
    shortage_amount = v_shortage,
    surplus_amount = v_surplus,
    unassigned_count = v_unassigned,
    updated_at = now()
  WHERE id = p_handover_id;

  RETURN jsonb_build_object(
    'billing_total', public.round_jod3(v_billing),
    'cash_total', public.round_jod3(v_cash),
    'card_total', public.round_jod3(v_card),
    'cliq_total', public.round_jod3(v_cliq),
    'expected_cash', v_expected,
    'shortage', v_shortage,
    'surplus', v_surplus,
    'unassigned_count', v_unassigned
  );
END;
$$;

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

  FOR v_session IN
    SELECT * FROM charging_sessions
    WHERE shift_id = p_shift_id OR import_batch_id = v_shift.import_batch_id
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

CREATE OR REPLACE FUNCTION public.submit_handover(
  p_handover_id uuid,
  p_actual_cash_received numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_tot jsonb;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;
  IF NOT public.current_user_can_import(v_h.station_id) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;
  IF v_h.status NOT IN ('draft', 'ready_to_submit', 'reopened', 'rejected') THEN
    RAISE EXCEPTION 'EV-D invalid status for submit: %', v_h.status;
  END IF;

  UPDATE cash_handovers SET actual_cash_received = public.round_jod3(p_actual_cash_received)
  WHERE id = p_handover_id;

  v_tot := public.refresh_handover_totals(p_handover_id);
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id;

  IF v_h.unassigned_count > 0 THEN
    RAISE EXCEPTION 'EV-D cannot submit: % unassigned payments', v_h.unassigned_count;
  END IF;
  IF abs(v_h.billing_total - (v_h.cash_total + v_h.card_total + v_h.cliq_total)) > 0.001 THEN
    RAISE EXCEPTION 'EV-D cannot submit: payment allocation does not reconcile to billing';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cash_handover_sessions WHERE handover_id = p_handover_id AND payment_method = 'UNASSIGNED'
  ) THEN
    RAISE EXCEPTION 'EV-D cannot submit: UNASSIGNED payment methods remain';
  END IF;

  UPDATE cash_handovers SET
    status = 'submitted',
    submitted_by = auth.uid(),
    submitted_at = now(),
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, details)
  VALUES (p_handover_id, v_h.status, 'submitted', 'submit', auth.uid(), v_tot);

  RETURN jsonb_build_object('ok', true, 'status', 'submitted', 'totals', v_tot);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_handover(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied: approve role' USING ERRCODE = '42501';
  END IF;

  IF v_h.submitted_by = auth.uid() AND NOT public.current_user_is_system_admin() THEN
    RAISE EXCEPTION 'EV-D denied: cannot approve own handover' USING ERRCODE = '42501';
  END IF;

  IF v_h.status NOT IN ('submitted', 'under_review', 'reopened') THEN
    RAISE EXCEPTION 'EV-D invalid status for approve: %', v_h.status;
  END IF;

  UPDATE cash_handovers SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id)
  VALUES (p_handover_id, v_h.status, 'approved', 'approve', auth.uid());

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_handover(p_handover_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;
  IF v_h.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'EV-D invalid status for reject';
  END IF;

  UPDATE cash_handovers SET
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason)
  VALUES (p_handover_id, v_h.status, 'rejected', 'reject', auth.uid(), p_reason);

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_handover(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;
  IF v_h.status <> 'approved' THEN
    RAISE EXCEPTION 'EV-D can only lock approved handovers';
  END IF;

  UPDATE cash_handovers SET
    status = 'locked',
    locked_by = auth.uid(),
    locked_at = now(),
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id)
  VALUES (p_handover_id, 'approved', 'locked', 'lock', auth.uid());

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'handover_lock', 'cash_handovers', p_handover_id, jsonb_build_object('version', v_h.version));

  RETURN jsonb_build_object('ok', true, 'status', 'locked');
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_handover(p_handover_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
  ) THEN
    RAISE EXCEPTION 'EV-D denied: reopen requires ops/admin' USING ERRCODE = '42501';
  END IF;
  IF coalesce(p_reason, '') = '' THEN
    RAISE EXCEPTION 'EV-D reopen reason required';
  END IF;
  IF v_h.status <> 'locked' THEN
    RAISE EXCEPTION 'EV-D can only reopen locked handovers';
  END IF;

  UPDATE cash_handovers SET
    status = 'reopened',
    reopened_by = auth.uid(),
    reopened_at = now(),
    reopen_reason = p_reason,
    version = v_h.version + 1,
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason)
  VALUES (p_handover_id, 'locked', 'reopened', 'reopen', auth.uid(), p_reason);

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'handover_reopen', 'cash_handovers', p_handover_id,
    jsonb_build_object('reason', p_reason, 'version', v_h.version + 1));

  RETURN jsonb_build_object('ok', true, 'status', 'reopened');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_handover_adjustment(
  p_handover_id uuid,
  p_cash_impact text,
  p_amount numeric,
  p_reason text,
  p_evidence text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_id uuid;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF v_h.status IN ('locked') THEN
    RAISE EXCEPTION 'EV-D cannot adjust locked handover';
  END IF;
  IF NOT public.current_user_has_station_access(v_h.station_id) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO cash_handover_adjustments (
    handover_id, adjustment_type, cash_impact, amount_jod, reason, evidence_reference, requested_by, status
  ) VALUES (
    p_handover_id, 'cash_adjustment', p_cash_impact, public.round_jod3(p_amount), p_reason, p_evidence, auth.uid(), 'pending'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'adjustment_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_handover_adjustment(p_adjustment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_adj public.cash_handover_adjustments%ROWTYPE;
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_adj FROM cash_handover_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  SELECT * INTO v_h FROM cash_handovers WHERE id = v_adj.handover_id FOR UPDATE;
  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;
  IF v_h.status = 'locked' THEN
    RAISE EXCEPTION 'EV-D cannot approve adjustment on locked handover';
  END IF;

  UPDATE cash_handover_adjustments SET
    status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_adjustment_id;

  PERFORM public.refresh_handover_totals(v_h.id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Guard recalculation on locked sessions
CREATE OR REPLACE FUNCTION public.d_guard_locked_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.session_in_locked_handover(OLD.session_id) THEN
      RAISE EXCEPTION 'EV-D denied: billing locked by cash handover' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
  IF public.session_in_locked_handover(NEW.session_id) THEN
    RAISE EXCEPTION 'EV-D denied: billing locked by cash handover' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_d_guard_locked_billing ON public.billing_calculations;
CREATE TRIGGER trg_d_guard_locked_billing
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_calculations
  FOR EACH ROW EXECUTE FUNCTION public.d_guard_locked_billing();

-- Grants
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'assign_session_payment_method(uuid,text,text,text,text)',
      'apply_batch_default_payment_method(uuid,text,boolean)',
      'create_handover_draft(uuid)',
      'refresh_handover_totals(uuid)',
      'submit_handover(uuid,numeric)',
      'approve_handover(uuid)',
      'reject_handover(uuid,text)',
      'lock_handover(uuid)',
      'reopen_handover(uuid,text)',
      'create_handover_adjustment(uuid,text,numeric,text,text)',
      'approve_handover_adjustment(uuid)',
      'session_in_locked_handover(uuid)'
    ]) AS sig
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', r.sig);
  END LOOP;
END $$;
