import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { validateActiveSubjects } from '@/lib/active-subjects';
import { createUserProfileStore } from '@/lib/user-profile-store';
import { getSubscriptionSummary, isPremiumUser } from '@/lib/subscription';

function toProfileResponse(user: {
  id: string;
  activeSubjects: string[];
  onboardingComplete: boolean;
  subscriptionStart?: Date | { toDate: () => Date } | number | null;
  subscriptionExpiry?: Date | { toDate: () => Date } | number | null;
  graceUntil?: Date | { toDate: () => Date } | number | null;
  subscriptionProvider?: string | null;
  entitlement?: 'premium' | 'free' | 'none' | null;
  subscriptionStatus?: 'active' | 'grace' | 'expired' | 'unknown' | null;
  productId?: string | null;
  store?: string | null;
  environment?: string | null;
  revenueCatAppUserId?: string | null;
  lastRevenueCatEventId?: string | null;
  adminOverride?: boolean | null;
}) {
  const subscription = getSubscriptionSummary(user);
  return {
    id: user.id,
    activeSubjects: user.activeSubjects,
    onboardingComplete: user.onboardingComplete,
    entitlement: subscription.entitlement,
    subscriptionStatus: subscription.subscriptionStatus,
    subscriptionStart: subscription.subscriptionStart,
    subscriptionExpiry: subscription.subscriptionExpiry,
    graceUntil: subscription.graceUntil,
    subscriptionProvider: subscription.subscriptionProvider,
    productId: user.productId ?? null,
    store: user.store ?? null,
    environment: user.environment ?? null,
    revenueCatAppUserId: user.revenueCatAppUserId ?? null,
    lastRevenueCatEventId: user.lastRevenueCatEventId ?? null,
    adminOverride: subscription.adminOverride,
  };
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const labelLower = session.label.toLowerCase();
    const mobileStore = createFirestoreMobileUserStore();
    const mobileUser = await mobileStore.getByUsername(labelLower);
    const profileStore = createUserProfileStore();
    const profileUser = mobileUser ? null : await profileStore.getByLabel(labelLower);
    const user = mobileUser ?? profileUser;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = validateActiveSubjects(body?.activeSubjects);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.value.length > 1 && !isPremiumUser(user)) {
      return NextResponse.json(
        { error: 'Premium required to select multiple subjects' },
        { status: 403 }
      );
    }

    if (mobileUser) {
      await mobileStore.updateProfile(user.id, {
        activeSubjects: result.value,
        onboardingComplete: true,
      });
    } else {
      await profileStore.updateProfile(user.id, {
        activeSubjects: result.value,
        onboardingComplete: true,
      });
    }

    return NextResponse.json(
      toProfileResponse({
        ...user,
        activeSubjects: result.value,
        onboardingComplete: true,
      })
    );
  } catch (error) {
    console.error('Update active subjects error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating subjects' },
      { status: 500 }
    );
  }
}
