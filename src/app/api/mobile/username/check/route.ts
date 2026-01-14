import { NextRequest, NextResponse } from 'next/server';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { createProfanityFilter } from '@/lib/profanity-filter';
import { MobileAuthError, checkMobileUsernameAvailability } from '@/lib/mobile-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const store = createFirestoreMobileUserStore();
    const filter = createProfanityFilter();

    const result = await checkMobileUsernameAvailability(
      { username },
      store,
      filter
    );

    return NextResponse.json({
      available: result.available,
      reason: result.reason ?? null,
    });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Mobile username check error:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking username' },
      { status: 500 }
    );
  }
}
