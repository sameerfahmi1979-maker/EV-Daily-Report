-- EV-A1: Transactional replace of a session billing row.
-- Applied remotely as migration: a1_replace_session_billing_rpc
-- Tariff algorithm unchanged; callers supply already-computed amounts.

CREATE OR REPLACE FUNCTION public.replace_session_billing(
  p_session_id uuid,
  p_rate_structure_id uuid,
  p_subtotal numeric,
  p_taxes numeric,
  p_fees numeric,
  p_total_amount numeric,
  p_currency text DEFAULT 'JOD',
  p_breakdown jsonb DEFAULT NULL,
  p_breakdown_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_billing_id uuid;
  v_item jsonb;
  v_deleted int := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM charging_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  DELETE FROM billing_breakdown_items bbi
  USING billing_calculations bc
  WHERE bbi.billing_calculation_id = bc.id
    AND bc.session_id = p_session_id;

  DELETE FROM billing_calculations
  WHERE session_id = p_session_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO billing_calculations (
    session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency, breakdown
  ) VALUES (
    p_session_id, p_rate_structure_id, p_subtotal, COALESCE(p_taxes,0), COALESCE(p_fees,0),
    p_total_amount, COALESCE(p_currency,'JOD'), p_breakdown
  )
  RETURNING id INTO v_billing_id;

  IF p_breakdown_items IS NOT NULL AND jsonb_typeof(p_breakdown_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_breakdown_items)
    LOOP
      INSERT INTO billing_breakdown_items (
        billing_calculation_id, rate_period_id, period_name,
        start_time, end_time, duration_minutes,
        energy_kwh, rate_per_kwh, demand_kw, demand_charge, energy_charge, line_total
      ) VALUES (
        v_billing_id,
        NULLIF(v_item->>'rate_period_id', '')::uuid,
        v_item->>'period_name',
        (v_item->>'start_time')::timestamptz,
        (v_item->>'end_time')::timestamptz,
        COALESCE((v_item->>'duration_minutes')::numeric, 0),
        COALESCE((v_item->>'energy_kwh')::numeric, 0),
        COALESCE((v_item->>'rate_per_kwh')::numeric, 0),
        COALESCE((v_item->>'demand_kw')::numeric, 0),
        COALESCE((v_item->>'demand_charge')::numeric, 0),
        COALESCE((v_item->>'energy_charge')::numeric, 0),
        COALESCE((v_item->>'line_total')::numeric, 0)
      );
    END LOOP;
  END IF;

  UPDATE charging_sessions
  SET has_billing_calculation = true,
      calculated_cost = p_total_amount
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'billing_id', v_billing_id,
    'session_id', p_session_id,
    'replaced_count', v_deleted,
    'total_amount', p_total_amount
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.replace_session_billing IS
  'EV-A1 transactional billing upsert/replace for a single session. Tariff computation remains in caller until Phase B.';
