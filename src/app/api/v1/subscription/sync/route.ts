import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { computeSubscriptionStatus, getSubscriptionSummary } from '@/lib/subscription';
import {
  getRevenueCatEntitlementName,
  normalizeRevenueCatEnvironment,
  normalizeRevenueCatStore,
  parseRevenueCatDate,
} from '@/lib/revenuecat';

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, unknown>;
    environment?: string;
  };
};

function normalizeEntitlementForStatus(value: 'premium' | 'none'): 'premium' | 'free' {
  return value === 'premium' ? 'premium' : 'free';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.REVENUECAT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'RevenueCat API key not configured' }, { status: 500 });
    }

    const store = createFirestoreMobileUserStore();
    const user = await store.getByUsername(session.label.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const appUserId = user.revenueCatAppUserId || user.id;
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: 'RevenueCat user not found' }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'RevenueCat sync failed' }, { status: 502 });
    }

    const payload = (await response.json()) as RevenueCatSubscriberResponse;
    const entitlementName = getRevenueCatEntitlementName();
    const entitlements =
      payload.subscriber && typeof payload.subscriber.entitlements === 'object'
        ? (payload.subscriber.entitlements as Record<string, unknown>)
        : null;
    const entitlementData = entitlements ? entitlements[entitlementName] : null;

    const entitlementRecord =
      entitlementData && typeof entitlementData === 'object'
        ? (entitlementData as Record<string, unknown>)
        : null;

    const expiryDate = parseRevenueCatDate(
      entitlementRecord?.expires_date_ms ?? entitlementRecord?.expires_date
    );
    const graceDate = parseRevenueCatDate(
      entitlementRecord?.grace_period_expires_date_ms ??
        entitlementRecord?.grace_period_expires_date
    );
    const purchaseDate = parseRevenueCatDate(
      entitlementRecord?.purchase_date_ms ?? entitlementRecord?.purchase_date
    );

    const productId =
      typeof entitlementRecord?.product_identifier === 'string'
        ? entitlementRecord.product_identifier
        : typeof entitlementRecord?.product_id === 'string'
          ? entitlementRecord.product_id
          : null;

    const storeValue = normalizeRevenueCatStore(entitlementRecord?.store);
    const environment = normalizeRevenueCatEnvironment(
      entitlementRecord?.environment ?? payload.subscriber?.environment
    );

    let entitlement: 'premium' | 'none' = 'none';
    if (entitlementRecord) {
      if (!expiryDate || expiryDate.getTime() >= Date.now()) {
        entitlement = 'premium';
      }
    }

    const subscriptionStatus = computeSubscriptionStatus({
      entitlement: normalizeEntitlementForStatus(entitlement),
      subscriptionExpiry: expiryDate,
      graceUntil: graceDate,
      fallbackStatus: entitlementRecord ? null : 'unknown',
    });

    await store.updateSubscription(user.id, {
      subscriptionProvider: 'revenuecat',
      revenueCatAppUserId: appUserId,
      entitlement,
      subscriptionStatus,
      subscriptionStart: purchaseDate,
      subscriptionExpiry: expiryDate,
      graceUntil: graceDate,
      productId,
      store: storeValue ?? null,
      environment: environment ?? null,
    });

    const summary = getSubscriptionSummary({
      ...user,
      subscriptionStart: purchaseDate,
      subscriptionExpiry: expiryDate,
      graceUntil: graceDate,
      subscriptionProvider: 'revenuecat',
      entitlement,
      subscriptionStatus,
    });

    return NextResponse.json({
      revenueCatAppUserId: appUserId,
      entitlement: summary.entitlement,
      subscriptionStatus: summary.subscriptionStatus,
      subscriptionStart: summary.subscriptionStart,
      subscriptionExpiry: summary.subscriptionExpiry,
      graceUntil: summary.graceUntil,
      subscriptionProvider: summary.subscriptionProvider,
      productId: productId ?? null,
      store: storeValue ?? null,
      environment: environment ?? null,
    });
  } catch (error) {
    console.error('RevenueCat sync error:', error);
    return NextResponse.json(
      { error: 'An error occurred while syncing RevenueCat' },
      { status: 500 }
    );
  }
}
