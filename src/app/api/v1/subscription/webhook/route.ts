import { NextResponse } from 'next/server';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { computeSubscriptionStatus, Entitlement } from '@/lib/subscription';
import { resolveTimestamp } from '@/lib/account-deletion';
import {
  normalizeRevenueCatEnvironment,
  normalizeRevenueCatStore,
  parseRevenueCatMillisField,
  parseRevenueCatWebhookEvent,
  resolveRevenueCatAppUserId,
  resolveRevenueCatEntitlement,
  resolveRevenueCatProductId,
} from '@/lib/revenuecat';

type SubscriptionUpdate = Parameters<
  ReturnType<typeof createFirestoreMobileUserStore>['updateSubscription']
>[1];

function normalizeEntitlementForStatus(value: unknown): Entitlement | null {
  if (value === 'premium') {
    return 'premium';
  }
  if (value === 'free' || value === 'none') {
    return 'free';
  }
  return null;
}

function resolveWebhookAuth() {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) {
    return { error: 'RevenueCat webhook auth not configured' };
  }

  const headerNameRaw = process.env.REVENUECAT_WEBHOOK_AUTH_HEADER || 'authorization';
  const headerName = headerNameRaw.toLowerCase();

  return { expected, headerName };
}

export async function POST(request: Request) {
  try {
    const authConfig = resolveWebhookAuth();
    if ('error' in authConfig) {
      return NextResponse.json({ error: authConfig.error }, { status: 500 });
    }

    const received = request.headers.get(authConfig.headerName);
    if (!received || received.trim() !== authConfig.expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const event = parseRevenueCatWebhookEvent(payload);
    if (!event || typeof event.id !== 'string' || event.id.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid RevenueCat event' }, { status: 400 });
    }

    const appUserId = resolveRevenueCatAppUserId(event);
    if (!appUserId) {
      return NextResponse.json({ error: 'Missing app_user_id' }, { status: 400 });
    }

    const store = createFirestoreMobileUserStore();
    let user = await store.getById(appUserId);
    if (!user) {
      user = await store.getByRevenueCatAppUserId(appUserId);
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.lastRevenueCatEventId === event.id) {
      return NextResponse.json({ status: 'ignored' });
    }

    const entitlementFromEvent = resolveRevenueCatEntitlement(event);
    const expiryField = parseRevenueCatMillisField(event, 'expiration_at_ms');
    const graceField = parseRevenueCatMillisField(event, 'grace_period_expiration_at_ms');
    const purchaseField = parseRevenueCatMillisField(event, 'purchased_at_ms');

    const update: SubscriptionUpdate = {
      subscriptionProvider: 'revenuecat',
      revenueCatAppUserId: appUserId,
      lastRevenueCatEventId: event.id,
    };

    if (entitlementFromEvent !== null) {
      update.entitlement = entitlementFromEvent;
    }
    if (expiryField.hasField) {
      update.subscriptionExpiry = expiryField.value;
    }
    if (graceField.hasField) {
      update.graceUntil = graceField.value;
    }
    if (purchaseField.hasField) {
      update.subscriptionStart = purchaseField.value;
    }

    const productId = resolveRevenueCatProductId(event);
    if (productId) {
      update.productId = productId;
    }

    const storeValue = normalizeRevenueCatStore(event.store);
    if (storeValue) {
      update.store = storeValue;
    }

    const environment = normalizeRevenueCatEnvironment(event.environment);
    if (environment) {
      update.environment = environment;
    }

    const entitlementForStatus =
      entitlementFromEvent === 'premium'
        ? 'premium'
        : entitlementFromEvent === 'none'
          ? 'free'
          : normalizeEntitlementForStatus(user.entitlement);

    const effectiveExpiry = expiryField.hasField
      ? expiryField.value
      : resolveTimestamp(user.subscriptionExpiry);
    const effectiveGrace = graceField.hasField ? graceField.value : resolveTimestamp(user.graceUntil);
    const fallbackStatus =
      entitlementForStatus === null && user.subscriptionStatus === 'unknown' ? 'unknown' : null;

    update.subscriptionStatus = computeSubscriptionStatus({
      entitlement: entitlementForStatus,
      subscriptionExpiry: effectiveExpiry,
      graceUntil: effectiveGrace,
      fallbackStatus,
    });

    await store.updateSubscription(user.id, update);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('RevenueCat webhook error:', error);
    return NextResponse.json(
      { error: 'An error occurred while handling the webhook' },
      { status: 500 }
    );
  }
}
