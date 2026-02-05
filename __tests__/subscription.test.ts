import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getSubscriptionSummary, isPremiumUser } from '@/lib/subscription';

describe('subscription summary', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks active when subscription expiry is in the future', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-05T12:00:00Z'));
    const summary = getSubscriptionSummary({
      subscriptionStart: new Date('2026-02-01T00:00:00Z'),
      subscriptionExpiry: new Date('2026-03-01T00:00:00Z'),
      subscriptionProvider: 'apple',
    });

    expect(summary.subscriptionStatus).toBe('active');
    expect(summary.entitlement).toBe('premium');
    expect(summary.subscriptionProvider).toBe('apple');
    expect(summary.subscriptionStart).toContain('2026-02-01');
  });

  it('marks grace when expiry passed but grace is still active', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-05T12:00:00Z'));
    const summary = getSubscriptionSummary({
      subscriptionExpiry: new Date('2026-02-01T00:00:00Z'),
      graceUntil: new Date('2026-02-10T00:00:00Z'),
    });

    expect(summary.subscriptionStatus).toBe('grace');
    expect(summary.entitlement).toBe('premium');
  });

  it('marks expired when no active subscription or grace', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-05T12:00:00Z'));
    const summary = getSubscriptionSummary({
      subscriptionExpiry: new Date('2026-02-01T00:00:00Z'),
      graceUntil: new Date('2026-02-02T00:00:00Z'),
    });

    expect(summary.subscriptionStatus).toBe('expired');
    expect(summary.entitlement).toBe('free');
    expect(summary.subscriptionStart).toBeNull();
  });

  it('treats admin override as active', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-05T12:00:00Z'));
    const summary = getSubscriptionSummary({
      subscriptionExpiry: new Date('2026-02-01T00:00:00Z'),
      adminOverride: true,
    });

    expect(summary.subscriptionStatus).toBe('active');
    expect(summary.entitlement).toBe('premium');
    expect(summary.adminOverride).toBe(true);
  });

  it('isPremiumUser mirrors premium entitlement', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-05T12:00:00Z'));
    expect(isPremiumUser({ adminOverride: true })).toBe(true);
    expect(isPremiumUser({ subscriptionExpiry: new Date('2026-01-01T00:00:00Z') })).toBe(false);
  });
});
