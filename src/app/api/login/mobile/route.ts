import { NextRequest, NextResponse } from 'next/server';
import { validateAccessCode, createSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Access code is required' },
        { status: 400 }
      );
    }

    const accessCode = await validateAccessCode(code.trim());

    if (!accessCode) {
      return NextResponse.json(
        { error: 'Invalid access code' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(accessCode.label, accessCode.isAdmin);

    return NextResponse.json({
      success: true,
      token,
      label: accessCode.label,
      isAdmin: accessCode.isAdmin,
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
