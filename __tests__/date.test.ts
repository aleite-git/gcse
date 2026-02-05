import { describe, it, expect } from '@jest/globals';
import {
  getTodayLondon,
  getDaysAgoLondon,
  getLastNDaysLondon,
  isToday,
  parseDate,
  formatDisplayDate,
  getNowLondon,
} from '@/lib/date';

// Test date handling in Europe/London timezone

describe('Date Handling in Europe/London', () => {
  it('should format today as YYYY-MM-DD', () => {
    const today = getTodayLondon();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return today for 0 days ago', () => {
    expect(getDaysAgoLondon(0)).toBe(getTodayLondon());
  });

  it('should correctly identify today', () => {
    const today = getTodayLondon();
    expect(isToday(today)).toBe(true);
  });

  it('should correctly identify not today', () => {
    const yesterday = getDaysAgoLondon(1);
    expect(isToday(yesterday)).toBe(false);
  });

  it('should get last 7 days including today', () => {
    const dates = getLastNDaysLondon(7);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe(getTodayLondon());

    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(7);
  });

  it('should get last N days in descending order', () => {
    const dates = getLastNDaysLondon(5);
    for (let i = 0; i < dates.length - 1; i++) {
      const current = parseDate(dates[i]).getTime();
      const next = parseDate(dates[i + 1]).getTime();
      expect(current).toBeGreaterThan(next);
    }
  });

  it('should format display dates as a readable string', () => {
    const today = getTodayLondon();
    const display = formatDisplayDate(today);
    expect(typeof display).toBe('string');
    expect(display.length).toBeGreaterThan(0);
  });

  it('formats display dates from Date objects', () => {
    const date = new Date('2026-02-05T00:00:00Z');
    const display = formatDisplayDate(date);
    expect(typeof display).toBe('string');
    expect(display.length).toBeGreaterThan(0);
  });

  it('should return a valid London timestamp', () => {
    const now = getNowLondon();
    expect(now).toBeInstanceOf(Date);
    expect(Number.isNaN(now.getTime())).toBe(false);
  });
});
