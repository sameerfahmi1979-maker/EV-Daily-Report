import { describe, expect, it } from 'vitest';
import {
  expectedPhysicalCash,
  paymentReconciliationOk,
  requiresDiscrepancyReason,
  roundJod3,
  shortageSurplus,
  summarizeByMethod,
  sumSettlement,
} from '../paymentHandover';

describe('paymentHandover EV-D', () => {
  it('rounds JOD to 3dp', () => {
    expect(roundJod3(1.2344)).toBe(1.234);
    expect(roundJod3(1.2345)).toBe(1.235);
  });

  it('computes expected physical cash excluding card/cliq', () => {
    expect(
      expectedPhysicalCash({ cashTotal: 10, approvedIncrease: 0.5, approvedDecrease: 0.2 })
    ).toBe(10.3);
  });

  it('shortage and surplus', () => {
    expect(shortageSurplus(10, 9).shortage).toBe(1);
    expect(shortageSurplus(10, 9).surplus).toBe(0);
    expect(shortageSurplus(10, 11.5).surplus).toBe(1.5);
  });

  it('reconciles mixed methods within 0.001', () => {
    expect(
      paymentReconciliationOk({
        billingTotal: 10,
        cashTotal: 4,
        cardTotal: 3,
        cliqTotal: 3,
        unassignedCount: 0,
      })
    ).toBe(true);
    expect(
      paymentReconciliationOk({
        billingTotal: 10,
        cashTotal: 4,
        cardTotal: 3,
        cliqTotal: 2.9,
        unassignedCount: 0,
      })
    ).toBe(false);
    expect(
      paymentReconciliationOk({
        billingTotal: 10,
        cashTotal: 10,
        cardTotal: 0,
        cliqTotal: 0,
        unassignedCount: 1,
      })
    ).toBe(false);
  });

  it('requires a discrepancy reason only when shortage or surplus is non-zero', () => {
    expect(requiresDiscrepancyReason(0, 0)).toBe(false);
    expect(requiresDiscrepancyReason(0.0001, 0)).toBe(false); // sub-cent noise
    expect(requiresDiscrepancyReason(0.5, 0)).toBe(true);
    expect(requiresDiscrepancyReason(0, 0.5)).toBe(true);
  });

  it('summarizes by method', () => {
    const s = summarizeByMethod([
      { payment_method: 'Cash', amount_jod: 1.5 },
      { payment_method: 'Card', amount_jod: 2.25 },
      { payment_method: 'CliQ', amount_jod: 0.75 },
    ]);
    expect(s.cash).toBe(1.5);
    expect(s.card).toBe(2.25);
    expect(s.cliq).toBe(0.75);
    expect(s.billing).toBe(4.5);
  });
});

describe('manual shift cash settlement', () => {
  it('sums Cash + CliQ + Card entered manually at handover', () => {
    expect(sumSettlement(4, 3, 3)).toBe(10);
    expect(sumSettlement(1.111, 2.222, 3.333)).toBe(6.666);
  });

  it('treats missing/invalid entries as zero', () => {
    expect(sumSettlement(Number.NaN, 5, 0)).toBe(5);
  });

  it('flags a shortage ("miss") when the total entered is below shift sales', () => {
    const total = sumSettlement(20, 5, 5); // 30 entered
    const { shortage, surplus } = shortageSurplus(35, total); // shift sold 35
    expect(shortage).toBe(5);
    expect(surplus).toBe(0);
    expect(requiresDiscrepancyReason(shortage, surplus)).toBe(true);
  });

  it('flags a surplus when the total entered exceeds shift sales', () => {
    const total = sumSettlement(20, 10, 8); // 38 entered
    const { shortage, surplus } = shortageSurplus(35, total); // shift sold 35
    expect(shortage).toBe(0);
    expect(surplus).toBe(3);
    expect(requiresDiscrepancyReason(shortage, surplus)).toBe(true);
  });

  it('requires no reason when the totals balance exactly', () => {
    const total = sumSettlement(15, 10, 10);
    const { shortage, surplus } = shortageSurplus(35, total);
    expect(requiresDiscrepancyReason(shortage, surplus)).toBe(false);
  });
});
