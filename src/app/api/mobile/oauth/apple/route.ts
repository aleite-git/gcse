import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';
import { MobileAuthError, loginMobileOAuthUser } from '@/lib/mobile-auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';
import { createProfanityFilter } from '@/lib/profanity-filter';
import { verifyAppleIdToken } from '@/lib/mobile-oauth';

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

    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'Apple client ID not configured' },
        { status: 500 }
      );
    }

    const profile = await verifyAppleIdToken(idToken, clientId);
    const store = createFirestoreMobileUserStore();
    const filter = createProfanityFilter();
    const allowLinkExisting = Boolean(body?.linkExisting);
    const user = await loginMobileOAuthUser(
      {
        profile,
        username: body?.username,
        allowLinkExisting,
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
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    console.error('Mobile Apple OAuth error:', error);
    return NextResponse.json(
      { error: 'An error occurred during Apple login' },
      { status: 500 }
    );
  }
}
