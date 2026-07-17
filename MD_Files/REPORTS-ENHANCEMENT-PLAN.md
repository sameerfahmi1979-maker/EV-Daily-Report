# Reports Module Enhancement Plan

## Status: PENDING REVIEW - No implementation yet

---

## Scope

Three changes requested:
1. Remove "Exclude Test Sessions (Demo Only)" checkbox
2. Audit and fix all filter-to-export data flow inconsistencies
3. Add a results summary strip (total energy, total amount, total duration) above the data table

---

## Files Involved

| File | Role | Lines |
|------|------|-------|
| `src/components/ExportPage.tsx` | UI: filters, table, export buttons | ~728 |
| `src/lib/reportService.ts` | Queries + PDF/Excel/CSV generation | ~1325 |

---

## Part 1: Remove "Exclude Test Sessions"

### What exists now
- `ExportPage.tsx:74` -- state: `const [excludeTestSessions, setExcludeTestSessions] = useState(true);`
- `ExportPage.tsx:94` -- listed in useEffect dependency array
- `ExportPage.tsx:508-519` -- yellow banner with checkbox UI
- The filter is **never applied** to any Supabase query or any export function. It is purely decorative.

### Plan
- Delete the `excludeTestSessions` state variable (line 74)
- Remove it from the useEffect dependency array (line 94)
- Delete the entire yellow banner block (lines 508-519)
- No query or export function changes needed since it was never wired up

### Risk: None. No data logic changes.

---

## Part 2: Filter-to-Export Audit

### 2A. Filter Matrix -- Current State

There are 5 active filters that matter:

| Filter | UI Table Query | Sessions Excel | Sessions CSV | Sessions PDF | Billing Excel | Billing CSV | Billing PDF | Summary |
|--------|---------------|----------------|-------------|-------------|--------------|------------|------------|---------|
| Date range | YES | YES | YES | YES | YES | YES | YES | YES (month only) |
| Time range | YES | YES | YES | YES | YES | YES | YES | NO |
| Station | YES | YES | YES | YES | YES | YES | YES | NO |
| Card Number | YES | NO | NO | YES | NO | NO | YES | NO |
| Search term | YES | NO | NO | NO | NO | NO | NO | NO |

### 2B. Bugs Found

#### BUG 1: cardNumber missing from Excel and CSV exports (HIGH)

**Sessions Excel** (`reportService.ts:398`): Function signature has no `cardNumber` parameter.
**Sessions CSV** (`reportService.ts:481`): Same -- no `cardNumber` parameter.
**Billing Excel** (`reportService.ts:742`): Same -- no `cardNumber` parameter.
**Billing CSV** (`reportService.ts:822`): Same -- no `cardNumber` parameter.

**Call sites in ExportPage.tsx:**
- Line 263: `exportSessionsToExcel(start, end, stationId, true, startTime, endTime)` -- missing cardNumber
- Line 265: `exportSessionsToCSV(start, end, stationId, startTime, endTime)` -- missing cardNumber
- Line 273: `exportBillingToExcel(start, end, stationId, true, startTime, endTime)` -- missing cardNumber
- Line 275: `exportBillingToCSV(start, end, stationId, startTime, endTime)` -- missing cardNumber

**Only PDF exports pass cardNumber:**
- Line 267: `exportSessionsToPDF(start, end, stationId, true, startTime, endTime, cardNumber)` -- correct
- Line 277: `exportBillingToPDF(start, end, stationId, true, startTime, endTime, cardNumber)` -- correct

**Impact:** If user filters by operator/card number and exports to Excel or CSV, the export will contain ALL sessions regardless of operator. Only PDF respects this filter. User may not notice the discrepancy.

**Fix:** Add `cardNumber?: string` parameter to all 4 functions (Sessions Excel, Sessions CSV, Billing Excel, Billing CSV). Apply `.eq('card_number', cardNumber)` when provided. Update all call sites to pass `cardNumber`.

---

#### BUG 2: searchTerm not applied to any export (MEDIUM)

**Current behavior:** The search box filters the UI table via `.ilike('transaction_id', '%searchTerm%')` (ExportPage.tsx:164). But no export function receives or applies searchTerm.

**Impact:** User searches for a specific transaction ID, sees 1 result in the table, clicks export -- gets ALL sessions for the date range.

**Fix:** Add `searchTerm?: string` parameter to all 6 session/billing export functions. Apply `.ilike('transaction_id', '%searchTerm%')` when provided. Update all call sites.

---

#### BUG 3: Supabase 1000-row limit on Excel/CSV exports (HIGH)

**Current behavior:** Excel and CSV export functions (`exportSessionsToExcel`, `exportSessionsToCSV`, `exportBillingToExcel`, `exportBillingToCSV`) have NO `.limit()` call. Supabase PostgREST has a default limit of 1,000 rows. For date ranges with >1,000 sessions, exported files will silently be truncated.

**Evidence:** The analytics dashboard had the exact same bug (fixed in a previous migration). A 30-day range has 7,000+ sessions.

**Impact:** Users exporting monthly data get only the most recent 1,000 sessions with no warning.

**Fix options (choose one during implementation):**
- **Option A:** Paginated fetch loop -- fetch 1,000 rows at a time until exhausted, concatenate all results
- **Option B:** Create an RPC function that returns all rows for a given filter set (bypasses PostgREST limit)
- **Recommended:** Option A -- simpler, no migration needed, works for all export types

---

#### BUG 4: PDF exports silently limited to 500 rows, shows only 100 (LOW-MEDIUM)

**Sessions PDF** (`reportService.ts:575`): `.limit(500)`
**Billing PDF** (`reportService.ts:927`): `.limit(500)`

Both PDFs then slice to first 100 rows for the table (lines 667, 1029). However, the summary metrics (totals) are calculated from the full 500-row result, so totals are also wrong for large datasets.

**Impact:** PDF summary says "Total Energy: X" but that X only covers 500 of potentially 7,000 sessions.

**Fix:**
- Fetch all rows (using paginated loop from BUG 3 fix)
- Calculate summary metrics from ALL rows
- Keep showing first 100 rows in the PDF table (reasonable for printable output)
- Add text: "Showing first 100 of N total sessions. See summary for complete totals."

---

#### BUG 5: Summary report ignores all filters except month (LOW)

**`generateMonthlySummary`** (`reportService.ts:1104`):
- Only takes a `month: Date` parameter
- Ignores station, operator, time range
- Uses `start_date` field (not `start_ts`) so cannot filter by time
- Subject to the same 1,000-row limit (no pagination)

**Impact:** Summary tab always shows the full month regardless of filters selected.

**Fix:** Add optional parameters: `stationId`, `cardNumber`, `startTime`, `endTime`. Apply filters when provided. Use paginated fetch.

---

#### BUG 6: Summary CSV missing summary metrics (LOW)

**`exportSummaryToExcel`** (`reportService.ts:1170-1202`): Exports 2 sheets -- summary metrics + station breakdown.
**`exportSummaryToCSV`** (`reportService.ts:1204-1224`): Only exports station breakdown. Summary metrics are omitted entirely.

**Fix:** Prepend summary metrics as header rows in the CSV, or export two CSV files.

---

#### BUG 7: Billing duplicate rows inflate totals (MEDIUM)

Same issue we fixed in the analytics RPC functions: 209 sessions have duplicate `billing_calculations` records. All export functions use `billing_calculations[0]` so they pick one record per session (which happens to be correct for row-level data). BUT if a future query joins differently, this could resurface.

**Current workaround:** Using `[0]` index is incidentally correct because both duplicates have the same amount.

**Fix:** No immediate code change needed, but the root cause (duplicate billing records) should be cleaned up via a separate data-cleanup migration. Add a unique constraint on `billing_calculations(session_id)` after deduplication to prevent future duplicates.

---

#### BUG 8: Search placeholder is misleading (LOW)

**ExportPage.tsx:340**: Placeholder text says "Search by ticket, vehicle, driver, customer, or material..."
**Actual query** (line 164): Only searches `transaction_id`.

**Fix:** Change placeholder to "Search by Transaction ID" to match actual behavior.

---

### 2C. Fix Priority Order

| Priority | Bug | Effort | Impact |
|----------|-----|--------|--------|
| 1 | BUG 3: 1000-row limit on exports | Medium | Users lose 85%+ of data in exports |
| 2 | BUG 1: cardNumber missing from Excel/CSV | Low | Filtered exports contain wrong data |
| 3 | BUG 4: PDF 500-row limit on summaries | Medium | PDF summary totals are wrong |
| 4 | BUG 2: searchTerm not in exports | Low | Export ignores active search |
| 5 | BUG 5: Summary ignores filters | Medium | Summary always full month |
| 6 | BUG 8: Misleading search placeholder | Trivial | UX confusion |
| 7 | BUG 6: Summary CSV missing metrics | Low | Inconsistent with Excel |
| 8 | BUG 7: Billing duplicates root cause | Medium | Data integrity (latent risk) |

---

## Part 3: Add Results Summary Strip

### What exists now
- `ExportPage.tsx:300-301`: Two values are already calculated from the paginated transaction data:
  ```
  const totalEnergy = transactions.reduce(...)
  const totalRevenue = transactions.reduce(...)
  ```
- These are calculated from the **current page** of results (10-100 rows), not the full dataset. They are not displayed as a summary.

### Problem
- Current totals are from the paginated subset, not the full filtered result set
- `duration_minutes` is not included in the current page query (but IS in the raw data)
- `totalCount` (line 70) is the only value that represents the full result set

### Plan

**Step 1: Create a summary RPC function** (or reuse existing `get_analytics_summary` with filter extensions)

New function: `get_report_summary(p_start date, p_end date, p_start_time time, p_end_time time, p_station_id uuid, p_card_number text)`

Returns:
```json
{
  "totalEnergy": 106691.0,
  "totalAmount": 20923.601,
  "totalDuration": 147302,
  "totalSessions": 7048
}
```

This runs a single SQL query with all filters applied, returning correct totals for the entire filtered dataset (no row limit).

**Step 2: Add summary strip to ExportPage.tsx**

Position: Between the filter bar and the results table (after line 519, before line 521).

Layout: A horizontal strip with 4 metric cards:
- Total Sessions: `7,048`
- Total Energy: `106,691.0 kWh`
- Total Amount: `20,923.60 JOD`
- Total Duration: `2,455 hrs 2 min`

Design: Use a clean row of stat cards with subtle background, matching the existing design language. Similar to the PDF summary metrics section but rendered in the UI.

**Step 3: Trigger summary refresh**

- Fetch summary whenever filters change (debounced, same as `loadTransactions`)
- Show a loading skeleton while the RPC call is in flight
- Summary reflects ALL matching records, not just the current page

---

## Implementation Checklist (for when approved)

### Phase A: Remove Test Sessions UI
- [ ] Delete `excludeTestSessions` state and checkbox
- [ ] Remove from useEffect dependency array

### Phase B: Fix Filter Consistency
- [ ] Add `cardNumber` param to 4 export functions (Sessions Excel, Sessions CSV, Billing Excel, Billing CSV)
- [ ] Add `searchTerm` param to all 6 export functions
- [ ] Update all call sites in ExportPage.tsx to pass all active filters
- [ ] Fix search placeholder text
- [ ] Implement paginated fetch utility to bypass 1000-row limit
- [ ] Apply paginated fetch to all Excel/CSV exports
- [ ] Apply paginated fetch to PDF summary calculations (keep 100-row display limit)
- [ ] Add "Showing X of Y" text to PDF when truncated
- [ ] Add filter params to `generateMonthlySummary`
- [ ] Add summary metrics to CSV summary export

### Phase C: Add Summary Strip
- [ ] Create `get_report_summary` RPC function (migration)
- [ ] Add summary state + fetch logic to ExportPage.tsx
- [ ] Render 4 metric cards between filters and table
- [ ] Add loading skeleton for summary

### Phase D: Verification
- [ ] Test each filter combination with each export format (3 tabs x 3 formats = 9 combinations)
- [ ] Verify exported data matches UI table data for same filters
- [ ] Verify summary strip totals match PDF summary metrics
- [ ] Test with >1000 sessions to confirm pagination works
- [ ] Test with operator filter on Excel/CSV exports

---

## Questions for Review

1. **Search term in exports:** Should the text search filter also apply when exporting? Or should exports always include all records matching the other filters? (Plan assumes: yes, apply it)

2. **Summary tab filters:** Should the Station Performance tab respect station/operator filters? Currently it only takes a month. (Plan assumes: yes, extend it)

3. **PDF row limit:** Is 100 rows in the PDF table acceptable? Or should we paginate across multiple PDF pages to include all rows? (Plan assumes: keep 100, fix summary totals)

4. **Duplicate billing records:** Should we clean these up now, or defer to a separate task? (Plan assumes: defer, but add unique constraint to prevent new ones)
