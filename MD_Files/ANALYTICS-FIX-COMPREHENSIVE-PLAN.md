# Analytics Dashboard Comprehensive Fix Plan

**Version**: 2.0 (Updated after full code + database review)
**Date**: February 16, 2026

---

## Executive Summary

The analytics dashboard displays drastically incorrect values (e.g., user reported 1556.60 instead of correct totals). After a thorough review of every analytics file, every chart component, every service function, and live database queries, the **root cause** has been identified and verified.

---

## ROOT CAUSE: Supabase PostgREST 1000-Row Default Limit

**This is the single most important finding.**

Supabase's PostgREST API returns a **maximum of 1000 rows** by default when no explicit `.limit()` or `.range()` is specified. Every analytics query in `analyticsService.ts` fetches sessions using `.select()` without pagination, so when a date range contains more than 1000 sessions, only the first 1000 are returned. The rest are silently dropped.

### Proof

| Query | Actual Rows | Rows Returned | Data Loss |
|-------|-------------|---------------|-----------|
| Last 30 days sessions | **7,048** | 1,000 | **85.8% lost** |
| All sessions | **51,523** | 1,000 | **98.1% lost** |
| Billing calculations (last 30d) | **7,071** | 1,000 | **85.9% lost** |

### Impact

| Metric | Expected (Last 30d) | Shown (est. from 1000 rows) | Error |
|--------|---------------------|-----------------------------|-------|
| Total Energy | **106,691.0 kWh** | ~15,147.6 kWh | **-86%** |
| Total Sessions | **7,048** | 1,000 | **-86%** |
| Total Revenue | **20,998.387 JOD** | ~2,945.6 JOD | **-86%** |
| CO2 Reduction | **145,894.09 kg** | ~broken (string concat bug) | **N/A** |

**Every single chart and metric on the analytics dashboard is wrong.**

---

## All Bugs Found (Severity-Ranked)

### CRITICAL - Causes completely wrong data

#### BUG-1: Supabase 1000-Row Limit (ALL functions)
- **File**: `src/lib/analyticsService.ts` - Lines 136-141, 183-188, 315-324, 428-440, 483-494, 532-536, 563-573, 607-611, 631-636
- **Affected**: ALL 10 query functions (every function except `exportToCSV` and `getRecentActivity`)
- **Impact**: Only 14% of data is processed. All totals, distributions, and trends are wrong.
- **Fix**: Replace client-side aggregation with server-side PostgreSQL aggregation via `.rpc()`, or use pagination to fetch all rows.

#### BUG-2: CO2 String Concatenation (3 functions)
- **File**: `src/lib/analyticsService.ts`
- **Line 460**: `shifts[shift].co2 += session.co2_reduction_kg || 0;`
- **Line 506**: `existing.co2 += session.co2_reduction_kg || 0;`
- **Line 615**: `sum + (s.co2_reduction_kg || 0)`
- **Cause**: Supabase returns `numeric` columns as strings (e.g., `"14.74"`). The `||` operator on a truthy string returns the string. Then `0 + "14.74"` = `"014.74"` (string concatenation), not `14.74` (number addition). Result snowballs: `"014.7419.15"` etc.
- **Impact**: CO2 values are completely garbage - a concatenated string, not a number.
- **Fix**: Use `parseFloat(session.co2_reduction_kg || '0')` everywhere.

#### BUG-3: Active Stations Ignores Date Filter
- **File**: `src/lib/analyticsService.ts` - Lines 162-164
- **Code**: `const { count: activeStations } = await supabase.from('stations').select('*', { count: 'exact', head: true });`
- **Impact**: Always shows total station count regardless of selected date range.
- **Fix**: Count distinct `station_id` from `charging_sessions` within the date range.

### HIGH - Causes crashes or incorrect calculations

#### BUG-4: Null Crash on start_time Parsing
- **File**: `src/lib/analyticsService.ts`
- **Line 451**: `const hour = parseInt(session.start_time.split(':')[0]);` (getShiftComparison)
- **Line 585**: `const hour = parseInt(session.start_time.split(':')[0]);` (getBestTimeToCharge)
- **Impact**: If `start_time` is null/undefined, calling `.split()` on it throws a TypeError and crashes the entire dashboard load.
- **Fix**: Add null check before parsing.

#### BUG-5: Best Time avgCost Uses Wrong Denominator
- **File**: `src/lib/analyticsService.ts` - Line 598
- **Code**: `avgCost: data.sessions > 0 ? data.totalCost / data.sessions : 0`
- **Impact**: Divides total cost by ALL sessions including those without billing, diluting the average. Should divide only by sessions that have billing.
- **Fix**: Track `billedSessionCount` separately and use it as denominator.

### MODERATE - Shows incomplete or subtly wrong data

#### BUG-6: Null Connector Type Not Normalized
- **File**: `src/lib/analyticsService.ts` - Lines 501, 544, 644
- **Impact**: 111 sessions have `null` connector_type. Code uses `session.connector_type || 'Unknown'` which works, but doesn't trim whitespace. Could cause duplicate groups if data has inconsistent spacing.
- **Fix**: Use `(session.connector_type?.trim() || 'Unknown')`.

#### BUG-7: Column Name Wrong in Previous Plan
- **Previous plan referenced**: `has_billing` column
- **Actual column name**: `has_billing_calculation` (boolean)
- **Impact**: Any code referencing `has_billing` would fail silently.

#### BUG-8: Energy Trend Week Key Mismatch
- **File**: `src/lib/analyticsService.ts` - Lines 222-244
- **Impact**: When `groupBy` is 'week', sessions whose week-start falls outside the generated intervals are silently dropped (the `if (existing)` check at line 239 fails). This can happen for sessions near date range boundaries.
- **Fix**: Always create the key if it doesn't exist, rather than silently dropping.

#### BUG-9: No parseFloat Safety on energy_consumed_kwh
- **File**: `src/lib/analyticsService.ts` - Lines 144, 241, 335, 458, 504, 586, 616
- **Impact**: `parseFloat(null)` or `parseFloat(undefined)` returns `NaN`. Then `sum + NaN = NaN`, corrupting all subsequent calculations.
- **Fix**: Use `parseFloat(s.energy_consumed_kwh || '0')` everywhere.

---

## Verified Database State (as of Feb 16, 2026)

### Overall
| Metric | Value |
|--------|-------|
| Total Sessions | 51,523 |
| Date Range | Aug 1, 2025 - Feb 15, 2026 |
| Total Energy | 834,150.0 kWh |
| Total Revenue (all time) | Not verified (billing exists for subset) |
| Active Stations | 1 |
| Connector Types | 6 (GBT DC, CCS1, CHAdeMO, CCS2, NACS(Tesla), null) |

### Last 30 Days (Jan 17 - Feb 16, 2026)
| Metric | Verified Value |
|--------|---------------|
| Total Sessions | **7,048** |
| Total Energy | **106,691.0 kWh** |
| Active Stations | **1** |
| Total Revenue | **20,998.387 JOD** |
| Billing Records | **7,071** |
| Sessions with billing | **7,042** (99.9%) |
| Sessions with CO2 data | **6,978** (99.0%) |
| Sessions without CO2 | **70** (1.0%) |
| Total CO2 Reduction | **145,894.09 kg** |

### Connector Type Distribution (Last 30 Days)
| Type | Sessions |
|------|----------|
| GBT DC | 4,827 |
| CCS1 | 1,054 |
| CHAdeMO | 435 |
| CCS2 | 413 |
| NACS(Tesla) | 208 |
| null (Unknown) | 111 |

### Database Column Types (Relevant)
| Column | Type | Nullable | Supabase JS Returns |
|--------|------|----------|-------------------|
| `energy_consumed_kwh` | numeric | NOT NULL | string (e.g., "15.4") |
| `co2_reduction_kg` | numeric | YES (nullable) | string or null |
| `start_time` | time without time zone | NOT NULL | string (e.g., "14:30:00") |
| `duration_minutes` | integer | NOT NULL | number |
| `connector_type` | text | YES (nullable) | string or null |
| `has_billing_calculation` | boolean | YES | boolean or null |
| `total_amount` (billing_calculations) | numeric | - | string |

### Existing Indexes (Confirmed)
- `idx_charging_sessions_start_date` (btree on start_date) - GOOD
- `idx_charging_sessions_station_id` (btree on station_id) - GOOD
- `idx_charging_sessions_start_ts` (btree on start_ts) - GOOD
- `idx_sessions_has_billing` (btree on has_billing_calculation) - GOOD

---

## Recommended Solution Architecture

### Option A: Server-Side Aggregation with PostgreSQL Functions (RECOMMENDED)

Create database functions that perform aggregation in PostgreSQL and return only the results. Call via Supabase `.rpc()`.

**Advantages**:
- Eliminates 1000-row limit entirely (aggregation happens in DB)
- Much faster (no data transfer overhead)
- Scales to any number of sessions
- Single query per metric instead of fetching all rows

**Example for Summary Metrics**:
```sql
CREATE OR REPLACE FUNCTION get_analytics_summary(p_start_date date, p_end_date date)
RETURNS JSON AS $$
  SELECT json_build_object(
    'totalEnergy', COALESCE(SUM(energy_consumed_kwh), 0),
    'totalSessions', COUNT(*),
    'activeStations', COUNT(DISTINCT station_id)
  )
  FROM charging_sessions
  WHERE start_date >= p_start_date AND start_date <= p_end_date;
$$ LANGUAGE sql STABLE;
```

**Client call**:
```typescript
const { data } = await supabase.rpc('get_analytics_summary', {
  p_start_date: startDateStr,
  p_end_date: endDateStr
});
```

### Option B: Pagination Helper (SIMPLER but less performant)

Create a helper that fetches all rows in batches of 1000:

```typescript
async function fetchAllRows(query: any): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}
```

**Advantages**: Simpler to implement, no database changes needed.
**Disadvantages**: Still transfers all data to client, slower for large datasets.

### Recommended Approach: Hybrid

- **Use Option A (RPC functions)** for: Summary metrics, Energy trend, Station utilization, Revenue by station, Shift comparison, Connector type comparison, Charger type breakdown, Best time to charge, CO2 impact, Daily transactions
- **Use Option B (pagination)** only if RPC functions are not feasible for a specific query
- **Keep current approach** for: Recent Activity (already limited to 10 rows)

---

## Component-by-Component Fix Plan

### 1. Summary Metrics (Top Cards)

**File**: `src/lib/analyticsService.ts` - `getSummaryMetrics()` (lines 130-174)

**Bugs Present**:
- BUG-1: 1000-row limit (sessions query, line 136-141)
- BUG-1: 1000-row limit (billings query, line 147-156)
- BUG-3: Active stations ignores date filter (line 162-164)
- BUG-9: No parseFloat safety (line 144)

**Fix**: Replace with RPC function:
```sql
CREATE OR REPLACE FUNCTION get_analytics_summary(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT json_build_object(
    'totalEnergy', COALESCE(SUM(cs.energy_consumed_kwh), 0),
    'totalSessions', COUNT(*),
    'activeStations', COUNT(DISTINCT cs.station_id),
    'totalRevenue', COALESCE((
      SELECT SUM(bc.total_amount)
      FROM billing_calculations bc
      INNER JOIN charging_sessions cs2 ON bc.session_id = cs2.id
      WHERE cs2.start_date >= p_start AND cs2.start_date <= p_end
    ), 0)
  )
  FROM charging_sessions cs
  WHERE cs.start_date >= p_start AND cs.start_date <= p_end;
$$ LANGUAGE sql STABLE;
```

**Expected Results (Last 30d)**: Energy=106691.0, Sessions=7048, Stations=1, Revenue=20998.387

---

### 2. Energy Consumption Trend

**File**: `src/lib/analyticsService.ts` - `getEnergyTrend()` (lines 176-254)

**Bugs Present**:
- BUG-1: 1000-row limit (line 183-188)
- BUG-8: Week key mismatch at boundaries (line 239)
- BUG-9: No parseFloat safety (line 241)

**Fix**: Replace with RPC function that groups by day/week/month in SQL:
```sql
CREATE OR REPLACE FUNCTION get_energy_trend(p_start date, p_end date, p_group_by text)
RETURNS JSON AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT
      CASE p_group_by
        WHEN 'day' THEN start_date::text
        WHEN 'week' THEN date_trunc('week', start_date)::date::text
        WHEN 'month' THEN date_trunc('month', start_date)::date::text
      END as period,
      SUM(energy_consumed_kwh) as energy,
      COUNT(*) as sessions
    FROM charging_sessions
    WHERE start_date >= p_start AND start_date <= p_end
    GROUP BY period
    ORDER BY period
  ) t;
$$ LANGUAGE sql STABLE;
```

**Note**: Client-side formatting of the period labels can still be done in TypeScript after receiving the raw data.

---

### 3. Revenue by Station

**File**: `src/lib/analyticsService.ts` - `getRevenueByStation()` (lines 256-307)

**Bugs Present**:
- BUG-1: 1000-row limit (billing query, line 262-276)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_revenue_by_station(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      s.name as station,
      s.station_code as station_code,
      COALESCE(SUM(bc.total_amount), 0) as revenue,
      COUNT(DISTINCT bc.id) as sessions
    FROM billing_calculations bc
    INNER JOIN charging_sessions cs ON bc.session_id = cs.id
    INNER JOIN stations s ON cs.station_id = s.id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY s.id, s.name, s.station_code
    ORDER BY revenue DESC
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 4. Station Utilization (Energy Distribution)

**File**: `src/lib/analyticsService.ts` - `getStationUtilization()` (lines 309-351)

**Bugs Present**:
- BUG-1: 1000-row limit (line 315-324)
- BUG-9: No parseFloat safety (line 335)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_station_utilization(p_start date, p_end date)
RETURNS JSON AS $$
  WITH station_data AS (
    SELECT
      s.name,
      SUM(cs.energy_consumed_kwh) as energy,
      COUNT(*) as sessions
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
        THEN (sd.energy / tot.total_energy * 100)
        ELSE 0
      END as percentage
    FROM station_data sd, total tot
    ORDER BY sd.energy DESC
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 5. Shift Comparison

**File**: `src/lib/analyticsService.ts` - `getShiftComparison()` (lines 423-476)

**Bugs Present**:
- BUG-1: 1000-row limit (line 428-440)
- BUG-2: CO2 string concatenation (line 460)
- BUG-4: Null crash on start_time (line 451)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_shift_comparison(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      CASE
        WHEN EXTRACT(HOUR FROM start_time) >= 6 AND EXTRACT(HOUR FROM start_time) < 12 THEN 'Morning'
        WHEN EXTRACT(HOUR FROM start_time) >= 12 AND EXTRACT(HOUR FROM start_time) < 18 THEN 'Afternoon'
        ELSE 'Night'
      END as shift,
      SUM(energy_consumed_kwh) as energy,
      COALESCE(SUM(bc.total_amount), 0) as revenue,
      COUNT(*) as sessions,
      COALESCE(SUM(co2_reduction_kg), 0) as co2_reduction,
      CASE WHEN COUNT(*) > 0 THEN AVG(duration_minutes) ELSE 0 END as avg_duration
    FROM charging_sessions cs
    LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY shift
    ORDER BY
      CASE shift
        WHEN 'Morning' THEN 1
        WHEN 'Afternoon' THEN 2
        WHEN 'Night' THEN 3
      END
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 6. Connector Type Comparison

**File**: `src/lib/analyticsService.ts` - `getConnectorTypeComparison()` (lines 478-525)

**Bugs Present**:
- BUG-1: 1000-row limit (line 483-494)
- BUG-2: CO2 string concatenation (line 506)
- BUG-6: Null connector not trimmed (line 501)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_connector_type_comparison(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown') as connector_type,
      SUM(cs.energy_consumed_kwh) as energy,
      COALESCE(SUM(bc.total_amount), 0) as revenue,
      COUNT(*) as sessions,
      CASE WHEN COUNT(*) > 0
        THEN SUM(cs.energy_consumed_kwh) / COUNT(*)
        ELSE 0
      END as avg_energy,
      COALESCE(SUM(cs.co2_reduction_kg), 0) as co2_reduction
    FROM charging_sessions cs
    LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
    ORDER BY revenue DESC
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 7. Charger Type Breakdown

**File**: `src/lib/analyticsService.ts` - `getChargerTypeBreakdown()` (lines 527-556)

**Bugs Present**:
- BUG-1: 1000-row limit (line 532-536)
- BUG-6: Null connector not trimmed (line 544)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_charger_type_breakdown(p_start date, p_end date)
RETURNS JSON AS $$
  WITH type_counts AS (
    SELECT
      COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as type,
      COUNT(*) as count
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
        THEN (tc.count::numeric / tot.total * 100)
        ELSE 0
      END as percentage
    FROM type_counts tc, total tot
    ORDER BY tc.count DESC
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 8. Best Time to Charge

**File**: `src/lib/analyticsService.ts` - `getBestTimeToCharge()` (lines 558-600)

**Bugs Present**:
- BUG-1: 1000-row limit (line 563-573)
- BUG-4: Null crash on start_time (line 585)
- BUG-5: avgCost wrong denominator (line 598)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_best_time_to_charge(p_start date, p_end date)
RETURNS JSON AS $$
  WITH hours AS (
    SELECT generate_series(0, 23) as hour
  ),
  hourly_data AS (
    SELECT
      EXTRACT(HOUR FROM cs.start_time)::int as hour,
      SUM(cs.energy_consumed_kwh) as energy,
      COUNT(*) as sessions,
      COALESCE(SUM(bc.total_amount), 0) as total_cost,
      COUNT(bc.id) as billed_sessions
    FROM charging_sessions cs
    LEFT JOIN billing_calculations bc ON cs.id = bc.session_id
    WHERE cs.start_date >= p_start AND cs.start_date <= p_end
    GROUP BY EXTRACT(HOUR FROM cs.start_time)::int
  )
  SELECT json_agg(row_to_json(t) ORDER BY t.hour)
  FROM (
    SELECT
      h.hour,
      COALESCE(hd.energy, 0) as energy,
      COALESCE(hd.sessions, 0) as sessions,
      CASE WHEN COALESCE(hd.billed_sessions, 0) > 0
        THEN hd.total_cost / hd.billed_sessions
        ELSE 0
      END as avg_cost
    FROM hours h
    LEFT JOIN hourly_data hd ON h.hour = hd.hour
  ) t;
$$ LANGUAGE sql STABLE;
```

---

### 9. CO2 Impact Metrics

**File**: `src/lib/analyticsService.ts` - `getCO2ImpactMetrics()` (lines 602-624)

**Bugs Present**:
- BUG-1: 1000-row limit (line 607-611)
- BUG-2: CO2 string concatenation (line 615)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_co2_impact(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT json_build_object(
    'totalCO2Reduction', COALESCE(SUM(co2_reduction_kg), 0),
    'treesEquivalent', COALESCE(SUM(co2_reduction_kg), 0) / 21.0,
    'kmDrivenEquivalent', COALESCE(SUM(co2_reduction_kg), 0) / 0.171,
    'energyUsed', COALESCE(SUM(energy_consumed_kwh), 0)
  )
  FROM charging_sessions
  WHERE start_date >= p_start AND start_date <= p_end;
$$ LANGUAGE sql STABLE;
```

---

### 10. Daily Transactions by Connector

**File**: `src/lib/analyticsService.ts` - `getDailyTransactionsByConnector()` (lines 626-664)

**Bugs Present**:
- BUG-1: 1000-row limit (line 631-636)
- BUG-6: Null connector not trimmed (line 644)

**Fix**: RPC function:
```sql
CREATE OR REPLACE FUNCTION get_daily_transactions_by_connector(p_start date, p_end date)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date), '[]'::json)
  FROM (
    SELECT
      start_date as date,
      COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as connector_type,
      COUNT(*) as count
    FROM charging_sessions
    WHERE start_date >= p_start AND start_date <= p_end
    GROUP BY start_date, connector_type
    ORDER BY start_date
  ) t;
$$ LANGUAGE sql STABLE;
```

**Note**: The client-side code will need to pivot this data into the `DailyTransaction` format (date as key, connector types as columns).

---

### 11. Recent Activity Table

**File**: `src/lib/analyticsService.ts` - `getRecentActivity()` (lines 353-392)

**Bugs Present**:
- None critical (already uses `.limit(10)`)
- BUG-9: No parseFloat safety (line 385)

**Fix**: Add parseFloat safety:
```typescript
energy: parseFloat(session.energy_consumed_kwh || '0'),
```

This function is the only one NOT affected by BUG-1 because it explicitly limits to 10 rows.

---

## Implementation Plan

### Phase 1: Create Database Functions (Migration)

Create a single migration with all 10 RPC functions. This is safe because:
- All functions are read-only (SELECT only)
- No schema changes
- No data modifications
- Can be dropped and recreated safely

**Functions to create**:
1. `get_analytics_summary(p_start date, p_end date)` - Returns JSON
2. `get_energy_trend(p_start date, p_end date, p_group_by text)` - Returns JSON
3. `get_revenue_by_station(p_start date, p_end date)` - Returns JSON
4. `get_station_utilization(p_start date, p_end date)` - Returns JSON
5. `get_shift_comparison(p_start date, p_end date)` - Returns JSON
6. `get_connector_type_comparison(p_start date, p_end date)` - Returns JSON
7. `get_charger_type_breakdown(p_start date, p_end date)` - Returns JSON
8. `get_best_time_to_charge(p_start date, p_end date)` - Returns JSON
9. `get_co2_impact(p_start date, p_end date)` - Returns JSON
10. `get_daily_transactions_by_connector(p_start date, p_end date)` - Returns JSON

### Phase 2: Rewrite analyticsService.ts

Replace all 10 query functions to call `.rpc()` instead of `.from().select()`.

**Key changes**:
- Each function becomes a simple `.rpc()` call
- No client-side aggregation (no reduce, no forEach loops)
- All numeric parsing happens in PostgreSQL
- All null handling happens in PostgreSQL
- Much simpler, less error-prone code

**Example rewrite**:
```typescript
export async function getSummaryMetrics(dateRange: DateRange): Promise<SummaryMetrics> {
  const startDateStr = format(dateRange.startDate, 'yyyy-MM-dd');
  const endDateStr = format(dateRange.endDate, 'yyyy-MM-dd');

  const { data, error } = await supabase.rpc('get_analytics_summary', {
    p_start: startDateStr,
    p_end: endDateStr
  });

  if (error) throw error;

  return {
    totalEnergy: data.totalEnergy || 0,
    totalRevenue: data.totalRevenue || 0,
    totalSessions: data.totalSessions || 0,
    activeStations: data.activeStations || 0
  };
}
```

### Phase 3: Update Chart Components (if needed)

Most chart components should work with the same data shapes. Only update if:
- The data structure from RPC differs from current expectations
- Additional fields need to be displayed (e.g., billed session counts)

**Components likely needing updates**:
- `EnergyTrendChart.tsx` - May need to handle raw dates from RPC instead of pre-formatted labels
- `DailyTransactionsChart.tsx` - Will need client-side pivot of RPC results
- `AnalyticsDashboard.tsx` - Minimal changes (same function signatures)

### Phase 4: Testing and Validation

Compare dashboard values against verified SQL results for each date range preset.

---

## Files to Modify

| File | Change Type | Priority |
|------|-------------|----------|
| New migration SQL | CREATE FUNCTION (10 functions) | Phase 1 |
| `src/lib/analyticsService.ts` | Complete rewrite of query functions | Phase 2 |
| `src/components/EnergyTrendChart.tsx` | Minor data format update | Phase 3 |
| `src/components/DailyTransactionsChart.tsx` | Data pivot logic | Phase 3 |
| `src/components/AnalyticsDashboard.tsx` | Minimal (same API) | Phase 3 |

**Components that should NOT need changes** (data shape unchanged):
- `MetricCard.tsx`
- `RevenueChart.tsx`
- `StationComparison.tsx`
- `ShiftComparisonChart.tsx`
- `ConnectorTypeChart.tsx`
- `ChargerTypeBreakdown.tsx`
- `BestTimeToChargeChart.tsx`
- `CO2ImpactCard.tsx`
- `RecentActivityTable.tsx`
- `DateRangeSelector.tsx`

---

## Validation Queries (Run After Fix)

### Quick Comparison (Last 30 Days)

Expected results after fix:

| Metric | Expected Value |
|--------|---------------|
| Total Sessions | 7,048 |
| Total Energy | 106,691.0 kWh |
| Active Stations | 1 |
| Total Revenue | 20,998.387 JOD |
| CO2 Reduction | 145,894.09 kg |
| Trees Equivalent | ~6,947 |
| KM Driven Equivalent | ~853,181 |

### Per-Component Verification

```sql
-- Verify shift comparison
SELECT
  CASE
    WHEN EXTRACT(HOUR FROM start_time) >= 6 AND EXTRACT(HOUR FROM start_time) < 12 THEN 'Morning'
    WHEN EXTRACT(HOUR FROM start_time) >= 12 AND EXTRACT(HOUR FROM start_time) < 18 THEN 'Afternoon'
    ELSE 'Night'
  END as shift,
  COUNT(*) as sessions,
  SUM(energy_consumed_kwh) as energy
FROM charging_sessions
WHERE start_date >= '2026-01-17' AND start_date <= '2026-02-16'
GROUP BY shift;

-- Verify connector breakdown
SELECT
  COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as type,
  COUNT(*) as sessions,
  SUM(energy_consumed_kwh) as energy
FROM charging_sessions
WHERE start_date >= '2026-01-17' AND start_date <= '2026-02-16'
GROUP BY type
ORDER BY sessions DESC;
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RPC function SQL error | Low | High | Test each function independently first |
| Data type mismatch (RPC returns) | Medium | Medium | Verify JSON structure matches TypeScript interfaces |
| Performance regression | Low | Low | RPC functions are faster than current approach |
| Breaking existing exports | Low | Medium | Export functions use same data, just verify format |

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Data fetching | Client-side with 1000-row limit | Server-side SQL aggregation |
| Aggregation | JavaScript reduce/forEach (BUG-prone) | PostgreSQL SUM/COUNT/AVG (correct) |
| CO2 calculation | String concatenation bug | Numeric SUM in SQL |
| Active stations | All stations (ignores filter) | DISTINCT station_id in date range |
| Null handling | Inconsistent (crashes, NaN) | COALESCE in SQL |
| Performance | Fetches up to 1000 rows per query x 11 queries | Returns only aggregated results |
| Code complexity | ~350 lines of aggregation logic | ~100 lines of RPC calls |

---

*Version 2.0 - Updated February 16, 2026 after full code review and database validation*
*Previous version: 1.0 (initial plan with speculative issues)*
