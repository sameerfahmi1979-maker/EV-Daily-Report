import { describe, expect, it } from 'vitest';
import {
  calculateSessionBillingV2Pure,
  jordanGovernmentTariff,
} from '../billingEngineV2';
import {
  expandPeriodToDisplayIntervals,
  intervalToStyle,
  validateDayCoverage,
  roundJod3,
} from '../tariffIntervalUtils';

describe('tariffIntervalUtils', () => {
  it('expands overnight MID into two display segments', () => {
    const iv = expandPeriodToDisplayIntervals('23:00:00', '05:00:00');
    expect(iv).toEqual([
      { startMinute: 23 * 60, endMinute: 24 * 60 },
      { startMinute: 0, endMinute: 5 * 60 },
    ]);
    const styles = iv.map(intervalToStyle);
    expect(Number(styles[0].width.replace('%', ''))).toBeGreaterThan(0);
    expect(Number(styles[1].width.replace('%', ''))).toBeGreaterThan(0);
  });

  it('validates complete Jordan coverage', () => {
    const t = jordanGovernmentTariff();
    const v = validateDayCoverage(t.periods);
    expect(v.complete).toBe(true);
    expect(v.uncoveredMinutes).toBe(0);
    expect(v.overlaps.length).toBe(0);
  });
});

describe('billingEngineV2 pure', () => {
  const tariff = jordanGovernmentTariff();

  it('bills overnight MID session entirely at 0.193', () => {
    // 2026-07-15 23:53:32 → 2026-07-16 00:37:05 Asia/Amman
    const result = calculateSessionBillingV2Pure({
      startTs: '2026-07-15T20:53:32.000Z', // Amman UTC+3 in July
      endTs: '2026-07-15T21:37:05.000Z',
      energyKwh: 38,
      structures: [tariff],
    });
    expect(result.total).toBe(roundJod3(38 * 0.193));
    expect(result.total).toBe(7.334);
    expect(result.taxes).toBe(0);
    expect(result.segments.every((s) => s.demandCharge === 0)).toBe(true);
    expect(result.segments.every((s) => s.periodName === 'MID')).toBe(true);
  });

  it('splits Peak→MID at 23:00', () => {
    const result = calculateSessionBillingV2Pure({
      startTs: '2026-07-16T19:50:00.000Z', // 22:50 Amman
      endTs: '2026-07-16T20:10:00.000Z', // 23:10 Amman
      energyKwh: 20,
      structures: [tariff],
    });
    expect(result.segments.length).toBe(2);
    expect(result.segments[0].periodName).toBe('Peak');
    expect(result.segments[1].periodName).toBe('MID');
    expect(result.taxes).toBe(0);
    expect(result.segments.every((s) => s.demandCharge === 0)).toBe(true);
  });

  it('splits Off-Peak→Mid-Peak→Peak for 13:50→17:10', () => {
    const result = calculateSessionBillingV2Pure({
      startTs: '2026-07-16T10:50:00.000Z', // 13:50
      endTs: '2026-07-16T14:10:00.000Z', // 17:10
      energyKwh: 33,
      structures: [tariff],
    });
    expect(result.segments.map((s) => s.periodName)).toEqual([
      'Off-Peak',
      'Mid-Peak',
      'Peak',
    ]);
    const sumEnergy = result.segments.reduce((s, x) => s + x.energyKwh, 0);
    expect(Math.abs(sumEnergy - 33)).toBeLessThan(0.02);
  });

  it('demand charge never affects total', () => {
    const result = calculateSessionBillingV2Pure({
      startTs: '2026-07-16T08:00:00.000Z',
      endTs: '2026-07-16T09:00:00.000Z',
      energyKwh: 10,
      structures: [tariff],
    });
    expect(result.total).toBe(roundJod3(10 * 0.183));
    expect(result.segments[0].demandCharge).toBe(0);
  });
});
