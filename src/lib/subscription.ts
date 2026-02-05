import { resolveTimestamp } from '@/lib/account-deletion';

export type SubscriptionStatus = 'active' | 'grace' | 'expired' | 'unknown';
export type Entitlement = 'premium' | 'free';

export type SubscriptionProvider = 'apple' | 'google' | 'manual' | 'revenuecat';

export type SubscriptionFields = {
  subscriptionStart?: Date | { toDate: () => Date } | number | null;
  subscriptionExpiry?: Date | { toDate: () => Date } | number | null;
  graceUntil?: Date | { toDate: () => Date } | number | null;
  subscriptionProvider?: SubscriptionProvider | string | null;
  adminOverride?: boolean | null;
  entitlement?: 'premium' | 'free' | 'none' | string | null;
  subscriptionStatus?: SubscriptionStatus | string | null;
};

export type SubscriptionSummary = {
  entitlement: Entitlement;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStart: string | null;
  subscriptionExpiry: string | null;
  graceUntil: string | null;
  subscriptionProvider: string | null;
  adminOverride: boolean;
};

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function normalizeEntitlement(value: SubscriptionFields['entitlement']): Entitlement | null {
  if (value === 'premium') {
    return 'premium';
  }
  if (value === 'none' || value === 'free') {
    return 'free';
  }
  return null;
}

export function computeSubscriptionStatus(input: {
  entitlement: Entitlement | null;
  subscriptionExpiry: Date | null;
  graceUntil: Date | null;
  fallbackStatus?: SubscriptionStatus | null;
  now?: Date;
}): SubscriptionStatus {
  const now = input.now ?? new Date();

  if (input.entitlement === 'premium') {
    if (input.subscriptionExpiry && now.getTime() <= input.subscriptionExpiry.getTime()) {
      return 'active';
    }
    if (input.graceUntil && now.getTime() <= input.graceUntil.getTime()) {
      return 'grace';
    }
  }

  if (input.fallbackStatus === 'unknown') {
    return 'unknown';
  }

  return 'expired';
}

export function getSubscriptionSummary(user: SubscriptionFields): SubscriptionSummary {
  const adminOverride = Boolean(user.adminOverride);
  const now = new Date();
  const subscriptionStart = resolveTimestamp(user.subscriptionStart);
  const subscriptionExpiry = resolveTimestamp(user.subscriptionExpiry);
  const graceUntil = resolveTimestamp(user.graceUntil);

  const storedEntitlement = normalizeEntitlement(user.entitlement);
  const hasStoredEntitlement = storedEntitlement !== null;
  const entitlementForStatus = hasStoredEntitlement ? storedEntitlement : 'premium';

  const fallbackStatus = hasStoredEntitlement && user.subscriptionStatus === 'unknown' ? 'unknown' : null;

  let subscriptionStatus = computeSubscriptionStatus({
    entitlement: entitlementForStatus,
    subscriptionExpiry,
    graceUntil,
    fallbackStatus,
    now,
  });

  if (adminOverride && subscriptionStatus !== 'active' && subscriptionStatus !== 'grace') {
    subscriptionStatus = 'active';
  }

  const entitlement: Entitlement =
    adminOverride || subscriptionStatus === 'active' || subscriptionStatus === 'grace'
      ? 'premium'
      : 'free';

  return {
    entitlement,
    subscriptionStatus,
    subscriptionStart: toIso(subscriptionStart),
    subscriptionExpiry: toIso(subscriptionExpiry),
    graceUntil: toIso(graceUntil),
    subscriptionProvider: user.subscriptionProvider ?? null,
    adminOverride,
  };
}

export function isPremiumUser(user: SubscriptionFields): boolean {
  return getSubscriptionSummary(user).entitlement === 'premium';
}
