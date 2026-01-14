import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';
import { MobileAuthError, loginMobileOAuthUser } from '@/lib/mobile-auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { createProfanityFilter } from '@/lib/profanity-filter';
import { verifyGoogleIdToken } from '@/lib/mobile-oauth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Google client ID not configured' },
        { status: 500 }
      );
    }

    const profile = await verifyGoogleIdToken(idToken, clientId);
    const store = createFirestoreMobileUserStore();
    const filter = createProfanityFilter();
    const user = await loginMobileOAuthUser(
      {
        profile,
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

    console.error('Mobile Google OAuth error:', error);
    return NextResponse.json(
      { error: 'An error occurred during Google login' },
      { status: 500 }
    );
  }
}
