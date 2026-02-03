import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import {
  SubscriptionVerificationError,
  verifyAppleSubscription,
  verifyGoogleSubscription,
} from '@/lib/subscription-verification';
import { getSubscriptionSummary } from '@/lib/subscription';

type VerifyRequestBody = {
  provider?: 'apple' | 'google';
  transactionId?: string;
  appReceipt?: string;
  purchaseToken?: string;
  packageName?: string;
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

    let body: VerifyRequestBody;
    try {
      body = (await request.json()) as VerifyRequestBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (body.provider !== 'apple' && body.provider !== 'google') {
      return NextResponse.json({ error: 'provider must be apple or google' }, { status: 400 });
    }

    const verification =
      body.provider === 'apple'
        ? await verifyAppleSubscription({
            transactionId: body.transactionId,
            appReceipt: body.appReceipt,
          })
        : await verifyGoogleSubscription({
            purchaseToken: body.purchaseToken,
            packageName: body.packageName,
          });

    await store.updateSubscription(user.id, {
      subscriptionStart: verification.subscriptionStart,
      subscriptionExpiry: verification.subscriptionExpiry,
      graceUntil: null,
      subscriptionProvider: verification.subscriptionProvider,
    });

    const summary = getSubscriptionSummary({
      ...user,
      subscriptionStart: verification.subscriptionStart,
      subscriptionExpiry: verification.subscriptionExpiry,
      graceUntil: null,
      subscriptionProvider: verification.subscriptionProvider,
    });

    return NextResponse.json({
      entitlement: summary.entitlement,
      subscriptionStatus: summary.subscriptionStatus,
      subscriptionStart: summary.subscriptionStart,
      subscriptionExpiry: summary.subscriptionExpiry,
      graceUntil: summary.graceUntil,
      subscriptionProvider: summary.subscriptionProvider,
      adminOverride: summary.adminOverride,
    });
  } catch (error) {
    if (error instanceof SubscriptionVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Subscription verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred while verifying the subscription' },
      { status: 500 }
    );
  }
}
