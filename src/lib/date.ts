import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { addDays, subDays, parseISO } from 'date-fns';

const TIMEZONE = 'Europe/London';

/**
 * Get the current date in Europe/London timezone as YYYY-MM-DD
 */
export function getTodayLondon(): string {
  return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get date N days ago in Europe/London timezone as YYYY-MM-DD
 */
export function getDaysAgoLondon(days: number): string {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  const daysAgo = subDays(zonedNow, days);
  return formatInTimeZone(daysAgo, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Get the last N days including today as YYYY-MM-DD strings
 */
export function getLastNDaysLondon(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    dates.push(getDaysAgoLondon(i));
  }
  return dates;
}

/**
 * Get tomorrow's date in Europe/London timezone as YYYY-MM-DD
 */
export function getTomorrowLondon(): string {
  const now = new Date();
  const zonedNow = toZonedTime(now, TIMEZONE);
  const tomorrow = addDays(zonedNow, 1);
  return formatInTimeZone(tomorrow, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Check if a date string is today in London timezone
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayLondon();
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
 * Get current timestamp in London timezone
 */
export function getNowLondon(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}
