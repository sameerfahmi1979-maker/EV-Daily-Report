# Phase E — Current-State Reporting Audit Matrix

**Date:** 2026-07-17
**Scope:** Inventory every dashboard/report/export path before building the Phase E authoritative reporting layer.

## Audit Matrix

| Report/Widget | Current Source | Risk | Correct Source | Action |
|---|---|---|---|---|
| HomeDashboard / AnalyticsDashboard | `analyticsService` RPCs → `billing_calculations` (deduped via `DISTINCT ON`) | Low | Already correct | Keep; reuse pattern |
| KPIDashboard (`kpiService`) | `charging_sessions.calculated_cost` | **High** — stale fallback, bypasses billing engine | `billing_calculations.total_amount` | Out of scope for this pass (legacy path retained); new authoritative KPIs added alongside in Reporting v2 |
| AccountantDashboard (`accountingService`) | `shifts.total_amount_jod` / `total_kwh` + legacy `handover_status` | **High** — mutable cache, ignores Phase D payment/handover | `cash_handovers` + `session_payment_allocations` | New Reporting v2 Cash Handover report supersedes for financial closure; legacy Accountant view retained, unlabeled change deferred |
| OperatorPerformance (`operatorAnalyticsService`) | `shifts.total_*` | Medium | `billing_calculations` via sessions | Retained; new Operator Shift report (9.2) built authoritative |
| RevenueForecast | `charging_sessions.calculated_cost` | Medium (forecast only, not closing figures) | `billing_calculations` | Out of scope (forecasting, not reconciliation) |
| ReportsPage → Shift/Handover/Operator tabs (`reportDataService`) | `shifts.total_*` | **High** | Authoritative RPCs (this phase) | New authoritative tabs added; legacy tabs retained and labeled |
| `pdfReportService` shift/handover/money-letter PDFs | `shifts.total_*` directly | **High** — no payment breakdown, no lock awareness | `cash_handovers` snapshot | New Cash Handover PDF (locked-snapshot aware) added; legacy PDFs retained for operational (non-financial-closure) use, now labeled "Operational Aggregate" |
| `reportService.generateInvoicePDF` | `billing_calculations` + breakdown, but still renders **Demand (kW) / Demand Charge** columns | Medium — dead columns render `0`, cosmetic only, not a real Demand Charge reappearing | N/A | Documented as remaining risk; not touched (out of narrow Phase E scope — cosmetic legacy invoice template) |
| Analytics RPCs (`get_analytics_summary` etc.) | `charging_sessions.start_date` (calendar date column, already Amman-local per import), `billing_calculations` deduped | Low | Already correct | Keep |
| `session_payment_allocations` / `cash_handovers` / `cash_handover_sessions` / `cash_handover_adjustments` | Only consumed by `PaymentHandoverPanel` (Phase D) | N/A | New Reporting v2 layer is the first report-side consumer | Build on top |
| `cash_handover_events` | No app reads at all | N/A | New locked-handover detail report | Add read path |
| Role/station scoping in reports | RLS-only; no RPC-level role/station enforcement; UI filters are user-selectable, not auto-scoped | **High** for a "Report Viewer"/station-scoped role being able to select another station's data via UI filter and have the RPC silently return nothing (safe) vs a table read that IS station-scoped by RLS (safe) — net risk is low today because RLS underlies everything, but new RPCs must not repeat the "no station check in RPC body" pattern | Add explicit role/station checks in every new Phase E RPC | Done in this phase (see §16) |
| Date/timezone handling in reports | Browser-local `Date` for grouping in several places (heatmap, KPI peak hours); `start_date`/`shift_date` columns are Amman-local since Phase B import always writes Amman date/time components | Medium | Use `charging_sessions.start_date`/`start_ts AT TIME ZONE 'Asia/Amman'` server-side for all new RPCs | Done — all new RPCs compute Amman-local grouping in SQL, never in the browser |

## Decision: Additive, Flag-Gated Reporting v2 Layer

Given the existing surface area (6 dashboards + 19 report tabs + 9 analytics RPCs + multiple PDF generators), a full rewrite/replacement of every legacy report in one phase would be high-risk and outside the "no report change is allowed to alter authoritative financial data" / "do not redesign unrelated operational modules" guardrails.

**Approach taken:**
1. Build a new, additive, authoritative SQL reporting layer (12 RPCs, §6 of the prompt) that derives every dollar figure from `billing_calculations`/`session_payment_allocations`/`cash_handovers` — never from `shifts.total_*` or `calculated_cost`.
2. Add a new **Reporting v2** page (flag-gated `reporting_v2_enabled`) presenting the required report set (9.1–9.7), KPIs (§7), filters/drill-down (§12), and Excel/PDF export built on the new RPCs only.
3. Leave every existing legacy dashboard/report/export path untouched and operational (per §18 activation plan: "keep rollback to old reports temporarily... remove old report path only after closure approval" — that removal is explicitly **not** part of this phase's closure).
4. Where a legacy component displays `shifts.total_*` as if authoritative, it is documented above as a known, deliberately-out-of-scope risk rather than silently left unaddressed.
