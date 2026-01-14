import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generateTomorrowPreview } from '@/lib/quiz';
import { Subject, SUBJECTS } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
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

    const preview = await generateTomorrowPreview(subject);

    // Include all details for admin preview (including correct answer and explanation)
    const adminQuestions = preview.questions.map((q, index) => ({
      id: q.id,
      stem: q.stem,
      options: q.options,
      topic: q.topic,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      notes: q.notes,
      difficulty: q.difficulty,
      isBonus: index === 5 && q.difficulty === 3,
    }));

    return NextResponse.json({
      date: preview.date,
      subject: preview.subject,
      questions: adminQuestions,
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
