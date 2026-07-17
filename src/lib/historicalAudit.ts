/**
 * EV-F pure, DB-free helpers mirroring the SQL classification/state-machine
 * logic in supabase/migrations/20260717150000-150700_f_*.sql. Kept separate
 * from historicalAuditService.ts (which performs the actual RPC calls) so the
 * decision logic can be unit-tested without a live database. Any change to
 * the SQL logic must be mirrored here.
 */

export function roundJod3(v: number): number {
  return Math.round((v + Number.EPSILON) * 1000) / 1000;
}

export type MatchTier = 'exact' | 'rounding_only' | 'minor' | 'material' | 'cannot_compare';

export function classifyMatchTier(currentTotal: number | null, expectedTotal: number | null): MatchTier {
  if (currentTotal === null || expectedTotal === null) return 'cannot_compare';
  const diff = roundJod3(currentTotal - expectedTotal);
  if (diff === 0) return 'exact';
  if (Math.abs(diff) <= 0.001) return 'rounding_only';
  if (Math.abs(diff) <= 1.0) return 'minor';
  return 'material';
}

export function confidenceForMatchTier(tier: MatchTier): 'high' | 'medium' | 'low' {
  if (tier === 'exact' || tier === 'rounding_only') return 'high';
  if (tier === 'minor') return 'medium';
  return 'low';
}

export function riskForMatchTier(tier: MatchTier): 'low' | 'medium' | 'high' {
  if (tier === 'exact' || tier === 'rounding_only') return 'low';
  if (tier === 'minor') return 'medium';
  return 'high';
}

export function recommendationFor(tier: MatchTier, engineVersionMissing: boolean): string {
  if (tier === 'exact' && engineVersionMissing) return 'repair_metadata_only';
  if (tier === 'exact' || tier === 'rounding_only') return 'no_action_required';
  return 'manual_review';
}

const CLASSIFICATION_PRIORITY = [
  'missing_billing', 'duplicate_billing', 'orphan_breakdown',
  'station_relationship_issue', 'operator_relationship_issue',
  'non_zero_demand', 'non_zero_tax', 'breakdown_mismatch',
  'legacy_unknown', 'legacy_calculated', 'v2_verified',
];

export function pickPrimaryClassification(exceptionTypes: string[]): string {
  for (const candidate of CLASSIFICATION_PRIORITY) {
    if (exceptionTypes.includes(candidate)) return candidate;
  }
  return 'cannot_compare';
}

export const HISTORICAL_PAYMENT_CLASSIFICATIONS = ['Cash', 'Card', 'CliQ', 'Unknown', 'NotApplicable', 'Deferred'] as const;
export type HistoricalPaymentClassification = (typeof HISTORICAL_PAYMENT_CLASSIFICATIONS)[number];

export function isValidHistoricalPaymentClassification(v: string): v is HistoricalPaymentClassification {
  return (HISTORICAL_PAYMENT_CLASSIFICATIONS as readonly string[]).includes(v);
}

/** Writes an actual payment allocation only for Cash/Card/CliQ; Unknown/NotApplicable/Deferred stay unassigned. */
export function classificationWritesAllocation(v: HistoricalPaymentClassification): boolean {
  return v === 'Cash' || v === 'Card' || v === 'CliQ';
}

/** Mirrors the batch-level proposal guard in propose_historical_payment_classification. */
export function isBatchProposalAllowed(
  classification: HistoricalPaymentClassification,
  evidence: { uniform_method_confirmed?: boolean }
): boolean {
  if (!classificationWritesAllocation(classification)) return true; // Unknown/NotApplicable/Deferred never need uniform-method evidence
  return evidence.uniform_method_confirmed === true;
}

export type CorrectionStatus =
  | 'identified' | 'review_required' | 'approved' | 'rejected' | 'deferred'
  | 'applying' | 'applied' | 'failed' | 'rolled_back';

export function canApprove(status: CorrectionStatus): boolean {
  return status === 'identified' || status === 'review_required';
}

export function canApply(status: CorrectionStatus): boolean {
  return status === 'approved' || status === 'failed'; // failed retry is idempotent-safe (single-transaction apply)
}

export function canRollback(status: CorrectionStatus): boolean {
  return status === 'applied';
}

/** Self-approval is blocked for everyone except system_admin. */
export function isApprovalAllowed(submitterId: string, approverId: string, approverIsSystemAdmin: boolean): boolean {
  if (submitterId !== approverId) return true;
  return approverIsSystemAdmin;
}

const CORRECTION_APPROVER_ROLES = new Set(['system_admin', 'global_admin', 'operations_manager', 'company_manager', 'accountant']);
export function roleCanApprove(role: string): boolean {
  return CORRECTION_APPROVER_ROLES.has(role);
}

const CORRECTION_SUBMITTER_ROLES = new Set([
  'system_admin', 'global_admin', 'operations_manager', 'company_manager', 'accountant', 'station_manager', 'import_officer',
]);
export function roleCanSubmit(role: string): boolean {
  return CORRECTION_SUBMITTER_ROLES.has(role);
}

const DENIED_ROLES = new Set(['pending', 'disabled', 'rejected']);
export function roleIsDenied(role: string | null | undefined): boolean {
  return !role || DENIED_ROLES.has(role);
}

/** Mirrors the report pagination cap applied server-side (LEAST(requested, hardCap)). */
export function effectivePageSize(requested: number | undefined, defaultSize: number, hardCap: number): number {
  return Math.min(requested ?? defaultSize, hardCap);
}
