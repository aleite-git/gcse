'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Attempt, Topic } from '@/types';

interface ResultsData {
  attempts: Attempt[];
  byDate: Record<string, Attempt[]>;
  topicStats: Array<{
    topic: string;
    correctRate: number;
    totalQuestions: number;
    correct: number;
  }>;
  totalAttempts: number;
}

export default function AdminResultsPage() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const router = useRouter();

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/results');

      if (response.status === 401 || response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load results');
      }

      const results = await response.json();
      setData(results);
    } catch {
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchResults}
            className="mt-4 text-indigo-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const dates = data?.byDate ? Object.keys(data.byDate).sort().reverse() : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quiz Results</h1>
            <p className="text-sm text-gray-500">
              {data?.totalAttempts || 0} total attempts
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/questions"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Manage Questions
            </Link>
            <Link
              href="/quiz/today"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              Take Quiz
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Topic Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance</h2>
          {data?.topicStats && data.topicStats.length > 0 ? (
            <div className="space-y-4">
              {data.topicStats.map((stat) => (
                <div key={stat.topic} className="flex items-center gap-4">
                  <div className="w-40 text-sm font-medium text-gray-700">
                    {formatTopic(stat.topic as Topic)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getPerformanceColor(stat.correctRate)}`}
                          style={{ width: `${stat.correctRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {stat.correctRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 w-24 text-right">
                    {stat.correct}/{stat.totalQuestions} correct
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No data available yet</p>
          )}
        </div>

        {/* Attempts by Date */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Date List */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Attempts by Date</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dates.map((date) => {
                const attempts = data?.byDate[date] || [];
                const bestScore = Math.max(...attempts.map((a) => a.score));
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedDate === date
                        ? 'bg-indigo-100 border border-indigo-300'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{formatDate(date)}</span>
                      <span
                        className={`text-sm font-semibold ${getScoreColor(bestScore)}`}
                      >
                        Best: {bestScore}/5
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })}
              {dates.length === 0 && (
                <p className="text-gray-500 text-center py-4">No attempts yet</p>
              )}
            </div>
          </div>

          {/* Attempt Details */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedDate ? `Attempts on ${formatDate(selectedDate)}` : 'Select a date'}
            </h2>
            {selectedDate && data?.byDate[selectedDate] ? (
              <div className="space-y-4">
                {data.byDate[selectedDate].map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-medium text-gray-900">
                          Attempt #{attempt.attemptNumber}
                        </span>
                        <span className="text-sm text-gray-500 ml-2">
                          (Version {attempt.quizVersion})
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${getScoreColor(attempt.score)}`}
                      >
                        {attempt.score}/5
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Duration:</span>{' '}
                        <span className="text-gray-900">
                          {formatDuration(attempt.durationSeconds)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Submitted:</span>{' '}
                        <span className="text-gray-900">
                          {formatTime(attempt.submittedAt)}
                        </span>
                      </div>
                    </div>
                    {attempt.topicBreakdown && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Topic breakdown:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(attempt.topicBreakdown).map(([topic, stats]) => (
                            <span
                              key={topic}
                              className={`px-2 py-1 rounded text-xs ${
                                stats.correct === stats.total
                                  ? 'bg-green-100 text-green-800'
                                  : stats.correct > 0
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {topic.replace(/_/g, ' ')}: {stats.correct}/{stats.total}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Select a date from the list to view attempt details
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
    Ethics_Law_Env: 'Ethics & Law',
    Performance: 'Performance',
  };
  return topicNames[topic] || topic;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

function getPerformanceColor(rate: number): string {
  if (rate >= 70) return 'bg-green-500';
  if (rate >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}
