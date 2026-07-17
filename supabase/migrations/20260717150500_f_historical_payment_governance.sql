-- EV-F Migration 6/9: Historical payment classification governance.
-- Never defaults history to Cash. Unknown/Deferred are first-class, non-guessed
-- states, explicitly excluded from finalized physical cash by simply not
-- writing an active session_payment_allocations row for them.

CREATE TABLE IF NOT EXISTS public.historical_payment_classification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('session', 'batch')),
  session_id uuid REFERENCES public.charging_sessions(id),
  batch_id uuid REFERENCES public.import_batches(id),
  station_id uuid REFERENCES public.stations(id),
  proposed_classification text NOT NULL CHECK (proposed_classification IN (
    'Cash', 'Card', 'CliQ', 'Unknown', 'NotApplicable', 'Deferred'
  )),
  evidence_source text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  notes text,
  affected_session_count integer NOT NULL DEFAULT 1,
  affected_total_amount numeric(14,3),
  status text NOT NULL DEFAULT 'identified' CHECK (status IN (
    'identified', 'review_required', 'approved', 'rejected', 'deferred',
    'applying', 'applied', 'failed', 'rolled_back'
  )),
  rejection_reason text,
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  applied_by uuid,
  applied_at timestamptz,
  rolled_back_by uuid,
  rolled_back_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'session' AND session_id IS NOT NULL) OR (scope = 'batch' AND batch_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_hpcq_session ON public.historical_payment_classification_queue (session_id);
CREATE INDEX IF NOT EXISTS idx_hpcq_batch ON public.historical_payment_classification_queue (batch_id);
CREATE INDEX IF NOT EXISTS idx_hpcq_status ON public.historical_payment_classification_queue (status);

ALTER TABLE public.historical_payment_classification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hpcq_select ON public.historical_payment_classification_queue;
CREATE POLICY hpcq_select ON public.historical_payment_classification_queue
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_approved()
    AND (
      public.current_user_is_system_admin()
      OR public.current_user_is_operations_manager()
      OR (
        public.current_user_role() IN ('accountant', 'station_manager', 'import_officer', 'report_viewer')
        AND (station_id IS NULL OR public.current_user_has_station_access(station_id))
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.historical_payment_classification_queue FROM anon, authenticated;

-- Proposal: evidence required, batch-level only when evidence proves a single method.
CREATE OR REPLACE FUNCTION public.propose_historical_payment_classification(
  p_scope text,
  p_session_id uuid,
  p_batch_id uuid,
  p_classification text,
  p_evidence_source text,
  p_evidence jsonb,
  p_confidence text DEFAULT 'medium',
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_station_id uuid;
  v_count int;
  v_total numeric;
  v_id uuid;
  v_evidence_source text;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_payment_classification_enabled');
  PERFORM public.f_assert_correction_role(false);

  v_evidence_source := nullif(btrim(coalesce(p_evidence_source, '')), '');
  IF v_evidence_source IS NULL THEN
    RAISE EXCEPTION 'EV-F evidence_source required — historical payment method must never be guessed';
  END IF;
  IF p_classification NOT IN ('Cash', 'Card', 'CliQ', 'Unknown', 'NotApplicable', 'Deferred') THEN
    RAISE EXCEPTION 'EV-F invalid classification';
  END IF;

  IF p_scope = 'session' THEN
    SELECT station_id INTO v_station_id FROM charging_sessions WHERE id = p_session_id;
    IF v_station_id IS NULL AND NOT EXISTS (SELECT 1 FROM charging_sessions WHERE id = p_session_id) THEN
      RAISE EXCEPTION 'EV-F session not found';
    END IF;
    v_count := 1;
    SELECT lb.total_amount INTO v_total
    FROM billing_calculations lb WHERE lb.session_id = p_session_id
    ORDER BY lb.calculated_at DESC NULLS LAST, lb.created_at DESC LIMIT 1;
  ELSIF p_scope = 'batch' THEN
    SELECT station_id INTO v_station_id FROM import_batches WHERE id = p_batch_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'EV-F batch not found'; END IF;

    SELECT count(*), coalesce(sum(bc.total_amount), 0) INTO v_count, v_total
    FROM charging_sessions cs
    LEFT JOIN LATERAL (
      SELECT bc.total_amount FROM billing_calculations bc WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
    ) bc ON true
    WHERE cs.import_batch_id = p_batch_id;

    -- Batch-level proposal is only valid when the evidence explicitly claims a
    -- single uniform method for every session in the batch; mixed-method
    -- evidence must be reviewed per-transaction instead.
    IF p_classification IN ('Cash', 'Card', 'CliQ') AND coalesce((p_evidence->>'uniform_method_confirmed')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'EV-F batch-level Cash/Card/CliQ proposal requires evidence.uniform_method_confirmed=true; use per-transaction review for mixed batches';
    END IF;
  ELSE
    RAISE EXCEPTION 'EV-F invalid scope';
  END IF;

  IF v_station_id IS NOT NULL AND NOT public.report_current_role_is_global()
     AND NOT public.current_user_has_station_access(v_station_id) THEN
    RAISE EXCEPTION 'EV-F denied: station scope' USING ERRCODE = '42501';
  END IF;

  INSERT INTO historical_payment_classification_queue (
    scope, session_id, batch_id, station_id, proposed_classification,
    evidence_source, evidence, confidence, notes, affected_session_count, affected_total_amount,
    submitted_by
  ) VALUES (
    p_scope, p_session_id, p_batch_id, v_station_id, p_classification,
    v_evidence_source, coalesce(p_evidence, '{}'::jsonb), coalesce(p_confidence, 'medium'), p_notes,
    v_count, v_total, auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_payment_classification_propose', 'historical_payment_classification_queue', v_id,
    jsonb_build_object('scope', p_scope, 'classification', p_classification, 'affected_count', v_count));

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'affected_session_count', v_count, 'affected_total_amount', v_total, 'status', 'identified');
END;
$$;

REVOKE ALL ON FUNCTION public.propose_historical_payment_classification(text, uuid, uuid, text, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propose_historical_payment_classification(text, uuid, uuid, text, text, jsonb, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.propose_historical_payment_classification(text, uuid, uuid, text, text, jsonb, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_historical_payment_classification(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_payment_classification_queue%ROWTYPE;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_payment_classification_enabled');
  PERFORM public.f_assert_correction_role(true);

  SELECT * INTO v_row FROM historical_payment_classification_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F classification proposal not found'; END IF;
  IF v_row.submitted_by = auth.uid() AND NOT public.current_user_is_system_admin() THEN
    RAISE EXCEPTION 'EV-F denied: cannot approve own proposal' USING ERRCODE = '42501';
  END IF;
  IF v_row.status NOT IN ('identified', 'review_required') THEN
    RAISE EXCEPTION 'EV-F invalid status for approve: %', v_row.status;
  END IF;

  UPDATE historical_payment_classification_queue
  SET status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION public.approve_historical_payment_classification(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_historical_payment_classification(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_historical_payment_classification(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_historical_payment_classification(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_payment_classification_queue%ROWTYPE;
  v_reason text;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_payment_classification_enabled');
  PERFORM public.f_assert_correction_role(true);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F rejection reason required'; END IF;

  SELECT * INTO v_row FROM historical_payment_classification_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F classification proposal not found'; END IF;
  IF v_row.status NOT IN ('identified', 'review_required') THEN
    RAISE EXCEPTION 'EV-F invalid status for reject: %', v_row.status;
  END IF;

  UPDATE historical_payment_classification_queue
  SET status = 'rejected', rejection_reason = v_reason, updated_at = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION public.reject_historical_payment_classification(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_historical_payment_classification(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_historical_payment_classification(uuid, text) TO authenticated, service_role;

-- Apply: only for Cash/Card/CliQ does an actual session_payment_allocations row
-- get written (assignment_source='historical_classification'). Unknown/
-- NotApplicable/Deferred are recorded as a governance decision only — no
-- allocation is created, so those sessions remain correctly excluded from
-- finalized physical cash (same "unassigned" treatment Reporting v2 already
-- uses) without any special-case reporting logic required.
CREATE OR REPLACE FUNCTION public.apply_historical_payment_classification(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_payment_classification_queue%ROWTYPE;
  v_session RECORD;
  v_applied_count int := 0;
  v_skipped_count int := 0;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_payment_classification_enabled');
  PERFORM public.f_assert_correction_role(true);

  SELECT * INTO v_row FROM historical_payment_classification_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F classification proposal not found'; END IF;
  IF v_row.status <> 'approved' THEN
    RAISE EXCEPTION 'EV-F invalid status for apply: %', v_row.status;
  END IF;

  UPDATE historical_payment_classification_queue SET status = 'applying', updated_at = now() WHERE id = p_id;

  BEGIN
    FOR v_session IN
      SELECT cs.id AS session_id, lb.id AS billing_id, lb.total_amount
      FROM charging_sessions cs
      LEFT JOIN LATERAL (
        SELECT bc.id, bc.total_amount FROM billing_calculations bc WHERE bc.session_id = cs.id
        ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
      ) lb ON true
      WHERE (v_row.scope = 'session' AND cs.id = v_row.session_id)
         OR (v_row.scope = 'batch' AND cs.import_batch_id = v_row.batch_id)
    LOOP
      IF public.session_in_locked_handover(v_session.session_id) THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      IF v_row.proposed_classification IN ('Cash', 'Card', 'CliQ') THEN
        IF v_session.billing_id IS NULL THEN
          v_skipped_count := v_skipped_count + 1;
          CONTINUE;
        END IF;
        UPDATE session_payment_allocations SET is_active = false, updated_at = now()
        WHERE session_id = v_session.session_id AND is_active = true;

        INSERT INTO session_payment_allocations (
          session_id, billing_calculation_id, payment_method, amount_jod,
          assignment_source, notes, assigned_by
        ) VALUES (
          v_session.session_id, v_session.billing_id, v_row.proposed_classification, v_session.total_amount,
          'historical_classification', 'EV-F: ' || v_row.evidence_source, auth.uid()
        );
      END IF;
      -- Unknown/NotApplicable/Deferred: no allocation row written (see comment above).

      v_applied_count := v_applied_count + 1;
    END LOOP;

    UPDATE historical_payment_classification_queue
    SET status = 'applied', applied_by = auth.uid(), applied_at = now(), updated_at = now(), failure_reason = NULL
    WHERE id = p_id;

    INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'historical_payment_classification_apply', 'historical_payment_classification_queue', p_id,
      jsonb_build_object('classification', v_row.proposed_classification, 'applied_count', v_applied_count, 'skipped_locked_or_unbilled', v_skipped_count));

    RETURN jsonb_build_object('ok', true, 'status', 'applied', 'applied_count', v_applied_count, 'skipped_count', v_skipped_count);
  EXCEPTION WHEN OTHERS THEN
    UPDATE historical_payment_classification_queue
    SET status = 'failed', failure_reason = SQLERRM, updated_at = now()
    WHERE id = p_id;
    RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_historical_payment_classification(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_historical_payment_classification(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_historical_payment_classification(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rollback_historical_payment_classification(p_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row historical_payment_classification_queue%ROWTYPE;
  v_reason text;
  v_count int;
BEGIN
  PERFORM public.f_assert_flag_enabled('historical_payment_classification_enabled');
  PERFORM public.f_assert_correction_role(true);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F rollback reason required'; END IF;

  SELECT * INTO v_row FROM historical_payment_classification_queue WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F classification proposal not found'; END IF;
  IF v_row.status <> 'applied' THEN
    RAISE EXCEPTION 'EV-F can only roll back an applied classification (status=%)', v_row.status;
  END IF;

  UPDATE session_payment_allocations spa
  SET is_active = false, updated_at = now()
  FROM charging_sessions cs
  WHERE spa.session_id = cs.id
    AND spa.is_active = true
    AND spa.assignment_source = 'historical_classification'
    AND (
      (v_row.scope = 'session' AND cs.id = v_row.session_id)
      OR (v_row.scope = 'batch' AND cs.import_batch_id = v_row.batch_id)
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE historical_payment_classification_queue
  SET status = 'rolled_back', rolled_back_by = auth.uid(), rolled_back_at = now(), updated_at = now()
  WHERE id = p_id;

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'historical_payment_classification_rollback', 'historical_payment_classification_queue', p_id,
    jsonb_build_object('reason', v_reason, 'deactivated_allocations', v_count));

  RETURN jsonb_build_object('ok', true, 'status', 'rolled_back', 'deactivated_allocations', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_historical_payment_classification(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_historical_payment_classification(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.rollback_historical_payment_classification(uuid, text) TO authenticated, service_role;

COMMENT ON TABLE public.historical_payment_classification_queue IS
  'EV-F: governed proposal/approval workflow for retroactively classifying historical payment methods. Never defaults to Cash; Unknown/NotApplicable/Deferred write no allocation (stay unassigned).';
