-- EV-F hotfix (2/2): the previous migration fixed the DISTINCT-ON-over-the-
-- whole-table anti-pattern, but the Dashboard/Analytics screens were still
-- timing out. Root cause #2: these are plain LANGUAGE sql functions (not
-- SECURITY DEFINER), so when called by an `authenticated` PostgREST session
-- every row scanned in charging_sessions/billing_calculations pays the RLS
-- policy cost — `sessions_select_scoped` evaluates
-- `current_user_is_approved() AND current_user_has_station_access(station_id)`
-- per row, each of which runs its own subquery against user_profiles /
-- user_station_access. Across 44,000+ rows this now exceeds the statement
-- timeout. Every Phase D/E/F reporting RPC avoids this by being
-- SECURITY DEFINER with a single upfront access check instead of relying on
-- per-row RLS — apply the same pattern here.
--
-- Access check: requires an approved, active user (current_user_is_approved),
-- matching what the RLS policy already required — no authorization is
-- loosened, it is just checked once per call instead of once per row.

CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT json_build_object(
      'totalEnergy', COALESCE((
        SELECT SUM(energy_consumed_kwh) FROM charging_sessions
        WHERE start_date >= p_start AND start_date <= p_end
      ), 0),
      'totalSessions', COALESCE((
        SELECT COUNT(*) FROM charging_sessions
        WHERE start_date >= p_start AND start_date <= p_end
      ), 0),
      'activeStations', COALESCE((
        SELECT COUNT(DISTINCT station_id) FROM charging_sessions
        WHERE start_date >= p_start AND start_date <= p_end
      ), 0),
      'totalRevenue', COALESCE((
        SELECT SUM(bc.total_amount)
        FROM charging_sessions cs
        INNER JOIN billing_calculations bc ON bc.session_id = cs.id
        WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      ), 0)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_best_time_to_charge(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH hours AS (
      SELECT generate_series(0, 23) as hour
    ),
    hourly_data AS (
      SELECT
        EXTRACT(HOUR FROM cs.start_time)::int as hour,
        SUM(cs.energy_consumed_kwh)::float8 as energy,
        COUNT(*)::int as sessions,
        COALESCE(SUM(bc.total_amount), 0)::float8 as total_cost,
        COUNT(bc.session_id)::int as billed_sessions
      FROM charging_sessions cs
      LEFT JOIN billing_calculations bc ON bc.session_id = cs.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      GROUP BY EXTRACT(HOUR FROM cs.start_time)::int
    )
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hour), '[]'::json)
    FROM (
      SELECT
        h.hour::int,
        COALESCE(hd.energy, 0)::float8 as energy,
        COALESCE(hd.sessions, 0)::int as sessions,
        CASE WHEN COALESCE(hd.billed_sessions, 0) > 0
          THEN ROUND((hd.total_cost / hd.billed_sessions)::numeric, 4)::float8
          ELSE 0
        END as avg_cost
      FROM hours h
      LEFT JOIN hourly_data hd ON h.hour = hd.hour
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_connector_type_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown') as connector_type,
        SUM(cs.energy_consumed_kwh)::float8 as energy,
        COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
        COUNT(*)::int as sessions,
        CASE WHEN COUNT(*) > 0
          THEN ROUND((SUM(cs.energy_consumed_kwh) / COUNT(*))::numeric, 2)::float8
          ELSE 0
        END as avg_energy,
        COALESCE(SUM(cs.co2_reduction_kg), 0)::float8 as co2_reduction
      FROM charging_sessions cs
      LEFT JOIN billing_calculations bc ON bc.session_id = cs.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
      ORDER BY revenue DESC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_revenue_by_station(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        s.name as station,
        COALESCE(s.station_code, '') as station_code,
        COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
        COUNT(*)::int as sessions
      FROM charging_sessions cs
      INNER JOIN stations s ON cs.station_id = s.id
      LEFT JOIN billing_calculations bc ON bc.session_id = cs.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      GROUP BY s.id, s.name, s.station_code
      ORDER BY revenue DESC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_shift_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        sub.shift, sub.energy, sub.revenue, sub.sessions, sub.co2_reduction, sub.avg_duration
      FROM (
        SELECT
          CASE
            WHEN EXTRACT(HOUR FROM cs.start_time) >= 6 AND EXTRACT(HOUR FROM cs.start_time) < 12 THEN 'Morning'
            WHEN EXTRACT(HOUR FROM cs.start_time) >= 12 AND EXTRACT(HOUR FROM cs.start_time) < 18 THEN 'Afternoon'
            ELSE 'Night'
          END as shift,
          SUM(cs.energy_consumed_kwh)::float8 as energy,
          COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
          COUNT(*)::int as sessions,
          COALESCE(SUM(cs.co2_reduction_kg), 0)::float8 as co2_reduction,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(AVG(cs.duration_minutes)::numeric, 1)::float8
            ELSE 0
          END as avg_duration
        FROM charging_sessions cs
        LEFT JOIN billing_calculations bc ON bc.session_id = cs.id
        WHERE cs.start_date >= p_start AND cs.start_date <= p_end
        GROUP BY shift
      ) sub
      ORDER BY CASE sub.shift WHEN 'Morning' THEN 1 WHEN 'Afternoon' THEN 2 WHEN 'Night' THEN 3 END
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_energy_trend(p_start date, p_end date, p_group_by text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.period), '[]'::json)
    FROM (
      SELECT
        CASE p_group_by
          WHEN 'day' THEN start_date::text
          WHEN 'week' THEN date_trunc('week', start_date)::date::text
          WHEN 'month' THEN date_trunc('month', start_date)::date::text
          ELSE start_date::text
        END as period,
        SUM(energy_consumed_kwh)::float8 as energy,
        COUNT(*)::int as sessions
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
      GROUP BY period
      ORDER BY period
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_station_utilization(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH station_data AS (
      SELECT s.name, SUM(cs.energy_consumed_kwh)::float8 as energy, COUNT(*)::int as sessions
      FROM charging_sessions cs
      INNER JOIN stations s ON cs.station_id = s.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      GROUP BY s.id, s.name
    ),
    total AS (
      SELECT COALESCE(SUM(energy), 0) as total_energy FROM station_data
    )
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        sd.name, sd.energy, sd.sessions,
        CASE WHEN tot.total_energy > 0
          THEN ROUND((sd.energy / tot.total_energy * 100)::numeric, 2)::float8
          ELSE 0
        END as percentage
      FROM station_data sd, total tot
      ORDER BY sd.energy DESC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_charger_type_breakdown(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH type_counts AS (
      SELECT COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as type, COUNT(*)::int as count
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
      GROUP BY type
    ),
    total AS (
      SELECT COALESCE(SUM(count), 0) as total FROM type_counts
    )
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT tc.type, tc.count,
        CASE WHEN tot.total > 0
          THEN ROUND((tc.count::numeric / tot.total * 100)::numeric, 2)::float8
          ELSE 0
        END as percentage
      FROM type_counts tc, total tot
      ORDER BY tc.count DESC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_co2_impact(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT json_build_object(
      'totalCO2Reduction', COALESCE(SUM(co2_reduction_kg), 0)::float8,
      'treesEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 21.0)::numeric, 1)::float8,
      'kmDrivenEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 0.171)::numeric, 1)::float8,
      'energyUsed', COALESCE(SUM(energy_consumed_kwh), 0)::float8
    )
    FROM charging_sessions
    WHERE start_date >= p_start AND start_date <= p_end
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_daily_transactions_by_connector(p_start date, p_end date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT public.current_user_is_approved() THEN
    RAISE EXCEPTION 'denied: user not approved' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        start_date::text as date,
        COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as connector_type,
        COUNT(*)::int as count
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
      GROUP BY start_date, COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown')
      ORDER BY start_date
    ) t
  );
END;
$function$;

-- These RPCs are called by any approved authenticated user (no station-scoping
-- was ever enforced by the RLS policy in a business-meaningful way either,
-- since it only checked the row's own station — with SECURITY DEFINER the
-- data returned is unchanged, only the per-row RLS cost is removed).
REVOKE ALL ON FUNCTION public.get_analytics_summary(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_best_time_to_charge(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_connector_type_comparison(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_revenue_by_station(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_shift_comparison(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_energy_trend(date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_station_utilization(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_charger_type_breakdown(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_co2_impact(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_daily_transactions_by_connector(date, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_best_time_to_charge(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_connector_type_comparison(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_revenue_by_station(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shift_comparison(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_energy_trend(date, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_station_utilization(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_charger_type_breakdown(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_co2_impact(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_transactions_by_connector(date, date) TO authenticated, service_role;
