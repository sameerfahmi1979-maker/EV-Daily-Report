-- EV-B controlled overnight UAT fixture (creates then deletes)
DROP TABLE IF EXISTS evb_uat_result;
CREATE TEMP TABLE evb_uat_result (
  total_amount numeric,
  engine text,
  taxes numeric,
  summary text,
  items int,
  demand_sum numeric,
  notice text
);

DO $$
DECLARE
  v_station uuid;
  v_sid uuid;
  v_admin uuid := '5bbb7898-638e-4a95-b4c5-3bd0cae57a7c';
  v_res jsonb;
  v_total numeric;
  v_engine text;
  v_taxes numeric;
  v_summary text;
  v_items int;
  v_demand numeric;
BEGIN
  SELECT id INTO v_station FROM stations ORDER BY created_at NULLS LAST LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text,
    true
  );

  INSERT INTO charging_sessions (
    station_id, transaction_id, charge_id, card_number,
    start_date, start_time, start_ts, end_date, end_time, end_ts,
    duration_minutes, energy_consumed_kwh, calculated_cost, station_code
  ) VALUES (
    v_station, 'EVB-UAT-1573323579', 'CHG-EVB-UAT', '6424',
    '2026-07-15', '23:53:32',
    ('2026-07-15 23:53:32'::timestamp AT TIME ZONE 'Asia/Amman'),
    '2026-07-16', '00:37:05',
    ('2026-07-16 00:37:05'::timestamp AT TIME ZONE 'Asia/Amman'),
    44, 38.000, 0, 'STATION-1'
  ) RETURNING id INTO v_sid;

  v_res := public.calculate_session_billing_v2(v_sid, 'manual_recalculate', 'evb_uat_overnight');

  SELECT bc.total_amount, bc.calculation_engine_version, bc.taxes, bc.applied_rate_summary
  INTO v_total, v_engine, v_taxes, v_summary
  FROM billing_calculations bc WHERE bc.session_id = v_sid;

  SELECT count(*)::int,
         coalesce(sum(demand_charge),0)
  INTO v_items, v_demand
  FROM billing_breakdown_items bbi
  JOIN billing_calculations bc ON bc.id = bbi.billing_calculation_id
  WHERE bc.session_id = v_sid;

  INSERT INTO evb_uat_result VALUES (
    v_total, v_engine, v_taxes, v_summary, v_items, v_demand, v_res::text
  );

  DELETE FROM billing_breakdown_items
  WHERE billing_calculation_id IN (SELECT id FROM billing_calculations WHERE session_id = v_sid);
  DELETE FROM billing_calculations WHERE session_id = v_sid;
  DELETE FROM charging_sessions WHERE id = v_sid;
END $$;

SELECT * FROM evb_uat_result;
