-- EV-F Migration 8/9: True server-side pagination + secondary filters for the
-- two heaviest Phase E reports (removes the PostgREST 1000-row default-cap
-- truncation risk flagged in the Phase E closure report), plus new historical
-- inventory / correction-queue / payment-classification-queue browsing RPCs.

-- Drop the old 3-arg Phase E overloads first so callers passing only
-- (p_start, p_end, p_station_id) cannot hit an "ambiguous function" error
-- against the new, wider-signature versions below.
DROP FUNCTION IF EXISTS public.report_billing_reconciliation(date, date, uuid);
DROP FUNCTION IF EXISTS public.report_exception_summary(date, date, uuid);

-- Harden report_billing_reconciliation: pagination + payment method / engine
-- version / exception status / locked filters.
CREATE OR REPLACE FUNCTION public.report_billing_reconciliation(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_engine_version text DEFAULT NULL,
  p_exception_status text DEFAULT NULL,
  p_locked boolean DEFAULT NULL,
  p_page_size integer DEFAULT 200,
  p_page_offset integer DEFAULT 0
)
RETURNS TABLE (
  session_id uuid, transaction_id text, station_id uuid, start_ts timestamptz, engine_version text,
  billing_source text, billing_total numeric, breakdown_sum numeric, difference numeric,
  demand_charge_sum numeric, taxes numeric, payment_method text, handover_id uuid, handover_number text,
  handover_locked boolean, exception_status text, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_size integer := LEAST(coalesce(p_page_size, 200), 500);
BEGIN
  PERFORM public.report_assert_access(p_station_id);
  PERFORM public.report_assert_date_range(p_start, p_end);

  RETURN QUERY
  WITH base AS (
    SELECT
      cs.id AS session_id, cs.transaction_id, cs.station_id, cs.start_ts,
      lb.calculation_engine_version AS engine_version, lb.billing_source, lb.total_amount AS billing_total,
      bbc.breakdown_sum, public.round_jod3(lb.total_amount - bbc.breakdown_sum) AS difference,
      bbc.demand_charge_sum, lb.taxes,
      coalesce(spa.payment_method, 'UNASSIGNED') AS payment_method,
      chs.handover_id, h.handover_number, (h.status = 'locked') AS handover_locked,
      CASE
        WHEN lb.billing_id IS NULL THEN 'billing_missing'
        WHEN abs(lb.total_amount - bbc.breakdown_sum) > 0.001 THEN 'breakdown_mismatch'
        WHEN coalesce(bbc.demand_charge_sum, 0) > 0 THEN 'non_zero_demand'
        WHEN coalesce(lb.taxes, 0) > 0 THEN 'non_zero_tax'
        WHEN lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2' THEN 'legacy_engine'
        WHEN spa.id IS NULL THEN 'unassigned_payment'
        ELSE 'reconciled'
      END AS exception_status
    FROM public.charging_sessions cs
    JOIN LATERAL (
      SELECT bc.id AS billing_id, bc.total_amount, bc.taxes, bc.calculation_engine_version, bc.billing_source
      FROM public.billing_calculations bc WHERE bc.session_id = cs.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
    ) lb ON true
    LEFT JOIN LATERAL (
      SELECT coalesce(sum(bbi.demand_charge), 0) AS demand_charge_sum,
             coalesce(sum(bbi.energy_charge), 0) + coalesce(sum(bbi.demand_charge), 0) AS breakdown_sum
      FROM public.billing_breakdown_items bbi WHERE bbi.billing_calculation_id = lb.billing_id
    ) bbc ON true
    LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
    LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
    LEFT JOIN public.cash_handovers h ON h.id = chs.handover_id
    WHERE cs.start_date BETWEEN p_start AND p_end
      AND (p_station_id IS NULL OR cs.station_id = p_station_id)
  )
  SELECT b.*, count(*) OVER () AS total_count
  FROM base b
  WHERE (p_payment_method IS NULL OR b.payment_method = p_payment_method)
    AND (p_engine_version IS NULL OR b.engine_version = p_engine_version OR (p_engine_version = 'null' AND b.engine_version IS NULL))
    AND (p_exception_status IS NULL OR b.exception_status = p_exception_status)
    AND (p_locked IS NULL OR coalesce(b.handover_locked, false) = p_locked)
  ORDER BY b.start_ts DESC
  LIMIT v_capped_size OFFSET coalesce(p_page_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.report_billing_reconciliation(date, date, uuid, text, text, text, boolean, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_billing_reconciliation(date, date, uuid, text, text, text, boolean, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_billing_reconciliation(date, date, uuid, text, text, text, boolean, integer, integer) TO authenticated, service_role;

-- Harden report_exception_summary: pagination + exception-type filter.
CREATE OR REPLACE FUNCTION public.report_exception_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL,
  p_exception_type text DEFAULT NULL,
  p_page_size integer DEFAULT 200,
  p_page_offset integer DEFAULT 0
)
RETURNS TABLE (
  exception_type text, station_id uuid, session_id uuid, transaction_id text, batch_id uuid,
  handover_id uuid, detail text, amount numeric, occurred_on date, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_size integer := LEAST(coalesce(p_page_size, 200), 500);
BEGIN
  PERFORM public.report_assert_access(p_station_id);
  PERFORM public.report_assert_date_range(p_start, p_end);

  RETURN QUERY
  WITH base AS (
    SELECT * FROM (
      SELECT
        'missing_billing'::text AS exception_type, cs.station_id, cs.id AS session_id, cs.transaction_id, cs.import_batch_id AS batch_id, NULL::uuid AS handover_id,
        'Session has no billing calculation'::text AS detail, NULL::numeric AS amount, cs.start_date AS occurred_on
      FROM public.charging_sessions cs
      LEFT JOIN LATERAL (SELECT bc.id AS billing_id FROM public.billing_calculations bc WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1) lb ON true
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id) AND lb.billing_id IS NULL

      UNION ALL
      SELECT 'missing_operator', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
        'Session has no operator assigned', NULL, cs.start_date
      FROM public.charging_sessions cs
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id) AND cs.operator_id IS NULL

      UNION ALL
      SELECT 'missing_payment_method', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, chs.handover_id,
        'Billed session has no active payment allocation', public.round_jod3(lb.total_amount), cs.start_date
      FROM public.charging_sessions cs
      JOIN LATERAL (SELECT bc.id AS billing_id, bc.total_amount FROM public.billing_calculations bc WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1) lb ON true
      LEFT JOIN public.session_payment_allocations spa ON spa.session_id = cs.id AND spa.is_active = true
      LEFT JOIN public.cash_handover_sessions chs ON chs.session_id = cs.id
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id) AND spa.id IS NULL

      UNION ALL
      SELECT 'billing_failure', b.station_id, NULL, NULL, b.id, NULL,
        coalesce(b.failure_reason, 'Batch billing_status indicates failure'), NULL, b.created_at::date
      FROM public.import_batches b
      WHERE b.created_at::date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR b.station_id = p_station_id)
        AND b.status IN ('billing_failed', 'validation_failed', 'failed')

      UNION ALL
      SELECT 'handover_pending', h.station_id, NULL, NULL, NULL, h.id,
        format('Handover %s has %s unassigned session(s)', h.handover_number, h.unassigned_count), NULL, h.shift_date
      FROM public.cash_handovers h
      WHERE h.shift_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR h.station_id = p_station_id)
        AND h.unassigned_count > 0 AND h.status NOT IN ('cancelled', 'rejected')

      UNION ALL
      SELECT 'handover_rejected', h.station_id, NULL, NULL, NULL, h.id,
        coalesce(h.rejection_reason, 'Handover rejected'), NULL, h.shift_date
      FROM public.cash_handovers h
      WHERE h.shift_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR h.station_id = p_station_id) AND h.status = 'rejected'

      UNION ALL
      SELECT 'legacy_engine', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
        coalesce('Engine: ' || lb.calculation_engine_version, 'Engine version missing'), public.round_jod3(lb.total_amount), cs.start_date
      FROM public.charging_sessions cs
      JOIN LATERAL (SELECT bc.id AS billing_id, bc.total_amount, bc.calculation_engine_version FROM public.billing_calculations bc WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1) lb ON true
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id)
        AND (lb.calculation_engine_version IS NULL OR lb.calculation_engine_version !~ '^ev-b-v2')

      UNION ALL
      SELECT 'non_zero_demand', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
        'Billing breakdown has non-zero demand charge', public.round_jod3(bbc.demand_charge_sum), cs.start_date
      FROM public.charging_sessions cs
      JOIN LATERAL (SELECT bc.id AS billing_id FROM public.billing_calculations bc WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1) lb ON true
      JOIN LATERAL (SELECT coalesce(sum(bbi.demand_charge), 0) AS demand_charge_sum FROM public.billing_breakdown_items bbi WHERE bbi.billing_calculation_id = lb.billing_id) bbc ON true
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id) AND coalesce(bbc.demand_charge_sum, 0) > 0

      UNION ALL
      SELECT 'non_zero_tax', cs.station_id, cs.id, cs.transaction_id, cs.import_batch_id, NULL,
        'Billing has non-zero tax', public.round_jod3(lb.taxes), cs.start_date
      FROM public.charging_sessions cs
      JOIN LATERAL (SELECT bc.id AS billing_id, bc.taxes FROM public.billing_calculations bc WHERE bc.session_id = cs.id ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1) lb ON true
      WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id) AND coalesce(lb.taxes, 0) > 0
    ) u
  )
  SELECT b.*, count(*) OVER () AS total_count
  FROM base b
  WHERE (p_exception_type IS NULL OR b.exception_type = p_exception_type)
  ORDER BY b.occurred_on DESC
  LIMIT v_capped_size OFFSET coalesce(p_page_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.report_exception_summary(date, date, uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_exception_summary(date, date, uuid, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_exception_summary(date, date, uuid, text, integer, integer) TO authenticated, service_role;

-- New: single-row historical inventory summary (§5 of the prompt).
CREATE OR REPLACE FUNCTION public.report_historical_inventory_summary(
  p_start date,
  p_end date,
  p_station_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.report_assert_access(p_station_id);
  PERFORM public.report_assert_date_range(p_start, p_end);

  WITH sess AS (
    SELECT cs.* FROM charging_sessions cs
    WHERE cs.start_date BETWEEN p_start AND p_end AND (p_station_id IS NULL OR cs.station_id = p_station_id)
  ),
  billed AS (
    SELECT s.id AS session_id, lb.billing_id, lb.total_amount, lb.calculation_engine_version, lb.billing_source, lb.taxes
    FROM sess s
    LEFT JOIN LATERAL (
      SELECT bc.id AS billing_id, bc.total_amount, bc.calculation_engine_version, bc.billing_source, bc.taxes
      FROM billing_calculations bc WHERE bc.session_id = s.id
      ORDER BY bc.calculated_at DESC NULLS LAST, bc.created_at DESC LIMIT 1
    ) lb ON true
  ),
  engine_dist AS (
    SELECT
      CASE
        WHEN billing_id IS NULL THEN 'missing'
        WHEN calculation_engine_version IS NULL THEN 'unknown'
        WHEN calculation_engine_version ~ '^ev-b-v2' THEN calculation_engine_version
        ELSE 'legacy'
      END AS label,
      count(*) AS cnt
    FROM billed GROUP BY 1
  ),
  source_dist AS (
    SELECT coalesce(billing_source, 'unknown') AS label, count(*) AS cnt FROM billed GROUP BY 1
  )
  SELECT jsonb_build_object(
    'total_sessions', (SELECT count(*) FROM sess),
    'total_billing_rows', (SELECT count(*) FROM billing_calculations bc JOIN sess s ON s.id = bc.session_id),
    'total_breakdown_rows', (SELECT count(*) FROM billing_breakdown_items bbi JOIN billing_calculations bc ON bc.id = bbi.billing_calculation_id JOIN sess s ON s.id = bc.session_id),
    'engine_version_distribution', coalesce((SELECT jsonb_object_agg(label, cnt) FROM engine_dist), '{}'::jsonb),
    'billing_source_distribution', coalesce((SELECT jsonb_object_agg(label, cnt) FROM source_dist), '{}'::jsonb),
    'missing_billing_count', (SELECT count(*) FROM billed WHERE billing_id IS NULL),
    'non_zero_tax_count', (SELECT count(*) FROM billed WHERE coalesce(taxes, 0) > 0),
    'non_zero_demand_count', (
      SELECT count(DISTINCT b.session_id) FROM billed b
      JOIN billing_breakdown_items bbi ON bbi.billing_calculation_id = b.billing_id
      WHERE bbi.demand_charge > 0
    ),
    'missing_operator_count', (SELECT count(*) FROM sess WHERE operator_id IS NULL),
    'missing_station_count', (SELECT count(*) FROM sess WHERE station_id IS NULL),
    'legacy_or_unknown_engine_count', (SELECT count(*) FROM billed WHERE billing_id IS NOT NULL AND (calculation_engine_version IS NULL OR calculation_engine_version !~ '^ev-b-v2')),
    'unassigned_payment_count', (
      SELECT count(*) FROM billed b
      WHERE b.billing_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM session_payment_allocations spa WHERE spa.session_id = b.session_id AND spa.is_active = true)
    ),
    'handover_unavailable_count', (
      SELECT count(*) FROM billed b
      WHERE b.billing_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM cash_handover_sessions chs WHERE chs.session_id = b.session_id)
    ),
    'correction_queue_status_counts', coalesce((
      SELECT jsonb_object_agg(status, cnt) FROM (
        SELECT status, count(*) AS cnt FROM historical_correction_queue hcq
        JOIN sess s ON s.id = hcq.session_id
        GROUP BY status
      ) q
    ), '{}'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.report_historical_inventory_summary(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_historical_inventory_summary(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_historical_inventory_summary(date, date, uuid) TO authenticated, service_role;

-- Paginated correction-queue browser with filters.
CREATE OR REPLACE FUNCTION public.report_correction_queue(
  p_status text DEFAULT NULL,
  p_risk text DEFAULT NULL,
  p_confidence text DEFAULT NULL,
  p_station_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 100,
  p_page_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, session_id uuid, transaction_id text, station_id uuid, classification text,
  exception_types text[], current_amount numeric, proposed_amount numeric, difference numeric,
  match_tier text, confidence text, risk text, proposed_action text, status text,
  reason text, submitted_at timestamptz, approved_at timestamptz, applied_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_size integer := LEAST(coalesce(p_page_size, 100), 500);
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    q.id, q.session_id, cs.transaction_id, q.station_id, q.classification, q.exception_types,
    q.current_amount, q.proposed_amount, q.difference, q.match_tier, q.confidence, q.risk,
    q.proposed_action, q.status, q.reason, q.submitted_at, q.approved_at, q.applied_at,
    count(*) OVER () AS total_count
  FROM historical_correction_queue q
  JOIN charging_sessions cs ON cs.id = q.session_id
  WHERE (p_status IS NULL OR q.status = p_status)
    AND (p_risk IS NULL OR q.risk = p_risk)
    AND (p_confidence IS NULL OR q.confidence = p_confidence)
    AND (p_station_id IS NULL OR q.station_id = p_station_id)
  ORDER BY q.submitted_at DESC
  LIMIT v_capped_size OFFSET coalesce(p_page_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.report_correction_queue(text, text, text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_correction_queue(text, text, text, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_correction_queue(text, text, text, uuid, integer, integer) TO authenticated, service_role;

-- Paginated historical payment classification queue browser.
CREATE OR REPLACE FUNCTION public.report_historical_payment_classification_queue(
  p_status text DEFAULT NULL,
  p_station_id uuid DEFAULT NULL,
  p_page_size integer DEFAULT 100,
  p_page_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, scope text, session_id uuid, batch_id uuid, station_id uuid,
  proposed_classification text, evidence_source text, confidence text,
  affected_session_count integer, affected_total_amount numeric, status text,
  submitted_at timestamptz, approved_at timestamptz, applied_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capped_size integer := LEAST(coalesce(p_page_size, 100), 500);
BEGIN
  PERFORM public.report_assert_access(p_station_id);

  RETURN QUERY
  SELECT
    q.id, q.scope, q.session_id, q.batch_id, q.station_id, q.proposed_classification,
    q.evidence_source, q.confidence, q.affected_session_count, q.affected_total_amount, q.status,
    q.submitted_at, q.approved_at, q.applied_at,
    count(*) OVER () AS total_count
  FROM historical_payment_classification_queue q
  WHERE (p_status IS NULL OR q.status = p_status)
    AND (p_station_id IS NULL OR q.station_id = p_station_id)
  ORDER BY q.submitted_at DESC
  LIMIT v_capped_size OFFSET coalesce(p_page_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.report_historical_payment_classification_queue(text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_historical_payment_classification_queue(text, uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.report_historical_payment_classification_queue(text, uuid, integer, integer) TO authenticated, service_role;
