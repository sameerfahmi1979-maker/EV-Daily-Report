-- EV-C Migration 6/6: RPC security grants + cancel/reprocess helpers

REVOKE ALL ON FUNCTION public.normalize_operator_card(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_operator_card(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.resolve_operator_match_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_operator_match_status(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.post_import_batch_v2(uuid, uuid, uuid, text, jsonb, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_import_batch_v2(uuid, uuid, uuid, text, jsonb, boolean, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_unposted_import_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.import_batches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-C denied: authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_batch FROM public.import_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EV-C batch not found';
  END IF;

  IF v_batch.station_id IS NOT NULL AND NOT public.current_user_can_import(v_batch.station_id) THEN
    RAISE EXCEPTION 'EV-C denied: not permitted for station' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'EV-C denied: user not approved' USING ERRCODE = '42501';
  END IF;

  IF v_batch.status IN ('posted', 'completed', 'completed_with_errors', 'partially_posted') THEN
    RAISE EXCEPTION 'EV-C cannot cancel a posted financial batch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.charging_sessions cs WHERE cs.import_batch_id = p_batch_id
  ) THEN
    RAISE EXCEPTION 'EV-C cannot cancel batch with sessions; use authorized rollback path';
  END IF;

  UPDATE public.import_batches
  SET status = 'cancelled',
      posting_completed_at = now(),
      failure_reason = coalesce(failure_reason, 'cancelled_before_post')
  WHERE id = p_batch_id;

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'import_cancel_unposted', 'import_batch', p_batch_id,
    jsonb_build_object('prior_status', v_batch.status)
  );

  RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_unposted_import_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_unposted_import_batch(uuid) TO authenticated, service_role;

-- Harden: ensure anon cannot execute Phase C posting
REVOKE EXECUTE ON FUNCTION public.post_import_batch_v2(uuid, uuid, uuid, text, jsonb, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_unposted_import_batch(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_operator_match_status(uuid, text, text) FROM anon;
