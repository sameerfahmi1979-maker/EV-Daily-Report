/**
 * EV-E Reporting v2 — authoritative reporting layer client.
 *
 * Every function here calls a `report_*` SECURITY DEFINER RPC (see
 * supabase/migrations/20260717140000-140700_e_*.sql). Money always comes from
 * `billing_calculations` / `session_payment_allocations` / `cash_handovers` —
 * never from `shifts.total_*` or `charging_sessions.calculated_cost`.
 *
 * Feature flag: system_settings.reporting_v2_enabled
 */
import { supabase } from './supabase';

export const REPORT_MAX_RANGE_DAYS = 400;

export interface ReportFilters {
  startDate: string; // yyyy-MM-dd (Asia/Amman local date)
  endDate: string;
  stationId?: string | null;
  operatorId?: string | null;
}

export async function isReportingV2Enabled(): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'reporting_v2_enabled')
    .maybeSingle();
  return (data?.value ?? 'false') === 'true';
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
}

export interface RevenueSummaryRow {
  report_date: string;
  station_id: string;
  station_name: string;
  session_count: number;
  energy_kwh: number;
  billing_total: number;
  legacy_count: number;
  v2_count: number;
  unknown_engine_count: number;
}

export function fetchRevenueSummary(f: ReportFilters) {
  return rpc<RevenueSummaryRow[]>('report_revenue_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface PaymentMethodSummary {
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  unassigned_total: number;
  session_count: number;
  cash_count: number;
  card_count: number;
  cliq_count: number;
  unassigned_count: number;
}

export async function fetchPaymentMethodSummary(f: ReportFilters): Promise<PaymentMethodSummary> {
  const rows = await rpc<PaymentMethodSummary[]>('report_payment_method_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
  return (
    rows[0] ?? {
      billing_total: 0,
      cash_total: 0,
      card_total: 0,
      cliq_total: 0,
      unassigned_total: 0,
      session_count: 0,
      cash_count: 0,
      card_count: 0,
      cliq_count: 0,
      unassigned_count: 0,
    }
  );
}

export interface PaymentReconciliationRow {
  report_date: string;
  station_id: string;
  station_name: string;
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  unassigned_total: number;
  difference: number;
  reconciled: boolean;
}

export function fetchPaymentReconciliation(f: ReportFilters) {
  return rpc<PaymentReconciliationRow[]>('report_payment_reconciliation', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface StationDailySummaryRow {
  report_date: string;
  station_id: string;
  station_name: string;
  session_count: number;
  energy_kwh: number;
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  unassigned_total: number;
  expected_cash: number;
  actual_cash: number;
  shortage: number;
  surplus: number;
  handover_count: number;
  locked_handover_count: number;
}

export function fetchStationDailySummary(f: ReportFilters) {
  return rpc<StationDailySummaryRow[]>('report_station_daily_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface OperatorShiftSummaryRow {
  shift_id: string;
  station_id: string;
  station_name: string;
  operator_id: string;
  operator_name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  session_count: number;
  energy_kwh: number;
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  unassigned_total: number;
  expected_cash: number;
  actual_cash_received: number;
  shortage_amount: number;
  surplus_amount: number;
  approved_adjustment_total: number;
  handover_id: string | null;
  handover_number: string | null;
  handover_status: string | null;
  handover_version: number | null;
  operational_total_amount_jod: number;
  operational_reconciled: boolean;
}

export function fetchOperatorShiftSummary(f: ReportFilters) {
  return rpc<OperatorShiftSummaryRow[]>('report_operator_shift_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
    p_operator_id: f.operatorId ?? null,
  });
}

export interface CashHandoverSummaryRow {
  handover_id: string;
  handover_number: string;
  station_id: string;
  station_name: string;
  operator_id: string;
  operator_name: string;
  shift_id: string;
  shift_date: string;
  status: string;
  billing_total: number;
  cash_total: number;
  card_total: number;
  cliq_total: number;
  expected_cash: number;
  actual_cash_received: number | null;
  shortage_amount: number;
  surplus_amount: number;
  net_adjustments: number;
  unassigned_count: number;
  version: number;
  discrepancy_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  reopened_at: string | null;
}

export function fetchCashHandoverSummary(f: ReportFilters & { status?: string | null }) {
  return rpc<CashHandoverSummaryRow[]>('report_cash_handover_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
    p_status: f.status ?? null,
  });
}

export function fetchHandoverDetail(handoverId: string) {
  return rpc<any>('report_handover_detail', { p_handover_id: handoverId });
}

export function fetchLockedHandoverSnapshot(handoverId: string) {
  return rpc<any>('report_locked_handover_snapshot', { p_handover_id: handoverId });
}

export interface ImportReconciliationRow {
  batch_id: string;
  filename: string;
  file_hash: string | null;
  station_id: string | null;
  station_name: string | null;
  operator_name: string | null;
  detected_operator_name: string | null;
  operator_match_status: string | null;
  status: string;
  records_total: number;
  records_success: number;
  records_failed: number;
  records_skipped: number;
  billed_count: number;
  billing_failed_count: number;
  created_at: string;
  posting_completed_at: string | null;
}

export function fetchImportReconciliation(f: ReportFilters) {
  return rpc<ImportReconciliationRow[]>('report_import_reconciliation', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface BillingReconciliationRow {
  session_id: string;
  transaction_id: string;
  station_id: string;
  start_ts: string;
  engine_version: string | null;
  billing_source: string | null;
  billing_total: number;
  breakdown_sum: number;
  difference: number;
  demand_charge_sum: number;
  taxes: number;
  payment_method: string;
  handover_id: string | null;
  handover_number: string | null;
  exception_status: string;
}

export function fetchBillingReconciliation(f: ReportFilters) {
  return rpc<BillingReconciliationRow[]>('report_billing_reconciliation', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface ExceptionRow {
  exception_type: string;
  station_id: string | null;
  session_id: string | null;
  transaction_id: string | null;
  batch_id: string | null;
  handover_id: string | null;
  detail: string;
  amount: number | null;
  occurred_on: string;
}

export function fetchExceptionSummary(f: ReportFilters) {
  return rpc<ExceptionRow[]>('report_exception_summary', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export interface HistoricalEngineRow {
  engine_label: string;
  session_count: number;
  billing_total: number;
  avg_amount: number;
}

export function fetchHistoricalEngineComparison(f: ReportFilters) {
  return rpc<HistoricalEngineRow[]>('report_historical_engine_comparison', {
    p_start: f.startDate,
    p_end: f.endDate,
    p_station_id: f.stationId ?? null,
  });
}

export function fetchShiftTotalsReconciliation(shiftId: string) {
  return rpc<any>('report_shift_totals_reconciliation', { p_shift_id: shiftId });
}
