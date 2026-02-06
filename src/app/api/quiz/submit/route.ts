import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { submitQuizAttempt, QuizValidationError } from '@/lib/quiz';
import { recordActivity, OVERALL_STREAK_SUBJECT } from '@/lib/streak';
import { SubmitRequest, SubmitResponse, QuestionFeedback, SUBJECTS } from '@/types';

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
    const { subject, answers, durationSeconds } = body;

    // Validate subject
    if (!subject || !SUBJECTS[subject]) {
      return NextResponse.json(
        { error: 'Valid subject is required' },
        { status: 400 }
      );
    }

    // Validate request
    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Answers are required' },
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
      subject,
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
        notes: q.notes,
      };
    });

    // Record streak activity for this subject
    const timezone = request.headers.get('x-timezone') || 'Europe/London';
    const { streak: updatedStreak, freezeEarned } = await recordActivity(
      session.label,
      subject,
      'quiz_submit',
      timezone
    );
    const { streak: overallStreak, freezeEarned: overallFreezeEarned } = await recordActivity(
      session.label,
      OVERALL_STREAK_SUBJECT,
      'quiz_submit',
      timezone
    );

    const response: SubmitResponse & {
      streak: { currentStreak: number; freezeDays: number; freezeEarned: boolean };
      overallStreak: { currentStreak: number; freezeDays: number; freezeEarned: boolean };
    } = {
      attemptId: attempt.id,
      score: attempt.score,
      feedback,
      topicBreakdown: attempt.topicBreakdown,
      streak: {
        currentStreak: updatedStreak.currentStreak,
        freezeDays: updatedStreak.freezeDays,
        freezeEarned,
      },
      overallStreak: {
        currentStreak: overallStreak.currentStreak,
        freezeDays: overallStreak.freezeDays,
        freezeEarned: overallFreezeEarned,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    if (error instanceof QuizValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to submit quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
