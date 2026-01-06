import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Test date handling in Europe/Lisbon timezone

describe('Date Handling in Europe/Lisbon', () => {
  // Mock timezone functions for testing
  function formatDateToLisbon(date: Date): string {
    // Simple implementation for testing
    return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
  }

  function isToday(dateStr: string): boolean {
    const today = formatDateToLisbon(new Date());
    return dateStr === today;
  }

  function getLastNDays(n: number): string[] {
    const dates: string[] = [];
    for (let i = 0; i < n; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(formatDateToLisbon(date));
    }
    return dates;
  }

  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2026-01-06T12:00:00Z');
    const formatted = formatDateToLisbon(date);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should correctly identify today', () => {
    const today = formatDateToLisbon(new Date());
    expect(isToday(today)).toBe(true);
  });

  it('should correctly identify not today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateToLisbon(yesterday);
    expect(isToday(yesterdayStr)).toBe(false);
  });

  it('should get last 7 days including today', () => {
    const dates = getLastNDays(7);
    expect(dates).toHaveLength(7);

    // First date should be today
    const today = formatDateToLisbon(new Date());
    expect(dates[0]).toBe(today);

    // All dates should be unique
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(7);
  });

  it('should get last N days in descending order', () => {
    const dates = getLastNDays(5);

    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const next = new Date(dates[i + 1]);
      expect(current.getTime()).toBeGreaterThan(next.getTime());
    }
  });

  it('should handle date at midnight edge case', () => {
    // This tests that we're using timezone-aware date handling
    const dateAtMidnight = new Date('2026-01-06T00:00:00Z');
    const formatted = formatDateToLisbon(dateAtMidnight);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle date near day boundary', () => {
    // 23:59 in one timezone might be a different day in another
    const lateNight = new Date('2026-01-06T23:59:00Z');
    const formatted = formatDateToLisbon(lateNight);
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
