'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QuizResponse, QuizQuestion, Answer, SubmitResponse, QuestionFeedback, StreakStatus, Subject, SUBJECTS } from '@/types';
import { useMe } from '@/lib/use-me';
import { getActiveSubjectsForApp } from '@/lib/onboarding';
import { studyNotes, StudyNote } from '@/lib/studyNotes';
import { StreakDisplay, StreakCelebration } from '@/components/StreakDisplay';
import { MathText } from '@/components/MathText';

type QuizState = 'loading' | 'quiz' | 'submitting' | 'results' | 'no-subject';

interface StreakResult {
  currentStreak: number;
  freezeDays: number;
  freezeEarned: boolean;
}

export default function QuizPage() {
  return (
    <Suspense fallback={<QuizLoading />}>
      <QuizContent />
    </Suspense>
  );
}

function QuizLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
        </div>
        <p className="mt-6 text-white/60 font-medium">Loading quiz...</p>
      </div>
    </div>
  );
}

function QuizContent() {
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject') as Subject | null;
  const subjectInfo = subject ? SUBJECTS[subject] : null;
  const { profile, status } = useMe();
  const activeSubjects = useMemo(() => getActiveSubjectsForApp(profile), [profile]);
  const activeSubjectsKey = activeSubjects.join('|');

  const [state, setState] = useState<QuizState>('loading');
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(() => Date.now());
  const [streakStatus, setStreakStatus] = useState<StreakStatus | null>(null);
  const [streakResult, setStreakResult] = useState<StreakResult | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const router = useRouter();
  const totalQuestions = quiz?.questions.length ?? 0;

  const loadQuiz = useCallback(async () => {
    // Validate subject
    if (!subject || !SUBJECTS[subject]) {
      setState('no-subject');
      return;
    }

    if (activeSubjects.length > 0 && !activeSubjects.includes(subject)) {
      setState('no-subject');
      return;
    }

    try {
      setState('loading');
      const response = await fetch(`/api/quiz/today?subject=${subject}`);

      if (response.status === 401) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load quiz');
      }

      const data: QuizResponse = await response.json();
      const noQuestionsMessage =
        data.questions.length === 0
          ? data.message || 'Question bank being revised! No quiz today!'
          : '';
      setError(noQuestionsMessage);
      setQuiz(data);
      setAnswers(new Map());
      setStartTime(Date.now());
      setState('quiz');

      // Fetch streak status for this subject
      try {
        const streakResponse = await fetch(`/api/streak?subject=${subject}&timezone=${encodeURIComponent(timezone)}`);
        if (streakResponse.ok) {
          const streakData = await streakResponse.json();
          setStreakStatus(streakData);
        }
      } catch {
        console.error('Failed to fetch streak');
      }
    } catch {
      setError('Failed to load quiz. Please try again.');
      setState('quiz');
    }
  }, [activeSubjectsKey, router, timezone, subject]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, optionIndex);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!quiz || !subject || quiz.questions.length === 0) return;
    if (answers.size !== quiz.questions.length) return;

    setState('submitting');
    setError('');

    try {
      const answerArray: Answer[] = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedIndex: answers.get(q.id)!,
      }));

      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-timezone': timezone,
        },
        body: JSON.stringify({ subject, answers: answerArray, durationSeconds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit quiz');
      }

      const data = await response.json();
      setResults(data);

      // Capture streak result if returned
      if (data.streak) {
        setStreakResult(data.streak);
        setShowCelebration(true);
        // Update streak status
        setStreakStatus((prev) => prev ? {
          ...prev,
          currentStreak: data.streak.currentStreak,
          freezeDays: data.streak.freezeDays,
        } : null);
      }

      setState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
      setState('quiz');
    }
  };

  const handleTryNewQuiz = async () => {
    if (!subject) return;

    setState('loading');
    setError('');

    try {
      const response = await fetch('/api/quiz/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate new quiz');
      }

      const data: QuizResponse = await response.json();
      const noQuestionsMessage =
        data.questions.length === 0
          ? data.message || 'Question bank being revised! No quiz today!'
          : '';
      setError(noQuestionsMessage);
      setQuiz(data);
      setAnswers(new Map());
      setResults(null);
      setStartTime(Date.now());
      setState('quiz');
    } catch {
      setError('Failed to generate new quiz. Please try again.');
      setState('results');
    }
  };

  const handleTryAgainSameQuiz = () => {
    if (!quiz) return;
    setAnswers(new Map());
    setResults(null);
    setShowCelebration(false);
    setStartTime(Date.now());
    setState('quiz');
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (state === 'no-subject') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold text-white mb-2">Subject not available</h1>
          <p className="text-white/60 mb-6">Select one of your active subjects to start your quiz.</p>
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

  if (state === 'loading' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
          </div>
          <p className="mt-6 text-white/60 font-medium">Loading {subjectInfo?.name || 'quiz'}...</p>
        </div>
      </div>
    );
  }

  if (state === 'results' && results) {
    return (
      <>
        {showCelebration && streakResult && (
          <StreakCelebration
            streak={streakResult.currentStreak}
            freezeEarned={streakResult.freezeEarned}
            onClose={() => setShowCelebration(false)}
          />
        )}
        <ResultsView
          results={results}
          onTryAgain={handleTryAgainSameQuiz}
          onTryNewQuiz={handleTryNewQuiz}
          onLogout={handleLogout}
          streakResult={streakResult}
          streakStatus={streakStatus}
          subject={subject}
          subjectInfo={subjectInfo}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                {subjectInfo && <span className="text-3xl">{subjectInfo.icon}</span>}
                <h1 className="text-2xl font-bold text-white">{subjectInfo?.name || 'Daily Quiz'}</h1>
              </div>
              <p className="text-sm text-white/40">
                {quiz?.quizVersion && `Version ${quiz.quizVersion}`}
              </p>
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
              href={`/progress?subject=${subject}`}
              className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 hover:bg-white/20 hover:text-white text-sm font-medium transition-all"
            >
              Progress
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-white/60">
              Answered: {answers.size}/{totalQuestions}
            </span>
            <div className="flex gap-1.5">
              {quiz?.questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    answers.has(q.id)
                      ? q.isBonus
                        ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-amber-500/50'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/50'
                      : q.isBonus
                      ? 'bg-amber-500/20'
                      : 'bg-white/10'
                  }`}
                  title={q.isBonus ? 'Bonus Question' : `Question ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-500"
              style={{
                width:
                  totalQuestions > 0
                    ? `${(answers.size / totalQuestions) * 100}%`
                    : '0%',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }}
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {quiz?.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              index={index}
              selectedIndex={answers.get(question.id)}
              onSelect={(optionIndex) => handleAnswerSelect(question.id, optionIndex)}
              disabled={state === 'submitting'}
            />
          ))}
        </div>

        {/* Submit Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={
              totalQuestions === 0 ||
              answers.size !== totalQuestions ||
              state === 'submitting'
            }
            className="relative px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:from-purple-500 hover:to-pink-500 focus:ring-4 focus:ring-purple-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-pink-600 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 active:scale-95"
          >
            {state === 'submitting' ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Submit Quiz'
            )}
          </button>
        </div>

        {totalQuestions > 0 && answers.size !== totalQuestions && (
          <p className="mt-4 text-center text-sm text-white/40">
            Answer all questions to submit (including the bonus!)
          </p>
        )}
      </div>

      {/* Shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function formatTopic(topic: string): string {
  return topic
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

function QuestionCard({
  question,
  index,
  selectedIndex,
  onSelect,
  disabled,
}: {
  question: QuizQuestion;
  index: number;
  selectedIndex?: number;
  onSelect: (index: number) => void;
  disabled: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const notesText = question.notes?.trim();
  const notes = studyNotes[question.topic];
  const isBonus = question.isBonus;
  const hasNotes = Boolean(notesText) || Boolean(notes);

  return (
    <div className={`rounded-2xl p-6 backdrop-blur-xl border transition-all ${
      isBonus
        ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 shadow-lg shadow-amber-500/10'
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`}>
      {isBonus && (
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full uppercase tracking-wider">
            Bonus
          </span>
          <span className="text-sm text-amber-400 font-medium">
            Challenge Question
          </span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold text-white leading-relaxed">
          <span className={`mr-2 ${isBonus ? 'text-amber-400' : 'text-purple-400'}`}>
            {isBonus ? 'B.' : `Q${index + 1}.`}
          </span>
          <MathText text={question.stem} />
        </h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            isBonus
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
          }`}>
            {formatTopic(question.topic)}
          </span>
          {hasNotes && (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="px-3 py-1 text-xs font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full hover:bg-cyan-500/30 transition-colors"
            >
              {showNotes ? 'Hide' : 'Notes'}
            </button>
          )}
        </div>
      </div>

      {showNotes && (
        <QuestionNotesPanel
          notesText={notesText}
          studyNote={notes}
          onClose={() => setShowNotes(false)}
        />
      )}

      <div className="space-y-3">
        {question.options.map((option, optionIndex) => (
          <label
            key={optionIndex}
            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 ${
              selectedIndex === optionIndex
                ? isBonus
                  ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500 shadow-lg shadow-amber-500/20'
                  : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              checked={selectedIndex === optionIndex}
              onChange={() => onSelect(optionIndex)}
              disabled={disabled}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center transition-all ${
              selectedIndex === optionIndex
                ? isBonus
                  ? 'border-amber-500 bg-amber-500'
                  : 'border-purple-500 bg-purple-500'
                : 'border-white/30'
            }`}>
              {selectedIndex === optionIndex && (
                <div className="w-2 h-2 bg-white rounded-full" />
              )}
            </div>
            <MathText text={option} className="text-white/80" />
          </label>
        ))}
      </div>
    </div>
  );
}

function StudyNotesPanel({ notes, onClose }: { notes: StudyNote; onClose: () => void }) {
  return (
    <div className="mb-5 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl backdrop-blur-sm">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-cyan-300">{notes.title}</h3>
        <button
          onClick={onClose}
          className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-4 max-h-80 overflow-y-auto text-sm">
        {notes.sections.map((section, i) => (
          <div key={i}>
            <h4 className="font-medium text-cyan-200 mb-1">{section.heading}</h4>
            <p className="text-white/60 mb-2">{section.content}</p>
            {section.bullets && (
              <ul className="list-disc list-inside space-y-1 text-white/50">
                {section.bullets.map((bullet, j) => (
                  <li key={j}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionNotesPanel({
  notesText,
  studyNote,
  onClose,
}: {
  notesText?: string;
  studyNote?: StudyNote;
  onClose: () => void;
}) {
  if (notesText) {
    return (
      <div className="mb-5 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl backdrop-blur-sm">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-cyan-300">Notes</h3>
          <button
            onClick={onClose}
            className="text-cyan-400 hover:text-cyan-300 transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <MathText text={notesText} className="text-sm text-white/60 whitespace-pre-line" block />
      </div>
    );
  }

  if (studyNote) {
    return <StudyNotesPanel notes={studyNote} onClose={onClose} />;
  }

  return null;
}

function ResultsView({
  results,
  onTryAgain,
  onTryNewQuiz,
  onLogout,
  streakResult,
  streakStatus,
  subject,
  subjectInfo,
}: {
  results: SubmitResponse;
  onTryAgain: () => void;
  onTryNewQuiz: () => void;
  onLogout: () => void;
  streakResult: StreakResult | null;
  streakStatus: StreakStatus | null;
  subject: Subject | null;
  subjectInfo: { name: string; icon: string; color: string } | null;
}) {
  const totalQuestions = results.feedback.length;
  const scorePercentage = (results.score / totalQuestions) * 100;

  let scoreGradient = 'from-red-500 to-orange-500';
  let scoreShadow = 'shadow-red-500/30';
  let scoreMessage = 'Keep practicing!';

  if (scorePercentage >= 80) {
    scoreGradient = 'from-green-400 to-emerald-500';
    scoreShadow = 'shadow-green-500/30';
    scoreMessage = scorePercentage === 100 ? 'Perfect!' : 'Excellent!';
  } else if (scorePercentage >= 60) {
    scoreGradient = 'from-yellow-400 to-orange-500';
    scoreShadow = 'shadow-yellow-500/30';
    scoreMessage = 'Great job!';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              {subjectInfo && <span className="text-3xl">{subjectInfo.icon}</span>}
              <h1 className="text-2xl font-bold text-white">{subjectInfo?.name || 'Quiz'} Results</h1>
            </div>
            {streakResult && (
              <StreakDisplay
                currentStreak={streakResult.currentStreak}
                freezeDays={streakResult.freezeDays}
                maxFreezes={streakStatus?.maxFreezes || 2}
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
              href={`/progress?subject=${subject}`}
              className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white/80 hover:bg-white/20 hover:text-white text-sm font-medium transition-all"
            >
              Progress
            </Link>
            <button
              onClick={onLogout}
              className="text-white/40 hover:text-white/80 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Score Card */}
        <div className={`relative overflow-hidden rounded-3xl p-8 text-center mb-8 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 shadow-2xl ${scoreShadow}`}>
          {/* Background glow */}
          <div className={`absolute inset-0 bg-gradient-to-r ${scoreGradient} opacity-10 blur-3xl`} />

          <div className="relative z-10">
            <p className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">Your Score</p>
            <p className={`text-7xl font-black bg-gradient-to-r ${scoreGradient} bg-clip-text text-transparent`}>
              {results.score}/{totalQuestions}
            </p>
            <p className="mt-1 text-xs text-white/30">(5 questions + 1 bonus)</p>
            <p className={`mt-4 text-xl font-bold bg-gradient-to-r ${scoreGradient} bg-clip-text text-transparent`}>
              {scoreMessage}
            </p>
          </div>
        </div>

        {/* Feedback Cards */}
        <div className="space-y-4 mb-8">
          {results.feedback.map((item, index) => (
            <FeedbackCard key={item.questionId} feedback={item} index={index} />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={onTryAgain}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 active:scale-95"
          >
            Try Quiz Again
          </button>
          <button
            onClick={onTryNewQuiz}
            className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all"
          >
            Try New Quiz
          </button>
          <Link
            href="/quiz/subjects"
            className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-center"
          >
            Other Subjects
          </Link>
          <Link
            href={`/progress?subject=${subject}`}
            className="px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-center"
          >
            View Progress
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeedbackCard({
  feedback,
  index,
}: {
  feedback: QuestionFeedback;
  index: number;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [expanded, setExpanded] = useState(!feedback.isCorrect);
  const notesText = feedback.notes?.trim();
  const notes = studyNotes[feedback.topic];
  const hasNotes = Boolean(notesText) || Boolean(notes);

  return (
    <div
      className={`rounded-2xl overflow-hidden backdrop-blur-xl border transition-all ${
        feedback.isCorrect
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
            feedback.isCorrect
              ? 'bg-gradient-to-br from-green-400 to-emerald-500'
              : 'bg-gradient-to-br from-red-400 to-rose-500'
          }`}
        >
          {feedback.isCorrect ? '✓' : '✗'}
        </span>
        <span className="flex-1 font-medium text-white/90 line-clamp-1">
          Q{index + 1}. <MathText text={feedback.stem} />
        </span>
        <svg
          className={`w-5 h-5 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4">
          <h3 className="font-semibold text-white/80 mb-4 pl-11">
            <MathText text={feedback.stem} />
          </h3>
          <div className="space-y-2 mb-4 pl-11">
            {feedback.options.map((option, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-sm transition-all ${
                  i === feedback.correctIndex
                    ? 'bg-green-500/20 border border-green-500/40 text-green-300'
                    : i === feedback.selectedIndex && !feedback.isCorrect
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                    : 'bg-white/5 border border-white/10 text-white/50'
                }`}
              >
                <span className="font-medium mr-2">
                  {i === feedback.correctIndex ? '✓' : i === feedback.selectedIndex && !feedback.isCorrect ? '✗' : ''}
                </span>
                <MathText text={option} />
              </div>
            ))}
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10 ml-11">
            <p className="text-sm text-white/60">
              <span className="font-medium text-white/80">Explanation:</span> <MathText text={feedback.explanation} />
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2 pl-11">
            <span className="text-xs text-white/30 px-2 py-1 bg-white/5 rounded-full">
              {feedback.topic.replace(/_/g, ' ')}
            </span>
            {hasNotes && (
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full hover:bg-cyan-500/30 transition-colors"
              >
                {showNotes ? 'Hide Notes' : 'Review Notes'}
              </button>
            )}
          </div>
          {showNotes && (
            <div className="mt-3 ml-11">
              <QuestionNotesPanel
                notesText={notesText}
                studyNote={notes}
                onClose={() => setShowNotes(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
