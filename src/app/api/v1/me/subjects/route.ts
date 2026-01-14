import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { validateActiveSubjects } from '@/lib/active-subjects';
import { createUserProfileStore } from '@/lib/user-profile-store';

function toProfileResponse(user: { id: string; activeSubjects: string[]; onboardingComplete: boolean }) {
  return {
    id: user.id,
    activeSubjects: user.activeSubjects,
    onboardingComplete: user.onboardingComplete,
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
        id: user.id,
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
