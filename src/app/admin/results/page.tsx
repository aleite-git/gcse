'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Attempt, Topic, Subject, SUBJECTS } from '@/types';

// Map topics to their subjects
const TOPICS_BY_SUBJECT: Record<Subject, string[]> = {
  'computer-science': [
    'CPU', 'RAM_ROM', 'Storage', 'OS', 'Embedded',
    'NetworksBasics', 'Protocols', 'Security', 'Ethics_Law_Env', 'Performance',
  ],
  'biology': [
    'Cell biology', 'Organisation', 'Infection and response', 'Bioenergetics',
    'Homeostasis and response', 'Inheritance, variation and evolution', 'Ecology',
    'Maths skills', 'Required practicals', 'Working scientifically',
  ],
  'chemistry': [
    'Atomic structure and the periodic table', 'Bonding, structure and the properties of matter',
    'Quantitative chemistry', 'Chemical changes', 'Energy changes',
    'The rate and extent of chemical change', 'Organic chemistry', 'Chemical analysis',
    'Chemistry of the atmosphere', 'Using resources',
  ],
};

function getSubjectForTopic(topic: string): Subject | null {
  for (const [subject, topics] of Object.entries(TOPICS_BY_SUBJECT)) {
    if (topics.includes(topic)) {
      return subject as Subject;
    }
  }
  return null;
}

interface UserStat {
  userLabel: string;
  totalAttempts: number;
  avgScore: number;
  bestScore: number;
  lastAttempt: string | null;
}

interface PreviewQuestion {
  id: string;
  stem: string;
  options: string[];
  topic: string;
  correctIndex: number;
  explanation: string;
  difficulty: number;
  isBonus?: boolean;
}

interface PreviewData {
  date: string;
  subject: Subject;
  questions: PreviewQuestion[];
}

interface ResultsData {
  attempts: Attempt[];
  byDate: Record<string, Attempt[]>;
  byUser: Record<string, Attempt[]>;
  topicStats: Array<{
    topic: string;
    correctRate: number;
    totalQuestions: number;
    correct: number;
  }>;
  userStats: UserStat[];
  totalAttempts: number;
}

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

type ViewMode = 'date' | 'user' | 'stats';

export default function AdminResultsPage() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('user');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [questionStats, setQuestionStats] = useState<QuestionWithStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject>('computer-science');
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

  const fetchPreview = async (subject: Subject) => {
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/admin/preview?subject=${subject}`);
      if (response.ok) {
        const data = await response.json();
        setPreview(data);
        setShowPreview(true);
      }
    } catch {
      console.error('Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchQuestionStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) {
        const data = await response.json();
        setQuestionStats(data.questions || []);
      }
    } catch {
      console.error('Failed to load question stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'stats' && questionStats.length === 0 && !statsLoading) {
      fetchQuestionStats();
    }
  }, [viewMode, questionStats.length, statsLoading, fetchQuestionStats]);

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

        {/* Tomorrow's Quiz Preview */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Tomorrow&apos;s Quiz Preview</h2>
            <div className="flex gap-2">
              {(Object.keys(SUBJECTS) as Subject[]).map((subject) => (
                <button
                  key={subject}
                  onClick={() => {
                    setSelectedSubject(subject);
                    if (showPreview && preview?.subject !== subject) {
                      fetchPreview(subject);
                    } else if (!showPreview) {
                      fetchPreview(subject);
                    }
                  }}
                  disabled={previewLoading}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    selectedSubject === subject
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {SUBJECTS[subject].icon} {SUBJECTS[subject].name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                if (showPreview) {
                  setShowPreview(false);
                } else {
                  fetchPreview(selectedSubject);
                }
              }}
              disabled={previewLoading}
              className="px-4 py-2 text-sm font-medium bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
            >
              {previewLoading ? 'Loading...' : showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
          {showPreview && preview && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 mb-4">
                Preview for {formatDate(preview.date)} ({SUBJECTS[preview.subject].name}) - These questions may change if regenerated.
              </p>
              {preview.questions.map((q, index) => (
                <div key={q.id} className={`p-4 rounded-lg ${q.isBonus ? 'bg-amber-50 border-2 border-amber-300' : 'bg-gray-50'}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${q.isBonus ? 'bg-amber-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                      {q.isBonus ? 'B' : index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {q.isBonus && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded">BONUS</span>
                        )}
                        <span className="text-xs text-gray-500">Difficulty: {q.difficulty}</span>
                      </div>
                      <p className="font-medium text-gray-900 mb-3">{q.stem}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        {q.options.map((opt, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded border text-sm ${
                              i === q.correctIndex
                                ? 'bg-green-100 border-green-400 text-green-800 font-medium'
                                : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          >
                            {i === q.correctIndex && <span className="mr-1">✓</span>}
                            {String.fromCharCode(65 + i)}. {opt}
                          </div>
                        ))}
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                        <span className="font-medium">Explanation: </span>{q.explanation}
                      </div>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${q.isBonus ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {q.topic.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!showPreview && !previewLoading && (
            <p className="text-gray-500 text-sm">Select a subject and click &quot;Show Preview&quot; to see tomorrow&apos;s quiz questions.</p>
          )}
        </div>

        {/* Topic Performance */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Topic Performance</h2>
          {data?.topicStats && data.topicStats.length > 0 ? (
            <div className="space-y-6">
              {(Object.keys(SUBJECTS) as Subject[]).map((subject) => {
                const subjectTopics = data.topicStats.filter(
                  (stat) => getSubjectForTopic(stat.topic) === subject
                );
                if (subjectTopics.length === 0) return null;

                // Calculate subject average
                const totalCorrect = subjectTopics.reduce((sum, t) => sum + t.correct, 0);
                const totalQuestions = subjectTopics.reduce((sum, t) => sum + t.totalQuestions, 0);
                const subjectAvg = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

                return (
                  <div key={subject} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className={`px-4 py-3 bg-gradient-to-r ${SUBJECTS[subject].color} bg-opacity-10 border-b border-gray-200`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{SUBJECTS[subject].icon}</span>
                          <span className="font-semibold text-gray-900">{SUBJECTS[subject].name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">
                            {totalCorrect}/{totalQuestions} correct
                          </span>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            subjectAvg >= 70 ? 'bg-green-100 text-green-800' :
                            subjectAvg >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {subjectAvg.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {subjectTopics.map((stat) => (
                        <div key={stat.topic} className="flex items-center gap-4">
                          <div className="w-48 text-sm font-medium text-gray-700 truncate">
                            {formatTopic(stat.topic as Topic)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${getPerformanceColor(stat.correctRate)}`}
                                  style={{ width: `${stat.correctRate}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600 w-14 text-right">
                                {stat.correctRate.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 w-20 text-right">
                            {stat.correct}/{stat.totalQuestions}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No data available yet</p>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => { setViewMode('user'); setSelectedDate(null); setSelectedQuestion(null); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              By User
            </button>
            <button
              onClick={() => { setViewMode('date'); setSelectedUser(null); setSelectedQuestion(null); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'date'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              By Date
            </button>
            <button
              onClick={() => { setViewMode('stats'); setSelectedUser(null); setSelectedDate(null); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                viewMode === 'stats'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Question Stats
            </button>
          </div>
        </div>

        {/* Content Grid */}
        {viewMode === 'stats' ? (
          /* Question Stats View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Questions List */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Questions</h2>
              {statsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading stats...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {questionStats.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestion(selectedQuestion === q.id ? null : q.id)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedQuestion === q.id
                          ? 'bg-indigo-100 border border-indigo-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">
                        {q.stem}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {q.totalAttempts} attempt{q.totalAttempts !== 1 ? 's' : ''}
                        </span>
                        <span className={`text-sm font-semibold ${
                          q.successRate >= 0.7 ? 'text-green-600' :
                          q.successRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(q.successRate * 100).toFixed(0)}% correct
                        </span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        <span className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700">
                          {q.topic.replace(/_/g, ' ')}
                        </span>
                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600">
                          Diff: {q.difficulty}
                        </span>
                      </div>
                    </button>
                  ))}
                  {questionStats.length === 0 && !statsLoading && (
                    <p className="text-gray-500 text-center py-4">No question stats yet</p>
                  )}
                </div>
              )}
            </div>

            {/* Question Details */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedQuestion ? 'Question Details' : 'Select a question'}
              </h2>
              {selectedQuestion ? (
                (() => {
                  const q = questionStats.find((qs) => qs.id === selectedQuestion);
                  if (!q) return null;
                  return (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="font-medium text-gray-900 mb-3">{q.stem}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700">
                            {q.topic.replace(/_/g, ' ')}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-600">
                            Difficulty: {q.difficulty}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-2xl font-bold text-gray-900">{q.totalAttempts}</p>
                            <p className="text-xs text-gray-500">Total Attempts</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className="text-2xl font-bold text-green-600">{q.totalCorrect}</p>
                            <p className="text-xs text-gray-500">Correct</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg border">
                            <p className={`text-2xl font-bold ${
                              q.successRate >= 0.7 ? 'text-green-600' :
                              q.successRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {(q.successRate * 100).toFixed(0)}%
                            </p>
                            <p className="text-xs text-gray-500">Success Rate</p>
                          </div>
                        </div>
                      </div>

                      {/* User Breakdown */}
                      <div>
                        <h3 className="font-medium text-gray-900 mb-3">By User</h3>
                        <div className="space-y-2">
                          {q.userBreakdown.map((user) => (
                            <div key={user.userLabel} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                              <div>
                                <span className="font-medium text-gray-900">{user.userLabel}</span>
                                <p className="text-xs text-gray-500">
                                  {user.attempts} attempt{user.attempts !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className={`text-lg font-bold ${
                                  user.successRate >= 0.7 ? 'text-green-600' :
                                  user.successRate >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {user.correct}/{user.attempts}
                                </span>
                                <p className="text-xs text-gray-500">
                                  {(user.successRate * 100).toFixed(0)}% correct
                                </p>
                              </div>
                            </div>
                          ))}
                          {q.userBreakdown.length === 0 && (
                            <p className="text-gray-500 text-center py-4">No user data</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Select a question from the list to view detailed stats
                </p>
              )}
            </div>
          </div>
        ) : (
          /* User/Date View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User/Date List */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {viewMode === 'user' ? 'Users' : 'Attempts by Date'}
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {viewMode === 'user' ? (
                  <>
                    {data?.userStats?.map((userStat) => (
                      <button
                        key={userStat.userLabel}
                        onClick={() => setSelectedUser(selectedUser === userStat.userLabel ? null : userStat.userLabel)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          selectedUser === userStat.userLabel
                            ? 'bg-indigo-100 border border-indigo-300'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-900">{userStat.userLabel}</span>
                          <span className={`text-sm font-semibold ${getScoreColor(userStat.bestScore)}`}>
                            Best: {userStat.bestScore}/5
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            {userStat.totalAttempts} attempt{userStat.totalAttempts !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            Avg: {userStat.avgScore.toFixed(1)}/5
                          </p>
                        </div>
                      </button>
                    ))}
                    {(!data?.userStats || data.userStats.length === 0) && (
                      <p className="text-gray-500 text-center py-4">No users yet</p>
                    )}
                  </>
                ) : (
                  <>
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
                            <span className={`text-sm font-semibold ${getScoreColor(bestScore)}`}>
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
                  </>
                )}
              </div>
            </div>

            {/* Attempt Details */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {viewMode === 'user'
                  ? (selectedUser ? `Attempts by ${selectedUser}` : 'Select a user')
                  : (selectedDate ? `Attempts on ${formatDate(selectedDate)}` : 'Select a date')}
              </h2>
              {viewMode === 'user' ? (
                selectedUser && data?.byUser[selectedUser] ? (
                  <div className="space-y-4">
                    {data.byUser[selectedUser]
                      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                      .map((attempt) => (
                      <AttemptCard key={attempt.id} attempt={attempt} showDate />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select a user from the list to view their attempts
                  </p>
                )
              ) : (
                selectedDate && data?.byDate[selectedDate] ? (
                  <div className="space-y-4">
                    {data.byDate[selectedDate].map((attempt) => (
                      <AttemptCard key={attempt.id} attempt={attempt} showUser />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select a date from the list to view attempt details
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTopic(topic: Topic): string {
  const topicNames: Record<string, string> = {
    // Computer Science topics
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
    // Biology topics
    CellBiology: 'Cell Biology',
    Organisation: 'Organisation',
    Infection: 'Infection & Response',
    Bioenergetics: 'Bioenergetics',
    Homeostasis: 'Homeostasis & Response',
    Inheritance: 'Inheritance',
    Variation: 'Variation & Evolution',
    Ecology: 'Ecology',
    // Chemistry topics
    AtomicStructure: 'Atomic Structure',
    BondingStructure: 'Bonding & Structure',
    QuantitativeChemistry: 'Quantitative Chemistry',
    ChemicalChanges: 'Chemical Changes',
    EnergyChanges: 'Energy Changes',
    RatesReactions: 'Rates of Reactions',
    OrganicChemistry: 'Organic Chemistry',
    ChemicalAnalysis: 'Chemical Analysis',
    AtmosphereResources: 'Atmosphere & Resources',
  };
  return topicNames[topic] || topic.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
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

function AttemptCard({
  attempt,
  showDate = false,
  showUser = false,
}: {
  attempt: Attempt;
  showDate?: boolean;
  showUser?: boolean;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-medium text-gray-900">
            Attempt #{attempt.attemptNumber}
          </span>
          <span className="text-sm text-gray-500 ml-2">
            (Version {attempt.quizVersion})
          </span>
          {showUser && attempt.userLabel && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
              {attempt.userLabel}
            </span>
          )}
        </div>
        <span className={`text-lg font-bold ${getScoreColor(attempt.score)}`}>
          {attempt.score}/5
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Duration:</span>{' '}
          <span className="text-gray-900">{formatDuration(attempt.durationSeconds)}</span>
        </div>
        <div>
          <span className="text-gray-500">{showDate ? 'Date:' : 'Submitted:'}</span>{' '}
          <span className="text-gray-900">
            {showDate ? formatDate(attempt.date) + ' ' : ''}{formatTime(attempt.submittedAt)}
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
  );
}
