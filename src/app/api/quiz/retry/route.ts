import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generateNewQuizVersion } from '@/lib/quiz';
import { QuizResponse, QuizQuestion } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate a new quiz version
    const { quizVersion, questions } = await generateNewQuizVersion();

    // Return questions without correct answers
    const safeQuestions: QuizQuestion[] = questions.map((q) => ({
      id: q.id,
      stem: q.stem,
      options: q.options,
    }));

    const response: QuizResponse = {
      quizVersion,
      questions: safeQuestions,
      startedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating retry quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate new quiz' },
      { status: 500 }
    );
  }
}
