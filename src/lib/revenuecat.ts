// RevenueCat helpers keep webhook + sync logic small and predictable.

export type RevenueCatWebhookEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  new_product_id?: string;
  entitlement_ids?: string[];
  expiration_at_ms?: number | null;
  grace_period_expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  environment?: string;
  store?: string;
  transferred_to?: string[];
  transferred_from?: string[];
};

export type RevenueCatEntitlement = 'premium' | 'none';

const DEFAULT_ENTITLEMENT = 'premium';

export function getRevenueCatEntitlementName(): string {
  const raw = process.env.REVENUECAT_ENTITLEMENT;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return DEFAULT_ENTITLEMENT;
}

export function parseRevenueCatWebhookEvent(body: unknown): RevenueCatWebhookEvent | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const event = (body as { event?: unknown }).event;
  if (!event || typeof event !== 'object') {
    return null;
  }

  return event as RevenueCatWebhookEvent;
}

export function resolveRevenueCatAppUserId(event: RevenueCatWebhookEvent): string | null {
  if (typeof event.app_user_id === 'string' && event.app_user_id.trim().length > 0) {
    return event.app_user_id.trim();
  }

  if (Array.isArray(event.transferred_to) && event.transferred_to.length > 0) {
    const candidate = event.transferred_to[0];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

export function resolveRevenueCatProductId(event: RevenueCatWebhookEvent): string | null {
  if (typeof event.new_product_id === 'string' && event.new_product_id.trim().length > 0) {
    return event.new_product_id.trim();
  }
  if (typeof event.product_id === 'string' && event.product_id.trim().length > 0) {
    return event.product_id.trim();
  }
  return null;
}

export function resolveRevenueCatEntitlement(
  event: RevenueCatWebhookEvent
): RevenueCatEntitlement | null {
  if (!Array.isArray(event.entitlement_ids)) {
    return null;
  }

  const entitlementName = getRevenueCatEntitlementName();
  return event.entitlement_ids.includes(entitlementName) ? 'premium' : 'none';
}

export function normalizeRevenueCatEnvironment(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim().toLowerCase();
}

export function normalizeRevenueCatStore(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim().toLowerCase();
}

export function parseRevenueCatMillisField(
  event: RevenueCatWebhookEvent,
  field: 'expiration_at_ms' | 'grace_period_expiration_at_ms' | 'purchased_at_ms'
): { hasField: boolean; value: Date | null } {
  if (!Object.prototype.hasOwnProperty.call(event, field)) {
    return { hasField: false, value: null };
  }

  const raw = event[field];
  if (typeof raw === 'number') {
    return { hasField: true, value: new Date(raw) };
  }

  return { hasField: true, value: null };
}

export function parseRevenueCatDate(value: unknown): Date | null {
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      const date = new Date(numeric);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
