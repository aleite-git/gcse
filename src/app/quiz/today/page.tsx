'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QuizResponse, QuizQuestion, Answer, SubmitResponse, QuestionFeedback } from '@/types';

type QuizState = 'loading' | 'quiz' | 'submitting' | 'results';

export default function QuizPage() {
  const [state, setState] = useState<QuizState>('loading');
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [results, setResults] = useState<SubmitResponse | null>(null);
  const [error, setError] = useState('');
  const [startTime] = useState(() => Date.now());
  const router = useRouter();

  const loadQuiz = useCallback(async () => {
    try {
      setState('loading');
      const response = await fetch('/api/quiz/today');

      if (response.status === 401) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load quiz');
      }

      const data: QuizResponse = await response.json();
      setQuiz(data);
      setAnswers(new Map());
      setState('quiz');
    } catch {
      setError('Failed to load quiz. Please try again.');
      setState('quiz');
    }
  }, [router]);

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
    if (!quiz || answers.size !== 5) return;

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray, durationSeconds }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit quiz');
      }

      const data: SubmitResponse = await response.json();
      setResults(data);
      setState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quiz');
      setState('quiz');
    }
  };

  const handleRetry = async () => {
    setState('loading');
    setError('');

    try {
      const response = await fetch('/api/quiz/retry', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate new quiz');
      }

      const data: QuizResponse = await response.json();
      setQuiz(data);
      setAnswers(new Map());
      setResults(null);
      setState('quiz');
    } catch {
      setError('Failed to generate new quiz. Please try again.');
      setState('results');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (state === 'results' && results) {
    return <ResultsView results={results} onRetry={handleRetry} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Quiz</h1>
            <p className="text-sm text-gray-500">
              {quiz?.quizVersion && `Version ${quiz.quizVersion}`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/progress"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Progress
            </Link>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-600">
              Answered: {answers.size}/5
            </span>
            <div className="flex gap-1">
              {quiz?.questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`w-3 h-3 rounded-full ${
                    answers.has(q.id) ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                  title={`Question ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(answers.size / 5) * 100}%` }}
            />
          </div>
        </div>

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

        <div className="mt-8 flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={answers.size !== 5 || state === 'submitting'}
            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'submitting' ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>

        {answers.size !== 5 && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Please answer all 5 questions to submit
          </p>
        )}
      </div>
    </div>
  );
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
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        <span className="text-indigo-600 mr-2">Q{index + 1}.</span>
        {question.stem}
      </h2>
      <div className="space-y-3">
        {question.options.map((option, optionIndex) => (
          <label
            key={optionIndex}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedIndex === optionIndex
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              checked={selectedIndex === optionIndex}
              onChange={() => onSelect(optionIndex)}
              disabled={disabled}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="ml-3 text-gray-700">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ResultsView({
  results,
  onRetry,
  onLogout,
}: {
  results: SubmitResponse;
  onRetry: () => void;
  onLogout: () => void;
}) {
  const scorePercentage = (results.score / 5) * 100;
  let scoreColor = 'text-red-600';
  let scoreBg = 'bg-red-100';

  if (scorePercentage >= 80) {
    scoreColor = 'text-green-600';
    scoreBg = 'bg-green-100';
  } else if (scorePercentage >= 60) {
    scoreColor = 'text-yellow-600';
    scoreBg = 'bg-yellow-100';
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Quiz Results</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/progress"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Progress
            </Link>
            <button
              onClick={onLogout}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        <div className={`${scoreBg} rounded-xl p-8 text-center mb-8`}>
          <p className="text-sm font-medium text-gray-600 mb-2">Your Score</p>
          <p className={`text-5xl font-bold ${scoreColor}`}>
            {results.score}/5
          </p>
          <p className="mt-2 text-gray-600">
            {scorePercentage === 100
              ? 'Perfect score!'
              : scorePercentage >= 80
              ? 'Great job!'
              : scorePercentage >= 60
              ? 'Good effort!'
              : 'Keep practicing!'}
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {results.feedback.map((item, index) => (
            <FeedbackCard key={item.questionId} feedback={item} index={index} />
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again (New Questions)
          </button>
          <Link
            href="/progress"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
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
  return (
    <div
      className={`rounded-xl p-6 ${
        feedback.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium ${
            feedback.isCorrect ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {feedback.isCorrect ? '✓' : '✗'}
        </span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-3">
            Q{index + 1}. {feedback.stem}
          </h3>
          <div className="space-y-2 mb-4">
            {feedback.options.map((option, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg text-sm ${
                  i === feedback.correctIndex
                    ? 'bg-green-100 border border-green-300 text-green-800'
                    : i === feedback.selectedIndex && !feedback.isCorrect
                    ? 'bg-red-100 border border-red-300 text-red-800'
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                {i === feedback.correctIndex && '✓ '}
                {i === feedback.selectedIndex && i !== feedback.correctIndex && '✗ '}
                {option}
              </div>
            ))}
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Explanation:</span> {feedback.explanation}
            </p>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Topic: {feedback.topic.replace(/_/g, ' ')}
          </p>
        </div>
      </div>
    </div>
  );
}
