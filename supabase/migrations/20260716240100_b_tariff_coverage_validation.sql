-- EV-B Migration 2/6: Tariff 24h coverage validation helpers

CREATE OR REPLACE FUNCTION public.b_time_to_minutes(p_time time)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXTRACT(HOUR FROM p_time)::int * 60 + EXTRACT(MINUTE FROM p_time)::int;
$$;

CREATE OR REPLACE FUNCTION public.b_validate_rate_structure_coverage(p_rate_structure_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cover int[] := ARRAY(SELECT 0 FROM generate_series(1, 1440));
  r RECORD;
  start_m int;
  end_m int;
  m int;
  uncovered int := 0;
  overlap_count int := 0;
BEGIN
  FOR r IN
    SELECT start_time, end_time, energy_rate_per_kwh, COALESCE(demand_charge_per_kw, 0) AS demand
    FROM rate_periods
    WHERE rate_structure_id = p_rate_structure_id
  LOOP
    IF r.energy_rate_per_kwh IS NULL OR r.energy_rate_per_kwh <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'non_positive_energy_rate');
    END IF;
    IF r.demand <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'demand_charge_must_be_zero', 'demand', r.demand);
    END IF;

    start_m := public.b_time_to_minutes(r.start_time);
    end_m := public.b_time_to_minutes(r.end_time);
    IF end_m = 0 AND start_m > 0 THEN
      end_m := 1440;
    END IF;

    IF end_m > start_m THEN
      FOR m IN start_m .. (end_m - 1) LOOP
        cover[m + 1] := cover[m + 1] + 1;
      END LOOP;
    ELSIF end_m < start_m THEN
      FOR m IN start_m .. 1439 LOOP
        cover[m + 1] := cover[m + 1] + 1;
      END LOOP;
      FOR m IN 0 .. (end_m - 1) LOOP
        cover[m + 1] := cover[m + 1] + 1;
      END LOOP;
    ELSE
      -- full day flat
      FOR m IN 0 .. 1439 LOOP
        cover[m + 1] := cover[m + 1] + 1;
      END LOOP;
    END IF;
  END LOOP;

  FOR m IN 1 .. 1440 LOOP
    IF cover[m] = 0 THEN uncovered := uncovered + 1; END IF;
    IF cover[m] > 1 THEN overlap_count := overlap_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', uncovered = 0 AND overlap_count = 0,
    'uncovered_minutes', uncovered,
    'overlap_minutes', overlap_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.b_validate_rate_structure_coverage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.b_validate_rate_structure_coverage(uuid) TO authenticated, service_role;
