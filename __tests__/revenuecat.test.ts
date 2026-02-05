import { afterEach, describe, expect, it } from '@jest/globals';
import {
  getRevenueCatEntitlementName,
  normalizeRevenueCatEnvironment,
  normalizeRevenueCatStore,
  parseRevenueCatDate,
  parseRevenueCatMillisField,
  parseRevenueCatWebhookEvent,
  resolveRevenueCatAppUserId,
  resolveRevenueCatEntitlement,
  resolveRevenueCatProductId,
} from '@/lib/revenuecat';

describe('revenuecat helpers', () => {
  const originalEnv = process.env.REVENUECAT_ENTITLEMENT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REVENUECAT_ENTITLEMENT;
    } else {
      process.env.REVENUECAT_ENTITLEMENT = originalEnv;
    }
  });

  it('uses default entitlement name when env is missing', () => {
    delete process.env.REVENUECAT_ENTITLEMENT;
    expect(getRevenueCatEntitlementName()).toBe('premium');
  });

  it('reads entitlement name from env', () => {
    process.env.REVENUECAT_ENTITLEMENT = 'gold';
    expect(getRevenueCatEntitlementName()).toBe('gold');
  });

  it('parses webhook events from payloads', () => {
    expect(parseRevenueCatWebhookEvent(null)).toBeNull();
    expect(parseRevenueCatWebhookEvent({})).toBeNull();
    const event = parseRevenueCatWebhookEvent({ event: { id: 'evt' } });
    expect(event).toMatchObject({ id: 'evt' });
  });

  it('resolves app user id from event fields', () => {
    expect(resolveRevenueCatAppUserId({ app_user_id: 'user-1' })).toBe('user-1');
    expect(resolveRevenueCatAppUserId({ transferred_to: ['user-2'] })).toBe('user-2');
    expect(resolveRevenueCatAppUserId({})).toBeNull();
  });

  it('picks the latest product id field', () => {
    expect(resolveRevenueCatProductId({ new_product_id: 'new' })).toBe('new');
    expect(resolveRevenueCatProductId({ product_id: 'old' })).toBe('old');
    expect(resolveRevenueCatProductId({})).toBeNull();
  });

  it('resolves entitlement from entitlement ids', () => {
    delete process.env.REVENUECAT_ENTITLEMENT;
    expect(resolveRevenueCatEntitlement({})).toBeNull();
    expect(resolveRevenueCatEntitlement({ entitlement_ids: ['premium'] })).toBe('premium');
    expect(resolveRevenueCatEntitlement({ entitlement_ids: ['starter'] })).toBe('none');
  });

  it('normalizes environment and store strings', () => {
    expect(normalizeRevenueCatEnvironment('SANDBOX')).toBe('sandbox');
    expect(normalizeRevenueCatEnvironment('')).toBeNull();
    expect(normalizeRevenueCatStore('APP_STORE')).toBe('app_store');
    expect(normalizeRevenueCatStore('   ')).toBeNull();
  });

  it('parses millis fields with presence tracking', () => {
    const missing = parseRevenueCatMillisField({}, 'expiration_at_ms');
    expect(missing).toEqual({ hasField: false, value: null });

    const present = parseRevenueCatMillisField({ expiration_at_ms: 123 }, 'expiration_at_ms');
    expect(present.hasField).toBe(true);
    expect(present.value?.getTime()).toBe(123);

    const cleared = parseRevenueCatMillisField({ expiration_at_ms: null }, 'expiration_at_ms');
    expect(cleared).toEqual({ hasField: true, value: null });
  });

  it('parses dates from numbers and strings', () => {
    expect(parseRevenueCatDate(1000)?.getTime()).toBe(1000);
    expect(parseRevenueCatDate('2000')?.getTime()).toBe(2000);
    expect(parseRevenueCatDate('2026-02-05T00:00:00Z')).toBeInstanceOf(Date);
    expect(parseRevenueCatDate('not-a-date')).toBeNull();
  });
});
