import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { subDays, parseISO } from 'date-fns';

const TIMEZONE = 'Europe/Lisbon';

/**
 * Get the current date in Europe/Lisbon timezone as YYYY-MM-DD
 */
export function getTodayLisbon(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get date N days ago in Europe/Lisbon timezone as YYYY-MM-DD
 */
export function getDaysAgoLisbon(days: number): string {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  const daysAgo = subDays(zonedNow, days);
  return formatInTimeZone(daysAgo, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get the last N days including today as YYYY-MM-DD strings
 */
export function getLastNDaysLisbon(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(getDaysAgoLisbon(i));
  }
  return dates;
}

/**
 * Check if a date string is today in Lisbon timezone
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayLisbon();
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 */
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Format a Date to a display string
 */
export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(d, TIMEZONE, 'EEEE, MMMM d, yyyy');
}

/**
 * Get current timestamp in Lisbon timezone
 */
export function getNowLisbon(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}
