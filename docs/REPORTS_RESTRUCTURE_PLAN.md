# Reports Menu — Full Restructure Plan

Complete redesign of the Reports module in the EV CSMS application. The current monolithic `ExportPage.tsx` with its shared filter panel and limited export support will be replaced by a modern, tab-based report center where **every tab** has its own independent filters and **every tab** supports unlimited export to PDF, Excel, and CSV.

---

## Core Behavior: Filter-Driven Exports + Paginated Tables

**When a user applies filters and clicks Export (PDF/Excel/CSV/Print), the export uses the exact same active filters** — date range, station, operator, shift type, status, etc. The exported file contains **ALL rows matching those filters**, not just the currently visible page.

| Concern | Behavior |
|---|---|
| **On-screen table** | Paginated (10 / 25 / 50 / 100 per page selector, with Previous/Next controls and page counter) |
| **Export (PDF/Excel/CSV)** | Fetches **all matching rows** via `fetchAllRows()` using the **same filter state** applied to the table, then generates the file |
| **Print** | Triggers `window.print()` on the current page view |
| **Filter state** | Each tab maintains its own independent filter state; switching tabs does not reset other tabs |

---

## Current State (What Gets Deleted)

| File | Lines | Role |
|---|---|---|
| `ExportPage.tsx` | 750 | Monolithic UI — 6 tabs, shared filters, limited export formats |
| `reportService.ts` | 1,211 | Mixed: session/billing/summary export + invoice PDF + chart helper + paginated fetch |
| `pdfReportService.ts` | 671 | Shift, operator, handover, daily summary, shift-session, money-handover PDFs |

**CAUTION:** Both service files contain reusable utilities (`fetchAllRows`, `addBrandedHeader`, `addFooter`, etc.) that must be preserved/refactored into the new structure, not deleted outright.

---

## New Tab Structure (19 Tabs)

Tabs are organized into **4 groups** in the UI for easier navigation.

### Group A — Core Operations

| # | Tab Name | Data Source | Key Filters | Exports |
|---|---|---|---|---|
| 1 | **All Transactions** | `charging_sessions` + `billing_calculations` + `stations` | Date range, time, station, operator, search, quick-date presets | PDF, Excel, CSV, Print |
| 2 | **Shift Transactions** | `shifts` → linked `charging_sessions` | Date range, station, operator, shift type | PDF, Excel, CSV, Print |
| 3 | **Operator Transactions** | `charging_sessions` by `card_number` via `operators` | Date range, operator (required), station, shift type | PDF, Excel, CSV, Print |
| 4 | **Handover History** | `shifts` (handover fields) | Date range, station, operator, handover status | PDF, Excel, CSV, Print |

### Group B — Performance & Analytics

| # | Tab Name | Data Source | Key Filters | Exports |
|---|---|---|---|---|
| 5 | **Station Performance** | `charging_sessions` + `stations` (aggregated) | Date range, station (multi-select), comparison toggle | PDF, Excel, CSV, Print |
| 6 | **Operator Performance** | `shifts` + `operators` (aggregated) | Date range, operator, station | PDF, Excel, CSV, Print |
| 7 | **Full Performance** | All tables aggregated | Date range, station, operator, granularity (daily/weekly/monthly) | PDF (with charts), Excel, Print |
| 8 | **Peak Hours / Utilization** | `charging_sessions` (hour/day aggregation) | Date range, station | PDF, Excel, CSV, Print |
| 9 | **Operator Attendance** | `operator_roster` + `shifts` | Date range, operator, station | PDF, Excel, CSV, Print |

### Group C — Revenue & Billing

| # | Tab Name | Data Source | Key Filters | Exports |
|---|---|---|---|---|
| 10 | **Revenue Breakdown** | `billing_calculations` + `billing_breakdown_items` + `fixed_charges` | Date range, station, rate structure | PDF, Excel, CSV, Print |
| 11 | **Invoice History** | `billing_calculations` + `charging_sessions` | Date range, station, operator, amount range | PDF, Excel, CSV, Print |
| 12 | **Unpaid / Pending Billing** | `charging_sessions` WITHOUT `billing_calculations` | Date range, station | PDF, Excel, CSV, Print |
| 13 | **Monthly Financial Summary** | All revenue/billing tables (aggregated monthly) | Month selector, station, comparison mode | PDF (charts), Excel, Print |
| 14 | **Station Profitability** | `billing_calculations` + `rate_structures` + `stations` | Date range, station | PDF (charts), Excel, CSV, Print |
| 15 | **Rate Structure Impact** | `billing_calculations` + `rate_structures` (before/after) | Date range, rate structure, station | PDF (charts), Excel, CSV, Print |

### Group D — Operational Reports

| # | Tab Name | Data Source | Key Filters | Exports |
|---|---|---|---|---|
| 16 | **Daily Operations Summary** | `shifts` + `charging_sessions` (single-day) | Date (single), station | PDF (one-page printable), Excel, Print |
| 17 | **Energy Consumption** | `charging_sessions` (kWh focused) | Date range, station, charger type, time-of-day | PDF, Excel, CSV, Print |
| 18 | **Charger Uptime / Downtime** | `maintenance_logs` + `charging_sessions` | Date range, station | PDF (charts), Excel, CSV, Print |
| 19 | **Maintenance Report** | `maintenance_logs` | Date range, station, status (open/resolved/pending) | PDF, Excel, CSV, Print |

---

## Proposed Changes

### Shared Report Utilities (New)

#### [NEW] `reportUtils.ts` (`src/lib/reportUtils.ts`)

Extracts shared utilities from current `reportService.ts` and `pdfReportService.ts`:
- `fetchAllRows()` — paginated Supabase query helper
- `addBrandedPdfHeader()` — company logo + branded header for all PDFs
- `addPdfFooter()` — page numbers + timestamp + optional footer text
- `registerAmiriFont()` — Arabic font registration
- `containsArabic()` — helper for font selection
- `downloadBlob()` — helper to trigger browser download from Blob
- `buildExcelWorkbook()` — wrapper around XLSX creation with column widths
- `exportToCSV()` — generic CSV download helper
- `formatCurrency()` — re-exports `formatJOD` for consistency

---

### Report Data Services (New)

#### [NEW] `reportDataService.ts` (`src/lib/reportDataService.ts`)

Central data-fetching service — one async function per tab (19 functions):

**Core Operations:**
- `fetchAllTransactions(filters)` → `{ rows, totals }`
- `fetchShiftTransactions(filters)` → `{ shifts[], sessionsPerShift }`
- `fetchOperatorTransactions(filters)` → `{ rows, totals }`
- `fetchHandoverHistory(filters)` → `{ rows, statusSummary }`

**Performance & Analytics:**
- `fetchStationPerformance(filters)` → `{ stationStats[], totals }`
- `fetchOperatorPerformance(filters)` → `{ operatorStats[], totals }`
- `fetchFullPerformance(filters)` → `{ timeSeries[], stationBreakdown[], operatorBreakdown[], totals }`
- `fetchPeakHoursUtilization(filters)` → `{ heatmapData[][], peakHour, busiestDay }`
- `fetchOperatorAttendance(filters)` → `{ roster[], actualShifts[], coverage }`

**Revenue & Billing:**
- `fetchRevenueBreakdown(filters)` → `{ byPeriod[], byChargeType[], totals }`
- `fetchInvoiceHistory(filters)` → `{ invoices[], totals }`
- `fetchPendingBilling(filters)` → `{ unbilledSessions[], totals }`
- `fetchMonthlyFinancial(filters)` → `{ monthlyData[], trends[], totals }`
- `fetchStationProfitability(filters)` → `{ stationPnL[], totals }`
- `fetchRateStructureImpact(filters)` → `{ beforeAfter[], revenueEffect }`

**Operational:**
- `fetchDailyOpsSummary(filters)` → `{ shifts[], sessions[], dayTotals }`
- `fetchEnergyConsumption(filters)` → `{ byStation[], byTimeOfDay[], totals }`
- `fetchChargerUptime(filters)` → `{ uptimePercent[], maintenanceEvents[] }`
- `fetchMaintenanceReport(filters)` → `{ logs[], statusSummary }`

Each function accepts a strongly-typed filter object and returns a strongly-typed result. All queries paginated via `fetchAllRows`.

---

### Report Export Services (New)

#### [NEW] `reportExportService.ts` (`src/lib/reportExportService.ts`)

One export function per tab × per format (PDF/Excel/CSV). Uses `reportUtils.ts` for shared logic.

Chart-enabled tabs (7, 8, 10, 13, 14, 15, 17, 18) embed Canvas-rendered charts as base64 PNGs in PDF.

---

### Report UI Components (New)

#### [NEW] `reports/` directory (`src/components/reports/`)

**Shared components:**

| File | Purpose |
|---|---|
| `ReportsPage.tsx` | Root component — grouped tab navigation (4 groups), renders active tab |
| `ReportFilterBar.tsx` | Reusable filter bar (date range, quick presets, station/operator selects) |
| `ReportExportToolbar.tsx` | Export buttons row (PDF, Excel, CSV, Print) with loading state |
| `ReportDataTable.tsx` | Reusable paginated data table with column defs, sorting, totals row |
| `ReportSummaryCards.tsx` | KPI summary cards |
| `PerformanceChart.tsx` | Canvas chart component (bar, line, heatmap — PDF-embeddable) |

**Tab components (1 file per tab):**

| File | Tab |
|---|---|
| `AllTransactionsTab.tsx` | 1 — All Transactions |
| `ShiftTransactionsTab.tsx` | 2 — Shift Transactions |
| `OperatorTransactionsTab.tsx` | 3 — Operator Transactions |
| `HandoverHistoryTab.tsx` | 4 — Handover History |
| `StationPerformanceTab.tsx` | 5 — Station Performance |
| `OperatorPerformanceTab.tsx` | 6 — Operator Performance |
| `FullPerformanceTab.tsx` | 7 — Full Performance (charts + dashboard) |
| `PeakHoursTab.tsx` | 8 — Peak Hours / Utilization |
| `OperatorAttendanceTab.tsx` | 9 — Operator Attendance |
| `RevenueBreakdownTab.tsx` | 10 — Revenue Breakdown |
| `InvoiceHistoryTab.tsx` | 11 — Invoice History |
| `PendingBillingTab.tsx` | 12 — Unpaid / Pending Billing |
| `MonthlyFinancialTab.tsx` | 13 — Monthly Financial Summary |
| `StationProfitabilityTab.tsx` | 14 — Station Profitability |
| `RateImpactTab.tsx` | 15 — Rate Structure Impact |
| `DailyOpsSummaryTab.tsx` | 16 — Daily Operations Summary |
| `EnergyConsumptionTab.tsx` | 17 — Energy Consumption |
| `ChargerUptimeTab.tsx` | 18 — Charger Uptime / Downtime |
| `MaintenanceReportTab.tsx` | 19 — Maintenance Report |

---

### Existing Files to Modify

#### [MODIFY] `Dashboard.tsx` — Replace `import ExportPage` with `import ReportsPage`

#### [DELETE] `ExportPage.tsx` — Fully replaced

#### [REFACTOR] `reportService.ts` — Keep invoice functions, move everything else to new services

#### [REFACTOR] `pdfReportService.ts` — Keep shift-session & handover letter, move everything else

---

## Tab Detail Specifications

### Tab 1: All Transactions
**Filters:** Date range + quick presets, time range, station, operator, search, items per page.
**Columns:** Transaction ID, Station, Date, Start, End, Duration, Energy (kWh), Max Demand (kW), Cost (JOD), Status.
**Cards:** Total sessions, energy, revenue, avg duration. **Footer:** totals row.

### Tab 2: Shift Transactions
**Filters:** Date range, station, operator, shift type.
**Columns:** Shift Date, Station, Operator, Shift Type, Duration, Sessions, kWh, Revenue, Handover Status.
**Cards:** Total shifts, sessions, energy, revenue.

### Tab 3: Operator Transactions
**Filters:** Date range, operator (required), station, shift type.
**Columns:** Transaction ID, Station, Date, Start, End, Duration, Energy, Cost.
**Cards:** Sessions by operator, energy, revenue.

### Tab 4: Handover History
**Filters:** Date range, station, operator, status (Pending/Handed Over/Deposited), bank ref search.
**Columns:** Date, Station, Operator, Shift Type, Revenue, Status (color-coded), Bank Ref, Deposit Date.
**Cards:** Totals by status.

### Tab 5: Station Performance
**Filters:** Date range, station (multi-select or all).
**Columns:** Station, Code, Sessions, Energy, Revenue, Avg Duration, Avg Energy/Session.
**Cards:** Aggregated totals.

### Tab 6: Operator Performance
**Filters:** Date range, operator, station.
**Columns:** Name, Card #, Shifts, Sessions, Energy, Revenue, Avg Sessions/Shift, Handover Rate.
**Cards:** Aggregated operator totals.

### Tab 7: Full Performance (Dashboard-Style)
**Filters:** Date range, station, operator, granularity (Daily/Weekly/Monthly).
**Charts:** Revenue Trend (bar), Energy Trend (line), Sessions Count (bar), Station Comparison (grouped bar), Operator Ranking (horizontal bar), Utilization Heatmap.
**Cards:** Period totals + period-over-period comparison.
**PDF:** Multi-page with branded header, KPI cards, all charts as images, data tables.

### Tab 8: Peak Hours / Utilization
**Filters:** Date range, station.
**Display:** Heatmap grid (hour-of-day × day-of-week) showing session counts + energy. Peak hour highlighted.
**Columns:** Hour, Mon–Sun session counts, Total, Avg Energy.
**Cards:** Busiest hour, busiest day, avg sessions/hour.

### Tab 9: Operator Attendance
**Filters:** Date range, operator, station.
**Columns:** Operator, Scheduled Shifts (from roster), Actual Shifts, Missed Shifts, Attendance %, Total Sessions, Revenue.
**Cards:** Overall attendance rate, total scheduled, total actual, coverage gaps.

### Tab 10: Revenue Breakdown
**Filters:** Date range, station, rate structure.
**Columns:** Category (Peak/Off-Peak/Night/Fixed), Sessions, Energy, Revenue, % of Total.
**Charts:** Pie chart (revenue by rate period), stacked bar (energy vs fixed charges).
**Cards:** Total revenue, energy charges, fixed charges, avg revenue/session.

### Tab 11: Invoice History
**Filters:** Date range, station, operator, amount range (min/max).
**Columns:** Transaction ID, Station, Date, Subtotal, Fixed Charges, Total Amount, Currency.
**Cards:** Total invoiced, invoice count, avg invoice amount.

### Tab 12: Unpaid / Pending Billing
**Filters:** Date range, station.
**Columns:** Transaction ID, Station, Date, Start, End, Duration, Energy, Status ("Not Calculated").
**Cards:** Unbilled session count, total energy unbilled, estimated revenue loss.

### Tab 13: Monthly Financial Summary
**Filters:** Month selector, station, comparison mode (vs previous month).
**Charts:** Revenue trend (12-month bar), energy trend (line), sessions trend (bar), MoM comparison.
**Columns:** Month, Sessions, Energy, Revenue, Avg Revenue/Session, Growth %.
**Cards:** Current month totals, MoM change %, YTD totals.
**PDF:** Management-grade multi-page report with charts + tables.

### Tab 14: Station Profitability
**Filters:** Date range, station.
**Columns:** Station, Revenue, Estimated Energy Cost (rate × kWh), Gross Margin, Margin %, Sessions.
**Charts:** Bar chart (revenue vs cost per station), margin % line overlay.
**Cards:** Total revenue, total cost estimate, net margin, most profitable station.

### Tab 15: Rate Structure Impact
**Filters:** Date range, rate structure, station.
**Columns:** Rate Structure, Period, Sessions, Avg kWh, Avg Revenue/Session, Total Revenue.
**Charts:** Before/after comparison bar chart if rate changed during period.
**Cards:** Sessions per rate structure, revenue per rate, effectiveness comparison.

### Tab 16: Daily Operations Summary
**Filters:** Date (single day picker), station.
**Layout:** Single-page printable daily report: day's shifts, operators on duty, session count, energy, revenue, handover status, any maintenance issues.
**Cards:** Day totals for shifts, sessions, energy, revenue.
**PDF:** Designed as a one-page daily report for morning printing.

### Tab 17: Energy Consumption
**Filters:** Date range, station, charger type, time-of-day filter.
**Columns:** Date, Station, Sessions, Total kWh, Avg kWh/Session, Max Demand (kW).
**Charts:** Energy consumption trend line, station breakdown bar, time-of-day distribution.
**Cards:** Total kWh, avg kWh/day, peak demand, CO₂ savings estimate.

### Tab 18: Charger Uptime / Downtime
**Filters:** Date range, station.
**Columns:** Station, Total Hours, Active Hours (sessions running), Downtime Hours (maintenance), Uptime %, Maintenance Events.
**Charts:** Uptime % bar per station, downtime timeline.
**Cards:** Avg uptime %, total downtime hours, stations below threshold.

### Tab 19: Maintenance Report
**Filters:** Date range, station, status (Open/Resolved/Pending).
**Columns:** Date, Station, Issue Description, Reported By, Status, Resolution Date, Duration.
**Cards:** Total issues, open count, resolved count, avg resolution time.

---

## Architecture Decisions

1. **Independent filter state per tab** — Each tab holds its own `useState` for filters. Switching tabs does not reset other tabs.

2. **Filter-driven export flow** — Export reads current filters → fetches ALL matching rows → generates file with filter summary in header.

3. **Paginated on-screen tables** — Items-per-page selector (10/25/50/100), Previous/Next buttons, page counter.

4. **Separation of data fetching from export** — `reportDataService.ts` fetches, `reportExportService.ts` formats.

5. **Reusable sub-components** — `ReportFilterBar`, `ReportExportToolbar`, `ReportDataTable`, `ReportSummaryCards`, `PerformanceChart`.

6. **Chart rendering** — Native Canvas API, displayed on screen and converted to base64 PNGs for PDF embedding.

7. **Invoice/handover letter PDFs preserved** — `generateInvoicePDF()`, `generateShiftSessionReportPDF()`, `generateMoneyHandoverLetterPDF()` remain in place.

---

## File Change Summary

| Action | Count | Files |
|---|---|---|
| **NEW** | 3 | `src/lib/reportUtils.ts`, `reportDataService.ts`, `reportExportService.ts` |
| **NEW** | 6 | Shared UI: `ReportsPage`, `ReportFilterBar`, `ReportExportToolbar`, `ReportDataTable`, `ReportSummaryCards`, `PerformanceChart` |
| **NEW** | 19 | Tab components: `AllTransactionsTab` through `MaintenanceReportTab` (one per tab) |
| **MODIFY** | 1 | `Dashboard.tsx` — swap ExportPage → ReportsPage |
| **MODIFY** | 1 | `reportService.ts` — keep invoice functions, remove migrated exports |
| **MODIFY** | 1 | `pdfReportService.ts` — keep shift-session & handover letter, remove migrated exports |
| **DELETE** | 1 | `ExportPage.tsx` — fully replaced |

**Total: 28 new files, 3 modified, 1 deleted**

---

## Verification Plan

### Browser Testing
1. Navigate to Reports → verify 4 tab groups with 19 tabs render correctly
2. Click each tab → verify independent filter bar renders and works
3. On each tab → apply filters → export PDF/Excel/CSV → verify filtered data exported
4. On chart tabs (7, 8, 10, 13, 14, 15, 17, 18) → verify charts render on screen → export PDF with embedded charts
5. Switch between tabs → verify each retains its own filter state
6. Test responsive layout on mobile

### Manual Verification
- Open generated PDFs → check branded header, page numbers, footer, data accuracy
- Open generated Excel → check column headers, data completeness, formatting
- Compare exported row counts with on-screen totals
