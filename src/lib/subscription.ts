import { resolveTimestamp } from '@/lib/account-deletion';

export type SubscriptionStatus = 'active' | 'grace' | 'expired';
export type Entitlement = 'premium' | 'free';

export type SubscriptionProvider = 'apple' | 'google' | 'manual';

export type SubscriptionFields = {
  subscriptionStart?: Date | { toDate: () => Date } | number | null;
  subscriptionExpiry?: Date | { toDate: () => Date } | number | null;
  graceUntil?: Date | { toDate: () => Date } | number | null;
  subscriptionProvider?: SubscriptionProvider | string | null;
  adminOverride?: boolean | null;
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

export function getSubscriptionSummary(user: SubscriptionFields): SubscriptionSummary {
  const adminOverride = Boolean(user.adminOverride);
  const now = new Date();
  const subscriptionStart = resolveTimestamp(user.subscriptionStart);
  const subscriptionExpiry = resolveTimestamp(user.subscriptionExpiry);
  const graceUntil = resolveTimestamp(user.graceUntil);

  let subscriptionStatus: SubscriptionStatus = 'expired';
  if (subscriptionExpiry && now.getTime() <= subscriptionExpiry.getTime()) {
    subscriptionStatus = 'active';
  } else if (graceUntil && now.getTime() <= graceUntil.getTime()) {
    subscriptionStatus = 'grace';
  }

  if (adminOverride && subscriptionStatus === 'expired') {
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
