# Analytics Fix Implementation Checklist

Quick reference checklist for fixing analytics dashboard issues.

---

## Pre-Implementation

- [ ] Backup current code files
- [ ] Run validation queries and document current state
- [ ] Create feature branch: `fix/analytics-comprehensive`
- [ ] Review comprehensive plan document

---

## Phase 1: Critical Data Accuracy (2-3 hours)

### File: `src/lib/analyticsService.ts`

#### Function: `getSummaryMetrics()`
- [ ] Add null safety for `energy_consumed_kwh` parsing
- [ ] Add null safety for `total_amount` parsing
- [ ] Fix active stations query to count only stations with sessions in date range
- [ ] Add validation for numeric conversions
- [ ] Test with January 2026 data
- [ ] Verify: Total Energy = 126,633.5 kWh for Jan 2026
- [ ] Verify: Total Sessions = 8,225 for Jan 2026

**Code Pattern:**
```typescript
const totalEnergy = sessions?.reduce((sum, s) => {
  const energy = parseFloat(s.energy_consumed_kwh || '0');
  return sum + (isNaN(energy) || energy < 0 ? 0 : energy);
}, 0) || 0;
```

#### Function: `getEnergyTrend()`
- [ ] Add null safety for date parsing
- [ ] Add null safety for energy value parsing
- [ ] Ensure all dates in range are represented
- [ ] Validate grouping logic (day/week/month)
- [ ] Test with various date ranges
- [ ] Verify: Energy totals match getSummaryMetrics()

---

## Phase 2: Revenue & Billing (1-2 hours)

### File: `src/lib/analyticsService.ts`

#### Function: `getSummaryMetrics()` - Revenue Part
- [ ] Verify billing calculations join is correct
- [ ] Add null safety for revenue parsing
- [ ] Count sessions without billing separately
- [ ] Add warning when many sessions lack billing
- [ ] Test revenue calculations
- [ ] Verify: Revenue matches SQL query sum

#### Function: `getRevenueByStation()`
- [ ] Fix station joins
- [ ] Add null safety for station name/code
- [ ] Ensure only stations with sessions are included
- [ ] Verify revenue totals per station
- [ ] Test with multiple stations
- [ ] Verify: Sum of station revenues = total revenue

---

## Phase 3: Environmental & Time Analysis (1-2 hours)

### File: `src/lib/analyticsService.ts`

#### Function: `getCO2ImpactMetrics()`
- [ ] Add null safety for `co2_reduction_kg`
- [ ] Count sessions with/without CO2 data
- [ ] Verify conversion factors (trees: 21kg, km: 0.171kg)
- [ ] Add data completeness indicator
- [ ] Test calculations
- [ ] Verify: CO2 totals match SQL query

#### Function: `getShiftComparison()`
- [ ] Add validation for `start_time` format
- [ ] Handle invalid hour values (< 0 or > 23)
- [ ] Add null safety for duration and CO2
- [ ] Ensure revenue only counts billed sessions
- [ ] Test shift boundaries (6AM, 12PM, 6PM)
- [ ] Verify: All shifts sum to total sessions

#### Function: `getBestTimeToCharge()`
- [ ] Validate time parsing
- [ ] Initialize all 24 hours
- [ ] Add null safety for billing amounts
- [ ] Calculate average cost only for billed sessions
- [ ] Test with various data patterns
- [ ] Verify: All 24 hours represented

---

## Phase 4: Distribution Charts (1-2 hours)

### File: `src/lib/analyticsService.ts`

#### Function: `getConnectorTypeComparison()`
- [ ] Normalize connector types (trim, handle null/empty)
- [ ] Group unknown/null as 'Unknown'
- [ ] Add null safety for all numeric fields
- [ ] Calculate average energy correctly
- [ ] Test with various connector types
- [ ] Verify: Totals match getSummaryMetrics()

#### Function: `getChargerTypeBreakdown()`
- [ ] Same fixes as connector type
- [ ] Ensure percentages sum to 100%
- [ ] Test percentage calculations
- [ ] Verify: Count matches total sessions

#### Function: `getStationUtilization()`
- [ ] Fix station name handling
- [ ] Ensure percentage calculation is correct
- [ ] Sort by energy descending
- [ ] Test with multiple stations
- [ ] Verify: Percentages sum to 100%

#### Function: `getDailyTransactionsByConnector()`
- [ ] Ensure all dates in range are included
- [ ] Initialize missing dates with 0 transactions
- [ ] Normalize connector types consistently
- [ ] Test with various date ranges
- [ ] Verify: All dates present, no gaps

---

## Component Updates

### File: `src/components/AnalyticsDashboard.tsx`
- [ ] Review state management
- [ ] Ensure all components receive correct props
- [ ] Verify date range propagates to all functions
- [ ] Test refresh functionality
- [ ] Add error boundaries if needed

### Chart Components (Review each)
- [ ] `EnergyTrendChart.tsx` - Verify data display
- [ ] `RevenueChart.tsx` - Verify totals
- [ ] `StationComparison.tsx` - Verify percentages
- [ ] `ShiftComparisonChart.tsx` - Verify shift data
- [ ] `ConnectorTypeChart.tsx` - Verify connector data
- [ ] `ChargerTypeBreakdown.tsx` - Verify distribution
- [ ] `BestTimeToChargeChart.tsx` - Verify hours
- [ ] `DailyTransactionsChart.tsx` - Verify dates
- [ ] `CO2ImpactCard.tsx` - Verify calculations
- [ ] `RecentActivityTable.tsx` - Verify filtering

---

## Testing Checklist

### Unit Tests (Per Function)
- [ ] Test with empty data (no sessions)
- [ ] Test with single session
- [ ] Test with null values
- [ ] Test with invalid values (negative energy, etc.)
- [ ] Test with sessions missing billing

### Integration Tests
- [ ] Test dashboard load with January 2026 filter
- [ ] Test dashboard load with "Last 30 Days"
- [ ] Test dashboard load with "This Month"
- [ ] Test dashboard load with custom date range
- [ ] Test refresh button functionality
- [ ] Test export functions

### Date Range Tests
- [ ] Single day
- [ ] Week range
- [ ] Month range
- [ ] Multi-month range
- [ ] Year range
- [ ] Edge cases (month boundaries, year boundaries)

### Data Validation Tests
Run SQL queries and compare:
- [ ] Total Energy matches
- [ ] Total Revenue matches
- [ ] Total Sessions matches
- [ ] Active Stations matches
- [ ] CO2 Reduction matches
- [ ] Shift distribution matches
- [ ] Connector distribution matches
- [ ] Hourly pattern matches
- [ ] Station distribution matches

---

## Validation Queries to Run

After each phase, run these queries for January 2026:

```sql
-- Summary validation
SELECT
  COUNT(*) as sessions,
  SUM(CAST(energy_consumed_kwh AS NUMERIC)) as energy,
  COUNT(DISTINCT station_id) as stations
FROM charging_sessions
WHERE start_date >= '2026-01-01' AND start_date <= '2026-01-31';

-- Revenue validation
SELECT SUM(CAST(total_amount AS NUMERIC)) as revenue
FROM billing_calculations bc
INNER JOIN charging_sessions cs ON bc.session_id = cs.id
WHERE cs.start_date >= '2026-01-01' AND cs.start_date <= '2026-01-31';
```

Expected Results:
- Sessions: 8,225
- Energy: 126,633.5 kWh
- Stations: 1
- Revenue: [Run query to determine]

---

## Code Quality Checks

- [ ] No console errors in browser
- [ ] No TypeScript errors
- [ ] All imports working correctly
- [ ] Proper error handling in place
- [ ] Loading states working
- [ ] No infinite loops or memory leaks

---

## Performance Checks

- [ ] Dashboard loads in < 3 seconds
- [ ] Date filter change updates in < 2 seconds
- [ ] Refresh completes in < 3 seconds
- [ ] No unnecessary re-renders
- [ ] Queries are optimized

---

## User Experience Checks

- [ ] All metrics display correctly
- [ ] All charts render properly
- [ ] Export functions work
- [ ] Error messages are helpful
- [ ] Loading indicators are clear
- [ ] Mobile responsive (if applicable)

---

## Final Acceptance Tests

### Test Scenario 1: January 2026
1. Set date range to January 2026
2. Verify metrics:
   - Total Energy: 126,633.5 kWh ✓
   - Total Sessions: 8,225 ✓
   - Active Stations: 1 ✓
   - Revenue: [matches SQL] ✓
3. Check all charts render
4. Verify export functions work

### Test Scenario 2: Last 30 Days
1. Select "Last 30 Days" preset
2. Verify all metrics update
3. Verify all charts update
4. Check date labels are correct

### Test Scenario 3: Custom Range
1. Select custom date range (7 days)
2. Verify daily grouping is used
3. Verify all 7 days are shown
4. Verify totals are correct

### Test Scenario 4: Edge Cases
1. Test with single day
2. Test with year range
3. Test with no data period
4. Verify graceful handling

---

## Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Validation queries documented
- [ ] Rollback plan ready
- [ ] Stakeholders informed

### Pre-Deployment
- [ ] Run final validation queries
- [ ] Document current state
- [ ] Backup database (if needed)
- [ ] Test in staging environment

### Deployment
- [ ] Deploy code changes
- [ ] Monitor for errors
- [ ] Verify analytics immediately
- [ ] Check performance metrics

### Post-Deployment
- [ ] Run validation queries in production
- [ ] Verify all dashboards working
- [ ] Monitor user feedback
- [ ] Document any issues found

---

## Rollback Procedure

If issues are found:
1. Revert code to previous version
2. Restore from backup if needed
3. Document issues encountered
4. Plan fixes for next iteration

---

## Success Criteria

### Must Have (Blocking)
- [ ] All analytics match SQL queries exactly
- [ ] No console errors
- [ ] No incorrect values displayed
- [ ] All date filters working

### Should Have (Important)
- [ ] All charts loading quickly (< 3s)
- [ ] Export functions working
- [ ] Error messages helpful
- [ ] Mobile responsive

### Nice to Have (Enhancement)
- [ ] Individual chart loading states
- [ ] Chart animations smooth
- [ ] Print-friendly layout
- [ ] Keyboard navigation

---

## Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| Phase 1: Critical | 2-3 hours | | |
| Phase 2: Revenue | 1-2 hours | | |
| Phase 3: Time/CO2 | 1-2 hours | | |
| Phase 4: Charts | 1-2 hours | | |
| Testing | 2-3 hours | | |
| **Total** | **7-12 hours** | | |

---

## Notes & Issues

Use this section to track issues found during implementation:

### Issues Found
1. [Date] - [Issue Description] - [Status]
2. [Date] - [Issue Description] - [Status]

### Questions
1. [Question] - [Answer/Status]

### Decisions Made
1. [Decision] - [Rationale]

---

## Related Documents

- **ANALYTICS-FIX-COMPREHENSIVE-PLAN.md** - Full detailed plan
- **ANALYTICS-VALIDATION-QUERIES.md** - SQL validation queries
- **ANALYTICS-FIX-CHECKLIST.md** - This checklist (you are here)

---

## Quick Start

1. Read comprehensive plan
2. Run validation queries
3. Follow this checklist step-by-step
4. Test after each phase
5. Validate with SQL queries
6. Deploy when all checks pass

---

*Document created: February 16, 2026*
*Last updated: February 16, 2026*
