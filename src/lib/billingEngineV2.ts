/**
 * EV-B TypeScript billing engine (preview / parity with SQL v2).
 * Method: Option B — proportional duration energy split.
 * Demand charge = 0, tax = 0, timezone Asia/Amman, ROUND_HALF_UP 3dp.
 */

import { addDays } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { BILLING_TZ, expandPeriodToDisplayIntervals, roundJod3 } from './tariffIntervalUtils';

export const BILLING_ENGINE_VERSION = 'ev-b-v2.0.0';
export const CALCULATION_METHOD = 'proportional_duration_split';

export interface TariffPeriodInput {
  id: string;
  period_name: string;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  season: string | null;
  energy_rate_per_kwh: number;
  priority?: number | null;
}

export interface TariffStructureInput {
  id: string;
  effective_from: string; // YYYY-MM-DD
  effective_to: string | null;
  periods: TariffPeriodInput[];
}

export interface BillingSegmentResult {
  rateStructureId: string;
  ratePeriodId: string;
  periodName: string;
  startTs: Date;
  endTs: Date;
  durationMinutes: number;
  energyKwh: number;
  ratePerKwh: number;
  energyCharge: number;
  demandCharge: number;
  tax: number;
  lineTotal: number;
}

export interface SessionBillingResult {
  engineVersion: string;
  calculationMethod: string;
  segments: BillingSegmentResult[];
  subtotal: number;
  taxes: number;
  fees: number;
  total: number;
  rateStructureId: string;
  appliedRateSummary: string;
}

function dayNameAmman(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BILLING_TZ,
    weekday: 'long',
  })
    .format(d)
    .toLowerCase();
}

function localDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BILLING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function localMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BILLING_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function structureForInstant(
  structures: TariffStructureInput[],
  instant: Date
): TariffStructureInput | null {
  const dateStr = localDateStr(instant);
  const candidates = structures.filter((s) => {
    if (s.effective_from > dateStr) return false;
    if (s.effective_to && s.effective_to < dateStr) return false;
    return true;
  });
  candidates.sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1));
  return candidates[0] ?? null;
}

function periodCoversMinute(period: TariffPeriodInput, minute: number, day: string): boolean {
  if (!period.days_of_week.map((d) => d.toLowerCase()).includes(day)) return false;
  const intervals = expandPeriodToDisplayIntervals(period.start_time, period.end_time);
  return intervals.some((iv) => minute >= iv.startMinute && minute < iv.endMinute);
}

function findPeriod(
  structure: TariffStructureInput,
  instant: Date
): TariffPeriodInput | null {
  const minute = localMinutes(instant);
  const day = dayNameAmman(instant);
  const matches = structure.periods.filter((p) => periodCoversMinute(p, minute, day));
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return matches[0];
}

/** Next boundary: period end, midnight, or session end — as UTC Date. */
function nextBoundaryUtc(
  instant: Date,
  period: TariffPeriodInput,
  sessionEnd: Date,
  structureEndMidnightUtc: Date | null
): Date {
  const zoned = toZonedTime(instant, BILLING_TZ);
  const y = zoned.getFullYear();
  const m = zoned.getMonth();
  const d = zoned.getDate();
  const minute = localMinutes(instant);

  const intervals = expandPeriodToDisplayIntervals(period.start_time, period.end_time);
  let periodEndMinute = MINUTES_PER_DAY;
  for (const iv of intervals) {
    if (minute >= iv.startMinute && minute < iv.endMinute) {
      periodEndMinute = iv.endMinute;
      break;
    }
  }

  const candidates: Date[] = [sessionEnd];

  const localMidnight = fromZonedTime(new Date(y, m, d, 0, 0, 0, 0), BILLING_TZ);
  const nextMidnight = fromZonedTime(addDays(new Date(y, m, d, 0, 0, 0, 0), 1), BILLING_TZ);

  if (periodEndMinute >= MINUTES_PER_DAY) {
    candidates.push(nextMidnight);
  } else {
    const hh = Math.floor(periodEndMinute / 60);
    const mm = periodEndMinute % 60;
    candidates.push(fromZonedTime(new Date(y, m, d, hh, mm, 0, 0), BILLING_TZ));
  }

  // Midnight always (effective-date / day change)
  candidates.push(nextMidnight);
  void localMidnight;

  if (structureEndMidnightUtc) candidates.push(structureEndMidnightUtc);

  const after = candidates.filter((c) => c.getTime() > instant.getTime());
  after.sort((a, b) => a.getTime() - b.getTime());
  return after[0] ?? sessionEnd;
}

const MINUTES_PER_DAY = 24 * 60;

export function calculateSessionBillingV2Pure(params: {
  startTs: Date | string;
  endTs: Date | string;
  energyKwh: number;
  structures: TariffStructureInput[];
}): SessionBillingResult {
  const startTs = typeof params.startTs === 'string' ? new Date(params.startTs) : params.startTs;
  const endTs = typeof params.endTs === 'string' ? new Date(params.endTs) : params.endTs;
  if (!(endTs.getTime() > startTs.getTime())) {
    throw new Error('Invalid session duration: end must be after start');
  }

  const rawSegments: Array<Omit<BillingSegmentResult, 'energyKwh' | 'energyCharge' | 'lineTotal'> & {
    energyKwh?: number;
    energyCharge?: number;
    lineTotal?: number;
  }> = [];

  let cursor = new Date(startTs);
  while (cursor.getTime() < endTs.getTime()) {
    const structure = structureForInstant(params.structures, cursor);
    if (!structure) {
      throw new Error(`No active tariff structure at ${cursor.toISOString()} (${BILLING_TZ})`);
    }
    const period = findPeriod(structure, cursor);
    if (!period) {
      throw new Error(`No tariff period covers ${cursor.toISOString()} (${BILLING_TZ})`);
    }

    let structureEnd: Date | null = null;
    if (structure.effective_to) {
      const [yy, mm, dd] = structure.effective_to.split('-').map(Number);
      structureEnd = fromZonedTime(new Date(yy, mm - 1, dd + 1, 0, 0, 0, 0), BILLING_TZ);
    }

    const segEnd = nextBoundaryUtc(cursor, period, endTs, structureEnd);
    const durationMinutes =
      (segEnd.getTime() - cursor.getTime()) / (1000 * 60);

    rawSegments.push({
      rateStructureId: structure.id,
      ratePeriodId: period.id,
      periodName: period.period_name,
      startTs: new Date(cursor),
      endTs: new Date(segEnd),
      durationMinutes,
      ratePerKwh: Number(period.energy_rate_per_kwh),
      demandCharge: 0,
      tax: 0,
    });

    cursor = segEnd;
  }

  const totalDuration = rawSegments.reduce((s, x) => s + x.durationMinutes, 0);
  if (totalDuration <= 0) throw new Error('Zero duration after split');

  const segments: BillingSegmentResult[] = rawSegments.map((seg) => {
    const energyKwh = params.energyKwh * (seg.durationMinutes / totalDuration);
    const energyCharge = roundJod3(energyKwh * seg.ratePerKwh);
    return {
      ...seg,
      energyKwh: roundJod3(energyKwh),
      energyCharge,
      demandCharge: 0,
      tax: 0,
      lineTotal: energyCharge,
    };
  });

  // Reconcile total from rounded line totals
  let total = roundJod3(segments.reduce((s, x) => s + x.lineTotal, 0));
  // Same energy rate across all segments → exact total (overnight MID, etc.)
  const uniqueRates = new Set(segments.map((s) => s.ratePerKwh));
  if (uniqueRates.size === 1) {
    total = roundJod3(params.energyKwh * segments[0].ratePerKwh);
    if (segments.length === 1) {
      segments[0].lineTotal = total;
      segments[0].energyCharge = total;
      segments[0].energyKwh = roundJod3(params.energyKwh);
    }
  }

  const rateStructureId = segments[0]?.rateStructureId ?? params.structures[0]?.id ?? '';
  const summary = segments
    .map((s) => `${s.periodName}@${s.ratePerKwh}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');

  return {
    engineVersion: BILLING_ENGINE_VERSION,
    calculationMethod: CALCULATION_METHOD,
    segments,
    subtotal: total,
    taxes: 0,
    fees: 0,
    total,
    rateStructureId,
    appliedRateSummary: summary,
  };
}

/** Fixture helper: Jordan government 4-period TOU */
export function jordanGovernmentTariff(structureId = 'jordan-tou'): TariffStructureInput {
  const days = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];
  return {
    id: structureId,
    effective_from: '2020-01-01',
    effective_to: null,
    periods: [
      {
        id: 'off',
        period_name: 'Off-Peak',
        start_time: '05:00:00',
        end_time: '14:00:00',
        days_of_week: days,
        season: 'all',
        energy_rate_per_kwh: 0.183,
        priority: 10,
      },
      {
        id: 'mid',
        period_name: 'Mid-Peak',
        start_time: '14:00:00',
        end_time: '17:00:00',
        days_of_week: days,
        season: 'all',
        energy_rate_per_kwh: 0.193,
        priority: 20,
      },
      {
        id: 'peak',
        period_name: 'Peak',
        start_time: '17:00:00',
        end_time: '23:00:00',
        days_of_week: days,
        season: 'all',
        energy_rate_per_kwh: 0.213,
        priority: 30,
      },
      {
        id: 'night',
        period_name: 'MID',
        start_time: '23:00:00',
        end_time: '05:00:00',
        days_of_week: days,
        season: 'all',
        energy_rate_per_kwh: 0.193,
        priority: 40,
      },
    ],
  };
}
