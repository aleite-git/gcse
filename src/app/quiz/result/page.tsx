'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AttemptData {
  id: string;
  date: string;
  attemptNumber: number;
  score: number;
  answers: Array<{ questionId: string; selectedIndex: number }>;
  topicBreakdown: Record<string, { correct: number; total: number }>;
  durationSeconds: number;
}

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const attemptId = searchParams.get('attemptId');
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) {
      router.push('/quiz/today');
      return;
    }

    // For now, redirect to today's quiz as we don't have a specific attempt endpoint
    // This page can be extended to fetch specific attempt data
    router.push('/quiz/today');
  }, [attemptId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading result...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Attempt not found</p>
          <Link href="/quiz/today" className="mt-4 text-indigo-600 hover:underline">
            Go to today&apos;s quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Attempt #{attempt.attemptNumber} - {attempt.date}
        </h1>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-3xl font-bold text-indigo-600">
            Score: {attempt.score}/5
          </p>
          <p className="text-gray-500 mt-2">
            Duration: {Math.floor(attempt.durationSeconds / 60)}m {attempt.durationSeconds % 60}s
          </p>
        </div>
        <Link
          href="/quiz/today"
          className="mt-6 inline-block text-indigo-600 hover:underline"
        >
          Back to quiz
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  );
}
