/**
 * EV-B: Shared tariff interval helpers (half-open [start, end) in minutes-of-day).
 * Overnight periods like 23:00–05:00 expand to two visual segments without two DB rows.
 */

export const MINUTES_PER_DAY = 24 * 60;
export const BILLING_TZ = 'Asia/Amman';

export type MinuteInterval = { startMinute: number; endMinute: number };

export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  if (hours === 24 && minutes === 0) return MINUTES_PER_DAY;
  return hours * 60 + minutes;
}

export function minutesToPercent(minute: number): number {
  return (minute / MINUTES_PER_DAY) * 100;
}

/** Expand a DB period into one or two half-open display intervals. */
export function expandPeriodToDisplayIntervals(
  startTime: string,
  endTime: string
): MinuteInterval[] {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end === 0 && start > 0) end = MINUTES_PER_DAY;

  if (end === start) {
    return [{ startMinute: 0, endMinute: MINUTES_PER_DAY }];
  }

  if (end > start) {
    return [{ startMinute: start, endMinute: end }];
  }

  // Overnight: [start, 24:00) U [00:00, end)
  return [
    { startMinute: start, endMinute: MINUTES_PER_DAY },
    { startMinute: 0, endMinute: end },
  ];
}

export function intervalToStyle(interval: MinuteInterval): { left: string; width: string } {
  const left = minutesToPercent(interval.startMinute);
  const width = minutesToPercent(interval.endMinute - interval.startMinute);
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(0, width)}%`,
  };
}

export function minuteCoveredByPeriods(
  minute: number,
  periods: Array<{ start_time: string; end_time: string }>
): boolean {
  for (const p of periods) {
    for (const iv of expandPeriodToDisplayIntervals(p.start_time, p.end_time)) {
      if (minute >= iv.startMinute && minute < iv.endMinute) return true;
    }
  }
  return false;
}

export interface CoverageValidation {
  complete: boolean;
  gaps: MinuteInterval[];
  overlaps: Array<{ minute: number; count: number }>;
  uncoveredMinutes: number;
}

/** Validate 24h coverage for a set of periods (ignores days/season; caller filters). */
export function validateDayCoverage(
  periods: Array<{ start_time: string; end_time: string }>
): CoverageValidation {
  const cover = new Array<number>(MINUTES_PER_DAY).fill(0);
  for (const p of periods) {
    for (const iv of expandPeriodToDisplayIntervals(p.start_time, p.end_time)) {
      for (let m = iv.startMinute; m < iv.endMinute; m++) {
        cover[m] += 1;
      }
    }
  }

  const gaps: MinuteInterval[] = [];
  const overlaps: Array<{ minute: number; count: number }> = [];
  let gapStart: number | null = null;
  let uncovered = 0;

  for (let m = 0; m < MINUTES_PER_DAY; m++) {
    if (cover[m] === 0) {
      uncovered++;
      if (gapStart === null) gapStart = m;
    } else {
      if (gapStart !== null) {
        gaps.push({ startMinute: gapStart, endMinute: m });
        gapStart = null;
      }
    }
    if (cover[m] > 1) overlaps.push({ minute: m, count: cover[m] });
  }
  if (gapStart !== null) gaps.push({ startMinute: gapStart, endMinute: MINUTES_PER_DAY });

  return {
    complete: uncovered === 0 && overlaps.length === 0,
    gaps,
    overlaps,
    uncoveredMinutes: uncovered,
  };
}

/** ROUND_HALF_UP to 3 decimal places (positive money path). */
export function roundJod3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
