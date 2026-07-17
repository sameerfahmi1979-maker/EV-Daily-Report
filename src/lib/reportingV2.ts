/**
 * EV-E pure reconciliation/classification helpers — mirror the SQL logic in
 * report_assert_date_range / report_historical_engine_comparison /
 * report_payment_reconciliation so the client can pre-validate before calling
 * the RPC, and so this logic is unit-testable without a database.
 */

export const REPORT_MAX_RANGE_DAYS = 400;
export const RECONCILIATION_TOLERANCE_JOD = 0.001;

export function roundJod3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export interface DateRangeValidation {
  valid: boolean;
  reason?: string;
}

export function isDateRangeValid(
  start: string,
  end: string,
  maxDays: number = REPORT_MAX_RANGE_DAYS
): DateRangeValidation {
  if (!start || !end) return { valid: false, reason: 'Start and end date are required' };
  const days = daysBetween(start, end);
  if (days < 0) return { valid: false, reason: 'End date must not be before start date' };
  if (days > maxDays) {
    return { valid: false, reason: `Date range too wide (max ${maxDays} days); page through history in smaller windows` };
  }
  return { valid: true };
}

export type EngineLabel = 'missing' | 'unknown' | 'legacy' | string;

/** Mirrors report_historical_engine_comparison's CASE expression. */
export function classifyEngineLabel(billingId: string | null, engineVersion: string | null): EngineLabel {
  if (!billingId) return 'missing';
  if (!engineVersion) return 'unknown';
  if (/^ev-b-v2/.test(engineVersion)) return engineVersion;
  return 'legacy';
}

export interface PaymentReconciliation {
  billingTotal: number;
  cashTotal: number;
  cardTotal: number;
  cliqTotal: number;
  unassignedTotal: number;
  difference: number;
  reconciled: boolean;
}

/** Mirrors report_payment_reconciliation's difference/reconciled computation. */
export function computeReconciliation(params: {
  billingTotal: number;
  cashTotal: number;
  cardTotal: number;
  cliqTotal: number;
  unassignedTotal: number;
  tolerance?: number;
}): PaymentReconciliation {
  const tolerance = params.tolerance ?? RECONCILIATION_TOLERANCE_JOD;
  const sum = roundJod3(params.cashTotal + params.cardTotal + params.cliqTotal + params.unassignedTotal);
  const difference = roundJod3(params.billingTotal - sum);
  return {
    billingTotal: roundJod3(params.billingTotal),
    cashTotal: roundJod3(params.cashTotal),
    cardTotal: roundJod3(params.cardTotal),
    cliqTotal: roundJod3(params.cliqTotal),
    unassignedTotal: roundJod3(params.unassignedTotal),
    difference,
    reconciled: Math.abs(difference) <= tolerance,
  };
}

/**
 * Mirrors the "expected physical cash" formula across multiple adjustments
 * (approved positive/negative), including multi-adjustment and reopened-version
 * scenarios where several adjustments may apply to the same handover over time.
 */
export function computeExpectedCashWithAdjustments(params: {
  cashTotal: number;
  approvedAdjustments: Array<{ cashImpact: 'increase' | 'decrease'; amountJod: number; status: string }>;
}): number {
  const netAdjustments = params.approvedAdjustments
    .filter((a) => a.status === 'approved')
    .reduce((sum, a) => sum + (a.cashImpact === 'increase' ? a.amountJod : -a.amountJod), 0);
  return roundJod3(params.cashTotal + netAdjustments);
}

/** True if a session's local Amman date differs from its counterpart UTC date (overnight indicator helper for tests). */
export function isOvernightLocalDate(startLocalDate: string, endLocalDate: string): boolean {
  return startLocalDate !== endLocalDate;
}
