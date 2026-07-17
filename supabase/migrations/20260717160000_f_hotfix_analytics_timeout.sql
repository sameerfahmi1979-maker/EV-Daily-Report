-- EV-F hotfix: legacy analytics RPCs were timing out in production.
--
-- Root cause: get_analytics_summary, get_best_time_to_charge,
-- get_connector_type_comparison, get_revenue_by_station, and
-- get_shift_comparison all computed `SELECT DISTINCT ON (session_id) ...
-- FROM billing_calculations ORDER BY session_id, created_at DESC` over the
-- ENTIRE billing_calculations table (44,000+ rows and growing) BEFORE joining
-- to charging_sessions and filtering by date range. As the table grew this
-- crossed the statement_timeout threshold, causing the Dashboard/Analytics
-- screens to silently show all-zero data (the RPC error was swallowed by the
-- UI's catch handler).
--
-- Fix: billing_calculations already has billing_calculations_one_per_session_key
-- UNIQUE (session_id) (Phase A1), so there is at most one billing row per
-- session. The DISTINCT ON was therefore always unnecessary — a direct join
-- is correct and lets Postgres use the existing session_id index instead of
-- scanning/sorting the whole table on every call.

CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
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
FROM charging_sessions cs
INNER JOIN billing_calculations bc ON bc.session_id = cs.id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
), 0)
);
$function$
;

CREATE OR REPLACE FUNCTION public.get_best_time_to_charge(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
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
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_connector_type_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
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
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_revenue_by_station(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
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
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shift_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
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
LEFT JOIN billing_calculations bc ON bc.session_id = cs.id
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
$function$
;
