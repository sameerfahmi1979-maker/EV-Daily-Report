/*
  # Create Analytics RPC Functions

  1. New Functions
    - `get_analytics_summary(p_start date, p_end date)` - Summary metrics (energy, revenue, sessions, stations)
    - `get_energy_trend(p_start date, p_end date, p_group_by text)` - Energy grouped by day/week/month
    - `get_revenue_by_station(p_start date, p_end date)` - Revenue breakdown per station
    - `get_station_utilization(p_start date, p_end date)` - Energy distribution per station with percentages
    - `get_shift_comparison(p_start date, p_end date)` - Morning/Afternoon/Night shift metrics
    - `get_connector_type_comparison(p_start date, p_end date)` - Metrics per connector type
    - `get_charger_type_breakdown(p_start date, p_end date)` - Session count per connector type with percentages
    - `get_best_time_to_charge(p_start date, p_end date)` - Hourly energy/cost patterns (0-23)
    - `get_co2_impact(p_start date, p_end date)` - CO2 reduction metrics
    - `get_daily_transactions_by_connector(p_start date, p_end date)` - Daily session counts per connector type

  2. Purpose
    - Fixes Supabase PostgREST 1000-row default limit that was silently truncating analytics data
    - Moves aggregation to database (SUM, COUNT, AVG) for correct results regardless of data volume
    - Fixes CO2 string concatenation bug by using proper numeric SUM in SQL
    - Fixes active stations ignoring date filter by using COUNT(DISTINCT station_id)
    - Fixes avgCost wrong denominator by tracking billed sessions separately

  3. Important Notes
    - All functions are read-only (SELECT only)
    - All functions return JSON for easy consumption by the frontend
    - All functions use COALESCE for null safety
    - No schema or data changes - only new functions
*/

CREATE OR REPLACE FUNCTION get_analytics_summary(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'totalEnergy', COALESCE((
      SELECT SUM(energy_consumed_kwh)
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
    ), 0),
    'totalSessions', COALESCE((
      SELECT COUNT(*)
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
    ), 0),
    'activeStations', COALESCE((
      SELECT COUNT(DISTINCT station_id)
      FROM charging_sessions
      WHERE start_date >= p_start AND start_date <= p_end
    ), 0),
    'totalRevenue', COALESCE((
      SELECT SUM(bc.total_amount)
      FROM billing_calculations bc
      INNER JOIN charging_sessions cs ON bc.session_id = cs.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    ), 0)
  );
$$;

CREATE OR REPLACE FUNCTION get_energy_trend(p_start date, p_end date, p_group_by text)
RETURNS json
LANGUAGE sql
STABLE
AS $$
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
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_revenue_by_station(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      s.name as station,
      COALESCE(s.station_code, '') as station_code,
      COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
      COUNT(DISTINCT bc.id)::int as sessions
    FROM billing_calculations bc
    INNER JOIN charging_sessions cs ON bc.session_id = cs.id
    INNER JOIN stations s ON cs.station_id = s.id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY s.id, s.name, s.station_code
    ORDER BY revenue DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_station_utilization(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH station_data AS (
    SELECT
      s.name,
      SUM(cs.energy_consumed_kwh)::float8 as energy,
      COUNT(*)::int as sessions
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
      sd.name,
      sd.energy,
      sd.sessions,
      CASE WHEN tot.total_energy > 0
        THEN ROUND((sd.energy / tot.total_energy * 100)::numeric, 2)::float8
        ELSE 0
      END as percentage
    FROM station_data sd, total tot
    ORDER BY sd.energy DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_shift_comparison(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      sub.shift,
      sub.energy,
      sub.revenue,
      sub.sessions,
      sub.co2_reduction,
      sub.avg_duration
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
      LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
      GROUP BY shift
    ) sub
    ORDER BY
      CASE sub.shift
        WHEN 'Morning' THEN 1
        WHEN 'Afternoon' THEN 2
        WHEN 'Night' THEN 3
      END
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_connector_type_comparison(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
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
    LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
    ORDER BY revenue DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_charger_type_breakdown(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH type_counts AS (
    SELECT
      COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as type,
      COUNT(*)::int as count
    FROM charging_sessions
    WHERE start_date >= p_start AND start_date <= p_end
    GROUP BY type
  ),
  total AS (
    SELECT COALESCE(SUM(count), 0) as total FROM type_counts
  )
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      tc.type,
      tc.count,
      CASE WHEN tot.total > 0
        THEN ROUND((tc.count::numeric / tot.total * 100)::numeric, 2)::float8
        ELSE 0
      END as percentage
    FROM type_counts tc, total tot
    ORDER BY tc.count DESC
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_best_time_to_charge(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  WITH hours AS (
    SELECT generate_series(0, 23) as hour
  ),
  hourly_data AS (
    SELECT
      EXTRACT(HOUR FROM cs.start_time)::int as hour,
      SUM(cs.energy_consumed_kwh)::float8 as energy,
      COUNT(*)::int as sessions,
      COALESCE(SUM(bc.total_amount), 0)::float8 as total_cost,
      COUNT(bc.id)::int as billed_sessions
    FROM charging_sessions cs
    LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
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
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_co2_impact(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'totalCO2Reduction', COALESCE(SUM(co2_reduction_kg), 0)::float8,
    'treesEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 21.0)::numeric, 1)::float8,
    'kmDrivenEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 0.171)::numeric, 1)::float8,
    'energyUsed', COALESCE(SUM(energy_consumed_kwh), 0)::float8
  )
  FROM charging_sessions
  WHERE start_date >= p_start AND start_date <= p_end;
$$;

CREATE OR REPLACE FUNCTION get_daily_transactions_by_connector(p_start date, p_end date)
RETURNS json
LANGUAGE sql
STABLE
AS $$
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
  ) t;
$$;
