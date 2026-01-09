import { NextRequest, NextResponse } from 'next/server';
import { getTodayQuiz } from '@/lib/quiz';
import { QuizResponse, QuizQuestion, Subject, SUBJECTS } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') as Subject | null;

    // Validate subject parameter
    if (!subject || !SUBJECTS[subject]) {
      return NextResponse.json(
        { error: 'Valid subject parameter is required (computer-science, biology, or chemistry)' },
        { status: 400 }
      );
    }

    const { quizVersion, subject: quizSubject, questions } = await getTodayQuiz(subject);

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
      subject: quizSubject,
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
