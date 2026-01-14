'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Subject, SUBJECTS, StreakStatus } from '@/types';
import { useMe } from '@/lib/use-me';
import { getActiveSubjectsForApp } from '@/lib/onboarding';
import { StreakDisplay } from '@/components/StreakDisplay';

interface SubjectProgress {
  attemptedToday: boolean;
  todayBestScore: number;
  todayAttempts: number;
}

export default function SubjectPickerPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<Subject, SubjectProgress | null>>({
    'computer-science': null,
    'biology': null,
    'chemistry': null,
  });
  const [streaks, setStreaks] = useState<Record<Subject, StreakStatus | null>>({
    'computer-science': null,
    'biology': null,
    'chemistry': null,
  });
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const router = useRouter();
  const { profile, status } = useMe();
  const activeSubjects = useMemo(() => getActiveSubjectsForApp(profile), [profile]);
  const activeSubjectsKey = activeSubjects.join('|');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch progress for all subjects in parallel
        const subjects = activeSubjects.length > 0 ? activeSubjects : (Object.keys(SUBJECTS) as Subject[]);

        const progressPromises = subjects.map(async (subject) => {
          try {
            const res = await fetch(`/api/progress?subject=${subject}`);
            if (res.status === 401) {
              router.push('/');
              return null;
            }
            if (res.ok) {
              const data = await res.json();
              return { subject, data };
            }
          } catch {
            console.error(`Failed to fetch progress for ${subject}`);
          }
          return null;
        });

        // Fetch streaks for all subjects
        const streakRes = await fetch(`/api/streak?timezone=${encodeURIComponent(timezone)}`);
        if (streakRes.ok) {
          const streakData = await streakRes.json();
          if (streakData.streaks) {
            setStreaks(streakData.streaks);
          }
        }

        const progressResults = await Promise.all(progressPromises);

        const newProgress: Record<Subject, SubjectProgress | null> = {
          'computer-science': null,
          'biology': null,
          'chemistry': null,
        };

        for (const result of progressResults) {
          if (result) {
            newProgress[result.subject] = {
              attemptedToday: result.data.attemptedToday,
              todayBestScore: result.data.todayBestScore,
              todayAttempts: result.data.todayAttempts,
            };
          }
        }

        setProgress(newProgress);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeSubjectsKey, router, timezone]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Loading subjects...</p>
        </div>
      </div>
    );
  }

  if (profile && activeSubjects.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white">No active subjects</h2>
          <p className="mt-3 text-white/60">
            Choose at least one subject to unlock your daily quizzes.
          </p>
          <button
            onClick={() => router.push('/onboarding/subjects')}
            className="mt-6 rounded-full bg-purple-500 px-6 py-3 text-white font-semibold hover:bg-purple-400"
          >
            Choose subjects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Choose Your Subject</h1>
            <p className="text-white/60 mt-1">Complete a quiz for each subject daily</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/settings/subjects"
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
            >
              Edit subjects
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(activeSubjects.length > 0 ? activeSubjects : (Object.keys(SUBJECTS) as Subject[])).map((subject) => {
            const subjectInfo = SUBJECTS[subject];
            const subjectProgress = progress[subject];
            const subjectStreak = streaks[subject];
            const completed = subjectProgress?.attemptedToday || false;

            return (
              <SubjectCard
                key={subject}
                subject={subject}
                name={subjectInfo.name}
                icon={subjectInfo.icon}
                colorGradient={subjectInfo.color}
                completed={completed}
                bestScore={subjectProgress?.todayBestScore}
                attempts={subjectProgress?.todayAttempts}
                streak={subjectStreak?.currentStreak}
              />
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            Complete all three subjects to maintain your streaks!
          </p>
        </div>
      </div>
    </div>
  );
}

function SubjectCard({
  subject,
  name,
  icon,
  colorGradient,
  completed,
  bestScore,
  attempts,
  streak,
}: {
  subject: Subject;
  name: string;
  icon: string;
  colorGradient: string;
  completed: boolean;
  bestScore?: number;
  attempts?: number;
  streak?: number;
}) {
  return (
    <Link
      href={`/quiz/today?subject=${subject}`}
      className="relative group block rounded-3xl p-6 backdrop-blur-xl border border-white/10 bg-white/5 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-white/20"
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 opacity-40 group-hover:opacity-60 transition-opacity" />

      <div
        className={`absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border ${
          completed
            ? 'border-green-400/80 bg-green-500 shadow-lg shadow-green-500/30'
            : 'border-white/30 bg-white/10'
        }`}
      >
        {completed && (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="relative z-10">
        {/* Icon */}
        <div className="text-5xl mb-4">{icon}</div>

        {/* Subject name */}
        <h2 className="text-xl font-bold text-white mb-2">{name}</h2>

        {/* Status */}
        <div className="space-y-1">
          <p className="text-sm text-white/60">
            {completed ? "Completed today" : "Pending today\u2019s quiz"}
          </p>
          {completed && bestScore !== undefined && (
            <p className="text-sm text-white/40">
              Best score: <span className="text-white/80 font-medium">{bestScore}/6</span>
              {attempts && attempts > 1 && (
                <span className="text-white/30"> ({attempts} attempts)</span>
              )}
            </p>
          )}
        </div>

        {/* Streak indicator */}
        {streak !== undefined && streak > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-orange-400">🔥</span>
            <span className="text-sm text-white/60">
              {streak} day streak
            </span>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-6 h-6 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
