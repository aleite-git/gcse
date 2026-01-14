import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';
import { registerMobileUser, MobileAuthError } from '@/lib/mobile-auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { createProfanityFilter } from '@/lib/profanity-filter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = createFirestoreMobileUserStore();
    const filter = createProfanityFilter();
    const user = await registerMobileUser(
      {
        email: body?.email,
        password: body?.password,
        username: body?.username,
      },
      store,
      filter
    );

    const token = await createSessionToken(user.username, false);

    return NextResponse.json({
      success: true,
      token,
      username: user.username,
    });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error('Mobile register error:', error);
    return NextResponse.json(
      { error: 'An error occurred during registration' },
      { status: 500 }
    );
  }
}
