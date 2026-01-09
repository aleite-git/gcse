'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Question, QuestionInput, Topic } from '@/types';

const TOPICS: Topic[] = [
  'CPU',
  'RAM_ROM',
  'Storage',
  'OS',
  'Embedded',
  'NetworksBasics',
  'Protocols',
  'Security',
  'Ethics_Law_Env',
  'Performance',
];

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  const fetchQuestions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/questions');

      if (response.status === 401 || response.status === 403) {
        router.push('/');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
    } catch {
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch(`/api/admin/questions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete question');
      }

      await fetchQuestions();
    } catch {
      setError('Failed to delete question');
    }
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesTopic = filterTopic === 'all' || q.topic === filterTopic;
    const matchesSearch = q.stem.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTopic && matchesSearch;
  });

  const activeCount = questions.filter((q) => q.active).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
            <p className="text-sm text-gray-500">
              {activeCount} active / {questions.length} total questions
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/results"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              View Results
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

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setShowForm(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add Question
              </button>
              <BulkImport onImport={fetchQuestions} />
            </div>
            <div className="flex gap-4 items-center">
              <select
                value={filterTopic}
                onChange={(e) => setFilterTopic(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Topics</option>
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Question Form Modal */}
        {showForm && (
          <QuestionForm
            question={editingQuestion}
            onClose={() => {
              setShowForm(false);
              setEditingQuestion(null);
            }}
            onSave={async () => {
              await fetchQuestions();
              setShowForm(false);
              setEditingQuestion(null);
            }}
          />
        )}

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((question) => (
            <div
              key={question.id}
              className={`bg-white rounded-xl shadow-sm p-6 ${
                !question.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 text-xs font-medium rounded">
                      {question.topic.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                      Difficulty: {question.difficulty}
                    </span>
                    {!question.active && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 font-medium mb-3">{question.stem}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {question.options.map((option, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded ${
                          i === question.correctIndex
                            ? 'bg-green-100 text-green-800 border border-green-300'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {String.fromCharCode(65 + i)}. {option}
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    <span className="font-medium">Explanation:</span> {question.explanation}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingQuestion(question);
                      setShowForm(true);
                    }}
                    className="px-3 py-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(question.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No questions found. Add some questions to get started.
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionForm({
  question,
  onClose,
  onSave,
}: {
  question: Question | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState<QuestionInput>({
    stem: question?.stem || '',
    options: question?.options || ['', '', '', ''],
    correctIndex: question?.correctIndex || 0,
    explanation: question?.explanation || '',
    topic: question?.topic || 'CPU',
    subject: question?.subject || 'computer-science',
    difficulty: question?.difficulty || 2,
    tags: question?.tags || [],
    active: question?.active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = question
        ? `/api/admin/questions/${question.id}`
        : '/api/admin/questions';
      const method = question ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save question');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {question ? 'Edit Question' : 'Add Question'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Stem
            </label>
            <textarea
              value={formData.stem}
              onChange={(e) => setFormData({ ...formData, stem: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {formData.options.map((option, i) => (
              <div key={i}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Option {String.fromCharCode(65 + i)}
                  {i === formData.correctIndex && ' (Correct)'}
                </label>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...formData.options] as [string, string, string, string];
                    newOptions[i] = e.target.value;
                    setFormData({ ...formData, options: newOptions });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correct Answer
            </label>
            <select
              value={formData.correctIndex}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  correctIndex: parseInt(e.target.value) as 0 | 1 | 2 | 3,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <option key={i} value={i}>
                  Option {letter}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Explanation
            </label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Topic
              </label>
              <select
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value as Topic })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Difficulty
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData({ ...formData, difficulty: parseInt(e.target.value) as 1 | 2 | 3 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={1}>1 - Easy</option>
                <option value={2}>2 - Medium</option>
                <option value={3}>3 - Hard</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded"
            />
            <label htmlFor="active" className="text-sm text-gray-700">
              Active (include in quizzes)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkImport({ onImport }: { onImport: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleImport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const questions = JSON.parse(jsonInput);

      if (!Array.isArray(questions)) {
        throw new Error('Input must be an array of questions');
      }

      const response = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import questions');
      }

      const data = await response.json();
      setSuccess(`Successfully imported ${data.imported} questions`);
      setJsonInput('');
      onImport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import questions');
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) {
    return (
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Bulk Import
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Bulk Import Questions</h2>
        <p className="text-sm text-gray-600 mb-4">
          Paste a JSON array of questions. Each question should have: stem, options (array of 4),
          correctIndex (0-3), explanation, topic, and difficulty (1-3).
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
          rows={10}
          placeholder='[{"stem": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, ...}]'
        />

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleImport}
            disabled={loading || !jsonInput.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
