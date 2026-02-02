import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { ACTIVE_SUBJECTS, validateActiveSubjects } from '@/lib/active-subjects';
import { createUserProfileStore } from '@/lib/user-profile-store';
import { getSubscriptionSummary, isPremiumUser } from '@/lib/subscription';

function toProfileResponse(user: {
  id: string;
  activeSubjects?: string[];
  onboardingComplete?: boolean;
  username?: string;
  label?: string;
  subscriptionStart?: Date | { toDate: () => Date } | number | null;
  subscriptionExpiry?: Date | { toDate: () => Date } | number | null;
  graceUntil?: Date | { toDate: () => Date } | number | null;
  subscriptionProvider?: string | null;
  adminOverride?: boolean | null;
}) {
  const subscription = getSubscriptionSummary(user);
  return {
    id: user.id,
    username: user.username ?? user.label ?? null,
    activeSubjects: user.activeSubjects ?? [],
    onboardingComplete: user.onboardingComplete ?? false,
    entitlement: subscription.entitlement,
    subscriptionStatus: subscription.subscriptionStatus,
    subscriptionStart: subscription.subscriptionStart,
    subscriptionExpiry: subscription.subscriptionExpiry,
    graceUntil: subscription.graceUntil,
    subscriptionProvider: subscription.subscriptionProvider,
    adminOverride: subscription.adminOverride,
  };
}

async function getOrCreateProfile(label: string) {
  const labelLower = label.toLowerCase();
  const mobileStore = createFirestoreMobileUserStore();
  const mobileUser = await mobileStore.getByUsername(labelLower);
  if (mobileUser) {
    return { source: 'mobile' as const, user: mobileUser };
  }

  const profileStore = createUserProfileStore();
  const profile = await profileStore.getByLabel(labelLower);
  if (profile) {
    return { source: 'profile' as const, user: profile };
  }

  const created = await profileStore.createProfile({
    label,
    labelLower,
    activeSubjects: [...ACTIVE_SUBJECTS],
    onboardingComplete: true,
    subscriptionStart: null,
    subscriptionExpiry: null,
    graceUntil: null,
    subscriptionProvider: null,
    adminOverride: false,
    createdAt: new Date(),
  });

  return { source: 'profile' as const, user: created };
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await getOrCreateProfile(session.label);

  return NextResponse.json(toProfileResponse(result.user));
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getOrCreateProfile(session.label);
    const user = result.user;

    const body = await request.json();
    const onboardingComplete = body?.onboardingComplete ?? user.onboardingComplete ?? false;
    let activeSubjects = user.activeSubjects ?? [];

    if (body?.activeSubjects !== undefined) {
      const result = validateActiveSubjects(body.activeSubjects, {
        allowEmpty: !onboardingComplete,
      });
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      if (result.value.length > 1 && !isPremiumUser(user)) {
        return NextResponse.json(
          { error: 'Premium required to select multiple subjects' },
          { status: 403 }
        );
      }
      activeSubjects = result.value;
    } else if (onboardingComplete && activeSubjects.length === 0) {
      return NextResponse.json(
        { error: 'activeSubjects must contain at least one subject' },
        { status: 400 }
      );
    }

    if (result.source === 'mobile') {
      await createFirestoreMobileUserStore().updateProfile(user.id, {
        activeSubjects,
        onboardingComplete: Boolean(onboardingComplete),
      });
    } else {
      await createUserProfileStore().updateProfile(user.id, {
        activeSubjects,
        onboardingComplete: Boolean(onboardingComplete),
      });
    }

    return NextResponse.json(
      toProfileResponse({
        ...user,
        activeSubjects,
        onboardingComplete: Boolean(onboardingComplete),
      })
    );
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'An error occurred while updating profile' }, { status: 500 });
  }
}
