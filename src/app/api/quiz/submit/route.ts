import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { submitQuizAttempt } from '@/lib/quiz';
import { SubmitRequest, SubmitResponse, QuestionFeedback } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SubmitRequest = await request.json();
    const { answers, durationSeconds } = body;

    // Validate request
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Answers are required' },
        { status: 400 }
      );
    }

    if (answers.length !== 5) {
      return NextResponse.json(
        { error: 'Must answer all 5 questions' },
        { status: 400 }
      );
    }

    // Validate each answer has required fields
    for (const answer of answers) {
      if (!answer.questionId || typeof answer.selectedIndex !== 'number') {
        return NextResponse.json(
          { error: 'Invalid answer format' },
          { status: 400 }
        );
      }

      if (answer.selectedIndex < 0 || answer.selectedIndex > 3) {
        return NextResponse.json(
          { error: 'Invalid answer selection' },
          { status: 400 }
        );
      }
    }

    // Get IP address for hashing
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0] || request.headers.get('x-real-ip') || undefined;

    // Submit the attempt
    const { attempt, questions } = await submitQuizAttempt(
      session.label,
      answers,
      durationSeconds || 0,
      ipAddress
    );

    // Build feedback
    const feedback: QuestionFeedback[] = questions.map((q) => {
      const answer = answers.find((a) => a.questionId === q.id)!;
      return {
        questionId: q.id,
        stem: q.stem,
        options: q.options,
        selectedIndex: answer.selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect: answer.selectedIndex === q.correctIndex,
        explanation: q.explanation,
        topic: q.topic,
      };
    });

    const response: SubmitResponse = {
      attemptId: attempt.id,
      score: attempt.score,
      feedback,
      topicBreakdown: attempt.topicBreakdown,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit quiz';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
