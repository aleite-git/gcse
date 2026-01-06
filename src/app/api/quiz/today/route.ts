import { NextResponse } from 'next/server';
import { getTodayQuiz } from '@/lib/quiz';
import { QuizResponse, QuizQuestion } from '@/types';

export async function GET() {
  try {
    const { quizVersion, questions } = await getTodayQuiz();

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
    console.error('Error getting today quiz:', error);
    return NextResponse.json(
      { error: 'Failed to get quiz' },
      { status: 500 }
    );
  }
}
