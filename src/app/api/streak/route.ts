import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getStreakStatus, recordActivity, useFreeze, updateTimezone } from '@/lib/streak';

// GET /api/streak - Get current streak status
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get timezone from query params or default
    const { searchParams } = new URL(request.url);
    const timezone = searchParams.get('timezone') || 'Europe/Lisbon';

    // Record login activity (this updates streak if needed)
    await recordActivity(session.label, 'login', timezone);

    const status = await getStreakStatus(session.label, timezone);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting streak status:', error);
    return NextResponse.json(
      { error: 'Failed to get streak status' },
      { status: 500 }
    );
  }
}

// POST /api/streak - Actions (use freeze, update timezone)
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
    const { action, timezone } = body;

    switch (action) {
      case 'use_freeze': {
        const result = await useFreeze(session.label, timezone || 'Europe/Lisbon');
        return NextResponse.json({
          success: result.success,
          message: result.message,
          streak: {
            currentStreak: result.streak.currentStreak,
            freezeDays: result.streak.freezeDays,
          },
        });
      }

      case 'update_timezone': {
        if (!timezone) {
          return NextResponse.json(
            { error: 'Timezone is required' },
            { status: 400 }
          );
        }
        await updateTimezone(session.label, timezone);
        const status = await getStreakStatus(session.label, timezone);
        return NextResponse.json({ success: true, status });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing streak action:', error);
    return NextResponse.json(
      { error: 'Failed to process streak action' },
      { status: 500 }
    );
  }
}
