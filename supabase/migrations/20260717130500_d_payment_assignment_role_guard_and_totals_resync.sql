-- EV-D-FINAL-CLOSURE fix: two defects found during role-matrix UAT.
--
-- Defect 1 (security): assign_session_payment_method only checked station access, not
-- role. Since Report Viewer users legitimately have a user_station_access row (for
-- read-only reporting), current_user_has_station_access() returned true for them,
-- letting a Report Viewer assign/override a payment method — violating the Phase D
-- role matrix ("Report Viewer ... Cannot assign payment").
--
-- Defect 2 (correctness): refresh_handover_totals() aggregated straight from the
-- cash_handover_sessions snapshot taken at create_handover_draft time, and that
-- snapshot was never re-synced from session_payment_allocations afterward. Any
-- payment method assigned or overridden AFTER the draft was created (the exact,
-- intended "transaction override before lock" flow from the Phase D spec) was
-- invisible to totals/reconciliation, causing submit_handover to fail with
-- "payment allocation does not reconcile to billing" even though every session had
-- a valid, current, active allocation.

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

  IF NOT (
    public.current_user_can_import(v_session.station_id)
    OR (
      public.current_user_role() = 'accountant'
      AND public.current_user_has_station_access(v_session.station_id)
    )
  ) THEN
    RAISE EXCEPTION 'EV-D denied: role cannot assign payment method' USING ERRCODE = '42501';
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

  -- Keep any existing (non-locked) handover snapshot for this session in sync immediately.
  UPDATE cash_handover_sessions chs
  SET payment_method = p_payment_method,
      amount_jod = public.round_jod3(v_billing.total_amount),
      payment_allocation_id = v_id,
      billing_calculation_id = v_billing.id
  FROM cash_handovers h
  WHERE chs.handover_id = h.id
    AND chs.session_id = p_session_id
    AND h.status <> 'locked';

  PERFORM public.refresh_handover_totals(h.id)
  FROM cash_handovers h
  WHERE h.id IN (
    SELECT handover_id FROM cash_handover_sessions WHERE session_id = p_session_id
  ) AND h.status <> 'locked';

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'assign_payment_method', 'charging_sessions', p_session_id,
    jsonb_build_object('method', p_payment_method, 'amount', v_billing.total_amount, 'allocation_id', v_id));

  RETURN jsonb_build_object('ok', true, 'allocation_id', v_id, 'amount', public.round_jod3(v_billing.total_amount));
END;
$$;

REVOKE ALL ON FUNCTION public.assign_session_payment_method(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_session_payment_method(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_session_payment_method(uuid, text, text, text, text) TO authenticated, service_role;

-- refresh_handover_totals: resync the cash_handover_sessions snapshot from the live
-- session_payment_allocations before aggregating, so it always reflects current reality
-- (defense-in-depth on top of the immediate sync added above; also covers rows created
-- before this fix, or synced via any other path).
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

  IF v_h.status <> 'locked' THEN
    UPDATE cash_handover_sessions chs
    SET payment_method = coalesce(spa.payment_method, 'UNASSIGNED'),
        amount_jod = coalesce(public.round_jod3(bc.total_amount), chs.amount_jod),
        payment_allocation_id = spa.id,
        billing_calculation_id = coalesce(bc.id, chs.billing_calculation_id)
    FROM public.charging_sessions cs
    LEFT JOIN public.session_payment_allocations spa
      ON spa.session_id = cs.id AND spa.is_active = true
    LEFT JOIN public.billing_calculations bc
      ON bc.session_id = cs.id
      AND bc.id = (
        SELECT id FROM public.billing_calculations b2
        WHERE b2.session_id = cs.id
        ORDER BY b2.calculated_at DESC NULLS LAST, b2.created_at DESC
        LIMIT 1
      )
    WHERE chs.handover_id = p_handover_id
      AND chs.session_id = cs.id;
  END IF;

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
      WHERE spa.session_id = cs.id AND spa.is_active = true
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

REVOKE ALL ON FUNCTION public.refresh_handover_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_handover_totals(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.refresh_handover_totals(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_session_payment_method(uuid, text, text, text, text) IS
  'EV-D-FINAL-CLOSURE: now role-gated (import roles + accountant) and immediately re-syncs any existing non-locked handover snapshot.';
COMMENT ON FUNCTION public.refresh_handover_totals(uuid) IS
  'EV-D-FINAL-CLOSURE: resyncs cash_handover_sessions from live session_payment_allocations before aggregating (non-locked handovers only).';
