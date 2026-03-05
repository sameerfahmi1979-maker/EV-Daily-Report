# Analytics Validation Queries

This document contains SQL queries you can run to validate what the analytics dashboard SHOULD show.

Run these queries in Supabase SQL editor and compare results with what the dashboard displays.

---

## Current Dashboard Analysis

### What You Reported
- Analytics showing: **1556.60** (incorrect)
- Should show for January 2026: **126,633.5 kWh**

---

## Validation Queries

### 1. January 2026 Summary Metrics

```sql
-- Get all summary metrics for January 2026
SELECT
  COUNT(*) as total_sessions,
  COUNT(DISTINCT station_id) as active_stations,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  MIN(start_date) as first_session,
  MAX(start_date) as last_session
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31';
```

**Expected Results for January 2026:**
- total_sessions: 8,225
- total_energy_kwh: 126,633.5
- active_stations: 1

---

### 2. January 2026 Revenue

```sql
-- Get total revenue for January 2026
SELECT
  COUNT(*) as billed_sessions,
  SUM(CAST(bc.total_amount AS NUMERIC)) as total_revenue_jod,
  COUNT(cs.id) as total_sessions_in_period,
  ROUND(100.0 * COUNT(bc.id) / COUNT(cs.id), 2) as billing_percentage
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31';
```

---

### 3. Energy by Station (January 2026)

```sql
-- Get energy consumption per station for January 2026
SELECT
  s.name as station_name,
  s.station_code,
  COUNT(*) as sessions,
  SUM(CAST(cs.energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  ROUND(100.0 * SUM(CAST(cs.energy_consumed_kwh AS NUMERIC)) /
    (SELECT SUM(CAST(energy_consumed_kwh AS NUMERIC))
     FROM charging_sessions
     WHERE start_date >= '2026-01-01'
       AND start_date <= '2026-01-31'), 2) as percentage
FROM charging_sessions cs
INNER JOIN stations s ON cs.station_id = s.id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
GROUP BY s.id, s.name, s.station_code
ORDER BY total_energy_kwh DESC;
```

---

### 4. Revenue by Station (January 2026)

```sql
-- Get revenue per station for January 2026
SELECT
  s.name as station_name,
  s.station_code,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(bc.id) as billed_sessions,
  SUM(CAST(bc.total_amount AS NUMERIC)) as total_revenue_jod
FROM charging_sessions cs
INNER JOIN stations s ON cs.station_id = s.id
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
GROUP BY s.id, s.name, s.station_code
ORDER BY total_revenue_jod DESC;
```

---

### 5. CO2 Impact (January 2026)

```sql
-- Get CO2 impact metrics for January 2026
SELECT
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE co2_reduction_kg IS NOT NULL AND co2_reduction_kg > 0) as sessions_with_co2,
  SUM(CAST(co2_reduction_kg AS NUMERIC)) as total_co2_kg,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  -- Trees equivalent (21 kg CO2 per tree per year)
  ROUND(SUM(CAST(co2_reduction_kg AS NUMERIC)) / 21, 1) as trees_equivalent,
  -- KM driven equivalent (0.171 kg CO2 per km)
  ROUND(SUM(CAST(co2_reduction_kg AS NUMERIC)) / 0.171, 1) as km_driven_equivalent
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31';
```

---

### 6. Shift Distribution (January 2026)

```sql
-- Get energy and sessions by shift for January 2026
SELECT
  CASE
    WHEN CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) >= 6
      AND CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) < 12 THEN 'Morning (6AM-12PM)'
    WHEN CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) >= 12
      AND CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) < 18 THEN 'Afternoon (12PM-6PM)'
    ELSE 'Night (6PM-6AM)'
  END as shift,
  COUNT(*) as sessions,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  ROUND(AVG(duration_minutes), 1) as avg_duration_minutes,
  SUM(CAST(co2_reduction_kg AS NUMERIC)) as total_co2_kg
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND start_time IS NOT NULL
GROUP BY
  CASE
    WHEN CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) >= 6
      AND CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) < 12 THEN 'Morning (6AM-12PM)'
    WHEN CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) >= 12
      AND CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) < 18 THEN 'Afternoon (12PM-6PM)'
    ELSE 'Night (6PM-6AM)'
  END
ORDER BY shift;
```

---

### 7. Connector Type Distribution (January 2026)

```sql
-- Get distribution by connector type for January 2026
SELECT
  COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as connector_type,
  COUNT(*) as sessions,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  ROUND(AVG(CAST(energy_consumed_kwh AS NUMERIC)), 2) as avg_energy_per_session,
  SUM(CAST(co2_reduction_kg AS NUMERIC)) as total_co2_kg,
  ROUND(100.0 * COUNT(*) /
    (SELECT COUNT(*) FROM charging_sessions
     WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31'), 2) as percentage
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
GROUP BY COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown')
ORDER BY total_energy_kwh DESC;
```

---

### 8. Connector Revenue (January 2026)

```sql
-- Get revenue by connector type for January 2026
SELECT
  COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown') as connector_type,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(bc.id) as billed_sessions,
  SUM(CAST(bc.total_amount AS NUMERIC)) as total_revenue_jod
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
ORDER BY total_revenue_jod DESC;
```

---

### 9. Hourly Pattern (January 2026)

```sql
-- Get sessions and energy by hour for January 2026
SELECT
  CAST(SPLIT_PART(start_time, ':', 1) AS INTEGER) as hour,
  COUNT(*) as sessions,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  COUNT(bc.id) as sessions_with_billing,
  ROUND(AVG(CAST(bc.total_amount AS NUMERIC)), 3) as avg_cost_jod
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
  AND cs.start_time IS NOT NULL
GROUP BY CAST(SPLIT_PART(cs.start_time, ':', 1) AS INTEGER)
ORDER BY hour;
```

---

### 10. Daily Energy Trend (January 2026)

```sql
-- Get daily energy consumption for January 2026
SELECT
  start_date,
  COUNT(*) as sessions,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as total_energy_kwh,
  COUNT(bc.id) as sessions_with_billing,
  SUM(CAST(bc.total_amount AS NUMERIC)) as total_revenue_jod
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
GROUP BY cs.start_date
ORDER BY cs.start_date;
```

---

### 11. Check for Data Quality Issues

```sql
-- Find sessions with potential data issues
SELECT
  'Negative Energy' as issue_type,
  COUNT(*) as count
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND CAST(energy_consumed_kwh AS NUMERIC) < 0

UNION ALL

SELECT
  'Zero Energy' as issue_type,
  COUNT(*) as count
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND CAST(energy_consumed_kwh AS NUMERIC) = 0

UNION ALL

SELECT
  'NULL Connector Type' as issue_type,
  COUNT(*) as count
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND (connector_type IS NULL OR TRIM(connector_type) = '')

UNION ALL

SELECT
  'NULL CO2' as issue_type,
  COUNT(*) as count
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND (co2_reduction_kg IS NULL OR co2_reduction_kg = 0)

UNION ALL

SELECT
  'Invalid Start Time' as issue_type,
  COUNT(*) as count
FROM charging_sessions
WHERE start_date >= '2026-01-01'
  AND start_date <= '2026-01-31'
  AND (start_time IS NULL OR start_time = '' OR start_time NOT LIKE '%:%')

UNION ALL

SELECT
  'Sessions Without Billing' as issue_type,
  COUNT(*) as count
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01'
  AND cs.start_date <= '2026-01-31'
  AND bc.id IS NULL;
```

---

## Quick Comparison Test

Run this single query to get a quick overview:

```sql
-- Quick validation for January 2026
SELECT
  'Total Sessions' as metric,
  COUNT(*)::text as value
FROM charging_sessions
WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31'

UNION ALL

SELECT
  'Total Energy (kWh)' as metric,
  ROUND(SUM(CAST(energy_consumed_kwh AS NUMERIC)), 2)::text as value
FROM charging_sessions
WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31'

UNION ALL

SELECT
  'Sessions with Billing' as metric,
  COUNT(bc.id)::text as value
FROM charging_sessions cs
LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
WHERE cs.start_date >= '2026-01-01' AND cs.start_date <= '2026-01-31'

UNION ALL

SELECT
  'Total Revenue (JOD)' as metric,
  ROUND(SUM(CAST(bc.total_amount AS NUMERIC)), 3)::text as value
FROM billing_calculations bc
INNER JOIN charging_sessions cs ON bc.session_id = cs.id
WHERE cs.start_date >= '2026-01-01' AND cs.start_date <= '2026-01-31'

UNION ALL

SELECT
  'Active Stations' as metric,
  COUNT(DISTINCT station_id)::text as value
FROM charging_sessions
WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31'

UNION ALL

SELECT
  'Total CO2 Reduction (kg)' as metric,
  ROUND(SUM(CAST(co2_reduction_kg AS NUMERIC)), 1)::text as value
FROM charging_sessions
WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31';
```

---

## How to Use These Queries

1. **Open Supabase Dashboard** → Go to SQL Editor
2. **Copy and paste** each query
3. **Run the query** and note the results
4. **Compare with dashboard** - the values should match exactly
5. **Document discrepancies** - note any differences

---

## Expected Results Summary (January 2026)

Based on your earlier query, here's what we know:

| Metric | Expected Value |
|--------|---------------|
| Total Sessions | 8,225 |
| Total Energy | 126,633.5 kWh |
| Active Stations | 1 |
| Total Revenue | TBD (run query) |
| Sessions with Billing | TBD (run query) |
| CO2 Reduction | TBD (run query) |

---

## Common Issues to Look For

1. **Energy showing as 1556.60 instead of 126,633.5**
   - Likely cause: Query filtering wrong date range
   - Or: Aggregating only part of the data

2. **Missing sessions**
   - Check if date filter is using `start_date` consistently
   - Verify timezone handling

3. **Wrong revenue totals**
   - Check if query includes sessions without billing
   - Verify join conditions

4. **Percentage errors**
   - Check if denominators are calculated correctly
   - Verify all data is included in totals

---

## Next Steps After Validation

1. Run all queries and document current results
2. Compare with dashboard display
3. Identify specific components showing wrong data
4. Use the comprehensive fix plan to address issues
5. Re-run validation after fixes

---

*Document created: February 16, 2026*
