import { supabase } from './supabase';
import type { PaymentMethod } from './paymentHandover';

export async function isPaymentWorkflowEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'payment_workflow_v1_enabled')
    .maybeSingle();
  return (data?.value ?? 'false') === 'true';
}

export async function isHandoverWorkflowEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'handover_workflow_v1_enabled')
    .maybeSingle();
  return (data?.value ?? 'false') === 'true';
}

export async function assignSessionPayment(
  sessionId: string,
  method: PaymentMethod,
  reference?: string,
  notes?: string
) {
  const { data, error } = await supabase.rpc('assign_session_payment_method', {
    p_session_id: sessionId,
    p_payment_method: method,
    p_payment_reference: reference ?? null,
    p_notes: notes ?? null,
    p_source: 'manual_override',
  });
  if (error) throw error;
  return data;
}

export async function applyBatchDefaultPayment(batchId: string, method: PaymentMethod) {
  const { data, error } = await supabase.rpc('apply_batch_default_payment_method', {
    p_batch_id: batchId,
    p_payment_method: method,
    p_only_unassigned: true,
  });
  if (error) throw error;
  return data;
}

export async function createHandoverDraft(shiftId: string) {
  const { data, error } = await supabase.rpc('create_handover_draft', { p_shift_id: shiftId });
  if (error) throw error;
  return data as { ok: boolean; handover_id: string; handover_number: string };
}

/**
 * Manual Shift Cash Settlement: station manager/ops/admin enters the Cash,
 * CliQ, and Card totals collected at handover. Compares the sum to the
 * shift's total sales (+ any approved adjustments); a note is required
 * whenever there's a shortage ("miss", flagged for salary deduction) or a
 * surplus. Moves the handover to `ready_to_submit`.
 */
export async function setHandoverManualTotals(
  handoverId: string,
  cash: number,
  cliq: number,
  card: number,
  note?: string | null
) {
  const { data, error } = await supabase.rpc('set_handover_manual_totals', {
    p_handover_id: handoverId,
    p_cash: cash,
    p_cliq: cliq,
    p_card: card,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

/**
 * Finalizes a handover whose Cash/CliQ/Card totals were already saved via
 * setHandoverManualTotals (status must be `ready_to_submit`).
 */
export async function submitHandover(handoverId: string) {
  const { data, error } = await supabase.rpc('submit_handover', {
    p_handover_id: handoverId,
  });
  if (error) throw error;
  return data;
}

export async function approveHandover(handoverId: string) {
  const { data, error } = await supabase.rpc('approve_handover', { p_handover_id: handoverId });
  if (error) throw error;
  return data;
}

export async function rejectHandover(handoverId: string, reason: string) {
  const { data, error } = await supabase.rpc('reject_handover', {
    p_handover_id: handoverId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function lockHandover(handoverId: string) {
  const { data, error } = await supabase.rpc('lock_handover', { p_handover_id: handoverId });
  if (error) throw error;
  return data;
}

export async function reopenHandover(handoverId: string, reason: string) {
  const { data, error } = await supabase.rpc('reopen_handover', {
    p_handover_id: handoverId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function createHandoverAdjustment(
  handoverId: string,
  cashImpact: 'increase' | 'decrease',
  amount: number,
  reason: string,
  evidence?: string
) {
  const { data, error } = await supabase.rpc('create_handover_adjustment', {
    p_handover_id: handoverId,
    p_cash_impact: cashImpact,
    p_amount: amount,
    p_reason: reason,
    p_evidence: evidence ?? null,
  });
  if (error) throw error;
  return data;
}

export async function approveHandoverAdjustment(adjustmentId: string) {
  const { data, error } = await supabase.rpc('approve_handover_adjustment', {
    p_adjustment_id: adjustmentId,
  });
  if (error) throw error;
  return data;
}

export async function rejectHandoverAdjustment(adjustmentId: string, reason: string) {
  const { data, error } = await supabase.rpc('reject_handover_adjustment', {
    p_adjustment_id: adjustmentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function listHandoverAdjustments(handoverId: string) {
  const { data, error } = await supabase
    .from('cash_handover_adjustments')
    .select('*')
    .eq('handover_id', handoverId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listHandoversForShift(shiftId: string) {
  const { data, error } = await supabase
    .from('cash_handovers')
    .select('*')
    .eq('shift_id', shiftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getHandoverSessions(handoverId: string) {
  const { data, error } = await supabase
    .from('cash_handover_sessions')
    .select('*')
    .eq('handover_id', handoverId);
  if (error) throw error;
  return data || [];
}

export async function listActiveAllocationsForBatch(batchId: string) {
  const { data: sessions, error } = await supabase
    .from('charging_sessions')
    .select('id, transaction_id, calculated_cost, start_ts, operator_id')
    .eq('import_batch_id', batchId);
  if (error) throw error;
  const ids = (sessions || []).map((s) => s.id);
  if (!ids.length) return { sessions: [], allocations: [] as any[] };
  const { data: allocations, error: aErr } = await supabase
    .from('session_payment_allocations')
    .select('*')
    .in('session_id', ids)
    .eq('is_active', true);
  if (aErr) throw aErr;
  return { sessions: sessions || [], allocations: allocations || [] };
}
