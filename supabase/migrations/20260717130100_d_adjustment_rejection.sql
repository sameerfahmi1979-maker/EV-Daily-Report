-- EV-D-FINAL-CLOSURE Migration 2/4: adjustment rejection RPC + columns

ALTER TABLE public.cash_handover_adjustments
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- Harden create: require handover to exist, non-blank reason, and full audit/event trail.
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
  v_reason text;
BEGIN
  PERFORM public.d_assert_handover_workflow();

  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF v_h.status = 'locked' THEN
    RAISE EXCEPTION 'EV-D cannot adjust locked handover' USING ERRCODE = '55000';
  END IF;
  IF NOT public.current_user_has_station_access(v_h.station_id) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;
  IF p_cash_impact NOT IN ('increase', 'decrease') THEN
    RAISE EXCEPTION 'EV-D invalid cash_impact';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'EV-D adjustment amount must be positive';
  END IF;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'EV-D adjustment reason required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO cash_handover_adjustments (
    handover_id, adjustment_type, cash_impact, amount_jod, reason, evidence_reference, requested_by, status
  ) VALUES (
    p_handover_id, 'cash_adjustment', p_cash_impact, public.round_jod3(p_amount), v_reason, p_evidence, auth.uid(), 'pending'
  ) RETURNING id INTO v_id;

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason, details)
  VALUES (
    v_h.id, v_h.status, v_h.status, 'adjustment_create', auth.uid(), v_reason,
    jsonb_build_object('adjustment_id', v_id, 'amount', public.round_jod3(p_amount), 'cash_impact', p_cash_impact)
  );

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_adjustment_create', 'cash_handover_adjustments', v_id,
    jsonb_build_object('handover_id', v_h.id, 'amount', public.round_jod3(p_amount), 'cash_impact', p_cash_impact, 'reason', v_reason)
  );

  RETURN jsonb_build_object('ok', true, 'adjustment_id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_handover_adjustment(uuid, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_handover_adjustment(uuid, text, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_handover_adjustment(uuid, text, numeric, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_handover_adjustment(
  p_adjustment_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_adj public.cash_handover_adjustments%ROWTYPE;
  v_h public.cash_handovers%ROWTYPE;
  v_reason text;
BEGIN
  PERFORM public.d_assert_handover_workflow();

  SELECT * INTO v_adj FROM cash_handover_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D adjustment not found'; END IF;

  SELECT * INTO v_h FROM cash_handovers WHERE id = v_adj.handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied: reject role' USING ERRCODE = '42501';
  END IF;

  IF v_h.status = 'locked' THEN
    RAISE EXCEPTION 'EV-D denied: handover locked' USING ERRCODE = '55000';
  END IF;

  IF v_adj.status <> 'pending' THEN
    RAISE EXCEPTION 'EV-D adjustment is not pending (status=%)', v_adj.status;
  END IF;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'EV-D rejection reason required' USING ERRCODE = '23514';
  END IF;

  UPDATE cash_handover_adjustments SET
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = v_reason
  WHERE id = p_adjustment_id;

  -- No effect on totals: refresh_handover_totals only sums status='approved'.
  PERFORM public.refresh_handover_totals(v_h.id);

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, reason, details)
  VALUES (
    v_h.id, v_h.status, v_h.status, 'adjustment_reject', auth.uid(), v_reason,
    jsonb_build_object('adjustment_id', p_adjustment_id, 'amount', v_adj.amount_jod, 'cash_impact', v_adj.cash_impact)
  );

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_adjustment_reject', 'cash_handover_adjustments', p_adjustment_id,
    jsonb_build_object('handover_id', v_h.id, 'reason', v_reason, 'amount', v_adj.amount_jod)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_handover_adjustment(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_handover_adjustment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_handover_adjustment(uuid, text) TO authenticated, service_role;

-- Tighten approve/create adjustment: require non-empty reason for create (already NOT NULL on `reason`
-- column, but enforce non-blank), and forbid self-created-adjustment self-approval by anyone other
-- than system_admin performing an explicit emergency action.
CREATE OR REPLACE FUNCTION public.approve_handover_adjustment(p_adjustment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_adj public.cash_handover_adjustments%ROWTYPE;
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_adj FROM cash_handover_adjustments WHERE id = p_adjustment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D adjustment not found'; END IF;

  SELECT * INTO v_h FROM cash_handovers WHERE id = v_adj.handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-D handover not found'; END IF;

  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_is_operations_manager()
    OR public.current_user_role() = 'accountant'
  ) THEN
    RAISE EXCEPTION 'EV-D denied' USING ERRCODE = '42501';
  END IF;

  IF v_adj.requested_by = auth.uid() AND NOT public.current_user_is_system_admin() THEN
    RAISE EXCEPTION 'EV-D denied: cannot approve own adjustment' USING ERRCODE = '42501';
  END IF;

  IF v_h.status = 'locked' THEN
    RAISE EXCEPTION 'EV-D cannot approve adjustment on locked handover' USING ERRCODE = '55000';
  END IF;

  IF v_adj.status <> 'pending' THEN
    RAISE EXCEPTION 'EV-D adjustment is not pending (status=%)', v_adj.status;
  END IF;

  UPDATE cash_handover_adjustments SET
    status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = p_adjustment_id;

  PERFORM public.refresh_handover_totals(v_h.id);

  INSERT INTO cash_handover_events (handover_id, from_status, to_status, action, actor_id, details)
  VALUES (
    v_h.id, v_h.status, v_h.status, 'adjustment_approve', auth.uid(),
    jsonb_build_object('adjustment_id', p_adjustment_id, 'amount', v_adj.amount_jod, 'cash_impact', v_adj.cash_impact,
      'requested_by', v_adj.requested_by)
  );

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'handover_adjustment_approve', 'cash_handover_adjustments', p_adjustment_id,
    jsonb_build_object('handover_id', v_h.id, 'amount', v_adj.amount_jod, 'requested_by', v_adj.requested_by)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_handover_adjustment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_handover_adjustment(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_handover_adjustment(uuid) TO authenticated, service_role;
