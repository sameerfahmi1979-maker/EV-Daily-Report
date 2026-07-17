-- Admin hard-delete: system_admin-only, irreversible, force-deletes a shift
-- or an import batch and every row in every table that descends from it
-- (sessions, billing, breakdown, payment allocations, cash handovers +
-- their sessions/adjustments/events, historical correction queue/archive,
-- historical payment classification queue, engine metadata repair log).
--
-- By explicit decision: this bypasses the locked-handover protection used
-- everywhere else in the system (cash handovers are deleted unconditionally,
-- not only when unlocked), and does NOT write an audit_log entry — no record
-- of the deletion is kept anywhere. This is a deliberate exception to the
-- immutable-audit-trail design used by every other destructive action in
-- this codebase; only use for genuine, intentional data removal.

CREATE OR REPLACE FUNCTION public.f_assert_admin_hard_delete()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.current_user_role() = ANY(ARRAY['system_admin', 'global_admin'])) THEN
    RAISE EXCEPTION 'denied: only a System Administrator can permanently delete a shift or upload' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.f_assert_admin_hard_delete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_assert_admin_hard_delete() TO authenticated, service_role;

-- Internal helper: deletes every descendant row for a given set of session
-- ids, in an order that satisfies the existing FK/trigger graph without
-- needing to disable any trigger — handover links are always removed first
-- (regardless of lock status), so the locked-handover guard triggers on
-- billing_calculations/billing_breakdown_items/charging_sessions never see a
-- lock by the time those rows are deleted.
CREATE OR REPLACE FUNCTION public.f_admin_force_delete_sessions(p_session_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_handover_count int := 0;
  v_session_count int := 0;
  v_billing_count int := 0;
BEGIN
  IF p_session_ids IS NULL OR array_length(p_session_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('sessions_deleted', 0, 'handovers_deleted', 0, 'billing_deleted', 0);
  END IF;

  -- Cash handovers touching any of these sessions (cascades to
  -- cash_handover_sessions / cash_handover_adjustments / cash_handover_events).
  WITH del AS (
    DELETE FROM cash_handovers h
    WHERE h.id IN (
      SELECT DISTINCT chs.handover_id FROM cash_handover_sessions chs
      WHERE chs.session_id = ANY(p_session_ids)
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_handover_count FROM del;

  -- Phase F governance rows referencing these sessions/billing (no useful
  -- cascade to rely on; delete explicitly so nothing survives).
  DELETE FROM historical_correction_archive
  WHERE correction_id IN (SELECT id FROM historical_correction_queue WHERE session_id = ANY(p_session_ids))
     OR session_id = ANY(p_session_ids);
  DELETE FROM historical_correction_queue WHERE session_id = ANY(p_session_ids);
  DELETE FROM historical_payment_classification_queue WHERE session_id = ANY(p_session_ids);
  DELETE FROM engine_metadata_repair_log WHERE session_id = ANY(p_session_ids);

  -- Payment allocations and billing breakdown (also covered by CASCADE from
  -- billing_calculations, deleted explicitly here for a self-contained,
  -- order-independent function).
  DELETE FROM session_payment_allocations WHERE session_id = ANY(p_session_ids);
  DELETE FROM billing_breakdown_items bbi
  USING billing_calculations bc
  WHERE bbi.billing_calculation_id = bc.id AND bc.session_id = ANY(p_session_ids);

  WITH del AS (
    DELETE FROM billing_calculations WHERE session_id = ANY(p_session_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_billing_count FROM del;

  WITH del AS (
    DELETE FROM charging_sessions WHERE id = ANY(p_session_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_session_count FROM del;

  RETURN jsonb_build_object(
    'sessions_deleted', v_session_count,
    'handovers_deleted', v_handover_count,
    'billing_deleted', v_billing_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.f_admin_force_delete_sessions(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.f_admin_force_delete_sessions(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_force_delete_shift(p_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_ids uuid[];
  v_result jsonb;
  v_shift_existed boolean;
BEGIN
  PERFORM public.f_assert_admin_hard_delete();

  SELECT EXISTS (SELECT 1 FROM shifts WHERE id = p_shift_id) INTO v_shift_existed;
  IF NOT v_shift_existed THEN
    RAISE EXCEPTION 'shift not found';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_session_ids FROM charging_sessions WHERE shift_id = p_shift_id;

  v_result := public.f_admin_force_delete_sessions(v_session_ids);

  -- Any handover recorded directly against this shift but with no surviving
  -- session link (defensive — should already be covered above).
  DELETE FROM cash_handovers WHERE shift_id = p_shift_id;

  DELETE FROM shifts WHERE id = p_shift_id;

  RETURN v_result || jsonb_build_object('shift_id', p_shift_id, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_delete_shift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_shift(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_force_delete_import_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session_ids uuid[];
  v_shift_ids uuid[];
  v_result jsonb;
  v_batch_existed boolean;
  v_shift_count int := 0;
BEGIN
  PERFORM public.f_assert_admin_hard_delete();

  SELECT EXISTS (SELECT 1 FROM import_batches WHERE id = p_batch_id) INTO v_batch_existed;
  IF NOT v_batch_existed THEN
    RAISE EXCEPTION 'import batch not found';
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_session_ids FROM charging_sessions WHERE import_batch_id = p_batch_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_shift_ids FROM shifts WHERE import_batch_id = p_batch_id;

  v_result := public.f_admin_force_delete_sessions(v_session_ids);

  -- Billing rows tagged to this batch by source_import_batch_id even if their
  -- session_id didn't carry import_batch_id (defensive, e.g. recalculated
  -- rows that kept the original batch tag).
  DELETE FROM historical_payment_classification_queue WHERE batch_id = p_batch_id;
  DELETE FROM billing_breakdown_items bbi
  USING billing_calculations bc
  WHERE bbi.billing_calculation_id = bc.id AND bc.source_import_batch_id = p_batch_id;
  DELETE FROM billing_calculations WHERE source_import_batch_id = p_batch_id;

  -- Handovers tied directly to shifts from this batch (defensive; sessions
  -- path above already removes handovers reachable via session links).
  DELETE FROM cash_handovers WHERE shift_id = ANY(v_shift_ids);

  WITH del AS (
    DELETE FROM shifts WHERE id = ANY(v_shift_ids)
    RETURNING 1
  )
  SELECT count(*) INTO v_shift_count FROM del;

  DELETE FROM import_batches WHERE id = p_batch_id;

  RETURN v_result || jsonb_build_object('batch_id', p_batch_id, 'shifts_deleted', v_shift_count, 'deleted', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_delete_import_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_import_batch(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_force_delete_shift(uuid) IS
  'System Administrator-only irreversible hard delete of a shift and every descendant row (sessions, billing, payments, handovers, correction/classification history). Bypasses locked-handover protection. Writes no audit_log entry.';
COMMENT ON FUNCTION public.admin_force_delete_import_batch(uuid) IS
  'System Administrator-only irreversible hard delete of an import batch and every descendant row (shifts, sessions, billing, payments, handovers, correction/classification history). Bypasses locked-handover protection. Writes no audit_log entry.';
