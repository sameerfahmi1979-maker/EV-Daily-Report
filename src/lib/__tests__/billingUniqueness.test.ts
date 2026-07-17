import { describe, expect, it } from 'vitest';

/**
 * EV-A1 focused unit tests for authoritative duplicate selection scoring.
 * Mirrors the SQL scoring used in a1_archive_dedupe_billing_and_unique_session_v2.
 * Does not recalculate tariffs.
 */

export type DupBillingCandidate = {
  id: string;
  session_id: string;
  total_amount: number;
  rate_structure_id: string | null;
  breakdown: unknown | null;
  item_cnt: number;
  item_sum: number;
  has_non_offpeak: boolean;
  calculation_date: string;
  created_at: string;
};

export function scoreBillingCandidate(row: DupBillingCandidate): number {
  return (
    (row.item_cnt > 0 ? 1000 : 0) +
    (row.rate_structure_id ? 100 : 0) +
    (row.item_cnt > 0 && Math.abs(row.total_amount - row.item_sum) <= 0.001 ? 50 : 0) +
    (row.breakdown != null ? 10 : 0) +
    (row.has_non_offpeak ? 5 : 0)
  );
}

export function selectAuthoritativeBilling(rows: DupBillingCandidate[]): DupBillingCandidate {
  if (rows.length === 0) throw new Error('empty group');
  return [...rows].sort((a, b) => {
    const scoreDiff = scoreBillingCandidate(b) - scoreBillingCandidate(a);
    if (scoreDiff !== 0) return scoreDiff;
    const calcDiff = b.calculation_date.localeCompare(a.calculation_date);
    if (calcDiff !== 0) return calcDiff;
    const createdDiff = b.created_at.localeCompare(a.created_at);
    if (createdDiff !== 0) return createdDiff;
    return b.id.localeCompare(a.id);
  })[0];
}

describe('EV-A1 billing uniqueness selection', () => {
  it('prefers a row with breakdown items over one without', () => {
    const keeper = selectAuthoritativeBilling([
      {
        id: 'a',
        session_id: 's1',
        total_amount: 2.928,
        rate_structure_id: 'r1',
        breakdown: null,
        item_cnt: 0,
        item_sum: 0,
        has_non_offpeak: false,
        calculation_date: '2026-06-12T12:00:00+03:00',
        created_at: '2026-06-12T12:00:00+03:00',
      },
      {
        id: 'b',
        session_id: 's1',
        total_amount: 2.928,
        rate_structure_id: 'r1',
        breakdown: { total: 2.928 },
        item_cnt: 1,
        item_sum: 2.928,
        has_non_offpeak: false,
        calculation_date: '2026-06-12T11:00:00+03:00',
        created_at: '2026-06-12T11:00:00+03:00',
      },
    ]);
    expect(keeper.id).toBe('b');
  });

  it('for material total conflict, prefers non-offpeak breakdown then later timestamp', () => {
    const keeper = selectAuthoritativeBilling([
      {
        id: 'ae4df970-222b-4f6e-84e1-65bc63627f84',
        session_id: '96f2dddd-4257-430e-9aa6-1e53420af5b5',
        total_amount: 1.4823,
        rate_structure_id: 'r1',
        breakdown: {},
        item_cnt: 1,
        item_sum: 1.4823,
        has_non_offpeak: false,
        calculation_date: '2026-06-12T11:59:03+03:00',
        created_at: '2026-06-12T11:59:03+03:00',
      },
      {
        id: '3a9a8b71-812b-494d-be85-0c4577eebe87',
        session_id: '96f2dddd-4257-430e-9aa6-1e53420af5b5',
        total_amount: 1.563,
        rate_structure_id: 'r1',
        breakdown: {},
        item_cnt: 1,
        item_sum: 1.563,
        has_non_offpeak: true,
        calculation_date: '2026-06-12T12:09:50+03:00',
        created_at: '2026-06-12T12:09:50+03:00',
      },
    ]);
    expect(keeper.id).toBe('3a9a8b71-812b-494d-be85-0c4577eebe87');
  });

  it('uses latest timestamp only as final tie-breaker when scores match', () => {
    const keeper = selectAuthoritativeBilling([
      {
        id: 'old',
        session_id: 's2',
        total_amount: 1,
        rate_structure_id: 'r1',
        breakdown: {},
        item_cnt: 1,
        item_sum: 1,
        has_non_offpeak: false,
        calculation_date: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'new',
        session_id: 's2',
        total_amount: 1,
        rate_structure_id: 'r1',
        breakdown: {},
        item_cnt: 1,
        item_sum: 1,
        has_non_offpeak: false,
        calculation_date: '2026-02-01T00:00:00Z',
        created_at: '2026-02-01T00:00:00Z',
      },
    ]);
    expect(keeper.id).toBe('new');
  });
});
