# EV Daily Calculations – Dashboard Redesign Plan

## 1. Objective

Replace the current **home** view (Welcome message + Phase 3/4 cards and “Load Sample Data”) with a **real operational dashboard** that gives at-a-glance statistics, income, environment metrics, and time context. The design will be inspired by the **Weighbridge System** dashboard (charts, international clocks, KPI strip, income/environment sections) and adapted to the EV charging domain.

**Scope:** Plan only — no implementation in this document.

---

## 2. Current State (EV App)

- **Home view:** “Welcome Back” + two static cards (Station Management, Rate Configuration) with buttons to Stations / Rates / Fixed Charges. When no data exists, a “Load Sample Data” card is shown.
- **Analytics** (separate route): Full analytics with summary metrics, energy trend, revenue by station, shift comparison, CO2 impact, connector/charger breakdowns, best time to charge, daily transactions, recent activity. Uses custom chart components (no ECharts in EV app currently).
- **Data available:** `analyticsService` already exposes: summary metrics (energy, revenue, sessions, active stations), energy trend, revenue by station, station utilization, recent activity, shift comparison, connector type comparison, best time to charge, CO2 impact, daily transactions by connector, charger type breakdown.

---

## 3. Reference: Weighbridge Dashboard (Patterns to Reuse)

| Element | Description |
|--------|-------------|
| **KPI strip** | 6 compact cards in a row: Tickets, Net weight, Pending 2nd weigh, Indicator status, Audit pending, Active vehicles. Each: label, big number, optional trend (e.g. % vs yesterday), icon in colored rounded box. |
| **Date range** | Preset selector (Today, Yesterday, Last 7/30 days, This month, etc.) in a bar; some users get full selector, others a fixed badge. |
| **Hero chart** | Single prominent chart (e.g. “Weight trend last 14 days”) — bar + line (ECharts), Inbound/Outbound/Net. |
| **World clock** | Section “World Markets” with theme toggle (Luxury / Minimal / Classic). Grid of analog clocks for Dubai, Riyadh, London, NY, Singapore, HK, Tokyo, Sydney. Each clock shows city name and digital time. |
| **Income block** | Dedicated gradient card (e.g. purple) “Commercial Weighing” with: Transactions count, Cash collected (currency), Unpaid transactions. |
| **In/Out/Net summary** | Three gradient cards: Total IN (green), Total OUT (red), Net difference (blue/orange). |
| **Charts row 1** | Pie/donut (e.g. material mix) + horizontal bar (e.g. top customers). |
| **Charts row 2** | Horizontal bar (e.g. top materials) + bar chart (e.g. weighs by hour). |
| **Heatmap** | Activity heatmap: day of week × hour, last 30 days. |
| **Alerts / Quick actions** | Conditional cards: e.g. “X pending second weigh”, “Y audits pending”, “Indicator offline”. |
| **Donut + legends** | E.g. Turnaround time (Fast/Normal/Slow/Critical), Quantity verified (In/Out/Internal). |
| **Performance lists** | Operator / Customer / Material performance with progress bars and counts. |
| **Recent table** | Last N transactions with key columns. |
| **Export** | “Export PDF” in header. |

---

## 4. Proposed EV Dashboard Layout (Section by Section)

### 4.1 Header and controls

- **Title:** “Dashboard” (or “EV Charging Dashboard”) with short subtitle (e.g. “Overview of charging operations and performance”).
- **Date range selector:** Same pattern as Weighbridge — presets (Today, Yesterday, Last 7 days, Last 30 days, This month, Last month). Optional: persist last selection.
- **Export:** “Export PDF” (or “Export summary”) button to generate a one-page or multi-page dashboard PDF (reuse or extend report/PDF logic if any).
- **Refresh:** Optional “Refresh” button to reload all dashboard data.

### 4.2 KPI strip (top row of stat cards)

- **Suggested cards (5–6):**
  1. **Sessions (today / period)** — total charging sessions in selected range; optional: “vs yesterday” or “vs previous period” trend.
  2. **Energy (kWh)** — total energy delivered in period; unit clearly shown (kWh).
  3. **Revenue (JOD)** — total revenue in period; currency from existing `formatJOD` / settings.
  4. **Active stations** — count of stations with at least one session in period (or total stations if preferred).
  5. **CO₂ saved (kg)** — from existing CO2 impact metrics; environmental highlight.
  6. **Pending billing** (optional) — count of sessions without billing calculated, if such a concept exists in the app.

- **Card style (aligned with Weighbridge):** White/card background, rounded corners, light shadow, icon in a small colored rounded box (e.g. Zap, DollarSign, Activity, MapPin, Leaf), label in small uppercase, large bold value, optional trend line (e.g. green ↑ / red ↓ and percentage).

### 4.3 International clock / time section

- **Purpose:** Show current time in relevant time zones for operations (Jordan, regional offices, partners). Mirrors Weighbridge “World Markets” but focused on EV operations.
- **Content:**
  - Section title, e.g. “Time zones” or “World time”.
  - **Cities (suggested):** Amman (Jordan), Dubai, Riyadh, London, (optional: New York, Singapore). Configurable list is ideal later.
  - **Display options (choose one or support both):**
    - **Option A – Analog clocks:** Reuse the Weighbridge-style component (AnalogClock + WorldClock). Theme toggle (Luxury / Minimal / Classic) optional.
    - **Option B – Digital only:** Row of cards: city name + digital time (12h or 24h) + optional date; compact and quick to scan.
  - **Recommendation:** Start with **digital row** for simplicity and consistency with “dashboard at a glance”; add analog clocks as an optional expanded block or toggle if desired.

### 4.4 Income / revenue block

- **Purpose:** Dedicated “Income” or “Revenue” section so operators see financial summary without opening Analytics.
- **Content:**
  - One prominent card (e.g. gradient background — green or blue to match EV/brand).
  - **Metrics:** Total revenue (JOD), number of billed sessions (or total sessions), optional: average revenue per session.
  - Optional: “Unpaid” or “Pending collection” if the system tracks payment status.
- **Style:** Similar to Weighbridge “Commercial Weighing” block: gradient, white/translucent inner cards for each metric, clear labels and large numbers.

### 4.5 Environment block

- **Purpose:** Highlight environmental impact (CO₂ avoided, trees equivalent, km driven equivalent).
- **Content:**
  - Reuse or adapt existing **CO2ImpactCard** logic: total CO₂ reduction (kg), trees equivalent, km driven equivalent, energy used.
  - Single card or 2–3 small cards (e.g. CO₂ saved, Trees, “km equivalent”).
- **Placement:** Next to or below Income block so “Income + Environment” sit together as two key stories.

### 4.6 Hero chart (main trend)

- **Chart:** “Energy & revenue trend” over the selected period (or last 14 days if period is long).
- **Type:** Combined bar + line (e.g. bars for energy per day, line for cumulative or daily revenue). Alternatively: dual-axis (energy vs revenue) in one chart.
- **Data source:** `getEnergyTrend`, and revenue aggregated by day (from existing analytics or a small extension).
- **Style:** Clean axes, legend, tooltips; consider ECharts (like Weighbridge) for consistency and flexibility, or reuse/extend existing EV chart components (e.g. EnergyTrendChart) to support revenue line.

### 4.7 Secondary charts (two rows)

- **Row 1:**
  - **Revenue by station** — horizontal bar or small table (station name, revenue, sessions). Data: `getRevenueByStation`.
  - **Connector type** — pie or donut (share of sessions or energy by connector). Data: `getConnectorTypeComparison`.
- **Row 2:**
  - **Best time to charge** — bar chart by hour (sessions or energy). Data: `getBestTimeToCharge`.
  - **Daily transactions by connector** — existing component or a compact version (e.g. top 5 days or top 5 connector types). Data: `getDailyTransactionsByConnector` (already limited to 10 records).

Chart styling: white card, title, short description, consistent colors (e.g. blue/green/orange palette). Prefer same library (ECharts or current EV charts) across dashboard for consistency.

### 4.8 Activity heatmap (optional but recommended)

- **Chart:** Sessions (or energy) by **day of week** (rows) × **hour** (columns), last 30 days.
- **Purpose:** “When do people charge?” — similar to Weighbridge activity heatmap.
- **Data:** Requires aggregation by weekday + hour from charging_sessions (or equivalent). May need a new analytics function or small RPC.
- **Style:** Color scale (e.g. light to dark green), tooltip with count and hour/day.

### 4.9 Alerts / quick actions

- **Conditional cards,** e.g.:
  - “X sessions pending billing calculation” → link to Billing.
  - “No data in selected period” → suggest changing date range or loading sample data.
  - “Y stations with no sessions in period” → optional, link to Stations.
- **Style:** Light yellow/orange/red background, icon, short message, CTA button.

### 4.10 Recent activity table

- **Content:** Last 5–10 charging sessions: transaction ID, station, energy (kWh), cost (JOD), start time, billing status.
- **Data:** `getRecentActivity(dateRange, 10)`.
- **Layout:** Compact table; “View all” linking to Billing or Session list.

### 4.11 Sample data / empty state

- **When no data:** Keep a compact “Load Sample Data” or “Get started” block (e.g. at top or in a dedicated card) so new users can seed data without losing the rest of the dashboard structure. Dashboard can show zeros and “No data” in charts until data exists.

---

## 5. Chart Types and Style (Summary)

| Block | Chart type | Data source | Style note |
|-------|------------|-------------|------------|
| Hero | Bar + line (energy + revenue over time) | Energy trend + revenue by day | Clear legend, tooltips |
| Revenue by station | Horizontal bar or table | getRevenueByStation | Top N stations |
| Connector mix | Pie or donut | getConnectorTypeComparison | Color per connector type |
| Best time to charge | Bar (hourly) | getBestTimeToCharge | 24 hours, sessions or kWh |
| Daily transactions | Compact bar/stacked (existing) | getDailyTransactionsByConnector (10) | Already limited to 10 |
| Activity heatmap | Heatmap (day × hour) | New or extended aggregation | Green scale, last 30 days |

- **Libraries:** Either introduce **ECharts** (like Weighbridge) for bar/line/pie/heatmap and consistent look, or extend existing EV chart components to cover these and keep bundle size smaller. Plan should state the chosen approach.
- **Responsiveness:** KPI cards and clock row stack on small screens; charts resize; table scrolls horizontally if needed.

---

## 6. Data and Backend

- **Reuse:** All of `getSummaryMetrics`, `getEnergyTrend`, `getRevenueByStation`, `getStationUtilization`, `getRecentActivity`, `getShiftComparison`, `getConnectorTypeComparison`, `getBestTimeToCharge`, `getCO2ImpactMetrics`, `getDailyTransactionsByConnector`, `getChargerTypeBreakdown`.
- **New/optional:**
  - Revenue by day (for hero chart line) — may be derivable from existing RPCs or sessions query.
  - Sessions (or energy) by weekday + hour for heatmap — new aggregation or RPC.
  - “Pending billing” count — if not already available, define and add to summary or a small query.

---

## 7. Navigation and Placement

- **Where:** This layout replaces the current **home** view content inside the existing Dashboard layout (sidebar + main area). Sidebar stays as is (Main: Dashboard, Analytics, Reports; Operations: Stations, Operators, Import, Billing, Rates, Fixed Charges).
- **Analytics:** The full **Analytics** page can remain as the “deep dive” (all charts, full date range, export). The new **Dashboard (home)** is the “at a glance” subset with KPIs, clocks, income, environment, and a few key charts.

---

## 8. Implementation Order (Suggested Phases)

1. **Phase 1 – Structure and KPIs**  
   - New dashboard component (or refactor home section).  
   - Date range selector + summary API.  
   - KPI strip (sessions, energy, revenue, stations, CO₂; optional pending billing).  
   - Empty state / sample data prompt unchanged but positioned appropriately.

2. **Phase 2 – Time and income / environment**  
   - International clock block (digital row first; analog optional).  
   - Income block (revenue, sessions, optional unpaid).  
   - Environment block (CO₂, trees, km equivalent).

3. **Phase 3 – Hero and main charts**  
   - Hero chart (energy + revenue trend).  
   - Revenue by station + connector mix.  
   - Best time to charge + daily transactions (compact).

4. **Phase 4 – Heatmap and polish**  
   - Activity heatmap (day × hour).  
   - Alerts / quick actions.  
   - Recent activity table.  
   - Export PDF (if not already present).  
   - Responsive and accessibility pass.

---

## 9. Out of Scope for This Plan

- Changes to sidebar or other routes.  
- New backend tables; only existing or minor new RPCs/aggregations as noted.  
- Authentication or permissions (reuse existing).  
- Theming (can follow existing app theme; Weighbridge-style clock themes are optional).

---

## 10. Success Criteria

- **Dashboard (home)** is a single, scannable page with:  
  - KPIs (sessions, energy, revenue, stations, CO₂).  
  - International clock(s).  
  - Income and environment sections.  
  - At least one hero trend and 2–4 supporting charts.  
  - Recent activity and optional alerts.  
- Design and chart style are consistent and inspired by Weighbridge (clocks, gradient income/environment blocks, KPI strip, chart types).  
- No duplicate or conflicting logic with Analytics; dashboard uses same APIs with a focused subset and default date range.

---

*Document version: 1.0 — Plan only; implementation to follow in separate tasks.*
