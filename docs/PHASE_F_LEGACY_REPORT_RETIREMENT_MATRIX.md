# Phase F — Legacy Report Retirement Matrix

## Purpose

Phase E introduced Reporting v2 (`report_*` SECURITY DEFINER RPCs) as the sole
authoritative source of financial truth, backed exclusively by
`billing_calculations`, `billing_breakdown_items`, `session_payment_allocations`,
and `cash_handovers`. Phase F audits every remaining dashboard/report/export in
the application and decides, per §15 of the Phase F prompt, whether it should
be: **keep**, **redirect**, **label** (`Legacy / Operational Only`), **hide**,
**deprecate**, or **remove after soak**.

No route is removed in this phase. Every legacy financial view is labeled
in-place, behind the `legacy_report_retirement_enabled` feature flag, so the
change is fully reversible during soak (see Rollback below).

## Method

Each Sidebar navigation target was traced to its component and data-fetching
service, and classified by its money source:

| Code | Money source | Authoritative? |
|------|--------------|-----------------|
| (a) | `charging_sessions.calculated_cost` (denormalized, mutable) | No |
| (b) | `shifts.total_amount_jod` (mutable shift aggregate) | No |
| (c) | Client-side JS summation of raw rows | No (also non-reconciled, no station/role scoping guarantees) |
| (d) | Demand Charge / tax columns surfaced in UI | Not applicable (system is demand=0, tax=0 by design; column display is legacy-only) |
| (e) | `report_*` RPCs (Reporting v2) | **Yes** |

## Matrix

| Nav item | Component(s) | Shows financial totals | Money source | Decision | Action taken this phase |
|---|---|---|---|---|---|
| home | `HomeDashboard.tsx` → `analyticsService.ts` (`get_analytics_summary`) | Yes | (a)/(c) via legacy `get_*` RPC over `billing_calculations.total_amount` (not station/role-scoped RLS-safe reporting) | Label + redirect | `LegacyReportBanner` added |
| analytics | `AnalyticsDashboard.tsx` → `analyticsService.ts` | Yes | (a)/(c), same legacy RPC family | Label + redirect | `LegacyReportBanner` added |
| reports | `reports/ReportsPage.tsx` + tabs, `reportDataService.ts` | Yes (financial tabs) | (b)/(c) client sums of `billing_calculations.total_amount` and `shifts.total_amount_jod` | Label financial tabs; keep operational (energy/uptime) tabs as-is | Documented here; UI label deferred to next soak iteration (tracked risk, see report) |
| stations | `StationDetails.tsx` → `stationService.ts` | Yes (station revenue) | (a) `calculated_cost` client-summed | Label as legacy-operational-only | Documented; per-station drill-down retained for ops use |
| operators | `OperatorDetails.tsx` → `operatorService.ts` | Yes (operator revenue) | (a) `calculated_cost` client-summed | Label as legacy-operational-only | Documented; retained for ops use |
| import / billing | `SessionList.tsx`, `BillingBreakdownViewer.tsx` | Session-level detail, not a "report" | `billing_calculations.total_amount` (per-row, not aggregated) + legacy Demand Charge/Tax columns (d) | Keep as operational billing UI; Demand Charge/Tax columns are legacy display artifacts (engine always writes 0) | No removal — these are the working billing screens import officers use daily; not a "report of record" |
| shifts | `ShiftManagement.tsx`, embeds `PaymentHandoverPanel.tsx` | Yes | (b) `shifts.total_amount_jod` client-summed; handover panel is already Phase D-authoritative for cash handover totals | Label shift revenue total as legacy-operational-only; handover panel itself is fine (uses `session_payment_allocations`) | `LegacyReportBanner` added |
| rates / fixed-charges | Rate/fixed-charge configuration screens | No | N/A (configuration, not reporting) | Keep | No change |
| operator-performance | `OperatorPerformance.tsx` → `operatorAnalyticsService.ts` | Yes | (b) `shifts.total_amount_jod` client-aggregated | Label + redirect | `LegacyReportBanner` added |
| accountant | `AccountantDashboard.tsx` → `accountingService.ts` | Yes | (b) `shifts.total_amount_jod` client-summed | Label + redirect | `LegacyReportBanner` added |
| kpi | `KPIDashboard.tsx` → `kpiService.ts` | Yes | (a)/(c) `calculated_cost` client-summed | Label + redirect (financial KPIs only; energy/uptime KPIs unaffected) | `LegacyReportBanner` added |
| cdr | `CDRExport.tsx` | Yes (Cost_JOD column + total) | (a)/(c) `calculated_cost` fetched + client-summed | Label as legacy-operational-only; CDR export itself (energy/session detail) is a valid interchange format and is kept | `LegacyReportBanner` added |
| roster | `OperatorRoster.tsx` | No | N/A (scheduling only) | Keep | No change |
| forecast | `RevenueForecast.tsx` | Yes | (a)/(c) `calculated_cost` by day, then simple moving average | Label as legacy-operational-only (forecast is inherently approximate; not presented as reconciled actuals) | `LegacyReportBanner` added |
| reporting-v2 | `ReportingV2Dashboard.tsx` → `reportingV2Service.ts` | Yes | **(e)** exclusively `report_*` RPCs | **Keep — sole authoritative financial surface** | No change (this phase adds pagination/filters to its backing RPCs, see implementation report) |

## Non-zero Demand Charge / Tax surfaces

`BillingBreakdownViewer.tsx` still renders "Demand Charge" and "Taxes" columns.
The billing engine (`calculate_session_billing_v2`) hardcodes both to `0` for
every session, and Reporting v2's reconciliation RPC would flag any non-zero
value as an exception (`non_zero_demand` / `non_zero_tax`). The columns are
harmless (always show `0.000 JOD`) but are legacy display artifacts from a
tariff structure this system does not currently bill. They are left in place
(operational billing detail screen, not a report) and flagged here as a
candidate for later UI cleanup — not a Phase F blocker since they never
misstate a non-zero amount.

## Rollout mechanism

- New flag: `legacy_report_retirement_enabled` (default `false`).
- `LegacyReportBanner` (`src/components/LegacyReportBanner.tsx`) is a single
  shared component added to the 8 legacy financial views above. It reads the
  flag directly from `system_settings` and renders nothing when the flag is
  `false`.
- No route was hidden, redirected, or removed — every legacy screen remains
  fully functional for its **operational** purpose (day-to-day session/shift
  management). Only the *financial-totals-as-source-of-truth* framing is
  called out.

## Rollback

Set `legacy_report_retirement_enabled = 'false'` in `system_settings` (or
simply do nothing — it defaults to `false`). No schema changes, no data
changes, and no removed functionality are involved, so rollback is
instantaneous and carries zero risk.

## Recommendation for full retirement (post-soak)

After a soak period with `legacy_report_retirement_enabled = true` and no
user confusion reported:

1. Continue keeping all *operational* screens (billing detail, shift/handover
   workflow, roster, station/operator drill-down) — they are not being
   retired, only their revenue-total framing is being corrected.
2. Consider rebuilding the **financial** widgets on `home`, `analytics`,
   `accountant`, `kpi`, `operator-performance`, `cdr`, and `forecast` directly
   on Reporting v2 RPCs in a later phase, at which point the banners can be
   removed from those specific screens.
3. `reports/ReportsPage.tsx` financial tabs are the highest-value follow-up:
   they are the most "report-like" of the remaining legacy surfaces and would
   benefit most from a full Reporting v2 rebuild.
