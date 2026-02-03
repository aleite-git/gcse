import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  checkAndApplyFreeze,
  getStreakStatus,
  recordActivity,
  useFreeze,
  updateTimezone,
  OVERALL_STREAK_SUBJECT,
} from '@/lib/streak';
import { Subject, SUBJECTS, StreakSubject } from '@/types';

// GET /api/streak - Get current streak status for a subject or all subjects
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get timezone and subject from query params
    const { searchParams } = new URL(request.url);
    const timezone = searchParams.get('timezone') || 'Europe/Lisbon';
    const subject = searchParams.get('subject') as StreakSubject | null;

    await checkAndApplyFreeze(session.label, OVERALL_STREAK_SUBJECT, timezone);

    // If subject is specified, return streak for that subject
    if (subject) {
      if (subject !== OVERALL_STREAK_SUBJECT && !SUBJECTS[subject as Subject]) {
        return NextResponse.json(
          { error: 'Invalid subject' },
          { status: 400 }
        );
      }

      // Record login activity for subject streaks only
      if (subject !== OVERALL_STREAK_SUBJECT) {
        await recordActivity(session.label, subject, 'login', timezone);
      }
      const status = await getStreakStatus(session.label, subject, timezone);

      return NextResponse.json(status);
    }

    // If no subject specified, return streaks for all subjects
    const overallStreak = await getStreakStatus(session.label, OVERALL_STREAK_SUBJECT, timezone);
    const allSubjects = Object.keys(SUBJECTS) as Subject[];
    const streaks: Record<Subject, Awaited<ReturnType<typeof getStreakStatus>>> = {} as Record<
      Subject,
      Awaited<ReturnType<typeof getStreakStatus>>
    >;

    for (const subj of allSubjects) {
      streaks[subj] = await getStreakStatus(session.label, subj, timezone);
    }

    return NextResponse.json({ overallStreak, streaks });
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
    const { action, subject, timezone } = body;

    // Validate subject for actions that require it
    if (action === 'use_freeze') {
      if (subject !== OVERALL_STREAK_SUBJECT) {
        return NextResponse.json(
          { error: 'Overall streak is required' },
          { status: 400 }
        );
      }
    }

    if (action === 'update_timezone') {
      if (!subject || (subject !== OVERALL_STREAK_SUBJECT && !SUBJECTS[subject as Subject])) {
        return NextResponse.json(
          { error: 'Valid subject is required' },
          { status: 400 }
        );
      }
    }

    switch (action) {
      case 'use_freeze': {
        const result = await useFreeze(session.label, subject, timezone || 'Europe/Lisbon');
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
        await updateTimezone(session.label, subject, timezone);
        const status = await getStreakStatus(session.label, subject, timezone);
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
