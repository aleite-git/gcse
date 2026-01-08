import { NextResponse } from 'next/server';
import { getTodayQuiz } from '@/lib/quiz';
import { QuizResponse, QuizQuestion } from '@/types';

export async function GET() {
  try {
    const { quizVersion, questions } = await getTodayQuiz();

    // Return questions without correct answers
    // Mark the last question (index 5) as bonus if it's a hard question (difficulty 3)
    const safeQuestions: QuizQuestion[] = questions.map((q, index) => ({
      id: q.id,
      stem: q.stem,
      options: q.options,
      topic: q.topic,
      isBonus: index === 5 && q.difficulty === 3,
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
