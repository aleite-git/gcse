'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACTIVE_SUBJECTS, ActiveSubject } from '@/lib/active-subjects';
import { updateActiveSubjects } from '@/lib/me-client';
import { useMe } from '@/lib/use-me';
import { validateSubjectSelection } from '@/lib/onboarding';
import { SUBJECTS } from '@/types';

const SUBJECT_DETAILS: Record<ActiveSubject, { icon: string; description: string }> = {
  Biology: { icon: '🧬', description: 'Cells, systems, and life processes' },
  Chemistry: { icon: '⚗️', description: 'Reactions, bonding, and elements' },
  'Computer Science': { icon: '💻', description: 'Systems, networks, and algorithms' },
};

export default function SubjectsSettingsPage() {
  const router = useRouter();
  const { profile, loading, status, setProfile } = useMe();
  const [selected, setSelected] = useState<ActiveSubject[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportedSubjects = useMemo(() => new Set(Object.values(SUBJECTS).map((s) => s.name)), []);
  const hasSupportedSelection = selected.some((subject) => supportedSubjects.has(subject));

  useEffect(() => {
    if (profile?.activeSubjects?.length) {
      setSelected(profile.activeSubjects);
    }
  }, [profile]);

  const toggleSubject = (subject: ActiveSubject) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((item) => item !== subject);
      }
      return [...prev, subject];
    });
  };

  const handleSubmit = async () => {
    const validation = validateSubjectSelection(selected, { requireSupported: true });
    if (!validation.valid) {
      setError(validation.message || 'Select at least one subject to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const updated = await updateActiveSubjects(selected);
      setProfile(updated);
      router.push('/quiz/subjects');
    } catch (err) {
      const message = (err as Error).message || 'Failed to save your subjects';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <p className="text-purple-200/80 uppercase tracking-[0.2em] text-xs">Settings</p>
          <h1 className="text-3xl font-bold text-white mt-3">
            Active subjects
          </h1>
          <p className="text-white/60 mt-3 max-w-xl">
            Update the subjects you want to focus on. You must keep at least one selected.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {ACTIVE_SUBJECTS.map((subject) => {
            const detail = SUBJECT_DETAILS[subject];
            const selectedState = selected.includes(subject);

            return (
              <button
                key={subject}
                type="button"
                onClick={() => toggleSubject(subject)}
                className={`group text-left rounded-2xl border px-5 py-5 transition-all duration-300 ${
                  selectedState
                    ? 'border-purple-400/80 bg-white/10 shadow-lg shadow-purple-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{detail.icon}</span>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{subject}</h2>
                      <p className="text-sm text-white/50">{detail.description}</p>
                    </div>
                  </div>
                  <div
                    className={`h-6 w-6 rounded-full border transition-all ${
                      selectedState ? 'border-purple-400 bg-purple-500/70' : 'border-white/30'
                    }`}
                  />
                </div>
                {!supportedSubjects.has(subject) && (
                  <p className="mt-3 text-xs text-white/40">
                    Not available yet. Select another subject to continue.
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !hasSupportedSelection}
            className="w-full sm:w-auto rounded-full bg-purple-500 px-8 py-3 text-white font-semibold shadow-lg shadow-purple-500/30 transition-all hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/quiz/subjects')}
            className="text-sm text-white/60 hover:text-white"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
