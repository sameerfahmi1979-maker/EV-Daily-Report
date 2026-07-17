-- EV-D-FINAL-CLOSURE Migration 1/4: mandatory discrepancy reason on shortage/surplus

ALTER TABLE public.cash_handovers
  ADD COLUMN IF NOT EXISTS discrepancy_reason text;

COMMENT ON COLUMN public.cash_handovers.discrepancy_reason IS
  'EV-D-FINAL-CLOSURE: required when shortage_amount>0 or surplus_amount>0 at submit time';

-- Replace submit_handover to require and store a discrepancy reason whenever
-- shortage or surplus is non-zero. Old 2-arg signature is dropped so no
-- legacy call path can bypass the new requirement.
DROP FUNCTION IF EXISTS public.submit_handover(uuid, numeric);

CREATE OR REPLACE FUNCTION public.submit_handover(
  p_handover_id uuid,
  p_actual_cash_received numeric,
  p_discrepancy_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
  v_tot jsonb;
  v_reason text;
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

  v_reason := nullif(btrim(coalesce(p_discrepancy_reason, '')), '');

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

  -- Mandatory discrepancy reason whenever shortage or surplus is non-zero.
  IF (v_h.shortage_amount > 0.0005 OR v_h.surplus_amount > 0.0005) AND v_reason IS NULL THEN
    RAISE EXCEPTION 'EV-D discrepancy reason required: shortage=% surplus=%',
      v_h.shortage_amount, v_h.surplus_amount USING ERRCODE = '23514';
  END IF;

  UPDATE cash_handovers SET
    status = 'submitted',
    submitted_by = auth.uid(),
    submitted_at = now(),
    discrepancy_reason = v_reason,
    updated_at = now()
  WHERE id = p_handover_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason, details)
  VALUES (
    p_handover_id, v_h.status, 'submitted', 'submit', auth.uid(), v_reason,
    v_tot || jsonb_build_object(
      'actual_cash_received', v_h.actual_cash_received,
      'shortage_amount', v_h.shortage_amount,
      'surplus_amount', v_h.surplus_amount,
      'discrepancy_reason', v_reason
    )
  );

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_submit', 'cash_handovers', p_handover_id,
    jsonb_build_object(
      'actual_cash_received', v_h.actual_cash_received,
      'shortage_amount', v_h.shortage_amount,
      'surplus_amount', v_h.surplus_amount,
      'discrepancy_reason', v_reason
    )
  );

  RETURN jsonb_build_object('ok', true, 'status', 'submitted', 'totals', v_tot, 'discrepancy_reason', v_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_handover(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_handover(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_handover(uuid, numeric, text) TO authenticated, service_role;
