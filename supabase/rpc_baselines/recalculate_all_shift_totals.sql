-- EV-A1 baseline snapshot (verbatim live definition). Do not improve in A1.
-- MD5: 00653252da9c0efcf63a9118bc51f3bf
CREATE OR REPLACE FUNCTION public.recalculate_all_shift_totals()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_shift RECORD;
  v_updated INT := 0;
  v_total_kwh NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_result JSON;
BEGIN
  FOR v_shift IN SELECT id FROM shifts LOOP
    v_result := recalculate_shift_totals(v_shift.id);
    v_updated := v_updated + 1;
    v_total_kwh := v_total_kwh + (v_result->>'total_kwh')::numeric;
    v_total_amount := v_total_amount + (v_result->>'total_amount_jod')::numeric;
  END LOOP;

  RETURN json_build_object(
    'shifts_updated', v_updated,
    'total_kwh', ROUND(v_total_kwh, 3),
    'total_amount_jod', ROUND(v_total_amount, 3)
  );
END;
$function$;
