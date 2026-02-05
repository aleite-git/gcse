import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { generateNewQuizVersion } from '@/lib/quiz';
import { QuizResponse, QuizQuestion, Subject, SUBJECTS } from '@/types';

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
    const { subject } = body as { subject: Subject };

    // Validate subject
    if (!subject || !SUBJECTS[subject]) {
      return NextResponse.json(
        { error: 'Valid subject is required' },
        { status: 400 }
      );
    }

    // Generate a new quiz version for the specified subject
    const { quizVersion, subject: quizSubject, questions } = await generateNewQuizVersion(subject);

    // Return questions without correct answers
    // Mark the last question (index 5) as bonus if it's a hard question (difficulty 3)
    const safeQuestions: QuizQuestion[] = questions.map((q, index) => ({
      id: q.id,
      stem: q.stem,
      options: q.options,
      topic: q.topic,
      notes: q.notes,
      isBonus: index === 5 && q.difficulty === 3,
    }));

    const response: QuizResponse = {
      quizVersion,
      subject: quizSubject,
      questions: safeQuestions,
      startedAt: new Date().toISOString(),
    };
    if (safeQuestions.length === 0) {
      response.message = 'Question bank being revised! No quiz today!';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating retry quiz:', error);
    return NextResponse.json(
      { error: 'Failed to generate new quiz' },
      { status: 500 }
    );
  }
}
