import { describe, expect, it } from 'vitest';
import {
  classifyEngineLabel,
  computeExpectedCashWithAdjustments,
  computeReconciliation,
  daysBetween,
  isDateRangeValid,
  isOvernightLocalDate,
  REPORT_MAX_RANGE_DAYS,
  roundJod3,
} from '../reportingV2';

describe('reportingV2 EV-E pure helpers', () => {
  it('rounds to 3dp consistently', () => {
    expect(roundJod3(1.23449)).toBe(1.234);
    expect(roundJod3(1.2345)).toBe(1.235);
  });

  describe('date range guard', () => {
    it('accepts a normal bounded range', () => {
      expect(isDateRangeValid('2026-07-01', '2026-07-17').valid).toBe(true);
    });

    it('accepts exactly the max range', () => {
      const start = '2026-01-01';
      const end = '2027-02-05'; // 400 days later
      expect(daysBetween(start, end)).toBe(REPORT_MAX_RANGE_DAYS);
      expect(isDateRangeValid(start, end).valid).toBe(true);
    });

    it('rejects a range one day over the max', () => {
      const start = '2026-01-01';
      const end = '2027-02-06'; // 401 days later
      expect(isDateRangeValid(start, end).valid).toBe(false);
    });

    it('rejects end before start', () => {
      expect(isDateRangeValid('2026-07-17', '2026-07-01').valid).toBe(false);
    });

    it('handles month-end and year-end boundaries correctly', () => {
      expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
      expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
      expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // 2024 is a leap year
      expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1); // 2025 is not
    });
  });

  describe('historical engine labeling', () => {
    it('labels missing billing', () => {
      expect(classifyEngineLabel(null, null)).toBe('missing');
    });
    it('labels unknown engine version', () => {
      expect(classifyEngineLabel('bc-1', null)).toBe('unknown');
    });
    it('labels v2 engine with its exact version string', () => {
      expect(classifyEngineLabel('bc-1', 'ev-b-v2.0.0')).toBe('ev-b-v2.0.0');
    });
    it('labels anything else as legacy', () => {
      expect(classifyEngineLabel('bc-1', 'v1-legacy')).toBe('legacy');
    });
  });

  describe('payment reconciliation', () => {
    it('reconciles when cash+card+cliq+unassigned equals billing', () => {
      const r = computeReconciliation({
        billingTotal: 10, cashTotal: 4, cardTotal: 3, cliqTotal: 2, unassignedTotal: 1,
      });
      expect(r.reconciled).toBe(true);
      expect(r.difference).toBe(0);
    });

    it('flags a mismatch beyond tolerance', () => {
      const r = computeReconciliation({
        billingTotal: 10, cashTotal: 4, cardTotal: 3, cliqTotal: 2, unassignedTotal: 0.5,
      });
      expect(r.reconciled).toBe(false);
      expect(r.difference).toBe(0.5);
    });

    it('tolerates a 0.001 JOD rounding difference', () => {
      const r = computeReconciliation({
        billingTotal: 10, cashTotal: 4, cardTotal: 3, cliqTotal: 2, unassignedTotal: 0.999,
      });
      expect(r.reconciled).toBe(true);
    });

    it('does not double-count when unassigned is 0 for a fully reconciled scope', () => {
      const r = computeReconciliation({
        billingTotal: 5.527, cashTotal: 2.845, cardTotal: 1.138, cliqTotal: 1.544, unassignedTotal: 0,
      });
      expect(r.reconciled).toBe(true);
    });
  });

  describe('multi-adjustment expected cash', () => {
    it('applies multiple approved adjustments across a reopened handover version', () => {
      const expected = computeExpectedCashWithAdjustments({
        cashTotal: 10,
        approvedAdjustments: [
          { cashImpact: 'increase', amountJod: 1.5, status: 'approved' },
          { cashImpact: 'decrease', amountJod: 0.75, status: 'approved' },
          { cashImpact: 'increase', amountJod: 5, status: 'rejected' }, // must be ignored
          { cashImpact: 'increase', amountJod: 2, status: 'pending' }, // must be ignored
        ],
      });
      expect(expected).toBe(10.75);
    });

    it('ignores rejected and pending adjustments entirely', () => {
      const expected = computeExpectedCashWithAdjustments({
        cashTotal: 10,
        approvedAdjustments: [
          { cashImpact: 'increase', amountJod: 100, status: 'rejected' },
          { cashImpact: 'decrease', amountJod: 100, status: 'pending' },
        ],
      });
      expect(expected).toBe(10);
    });
  });

  describe('overnight session date grouping', () => {
    it('flags a session whose start/end local dates differ', () => {
      expect(isOvernightLocalDate('2026-07-15', '2026-07-16')).toBe(true);
    });
    it('does not flag a same-day session', () => {
      expect(isOvernightLocalDate('2026-07-16', '2026-07-16')).toBe(false);
    });
  });
});
