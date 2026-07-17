/**
 * EV-F Historical audit / governed correction / payment-classification-
 * governance client. Every function calls a SECURITY DEFINER RPC created in
 * supabase/migrations/20260717150000-150700_f_*.sql.
 *
 * Comparison RPCs never mutate billing data. Correction/classification RPCs
 * require an explicit approval step — nothing here applies automatically.
 *
 * Feature flags: historical_comparison_enabled, historical_correction_enabled,
 * historical_payment_classification_enabled, legacy_report_retirement_enabled.
 */
import { supabase } from './supabase';

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
}

async function flag(key: string): Promise<boolean> {
  const { data } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value ?? 'false') === 'true';
}

export const isHistoricalComparisonEnabled = () => flag('historical_comparison_enabled');
export const isHistoricalCorrectionEnabled = () => flag('historical_correction_enabled');
export const isHistoricalPaymentClassificationEnabled = () => flag('historical_payment_classification_enabled');

export interface ComparisonResult {
  session_id: string;
  classification: { primary_classification: string; exception_types: string[] };
  current_total: number | null;
  current_engine_version: string | null;
  expected_total: number | null;
  expected_engine_version: string | null;
  difference: number | null;
  match_tier: 'exact' | 'rounding_only' | 'minor' | 'material' | 'cannot_compare';
  confidence?: 'high' | 'medium' | 'low';
  risk?: 'low' | 'medium' | 'high';
  recommendation?: string;
  cannot_compare_reason?: string | null;
}

export const compareHistoricalSessionToV2 = (sessionId: string) =>
  rpc<ComparisonResult>('compare_historical_session_to_v2', { p_session_id: sessionId });

export const compareHistoricalBatchToV2 = (
  start: string,
  end: string,
  stationId: string | null = null,
  limit = 50,
  offset = 0
) =>
  rpc<Array<{
    session_id: string; transaction_id: string; current_total: number | null; expected_total: number | null;
    difference: number | null; match_tier: string; primary_classification: string; cannot_compare_reason: string | null;
  }>>('compare_historical_batch_to_v2', { p_start: start, p_end: end, p_station_id: stationId, p_limit: limit, p_offset: offset });

export const submitHistoricalCorrection = (
  sessionId: string,
  proposedAction: 'replace_billing_with_v2' | 'repair_metadata_only' | 'no_action_required' | 'defer' | 'manual_review',
  reason: string,
  evidence: Record<string, unknown> = {}
) => rpc<{ ok: boolean; correction_id: string; status: string }>('submit_historical_correction', {
  p_session_id: sessionId, p_proposed_action: proposedAction, p_reason: reason, p_evidence: evidence,
});

export const reviewHistoricalCorrection = (correctionId: string) =>
  rpc<{ ok: boolean; status: string }>('review_historical_correction', { p_correction_id: correctionId });

export const approveHistoricalCorrection = (correctionId: string, reason?: string) =>
  rpc<{ ok: boolean; status: string }>('approve_historical_correction', { p_correction_id: correctionId, p_reason: reason ?? null });

export const rejectHistoricalCorrection = (correctionId: string, reason: string) =>
  rpc<{ ok: boolean; status: string }>('reject_historical_correction', { p_correction_id: correctionId, p_reason: reason });

export const deferHistoricalCorrection = (correctionId: string, reason: string) =>
  rpc<{ ok: boolean; status: string }>('defer_historical_correction', { p_correction_id: correctionId, p_reason: reason });

export const applyHistoricalCorrection = (correctionId: string) =>
  rpc<{ ok: boolean; status: string; result: unknown }>('apply_historical_correction', { p_correction_id: correctionId });

export const rollbackHistoricalCorrection = (correctionId: string, reason: string) =>
  rpc<{ ok: boolean; status: string; restored_total_amount: string }>('rollback_historical_correction', { p_correction_id: correctionId, p_reason: reason });

export interface CorrectionQueueRow {
  id: string; session_id: string; transaction_id: string; station_id: string | null; classification: string;
  exception_types: string[]; current_amount: number | null; proposed_amount: number | null; difference: number | null;
  match_tier: string | null; confidence: string; risk: string; proposed_action: string; status: string;
  reason: string | null; submitted_at: string; approved_at: string | null; applied_at: string | null; total_count: number;
}

export const fetchCorrectionQueue = (opts: {
  status?: string | null; risk?: string | null; confidence?: string | null; stationId?: string | null;
  pageSize?: number; pageOffset?: number;
} = {}) => rpc<CorrectionQueueRow[]>('report_correction_queue', {
  p_status: opts.status ?? null, p_risk: opts.risk ?? null, p_confidence: opts.confidence ?? null,
  p_station_id: opts.stationId ?? null, p_page_size: opts.pageSize ?? 100, p_page_offset: opts.pageOffset ?? 0,
});

export const proposeHistoricalPaymentClassification = (params: {
  scope: 'session' | 'batch'; sessionId?: string | null; batchId?: string | null;
  classification: 'Cash' | 'Card' | 'CliQ' | 'Unknown' | 'NotApplicable' | 'Deferred';
  evidenceSource: string; evidence?: Record<string, unknown>; confidence?: 'high' | 'medium' | 'low'; notes?: string;
}) => rpc<{ ok: boolean; id: string; affected_session_count: number; affected_total_amount: number | null; status: string }>(
  'propose_historical_payment_classification',
  {
    p_scope: params.scope, p_session_id: params.sessionId ?? null, p_batch_id: params.batchId ?? null,
    p_classification: params.classification, p_evidence_source: params.evidenceSource,
    p_evidence: params.evidence ?? {}, p_confidence: params.confidence ?? 'medium', p_notes: params.notes ?? null,
  }
);

export const approveHistoricalPaymentClassification = (id: string) =>
  rpc<{ ok: boolean; status: string }>('approve_historical_payment_classification', { p_id: id });

export const rejectHistoricalPaymentClassification = (id: string, reason: string) =>
  rpc<{ ok: boolean; status: string }>('reject_historical_payment_classification', { p_id: id, p_reason: reason });

export const applyHistoricalPaymentClassification = (id: string) =>
  rpc<{ ok: boolean; status: string; applied_count: number; skipped_count: number }>('apply_historical_payment_classification', { p_id: id });

export const rollbackHistoricalPaymentClassification = (id: string, reason: string) =>
  rpc<{ ok: boolean; status: string; deactivated_allocations: number }>('rollback_historical_payment_classification', { p_id: id, p_reason: reason });

export interface PaymentClassificationQueueRow {
  id: string; scope: string; session_id: string | null; batch_id: string | null; station_id: string | null;
  proposed_classification: string; evidence_source: string; confidence: string;
  affected_session_count: number; affected_total_amount: number | null; status: string;
  submitted_at: string; approved_at: string | null; applied_at: string | null; total_count: number;
}

export const fetchHistoricalPaymentClassificationQueue = (opts: {
  status?: string | null; stationId?: string | null; pageSize?: number; pageOffset?: number;
} = {}) => rpc<PaymentClassificationQueueRow[]>('report_historical_payment_classification_queue', {
  p_status: opts.status ?? null, p_station_id: opts.stationId ?? null,
  p_page_size: opts.pageSize ?? 100, p_page_offset: opts.pageOffset ?? 0,
});

export interface HandoverReadinessRow {
  session_id: string; transaction_id: string; station_id: string; start_ts: string; billing_total: number | null;
  payment_status: string; handover_status: string; readiness: 'eligible' | 'blocked' | 'already_included';
  blockers: string[]; total_count: number;
}

export const fetchHandoverReadiness = (
  start: string, end: string, stationId: string | null = null, pageSize = 100, pageOffset = 0
) => rpc<HandoverReadinessRow[]>('report_historical_handover_readiness', {
  p_start: start, p_end: end, p_station_id: stationId, p_page_size: pageSize, p_page_offset: pageOffset,
});

export const investigateEngineMetadata = (billingId: string) =>
  rpc<{
    ok: boolean; billing_id?: string; session_id?: string; current_engine_version: string | null;
    calculation_method?: string; inferred_engine_version: string | null; inference_basis: string;
    confidence: string; reason?: string;
  }>('investigate_engine_metadata', { p_billing_id: billingId });

export const applyEngineMetadataRepair = (billingId: string, reason: string) =>
  rpc<{ ok: boolean; billing_id: string; new_engine_version: string }>('apply_engine_metadata_repair', {
    p_billing_id: billingId, p_reason: reason,
  });

export const fetchHistoricalInventorySummary = (start: string, end: string, stationId: string | null = null) =>
  rpc<Record<string, unknown>>('report_historical_inventory_summary', { p_start: start, p_end: end, p_station_id: stationId });
