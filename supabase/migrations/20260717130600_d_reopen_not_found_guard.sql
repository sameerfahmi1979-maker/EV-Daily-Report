-- EV-D-FINAL-CLOSURE minor robustness fix: reopen_handover had no explicit "not found"
-- check. With a non-existent handover id, an authorized caller with a non-blank reason
-- fell through to an UPDATE affecting 0 rows, then an INSERT into cash_handover_events
-- that only failed by accident via its foreign key constraint (confusing error message,
-- though still safely denied/no-op overall). Add an explicit, clear guard.

CREATE OR REPLACE FUNCTION public.reopen_handover(p_handover_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_h public.cash_handovers%ROWTYPE;
BEGIN
  PERFORM public.d_assert_handover_workflow();
  SELECT * INTO v_h FROM cash_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-D handover not found';
  END IF;

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

REVOKE ALL ON FUNCTION public.reopen_handover(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_handover(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reopen_handover(uuid, text) TO authenticated, service_role;
