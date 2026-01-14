import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, getSessionFromRequest } from '@/lib/auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { createProfanityFilter } from '@/lib/profanity-filter';
import { MobileAuthError, updateMobileUsername } from '@/lib/mobile-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const store = createFirestoreMobileUserStore();
    const filter = createProfanityFilter();

    const result = await updateMobileUsername(
      {
        currentUsername: session.label,
        newUsername: body?.username,
      },
      store,
      filter
    );

    const token = await createSessionToken(result.user.username, false);

    return NextResponse.json({
      success: true,
      token,
      username: result.user.username,
      remainingChanges: result.remainingChanges,
    });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Mobile username update error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating username' },
      { status: 500 }
    );
  }
}
