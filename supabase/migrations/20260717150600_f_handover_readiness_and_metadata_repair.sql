-- EV-F Migration 7/9: Historical handover-readiness reporting + engine-version
-- metadata repair workflow. Never auto-creates historical handovers.

CREATE OR REPLACE FUNCTION public.report_historical_handover_readiness(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 100,
  p_page_offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid,
  transaction_id text,
  station_id uuid,
  start_ts timestamptz,
  billing_total numeric,
  payment_status text,
  handover_status text,
  readiness text,
  blockers text[],
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_size integer := LEAST(coalesce(p_page_size, 100), 500);
BEGIN
  PERFORM public.report_assert_access(p_station_id);
  PERFORM public.report_assert_date_range(p_start, p_end);

  RETURN QUERY
  WITH base AS (
    SELECT
      cs.id AS session_id,
      cs.transaction_id,
      cs.station_id,
      cs.start_ts,
      cs.operator_id,
      cs.shift_id,
      lb.total_amount AS billing_total,
      spa.id AS allocation_id,
      chs.handover_id
    FROM charging_sessions cs
    LEFT JOIN LATERAL (
      SELECT bc.total_amount FROM billing_calculations bc WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
    ) lb ON true
    LEFT JOIN session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    LEFT JOIN cash_handover_sessions chs ON chs.session_id = cs.id
    WHERE cs.start_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
  ),
  classified AS (
    SELECT
      b.*,
      CASE WHEN b.billing_total IS NULL THEN 'missing_billing' WHEN b.allocation_id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END AS payment_status,
      CASE WHEN b.handover_id IS NOT NULL THEN 'included' ELSE 'not_included' END AS ho_status,
      array_remove(ARRAY[
        CASE WHEN b.shift_id IS NULL THEN 'missing_shift' END,
        CASE WHEN b.operator_id IS NULL THEN 'missing_operator' END,
        CASE WHEN b.billing_total IS NULL THEN 'missing_billing' END,
        CASE WHEN b.allocation_id IS NULL AND b.billing_total IS NOT NULL THEN 'missing_payment' END
      ], NULL) AS blockers
    FROM base b
  )
  SELECT
    c.session_id, c.transaction_id, c.station_id, c.start_ts, c.billing_total,
    c.payment_status, c.ho_status,
    CASE
      WHEN c.handover_id IS NOT NULL THEN 'already_included'
      WHEN array_length(c.blockers, 1) IS NULL OR array_length(c.blockers, 1) = 0 THEN 'eligible'
      ELSE 'blocked'
    END AS readiness,
    c.blockers,
    count(*) OVER () AS total_count
  FROM classified c
  ORDER BY c.start_ts DESC
  LIMIT v_capped_size OFFSET coalesce(p_page_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.report_historical_handover_readiness(date, date, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_historical_handover_readiness(date, date, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_historical_handover_readiness(date, date, uuid, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.report_historical_handover_readiness(date, date, uuid, integer, integer) IS
  'EV-F: read-only handover-readiness report. Never creates a handover — purely surfaces eligible/blocked/already-included sessions for manual, operator-scoped handover creation via the existing Phase D workflow.';

-- Engine-version metadata repair: evidence-based only, never inferred from
-- totals matching alone.
CREATE TABLE IF NOT EXISTS public.engine_metadata_repair_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id uuid NOT NULL REFERENCES public.billing_calculations(id),
  session_id uuid NOT NULL REFERENCES public.charging_sessions(id),
  previous_engine_version text,
  inferred_engine_version text NOT NULL,
  inference_basis text NOT NULL CHECK (inference_basis IN (
    'truly_legacy', 'v2_missing_metadata', 'import_path_omitted_metadata', 'pre_metadata_import', 'cannot_determine'
  )),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  reason text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emrl_billing ON public.engine_metadata_repair_log (billing_id);
CREATE INDEX IF NOT EXISTS idx_emrl_session ON public.engine_metadata_repair_log (session_id);

ALTER TABLE public.engine_metadata_repair_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS emrl_select ON public.engine_metadata_repair_log;
CREATE POLICY emrl_select ON public.engine_metadata_repair_log
  FOR SELECT TO authenticated
  USING (public.current_user_is_approved() AND (public.current_user_is_system_admin() OR public.current_user_is_operations_manager() OR public.current_user_role() = 'accountant'));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.engine_metadata_repair_log FROM anon, authenticated;

-- Investigate + classify a NULL-engine-version billing row (read-only; does not write).
CREATE OR REPLACE FUNCTION public.investigate_engine_metadata(p_billing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_billing public.billing_calculations%ROWTYPE;
  v_preview jsonb;
  v_basis text;
  v_confidence text;
BEGIN
  SELECT * INTO v_billing FROM billing_calculations WHERE id = p_billing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'billing_row_not_found');
  END IF;
  IF v_billing.calculation_engine_version IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'engine_version_already_present', 'current', v_billing.calculation_engine_version);
  END IF;

  v_preview := public.f_compute_v2_billing_preview(v_billing.session_id);

  IF (v_preview->>'ok')::boolean IS NOT TRUE THEN
    v_basis := 'cannot_determine';
    v_confidence := 'low';
  ELSIF abs(v_billing.total_amount - (v_preview->>'expected_total_amount')::numeric) <= 0.001
        AND v_billing.calculation_method = 'proportional_duration_split' THEN
    -- Matches v2 math exactly AND uses the v2 calculation method label — strong
    -- evidence this row WAS produced by the v2 engine before version-tagging
    -- was added (not merely a coincidental total match from a different method).
    v_basis := 'v2_missing_metadata';
    v_confidence := 'high';
  ELSIF abs(v_billing.total_amount - (v_preview->>'expected_total_amount')::numeric) <= 0.001 THEN
    -- Totals match but calculation_method doesn't confirm v2 — could be
    -- coincidental. Do not assume v2 from totals alone.
    v_basis := 'cannot_determine';
    v_confidence := 'low';
  ELSIF v_billing.created_at < '2026-07-16'::date THEN
    v_basis := 'pre_metadata_import';
    v_confidence := 'medium';
  ELSE
    v_basis := 'truly_legacy';
    v_confidence := 'medium';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'billing_id', p_billing_id,
    'session_id', v_billing.session_id,
    'current_engine_version', v_billing.calculation_engine_version,
    'calculation_method', v_billing.calculation_method,
    'inferred_engine_version', CASE WHEN v_basis = 'v2_missing_metadata' THEN 'ev-b-v2.0.0' ELSE NULL END,
    'inference_basis', v_basis,
    'confidence', v_confidence,
    'comparison', v_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.investigate_engine_metadata(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.investigate_engine_metadata(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.investigate_engine_metadata(uuid) TO authenticated, service_role;

-- Backfill only when evidence is sufficient (high or medium confidence with a
-- non-'cannot_determine' basis). Never labels unknown rows as v2 based only on
-- matching totals (investigate_engine_metadata already enforces this by also
-- requiring the v2 calculation_method label before proposing 'v2_missing_metadata').
CREATE OR REPLACE FUNCTION public.apply_engine_metadata_repair(
  p_billing_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_investigation jsonb;
  v_billing public.billing_calculations%ROWTYPE;
  v_reason text;
BEGIN
  PERFORM public.f_assert_correction_role(true);

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN RAISE EXCEPTION 'EV-F reason required for metadata repair'; END IF;

  SELECT * INTO v_billing FROM billing_calculations WHERE id = p_billing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EV-F billing row not found'; END IF;

  IF public.session_in_locked_handover(v_billing.session_id) THEN
    RAISE EXCEPTION 'EV-F denied: session is in a locked handover' USING ERRCODE = '55000';
  END IF;

  v_investigation := public.investigate_engine_metadata(p_billing_id);
  IF (v_investigation->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'EV-F cannot repair: %', v_investigation->>'reason';
  END IF;
  IF v_investigation->>'inference_basis' <> 'v2_missing_metadata' OR v_investigation->>'confidence' <> 'high' THEN
    RAISE EXCEPTION 'EV-F denied: insufficient evidence for automated backfill (basis=%, confidence=%). Use manual correction workflow instead.',
      v_investigation->>'inference_basis', v_investigation->>'confidence';
  END IF;

  UPDATE billing_calculations
  SET calculation_engine_version = v_investigation->>'inferred_engine_version'
  WHERE id = p_billing_id;

  INSERT INTO engine_metadata_repair_log (
    billing_id, session_id, previous_engine_version, inferred_engine_version,
    inference_basis, confidence, reason, applied, actor_id
  ) VALUES (
    p_billing_id, v_billing.session_id, v_billing.calculation_engine_version,
    v_investigation->>'inferred_engine_version', v_investigation->>'inference_basis',
    v_investigation->>'confidence', v_reason, true, auth.uid()
  );

  INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'engine_metadata_repair', 'billing_calculations', p_billing_id,
    jsonb_build_object('inferred', v_investigation->>'inferred_engine_version', 'basis', v_investigation->>'inference_basis', 'reason', v_reason));

  RETURN jsonb_build_object('ok', true, 'billing_id', p_billing_id, 'new_engine_version', v_investigation->>'inferred_engine_version');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_engine_metadata_repair(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_engine_metadata_repair(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_engine_metadata_repair(uuid, text) TO authenticated, service_role;
