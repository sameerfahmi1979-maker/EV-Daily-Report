-- EV-A1 baseline snapshot (verbatim live definition). Do not improve in A1.
-- MD5: 65897713a84c803f0c590ee4c12f7fce
CREATE OR REPLACE FUNCTION public.recalculate_shift_totals(p_shift_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_kwh NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_session_count INT := 0;
BEGIN
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(cs.energy_consumed_kwh), 0)
  INTO v_session_count, v_total_kwh
  FROM charging_sessions cs
  WHERE cs.shift_id = p_shift_id;

  SELECT COALESCE(SUM(bc.total_amount), 0)
  INTO v_total_amount
  FROM billing_calculations bc
  JOIN charging_sessions cs ON bc.session_id = cs.id
  WHERE cs.shift_id = p_shift_id;

  UPDATE shifts
  SET
    total_kwh = v_total_kwh,
    total_amount_jod = v_total_amount,
    updated_at = now()
  WHERE id = p_shift_id;

  RETURN json_build_object(
    'shift_id', p_shift_id,
    'session_count', v_session_count,
    'total_kwh', ROUND(v_total_kwh, 3),
    'total_amount_jod', ROUND(v_total_amount, 3)
  );
END;
$function$;
