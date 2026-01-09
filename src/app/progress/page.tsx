'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProgressSummary, Topic, StreakStatus, Subject, SUBJECTS } from '@/types';
import { StreakDisplay } from '@/components/StreakDisplay';

export default function ProgressPage() {
  return (
    <Suspense fallback={<ProgressLoading />}>
      <ProgressContent />
    </Suspense>
  );
}

function ProgressLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
        </div>
        <p className="mt-6 text-white/60 font-medium">Loading progress...</p>
      </div>
    </div>
  );
}

function ProgressContent() {
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject') as Subject | null;
  const subjectInfo = subject ? SUBJECTS[subject] : null;

  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const router = useRouter();

  useEffect(() => {
    if (!subject || !SUBJECTS[subject]) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [progressResponse, streakResponse] = await Promise.all([
          fetch(`/api/progress?subject=${subject}`),
          fetch(`/api/streak?subject=${subject}&timezone=${encodeURIComponent(timezone)}`),
        ]);

        if (progressResponse.status === 401) {
          router.push('/');
          return;
        }

        if (!progressResponse.ok) {
          throw new Error('Failed to load progress');
        }

        const progressData = await progressResponse.json();
        setSummary(progressData);

        if (streakResponse.ok) {
          const streakData = await streakResponse.json();
          setStreakStatus(streakData);
        }
      } catch {
        setError('Failed to load progress data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, timezone, subject]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (!subject || !SUBJECTS[subject]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-white mb-2">No Subject Selected</h1>
          <p className="text-white/60 mb-6">Please select a subject to view your progress.</p>
          <Link
            href="/quiz/subjects"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            Choose Subject
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Loading {subjectInfo?.name} progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            href={`/quiz/today?subject=${subject}`}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            Go to quiz
          </Link>
        </div>
      </div>
    );
  }

  // Calculate overall stats
  const totalAttempts = summary?.last7Days.reduce((acc, day) => acc + day.attempts, 0) || 0;
  const daysActive = summary?.last7Days.filter(day => day.attempts > 0).length || 0;
  const avgScore = summary?.last7Days.length
    ? summary.last7Days.filter(d => d.attempts > 0).reduce((acc, d) => acc + d.bestScore, 0) / Math.max(daysActive, 1)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              {subjectInfo && <span className="text-3xl">{subjectInfo.icon}</span>}
              <h1 className="text-2xl font-bold text-white">{subjectInfo?.name} Progress</h1>
            </div>
            {streakStatus && (
              <StreakDisplay
                currentStreak={streakStatus.currentStreak}
                freezeDays={streakStatus.freezeDays}
                maxFreezes={streakStatus.maxFreezes}
                showFreezeButton={false}
                compact
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/quiz/subjects"
              className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 hover:bg-white/20 hover:text-white text-sm font-medium transition-all"
            >
              Subjects
            </Link>
            <Link
              href={`/quiz/today?subject=${subject}`}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/30"
            >
              Today&apos;s Quiz
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Today"
            value={summary?.attemptedToday ? '✓' : '−'}
            subtext={summary?.attemptedToday ? 'Completed' : 'Not started'}
            gradient={summary?.attemptedToday ? 'from-green-400 to-emerald-500' : 'from-slate-400 to-slate-500'}
          />
          <StatCard
            label="Best Today"
            value={summary?.todayBestScore ? `${summary.todayBestScore}/6` : '−'}
            subtext={summary?.todayAttempts ? `${summary.todayAttempts} attempt${summary.todayAttempts > 1 ? 's' : ''}` : 'No attempts'}
            gradient="from-purple-400 to-pink-500"
          />
          <StatCard
            label="7-Day Active"
            value={`${daysActive}/7`}
            subtext={`${totalAttempts} total attempts`}
            gradient="from-cyan-400 to-blue-500"
          />
          <StatCard
            label="Avg Score"
            value={avgScore > 0 ? avgScore.toFixed(1) : '−'}
            subtext="Last 7 days"
            gradient="from-amber-400 to-orange-500"
          />
        </div>

        {/* Call to Action */}
        {!summary?.attemptedToday && (
          <Link
            href={`/quiz/today?subject=${subject}`}
            className="block mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/30 backdrop-blur-xl hover:from-purple-600/30 hover:to-pink-600/30 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Start Today&apos;s {subjectInfo?.name} Quiz</h3>
                <p className="text-white/60 text-sm">Keep your streak going!</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
        )}

        {/* Last 7 Days */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Last 7 Days</h2>

          {/* Visual calendar strip */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {summary?.last7Days.map((day) => {
              const isToday = formatDate(day.date) === 'Today';
              const hasAttempt = day.attempts > 0;

              return (
                <div
                  key={day.date}
                  className={`flex-1 min-w-[80px] p-3 rounded-xl text-center transition-all ${
                    isToday
                      ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-2 border-purple-500'
                      : hasAttempt
                      ? 'bg-green-500/20 border border-green-500/30'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <div className="text-xs text-white/40 mb-1">{getDayName(day.date)}</div>
                  <div className={`text-2xl mb-1 ${hasAttempt ? '' : 'opacity-30'}`}>
                    {hasAttempt ? '🔥' : '○'}
                  </div>
                  {hasAttempt ? (
                    <div className={`text-sm font-bold ${getScoreGradient(day.bestScore)}`}>
                      {day.bestScore}/6
                    </div>
                  ) : (
                    <div className="text-xs text-white/30">−</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-medium text-white/40 uppercase tracking-wider">Date</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-white/40 uppercase tracking-wider">Best Score</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-white/40 uppercase tracking-wider">Attempts</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {summary?.last7Days.map((day) => (
                  <tr key={day.date} className="border-b border-white/5 last:border-0">
                    <td className="py-3 px-4 text-sm text-white/80">{formatDate(day.date)}</td>
                    <td className="py-3 px-4 text-center">
                      {day.attempts > 0 ? (
                        <span className={`font-bold ${getScoreGradient(day.bestScore)}`}>
                          {day.bestScore}/6
                        </span>
                      ) : (
                        <span className="text-white/30">−</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-white/60">
                      {day.attempts || '−'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {day.attempts > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/40 border border-white/10">
                          Missed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Topics to Improve */}
        {summary?.weakTopics && summary.weakTopics.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Topics to Improve</h2>
                <p className="text-xs text-white/40">Less than 70% correct rate</p>
              </div>
            </div>

            <div className="space-y-4">
              {summary.weakTopics.map((topic) => {
                const percentage = Math.round(topic.correctRate * 100);
                return (
                  <div key={topic.topic} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-white/80">
                        {formatTopic(topic.topic as Topic)}
                      </span>
                      <span className="text-sm text-white/40">
                        {percentage}%
                        <span className="text-white/20 ml-1">({topic.totalQuestions} Qs)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressGradient(topic.correctRate)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {summary?.weakTopics?.length === 0 && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-6 text-center backdrop-blur-xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/30 flex items-center justify-center">
              <span className="text-3xl">🎯</span>
            </div>
            <p className="text-green-400 font-bold text-lg">Great job!</p>
            <p className="text-green-400/60 text-sm mt-1">
              No weak topics identified. Keep up the excellent work!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  gradient
}: {
  label: string;
  value: string;
  subtext: string;
  gradient: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 hover:bg-white/10 transition-all">
      <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
        {value}
      </p>
      <p className="text-xs text-white/30 mt-1">{subtext}</p>
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

function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateObj = new Date(dateStr);
  dateObj.setHours(0, 0, 0, 0);

  if (dateObj.getTime() === today.getTime()) {
    return 'Today';
  }

  return date.toLocaleDateString('en-GB', { weekday: 'short' });
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
    Ethics_Law_Env: 'Ethics, Law & Environment',
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

function getScoreGradient(score: number): string {
  if (score >= 5) return 'bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent';
  if (score >= 4) return 'bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent';
  if (score >= 3) return 'bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent';
  return 'bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent';
}

function getProgressGradient(rate: number): string {
  if (rate >= 0.6) return 'bg-gradient-to-r from-yellow-400 to-orange-500';
  if (rate >= 0.4) return 'bg-gradient-to-r from-orange-400 to-red-500';
  return 'bg-gradient-to-r from-red-400 to-rose-500';
}
