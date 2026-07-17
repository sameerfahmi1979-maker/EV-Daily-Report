import { describe, expect, it } from 'vitest';
import {
  canApply,
  canApprove,
  canRollback,
  classificationWritesAllocation,
  classifyMatchTier,
  confidenceForMatchTier,
  effectivePageSize,
  isApprovalAllowed,
  isBatchProposalAllowed,
  isValidHistoricalPaymentClassification,
  pickPrimaryClassification,
  recommendationFor,
  riskForMatchTier,
  roleCanApprove,
  roleCanSubmit,
  roleIsDenied,
  roundJod3,
} from '../historicalAudit';

describe('EV-F historical audit pure helpers', () => {
  describe('match tier classification', () => {
    it('classifies an exact match', () => {
      expect(classifyMatchTier(3.294, 3.294)).toBe('exact');
    });
    it('classifies a rounding-only difference (<= 0.001 JOD)', () => {
      expect(classifyMatchTier(3.295, 3.294)).toBe('rounding_only');
    });
    it('classifies a minor difference (<= 1.000 JOD)', () => {
      expect(classifyMatchTier(4.0, 3.294)).toBe('minor');
    });
    it('classifies a material difference (> 1.000 JOD)', () => {
      expect(classifyMatchTier(10.0, 3.294)).toBe('material');
    });
    it('classifies cannot_compare when either side is missing', () => {
      expect(classifyMatchTier(null, 3.294)).toBe('cannot_compare');
      expect(classifyMatchTier(3.294, null)).toBe('cannot_compare');
      expect(classifyMatchTier(null, null)).toBe('cannot_compare');
    });
    it('is symmetric around zero (overbilled vs underbilled)', () => {
      expect(classifyMatchTier(3.0, 3.5)).toBe('minor'); // underbilled by 0.5
      expect(classifyMatchTier(4.0, 3.5)).toBe('minor'); // overbilled by 0.5
    });
  });

  describe('confidence/risk derived from match tier', () => {
    it('exact/rounding-only => high confidence, low risk', () => {
      expect(confidenceForMatchTier('exact')).toBe('high');
      expect(riskForMatchTier('rounding_only')).toBe('low');
    });
    it('minor => medium confidence, medium risk', () => {
      expect(confidenceForMatchTier('minor')).toBe('medium');
      expect(riskForMatchTier('minor')).toBe('medium');
    });
    it('material/cannot_compare => low confidence, high risk', () => {
      expect(confidenceForMatchTier('material')).toBe('low');
      expect(riskForMatchTier('cannot_compare')).toBe('high');
    });
  });

  describe('recommendation', () => {
    it('recommends metadata-only repair for an exact match with missing engine version', () => {
      expect(recommendationFor('exact', true)).toBe('repair_metadata_only');
    });
    it('recommends no action for an exact match with engine version present', () => {
      expect(recommendationFor('exact', false)).toBe('no_action_required');
    });
    it('recommends manual review for anything material or cannot-compare', () => {
      expect(recommendationFor('material', false)).toBe('manual_review');
      expect(recommendationFor('cannot_compare', false)).toBe('manual_review');
    });
  });

  describe('primary classification priority (mirrors f_classify_historical_session)', () => {
    it('missing_billing outranks everything else', () => {
      expect(pickPrimaryClassification(['legacy_unknown', 'missing_billing', 'non_zero_tax'])).toBe('missing_billing');
    });
    it('relationship issues outrank engine-version issues', () => {
      expect(pickPrimaryClassification(['legacy_unknown', 'operator_relationship_issue'])).toBe('operator_relationship_issue');
    });
    it('v2_verified is chosen when no exceptions exist', () => {
      expect(pickPrimaryClassification(['v2_verified', 'payment_unassigned', 'handover_unavailable'])).toBe('v2_verified');
    });
    it('falls back to cannot_compare when nothing matches the priority list', () => {
      expect(pickPrimaryClassification(['payment_unassigned', 'handover_unavailable'])).toBe('cannot_compare');
    });
  });

  describe('historical payment classification governance', () => {
    it('accepts only the six governed states', () => {
      expect(isValidHistoricalPaymentClassification('Cash')).toBe(true);
      expect(isValidHistoricalPaymentClassification('Deferred')).toBe(true);
      expect(isValidHistoricalPaymentClassification('Bitcoin')).toBe(false);
    });
    it('writes an allocation only for Cash/Card/CliQ', () => {
      expect(classificationWritesAllocation('Cash')).toBe(true);
      expect(classificationWritesAllocation('Card')).toBe(true);
      expect(classificationWritesAllocation('CliQ')).toBe(true);
      expect(classificationWritesAllocation('Unknown')).toBe(false);
      expect(classificationWritesAllocation('NotApplicable')).toBe(false);
      expect(classificationWritesAllocation('Deferred')).toBe(false);
    });
    it('blocks a batch-level Cash/Card/CliQ proposal without uniform-method evidence', () => {
      expect(isBatchProposalAllowed('Cash', {})).toBe(false);
      expect(isBatchProposalAllowed('Cash', { uniform_method_confirmed: false })).toBe(false);
    });
    it('allows a batch-level Cash/Card/CliQ proposal with uniform-method evidence', () => {
      expect(isBatchProposalAllowed('Cash', { uniform_method_confirmed: true })).toBe(true);
    });
    it('never requires uniform-method evidence for Unknown/NotApplicable/Deferred (never guessed)', () => {
      expect(isBatchProposalAllowed('Unknown', {})).toBe(true);
      expect(isBatchProposalAllowed('Deferred', {})).toBe(true);
    });
  });

  describe('correction state machine', () => {
    it('can only approve from identified or review_required', () => {
      expect(canApprove('identified')).toBe(true);
      expect(canApprove('review_required')).toBe(true);
      expect(canApprove('approved')).toBe(false);
      expect(canApprove('applied')).toBe(false);
      expect(canApprove('rejected')).toBe(false);
    });
    it('can only apply from approved (or retry from failed)', () => {
      expect(canApply('approved')).toBe(true);
      expect(canApply('failed')).toBe(true);
      expect(canApply('identified')).toBe(false);
      expect(canApply('applied')).toBe(false);
    });
    it('can only roll back an applied correction', () => {
      expect(canRollback('applied')).toBe(true);
      expect(canRollback('approved')).toBe(false);
      expect(canRollback('rolled_back')).toBe(false);
    });
  });

  describe('approval governance', () => {
    it('blocks self-approval for non-admins', () => {
      expect(isApprovalAllowed('user-1', 'user-1', false)).toBe(false);
    });
    it('allows system_admin to approve their own submission', () => {
      expect(isApprovalAllowed('user-1', 'user-1', true)).toBe(true);
    });
    it('allows approval when submitter and approver differ', () => {
      expect(isApprovalAllowed('user-1', 'user-2', false)).toBe(true);
    });
    it('restricts approve/reject/apply/rollback to admin/ops/accountant roles', () => {
      expect(roleCanApprove('accountant')).toBe(true);
      expect(roleCanApprove('operations_manager')).toBe(true);
      expect(roleCanApprove('station_manager')).toBe(false);
      expect(roleCanApprove('import_officer')).toBe(false);
      expect(roleCanApprove('report_viewer')).toBe(false);
    });
    it('allows a wider role set to submit (evidence support)', () => {
      expect(roleCanSubmit('import_officer')).toBe(true);
      expect(roleCanSubmit('station_manager')).toBe(true);
      expect(roleCanSubmit('report_viewer')).toBe(false);
    });
    it('denies pending/disabled/rejected/anonymous roles everywhere', () => {
      expect(roleIsDenied('pending')).toBe(true);
      expect(roleIsDenied('disabled')).toBe(true);
      expect(roleIsDenied('rejected')).toBe(true);
      expect(roleIsDenied(null)).toBe(true);
      expect(roleIsDenied(undefined)).toBe(true);
      expect(roleIsDenied('accountant')).toBe(false);
    });
  });

  describe('pagination cap', () => {
    it('caps requested page size at the hard cap', () => {
      expect(effectivePageSize(10000, 100, 500)).toBe(500);
    });
    it('uses the default when nothing is requested', () => {
      expect(effectivePageSize(undefined, 100, 500)).toBe(100);
    });
    it('allows a page size under the cap', () => {
      expect(effectivePageSize(50, 100, 500)).toBe(50);
    });
  });

  describe('rounding', () => {
    it('rounds to 3dp half-up like the SQL engine', () => {
      expect(roundJod3(1.23449)).toBe(1.234);
      expect(roundJod3(1.2345)).toBe(1.235);
    });
  });
});
