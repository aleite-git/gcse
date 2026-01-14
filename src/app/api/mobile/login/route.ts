import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/auth';
import { loginMobileUser, MobileAuthError } from '@/lib/mobile-auth';
import { createFirestoreMobileUserStore } from '@/lib/mobile-user-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const store = createFirestoreMobileUserStore();
    const user = await loginMobileUser(
      {
        email: body?.email,
        username: body?.username,
        password: body?.password,
      },
      store
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

    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
