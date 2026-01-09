import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getProgressSummary } from '@/lib/quiz';
import { Subject, SUBJECTS } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') as Subject | null;

    // Validate subject parameter
    if (!subject || !SUBJECTS[subject]) {
      return NextResponse.json(
        { error: 'Valid subject parameter is required (computer-science, biology, or chemistry)' },
        { status: 400 }
      );
    }

    const summary = await getProgressSummary(session.label, subject);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error getting progress:', error);
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    );
  }
}
