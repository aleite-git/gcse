import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getDb, COLLECTIONS } from '@/lib/firebase';
import { getQuestionsByIds } from '@/lib/questions';
import { QuestionStats } from '@/types';

interface QuestionWithStats {
  id: string;
  stem: string;
  topic: string;
  difficulty: number;
  totalAttempts: number;
  totalCorrect: number;
  successRate: number;
  userBreakdown: {
    userLabel: string;
    attempts: number;
    correct: number;
    successRate: number;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const db = getDb();

    // Get all question stats
    const statsSnapshot = await db.collection(COLLECTIONS.QUESTION_STATS).get();
    const allStats = statsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      lastAttemptedAt: doc.data().lastAttemptedAt?.toDate() || new Date(),
    })) as QuestionStats[];

    // Group stats by questionId
    const statsByQuestion = new Map<string, QuestionStats[]>();
    for (const stat of allStats) {
      const existing = statsByQuestion.get(stat.questionId) || [];
      existing.push(stat);
      statsByQuestion.set(stat.questionId, existing);
    }

    // Get unique question IDs that have stats
    const questionIds = Array.from(statsByQuestion.keys());

    if (questionIds.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    // Get question details
    const questions = await getQuestionsByIds(questionIds);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Build response with aggregated stats
    const questionsWithStats: QuestionWithStats[] = [];

    for (const [questionId, stats] of statsByQuestion) {
      const question = questionMap.get(questionId);
      if (!question) continue;

      const totalAttempts = stats.reduce((sum, s) => sum + s.attempts, 0);
      const totalCorrect = stats.reduce((sum, s) => sum + s.correct, 0);
      const successRate = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

      const userBreakdown = stats
        .map((s) => ({
          userLabel: s.userLabel,
          attempts: s.attempts,
          correct: s.correct,
          successRate: s.attempts > 0 ? s.correct / s.attempts : 0,
        }))
        .sort((a, b) => b.attempts - a.attempts);

      questionsWithStats.push({
        id: question.id,
        stem: question.stem,
        topic: question.topic,
        difficulty: question.difficulty,
        totalAttempts,
        totalCorrect,
        successRate,
        userBreakdown,
      });
    }

    // Sort by total attempts (most attempted first)
    questionsWithStats.sort((a, b) => b.totalAttempts - a.totalAttempts);

    return NextResponse.json({ questions: questionsWithStats });
  } catch (error) {
    console.error('Error fetching question stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question stats' },
      { status: 500 }
    );
  }
}
