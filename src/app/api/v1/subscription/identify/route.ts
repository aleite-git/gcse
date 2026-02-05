import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';

type IdentifyRequestBody = {
  revenueCatAppUserId?: string;
  appUserId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const store = createFirestoreMobileUserStore();
    const user = await store.getByUsername(session.label.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: IdentifyRequestBody;
    try {
      body = (await request.json()) as IdentifyRequestBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const rawAppUserId =
      typeof body.revenueCatAppUserId === 'string'
        ? body.revenueCatAppUserId
        : typeof body.appUserId === 'string'
          ? body.appUserId
          : '';
    const appUserId = rawAppUserId.trim();
    if (!appUserId) {
      return NextResponse.json({ error: 'revenueCatAppUserId is required' }, { status: 400 });
    }

    // Store the RevenueCat app user id so webhooks can map back to this user.
    await store.updateSubscription(user.id, {
      revenueCatAppUserId: appUserId,
      subscriptionProvider: 'revenuecat',
    });

    return NextResponse.json({ revenueCatAppUserId: appUserId });
  } catch (error) {
    console.error('RevenueCat identify error:', error);
    return NextResponse.json(
      { error: 'An error occurred while identifying the RevenueCat user' },
      { status: 500 }
    );
  }
}
