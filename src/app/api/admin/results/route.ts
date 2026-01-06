import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getAllAttempts, getAttemptsByDateRange } from '@/lib/quiz';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let attempts;

    if (startDate && endDate) {
      attempts = await getAttemptsByDateRange(startDate, endDate);
    } else {
      attempts = await getAllAttempts(limit);
    }

    // Group by date for easier analysis
    const byDate = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const dateAttempts = byDate.get(attempt.date) || [];
      dateAttempts.push(attempt);
      byDate.set(attempt.date, dateAttempts);
    }

    // Calculate topic statistics
    const topicStats = new Map<string, { correct: number; total: number }>();
    for (const attempt of attempts) {
      if (attempt.topicBreakdown) {
        for (const [topic, stats] of Object.entries(attempt.topicBreakdown)) {
          const existing = topicStats.get(topic) || { correct: 0, total: 0 };
          existing.correct += stats.correct;
          existing.total += stats.total;
          topicStats.set(topic, existing);
        }
      }
    }

    const weakTopics = Array.from(topicStats.entries())
      .map(([topic, stats]) => ({
        topic,
        correctRate: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        totalQuestions: stats.total,
        correct: stats.correct,
      }))
      .sort((a, b) => a.correctRate - b.correctRate);

    return NextResponse.json({
      attempts,
      byDate: Object.fromEntries(byDate),
      topicStats: weakTopics,
      totalAttempts: attempts.length,
    });
  } catch (error) {
    console.error('Error getting results:', error);
    return NextResponse.json(
      { error: 'Failed to get results' },
      { status: 500 }
    );
  }
}
