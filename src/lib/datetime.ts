import { format, parse, isValid } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const JORDAN_TIMEZONE = 'Asia/Amman';

export interface DateTimeComponents {
  date: string;
  time: string;
  timestamp: string;
}

export function parseDateTimeString(dateTimeStr: string): DateTimeComponents {
  const parsed = parse(dateTimeStr, 'yyyy-MM-dd HH:mm:ss', new Date());

  if (!isValid(parsed)) {
    throw new Error(`Invalid datetime format: ${dateTimeStr}. Expected: YYYY-MM-DD HH:mm:ss`);
  }

  return {
    date: format(parsed, 'yyyy-MM-dd'),
    time: format(parsed, 'HH:mm:ss'),
    timestamp: parsed.toISOString(),
  };
}

export function formatToJordanTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, JORDAN_TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

export function formatDateOnly(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, JORDAN_TIMEZONE, 'yyyy-MM-dd');
}

export function formatTimeOnly(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, JORDAN_TIMEZONE, 'HH:mm:ss');
}

export function toJordanZone(utcDate: Date | string): Date {
  const dateObj = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(dateObj, JORDAN_TIMEZONE);
}

export function calculateDurationMinutes(startTs: string, endTs: string): number {
  const start = new Date(startTs);
  const end = new Date(endTs);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
}

export function determineSeason(date: Date): 'summer' | 'winter' | 'spring' | 'fall' {
  const month = date.getMonth() + 1;

  if (month >= 6 && month <= 9) return 'summer';
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  return 'fall';
}

export function getDayOfWeek(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}
