/*
  # Fix Analytics RPC Functions for Duplicate Billing Records

  1. Modified Functions
    - `get_analytics_summary` - Use deduplicated billing subquery
    - `get_shift_comparison` - Use deduplicated billing subquery
    - `get_connector_type_comparison` - Use deduplicated billing subquery
    - `get_best_time_to_charge` - Use deduplicated billing subquery
    - `get_revenue_by_station` - Use deduplicated billing subquery

  2. Problem
    - 209 sessions have duplicate billing_calculations records (identical amounts, created within milliseconds)
    - LEFT/INNER JOIN with billing_calculations was producing duplicate rows
    - This inflated session counts and revenue totals in shift, connector, hourly, and revenue queries

  3. Fix
    - Use DISTINCT ON (session_id) subquery to get one billing record per session
    - Takes the most recent billing record for each session
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
      FROM (
        SELECT DISTINCT ON (session_id) session_id, total_amount
        FROM billing_calculations
        ORDER BY session_id, created_at DESC
      ) bc
      INNER JOIN charging_sessions cs ON bc.session_id = cs.id
      WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    ), 0)
  );
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
      COUNT(*)::int as sessions
    FROM (
      SELECT DISTINCT ON (session_id) session_id, total_amount
      FROM billing_calculations
      ORDER BY session_id, created_at DESC
    ) bc
    INNER JOIN charging_sessions cs ON bc.session_id = cs.id
    INNER JOIN stations s ON cs.station_id = s.id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY s.id, s.name, s.station_code
    ORDER BY revenue DESC
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
      LEFT JOIN (
        SELECT DISTINCT ON (session_id) session_id, total_amount
        FROM billing_calculations
        ORDER BY session_id, created_at DESC
      ) bc ON cs.id = bc.session_id
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
    LEFT JOIN (
      SELECT DISTINCT ON (session_id) session_id, total_amount
      FROM billing_calculations
      ORDER BY session_id, created_at DESC
    ) bc ON cs.id = bc.session_id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
    ORDER BY revenue DESC
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
      COUNT(bc.session_id)::int as billed_sessions
    FROM charging_sessions cs
    LEFT JOIN (
      SELECT DISTINCT ON (session_id) session_id, total_amount
      FROM billing_calculations
      ORDER BY session_id, created_at DESC
    ) bc ON cs.id = bc.session_id
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
