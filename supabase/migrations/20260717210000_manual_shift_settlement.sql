-- Manual Shift Cash Settlement
--
-- Replaces the per-transaction Cash/Card/CliQ payment-method selector with a
-- shift-level manual settlement: the station manager (or ops/admin) enters a
-- single Cash, CliQ, and Card total at handover time. The sum is compared to
-- the shift's total sales (shifts.total_amount_jod). Any shortage ("miss",
-- flagged for salary deduction) or surplus requires a mandatory note, stored
-- in discrepancy_reason.
--
-- The old per-transaction feature (session_payment_allocations,
-- assign_session_payment_method, apply_batch_default_payment_method,
-- refresh_handover_totals, cash_handover_sessions, payment_workflow_v1_enabled)
-- is left completely untouched/dormant. It is hidden from the UI but stays in
-- the database for historical data and possible future reuse.

-- 1. Narrower role helper for who may create/settle a handover under the new
--    manual flow: station_manager, operations_manager, system_admin only
--    (deliberately narrower than current_user_can_import, which also allows
--    import_officer/company_manager/global_admin).
CREATE OR REPLACE FUNCTION public.d_current_user_can_settle_handover(p_station_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_is_approved()
    AND public.current_user_role() IN ('system_admin', 'operations_manager', 'station_manager')
    AND public.current_user_has_station_access(p_station_id);
$$;

REVOKE ALL ON FUNCTION public.d_current_user_can_settle_handover(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d_current_user_can_settle_handover(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.d_current_user_can_settle_handover(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.d_current_user_can_settle_handover(uuid) IS
  'Manual Shift Cash Settlement: role gate for create_handover_draft / set_handover_manual_totals / submit_handover. Narrower than current_user_can_import — station_manager, operations_manager, system_admin only.';

-- 2. create_handover_draft: no longer snapshots session_payment_allocations
--    into cash_handover_sessions. billing_total is taken directly from
--    shifts.total_amount_jod. Totals start at zero and are filled in via
--    set_handover_manual_totals.
CREATE OR REPLACE FUNCTION public.create_handover_draft(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shift public.shifts%ROWTYPE;
  v_id uuid;
  v_num text;
BEGIN
  PERFORM public.d_assert_handover_workflow();

  SELECT * INTO v_shift FROM shifts WHERE id = p_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D shift not found'; END IF;
  IF v_shift.station_id IS NULL OR v_shift.operator_id IS NULL THEN
    RAISE EXCEPTION 'EV-D shift missing station/operator';
  END IF;
  IF NOT public.d_current_user_can_settle_handover(v_shift.station_id) THEN
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
    handover_number, station_id, operator_id, shift_id, shift_date, status,
    billing_total, expected_cash, created_by
  ) VALUES (
    v_num, v_shift.station_id, v_shift.operator_id, p_shift_id, v_shift.shift_date, 'draft',
    public.round_jod3(coalesce(v_shift.total_amount_jod, 0)), public.round_jod3(coalesce(v_shift.total_amount_jod, 0)), auth.uid()
  ) RETURNING id INTO v_id;

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
  'Manual Shift Cash Settlement: billing_total snapshotted from shifts.total_amount_jod; no longer derives from session_payment_allocations/cash_handover_sessions.';

-- 3. New RPC: station manager (or ops/admin) enters the Cash/CliQ/Card totals
--    manually. Compares the sum to the shift's total sales (+ any approved
--    adjustments) and records shortage/surplus with a mandatory note.
CREATE OR REPLACE FUNCTION public.set_handover_manual_totals(
  p_handover_id uuid,
  p_cash numeric,
  p_cliq numeric,
  p_card numeric,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_shift public.shifts%ROWTYPE;
  v_cash numeric := public.round_jod3(coalesce(p_cash, 0));
  v_cliq numeric := public.round_jod3(coalesce(p_cliq, 0));
  v_card numeric := public.round_jod3(coalesce(p_card, 0));
  v_total numeric;
  v_billing numeric;
  v_adj numeric := 0;
  v_expected numeric;
  v_shortage numeric := 0;
  v_surplus numeric := 0;
  v_note text;
BEGIN
  PERFORM public.d_assert_handover_workflow();

  IF v_cash < 0 OR v_cliq < 0 OR v_card < 0 THEN
    RAISE EXCEPTION 'EV-D amounts cannot be negative';
  END IF;

  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF NOT public.d_current_user_can_settle_handover(v_h.station_id) THEN
    RAISE EXCEPTION 'EV-D denied: cannot set handover totals' USING ERRCODE = '42501';
  END IF;

  IF v_h.status NOT IN ('draft', 'ready_to_submit', 'rejected', 'reopened') THEN
    RAISE EXCEPTION 'EV-D invalid status for setting totals: %', v_h.status;
  END IF;

  SELECT * INTO v_shift FROM shifts WHERE id = v_h.shift_id;
  v_billing := public.round_jod3(coalesce(v_shift.total_amount_jod, v_h.billing_total, 0));

  SELECT coalesce(sum(
    CASE WHEN cash_impact = 'increase' THEN amount_jod ELSE -amount_jod END
  ), 0)
  INTO v_adj
  FROM cash_handover_adjustments
  WHERE handover_id = p_handover_id AND status = 'approved';

  v_expected := public.round_jod3(v_billing + v_adj);
  v_total := public.round_jod3(v_cash + v_cliq + v_card);
  v_shortage := public.round_jod3(greatest(v_expected - v_total, 0));
  v_surplus := public.round_jod3(greatest(v_total - v_expected, 0));

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  IF (v_shortage > 0.0005 OR v_surplus > 0.0005) AND v_note IS NULL THEN
    RAISE EXCEPTION 'EV-D note required: shortage=% surplus=%', v_shortage, v_surplus
      USING ERRCODE = '23514';
  END IF;

  UPDATE cash_handovers SET
    billing_total = v_billing,
    cash_total = v_cash,
    cliq_total = v_cliq,
    card_total = v_card,
    net_adjustments = public.round_jod3(v_adj),
    expected_cash = v_expected,
    actual_cash_received = v_total,
    shortage_amount = v_shortage,
    surplus_amount = v_surplus,
    unassigned_count = 0,
    discrepancy_reason = v_note,
    status = 'ready_to_submit',
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason, details)
  VALUES (
    p_handover_id, v_h.status, 'ready_to_submit', 'set_manual_totals', auth.uid(), v_note,
    jsonb_build_object(
      'cash', v_cash, 'cliq', v_cliq, 'card', v_card, 'total', v_total,
      'expected_total', v_expected, 'shortage', v_shortage, 'surplus', v_surplus
    )
  );

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_set_manual_totals', 'cash_handovers', p_handover_id,
    jsonb_build_object(
      'cash', v_cash, 'cliq', v_cliq, 'card', v_card, 'total', v_total,
      'expected_total', v_expected, 'shortage', v_shortage, 'surplus', v_surplus, 'note', v_note
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'status', 'ready_to_submit',
    'cash_total', v_cash, 'cliq_total', v_cliq, 'card_total', v_card, 'total_entered', v_total,
    'expected_total', v_expected, 'shortage_amount', v_shortage, 'surplus_amount', v_surplus,
    'discrepancy_reason', v_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_handover_manual_totals(uuid, numeric, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_handover_manual_totals(uuid, numeric, numeric, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_handover_manual_totals(uuid, numeric, numeric, numeric, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_handover_manual_totals(uuid, numeric, numeric, numeric, text) IS
  'Manual Shift Cash Settlement: station manager/ops/admin enters Cash+CliQ+Card totals; compares sum to shift total sales (+ approved adjustments); requires a note when shortage ("miss", for salary deduction) or surplus is non-zero.';

-- 4. submit_handover: drop the old 3-arg signature (actual_cash_received /
--    discrepancy_reason were entered at submit time under the per-session
--    model). The new 1-arg version just finalizes totals already saved via
--    set_handover_manual_totals.
DROP FUNCTION IF EXISTS public.submit_handover(uuid, numeric, text);
DROP FUNCTION IF EXISTS public.submit_handover(uuid, numeric);

CREATE OR REPLACE FUNCTION public.submit_handover(p_handover_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF NOT public.d_current_user_can_settle_handover(v_h.station_id) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;

  IF v_h.status <> 'ready_to_submit' THEN
    RAISE EXCEPTION 'EV-D invalid status for submit: % (set totals first)', v_h.status;
  END IF;

  IF (v_h.shortage_amount > 0.0005 OR v_h.surplus_amount > 0.0005)
     AND coalesce(btrim(v_h.discrepancy_reason), '') = '' THEN
    RAISE EXCEPTION 'EV-D discrepancy reason required: shortage=% surplus=%',
      v_h.shortage_amount, v_h.surplus_amount USING ERRCODE = '23514';
  END IF;

  UPDATE cash_handovers SET
    status = 'submitted',
    submitted_by = auth.uid(),
    submitted_at = now(),
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason, details)
  VALUES (
    p_handover_id, v_h.status, 'submitted', 'submit', auth.uid(), v_h.discrepancy_reason,
    jsonb_build_object(
      'cash_total', v_h.cash_total, 'cliq_total', v_h.cliq_total, 'card_total', v_h.card_total,
      'shortage_amount', v_h.shortage_amount, 'surplus_amount', v_h.surplus_amount
    )
  );

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_submit', 'cash_handovers', p_handover_id,
    jsonb_build_object(
      'cash_total', v_h.cash_total, 'cliq_total', v_h.cliq_total, 'card_total', v_h.card_total,
      'shortage_amount', v_h.shortage_amount, 'surplus_amount', v_h.surplus_amount,
      'discrepancy_reason', v_h.discrepancy_reason
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', 'submitted');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_handover(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_handover(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_handover(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.submit_handover(uuid) IS
  'Manual Shift Cash Settlement: finalizes a handover whose Cash/CliQ/Card totals were already saved via set_handover_manual_totals (status must be ready_to_submit).';
