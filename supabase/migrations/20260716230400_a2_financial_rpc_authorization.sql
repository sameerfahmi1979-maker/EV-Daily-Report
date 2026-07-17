-- EV-A2 Migration 5/6: Authorize critical financial RPCs (no tariff algorithm rewrite)
-- STATUS: PREPARED — do not apply to live production without staging UAT.

CREATE OR REPLACE FUNCTION public.a2_assert_can_replace_session_billing(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-A2 denied: authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT station_id INTO v_station_id
  FROM public.charging_sessions
  WHERE id = p_session_id;

  IF v_station_id IS NULL THEN
    RAISE EXCEPTION 'EV-A2 denied: session not found or missing station' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_user_can_recalculate_billing(v_station_id) THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'rpc_denied', 'charging_sessions', p_session_id,
      jsonb_build_object('rpc', 'replace_session_billing', 'station_id', v_station_id)
    );
    RAISE EXCEPTION 'EV-A2 denied: recalculate billing not permitted for this station'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_station_id;
END;
$$;

-- Patch replace_session_billing with auth gate (body otherwise unchanged from A1)
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
  PERFORM public.a2_assert_can_replace_session_billing(p_session_id);

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

  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(), 'billing_recalculation', 'charging_sessions', p_session_id,
    jsonb_build_object('rpc', 'replace_session_billing', 'total_amount', p_total_amount)
  );

  RETURN jsonb_build_object(
    'billing_id', v_billing_id,
    'session_id', p_session_id,
    'replaced_count', v_deleted,
    'total_amount', p_total_amount
  );
END;
$function$;

-- Auth wrappers for other mutation RPCs (raise if unauthorized; then call original logic via renamed internals)
-- Strategy: revoke anon/public execute; grant authenticated only; add gate functions invoked at top via CREATE OR REPLACE of thin wrappers.

CREATE OR REPLACE FUNCTION public.a2_assert_can_mutate_station(p_station_id uuid, p_rpc text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'EV-A2 denied: authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_import(p_station_id)
     AND NOT public.current_user_can_recalculate_billing(p_station_id)
     AND NOT public.current_user_is_system_admin() THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(), 'rpc_denied', 'stations', p_station_id,
      jsonb_build_object('rpc', p_rpc)
    );
    RAISE EXCEPTION 'EV-A2 denied: not permitted to execute %', p_rpc USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.a2_assert_fleet_recalc(p_rpc text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.current_user_is_system_admin()
    OR public.current_user_role() IN ('operations_manager', 'company_manager')
  ) THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'rpc_denied', 'rpc', NULL, jsonb_build_object('rpc', p_rpc));
    RAISE EXCEPTION 'EV-A2 denied: fleet recalculation requires admin/operations manager'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Harden grants: remove anonymous / PUBLIC execute on financial mutation RPCs
REVOKE ALL ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_session_billing(uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb) TO authenticated, service_role;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'calculate_batch_billing',
        'delete_import_batch',
        'recalculate_shift_totals',
        'recalculate_all_shift_totals',
        'turbo_bulk_calculate_billing',
        'turbo_calculate_all_pending'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END $$;

-- Note: Full body rewrite of calculate_batch_billing / turbo_* to inject a2_assert_* is
-- intentionally staged: grant lockdown happens here; body injection should be verified in
-- staging against exact live definitions from a1_backup_20260716.rpc_definitions.
-- Staging apply script: scripts/a2_inject_rpc_auth_gates.sql (companion).
