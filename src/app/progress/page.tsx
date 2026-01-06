'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProgressSummary, Topic } from '@/types';

export default function ProgressPage() {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch('/api/progress');

        if (response.status === 401) {
          router.push('/');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load progress');
        }

        const data = await response.json();
        setSummary(data);
      } catch {
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/quiz/today" className="mt-4 text-indigo-600 hover:underline">
            Go to quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Progress</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/quiz/today"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Today&apos;s Quiz
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Today's Status */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Attempted Today</p>
              <p className={`text-2xl font-bold ${summary?.attemptedToday ? 'text-green-600' : 'text-gray-400'}`}>
                {summary?.attemptedToday ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Attempts Today</p>
              <p className="text-2xl font-bold text-indigo-600">{summary?.todayAttempts || 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Best Score Today</p>
              <p className="text-2xl font-bold text-indigo-600">{summary?.todayBestScore || 0}/5</p>
            </div>
          </div>
          {!summary?.attemptedToday && (
            <Link
              href="/quiz/today"
              className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Today&apos;s Quiz
            </Link>
          )}
        </div>

        {/* Last 7 Days */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Last 7 Days</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Best Score</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Attempts</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary?.last7Days.map((day) => (
                  <tr key={day.date} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-4 text-sm text-gray-900">{formatDate(day.date)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`font-semibold ${getScoreColor(day.bestScore)}`}>
                        {day.attempts > 0 ? `${day.bestScore}/5` : '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">
                      {day.attempts}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {day.attempts > 0 ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Not attempted
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Weak Topics */}
        {summary?.weakTopics && summary.weakTopics.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics to Improve</h2>
            <p className="text-sm text-gray-500 mb-4">
              Topics with less than 70% correct rate
            </p>
            <div className="space-y-4">
              {summary.weakTopics.map((topic) => (
                <div key={topic.topic} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {formatTopic(topic.topic as Topic)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {Math.round(topic.correctRate * 100)}% ({topic.totalQuestions} questions)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressColor(topic.correctRate)}`}
                        style={{ width: `${topic.correctRate * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary?.weakTopics?.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <p className="text-green-800 font-medium">
              Great job! No weak topics identified yet.
            </p>
            <p className="text-green-600 text-sm mt-1">
              Keep practicing to maintain your performance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateObj = new Date(dateStr);
  dateObj.setHours(0, 0, 0, 0);

  if (dateObj.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dateObj.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTopic(topic: Topic): string {
  const topicNames: Record<Topic, string> = {
    CPU: 'CPU',
    RAM_ROM: 'RAM & ROM',
    Storage: 'Storage',
    OS: 'Operating Systems',
    Embedded: 'Embedded Systems',
    NetworksBasics: 'Networks Basics',
    Protocols: 'Protocols',
    Security: 'Security',
    Ethics_Law_Env: 'Ethics, Law & Environment',
    Performance: 'Performance',
  };
  return topicNames[topic] || topic;
}

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

function getProgressColor(rate: number): string {
  if (rate >= 0.6) return 'bg-yellow-500';
  if (rate >= 0.4) return 'bg-orange-500';
  return 'bg-red-500';
}
