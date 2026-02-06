import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextRequest } from 'next/server';

const validateAccessCode = jest.fn();
const createSessionToken = jest.fn();
const setSessionCookie = jest.fn();
const clearSessionCookie = jest.fn();
const getSessionFromRequest = jest.fn();

const getTodayQuiz = jest.fn();
const generateNewQuizVersion = jest.fn();
const submitQuizAttempt = jest.fn();
const getProgressSummary = jest.fn();
const generateTomorrowPreview = jest.fn();
const getAllAttempts = jest.fn();
const getAttemptsByDateRange = jest.fn();

const getAllQuestions = jest.fn();
const addQuestion = jest.fn();
const bulkImportQuestions = jest.fn();
const getQuestionById = jest.fn();
const updateQuestion = jest.fn();
const deleteQuestion = jest.fn();
const getQuestionsByIds = jest.fn();

const checkAndApplyFreeze = jest.fn();
const getStreakStatus = jest.fn();
const recordActivity = jest.fn();
const useFreeze = jest.fn();
const updateTimezone = jest.fn();

const runAccountDeletionJob = jest.fn();
const getDb = jest.fn();

jest.unstable_mockModule('@/lib/auth', () => ({
  validateAccessCode,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
}));

class QuizValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

jest.unstable_mockModule('@/lib/quiz', () => ({
  getTodayQuiz,
  generateNewQuizVersion,
  submitQuizAttempt,
  getProgressSummary,
  generateTomorrowPreview,
  getAllAttempts,
  getAttemptsByDateRange,
  QuizValidationError,
}));

jest.unstable_mockModule('@/lib/questions', () => ({
  getAllQuestions,
  addQuestion,
  bulkImportQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  getQuestionsByIds,
}));

jest.unstable_mockModule('@/lib/streak', () => ({
  checkAndApplyFreeze,
  getStreakStatus,
  recordActivity,
  useFreeze,
  updateTimezone,
  OVERALL_STREAK_SUBJECT: 'overall',
}));

jest.unstable_mockModule('@/lib/account-deletion-job', () => ({
  runAccountDeletionJob,
}));

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS: {
    QUESTION_STATS: 'questionStats',
  },
}));

let loginPost: (request: NextRequest) => Promise<Response>;
let logoutPost: () => Promise<Response>;
let quizTodayGet: (request: NextRequest) => Promise<Response>;
let quizRetryPost: (request: NextRequest) => Promise<Response>;
let quizSubmitPost: (request: NextRequest) => Promise<Response>;
let progressGet: (request: NextRequest) => Promise<Response>;
let streakGet: (request: NextRequest) => Promise<Response>;
let streakPost: (request: NextRequest) => Promise<Response>;
let adminPreviewGet: (request: NextRequest) => Promise<Response>;
let adminQuestionsGet: (request: NextRequest) => Promise<Response>;
let adminQuestionsPost: (request: NextRequest) => Promise<Response>;
let adminQuestionGet: (request: NextRequest, params: { params: Promise<{ id: string }> }) => Promise<Response>;
let adminQuestionPut: (request: NextRequest, params: { params: Promise<{ id: string }> }) => Promise<Response>;
let adminQuestionDelete: (request: NextRequest, params: { params: Promise<{ id: string }> }) => Promise<Response>;
let adminResultsGet: (request: NextRequest) => Promise<Response>;
let adminStatsGet: (request: NextRequest) => Promise<Response>;
let adminDeletionPost: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  ({ POST: loginPost } = await import('@/app/api/login/route'));
  ({ POST: logoutPost } = await import('@/app/api/logout/route'));
  ({ GET: quizTodayGet } = await import('@/app/api/quiz/today/route'));
  ({ POST: quizRetryPost } = await import('@/app/api/quiz/retry/route'));
  ({ POST: quizSubmitPost } = await import('@/app/api/quiz/submit/route'));
  ({ GET: progressGet } = await import('@/app/api/progress/route'));
  ({ GET: streakGet, POST: streakPost } = await import('@/app/api/streak/route'));
  ({ GET: adminPreviewGet } = await import('@/app/api/admin/preview/route'));
  ({ GET: adminQuestionsGet, POST: adminQuestionsPost } = await import('@/app/api/admin/questions/route'));
  ({ GET: adminQuestionGet, PUT: adminQuestionPut, DELETE: adminQuestionDelete } = await import('@/app/api/admin/questions/[id]/route'));
  ({ GET: adminResultsGet } = await import('@/app/api/admin/results/route'));
  ({ GET: adminStatsGet } = await import('@/app/api/admin/stats/route'));
  ({ POST: adminDeletionPost } = await import('@/app/api/admin/account-deletion/run/route'));
});

beforeEach(() => {
  validateAccessCode.mockReset();
  createSessionToken.mockReset();
  setSessionCookie.mockReset();
  clearSessionCookie.mockReset();
  getSessionFromRequest.mockReset();
  getTodayQuiz.mockReset();
  generateNewQuizVersion.mockReset();
  submitQuizAttempt.mockReset();
  getProgressSummary.mockReset();
  generateTomorrowPreview.mockReset();
  getAllAttempts.mockReset();
  getAttemptsByDateRange.mockReset();
  getAllQuestions.mockReset();
  addQuestion.mockReset();
  bulkImportQuestions.mockReset();
  getQuestionById.mockReset();
  updateQuestion.mockReset();
  deleteQuestion.mockReset();
  getQuestionsByIds.mockReset();
  checkAndApplyFreeze.mockReset();
  getStreakStatus.mockReset();
  recordActivity.mockReset();
  useFreeze.mockReset();
  updateTimezone.mockReset();
  runAccountDeletionJob.mockReset();
  getDb.mockReset();

  createSessionToken.mockResolvedValue('token');
  getSessionFromRequest.mockResolvedValue({ label: 'User', isAdmin: true, iat: 0, exp: 0 });
});

describe('api routes', () => {
  it('logs in with a valid access code', async () => {
    validateAccessCode.mockResolvedValue({ label: 'Student', isAdmin: false });

    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    }) as NextRequest;

    const response = await loginPost(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.redirectTo).toBe('/quiz/subjects');
    expect(setSessionCookie).toHaveBeenCalled();
  });

  it('rejects invalid access code', async () => {
    validateAccessCode.mockResolvedValue(null);
    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'bad' }),
    }) as NextRequest;

    const response = await loginPost(request);
    expect(response.status).toBe(401);
  });

  it('rejects login without an access code', async () => {
    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }) as NextRequest;

    const response = await loginPost(request);
    expect(response.status).toBe(400);
  });

  it('returns 500 when login throws', async () => {
    validateAccessCode.mockRejectedValue(new Error('boom'));

    const request = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'abc' }),
    }) as NextRequest;

    const response = await loginPost(request);
    expect(response.status).toBe(500);
  });

  it('logs out successfully', async () => {
    const response = await logoutPost();
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('returns 500 when logout fails', async () => {
    clearSessionCookie.mockRejectedValue(new Error('boom'));
    const response = await logoutPost();
    expect(response.status).toBe(500);
  });

  it('returns today quiz', async () => {
    getTodayQuiz.mockResolvedValue({
      quizVersion: 1,
      subject: 'computer-science',
      questions: [
        { id: 'q1', stem: 'Q', options: ['1','2','3','4'], topic: 'CPU', notes: '', difficulty: 1 },
      ],
    });

    const request = new Request('http://localhost/api/quiz/today?subject=computer-science') as NextRequest;
    const response = await quizTodayGet(request);
    const payload = await response.json();
    expect(payload.quizVersion).toBe(1);
  });

  it('returns a no-quiz message when the question bank is empty', async () => {
    getTodayQuiz.mockResolvedValue({
      quizVersion: 1,
      subject: 'computer-science',
      questions: [],
    });

    const request = new Request('http://localhost/api/quiz/today?subject=computer-science') as NextRequest;
    const response = await quizTodayGet(request);
    const payload = await response.json();
    expect(payload.questions).toHaveLength(0);
    expect(payload.message).toBe('Question bank being revised! No quiz today!');
  });

  it('rejects quiz today without subject', async () => {
    const request = new Request('http://localhost/api/quiz/today') as NextRequest;
    const response = await quizTodayGet(request);
    expect(response.status).toBe(400);
  });

  it('returns 500 when quiz today fails', async () => {
    getTodayQuiz.mockRejectedValue(new Error('boom'));
    const request = new Request('http://localhost/api/quiz/today?subject=computer-science') as NextRequest;
    const response = await quizTodayGet(request);
    expect(response.status).toBe(500);
  });

  it('retries quiz', async () => {
    generateNewQuizVersion.mockResolvedValue({
      quizVersion: 2,
      subject: 'computer-science',
      questions: [
        { id: 'q1', stem: 'Q', options: ['1','2','3','4'], topic: 'CPU', notes: '', difficulty: 1 },
      ],
    });

    const request = new Request('http://localhost/api/quiz/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;

    const response = await quizRetryPost(request);
    const payload = await response.json();
    expect(payload.quizVersion).toBe(2);
  });

  it('returns a no-quiz message when retry has no questions', async () => {
    generateNewQuizVersion.mockResolvedValue({
      quizVersion: 2,
      subject: 'computer-science',
      questions: [],
    });

    const request = new Request('http://localhost/api/quiz/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;

    const response = await quizRetryPost(request);
    const payload = await response.json();
    expect(payload.questions).toHaveLength(0);
    expect(payload.message).toBe('Question bank being revised! No quiz today!');
  });

  it('rejects quiz retry with invalid subject', async () => {
    const request = new Request('http://localhost/api/quiz/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'invalid' }),
    }) as NextRequest;
    const response = await quizRetryPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects quiz retry without a session', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const request = new Request('http://localhost/api/quiz/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;
    const response = await quizRetryPost(request);
    expect(response.status).toBe(401);
  });

  it('returns 500 when quiz retry fails', async () => {
    generateNewQuizVersion.mockRejectedValue(new Error('boom'));
    const request = new Request('http://localhost/api/quiz/retry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;
    const response = await quizRetryPost(request);
    expect(response.status).toBe(500);
  });

  it('submits quiz and returns feedback', async () => {
    submitQuizAttempt.mockResolvedValue({
      attempt: { id: 'a1', score: 6, topicBreakdown: { CPU: { correct: 6, total: 6 } } },
      questions: Array.from({ length: 6 }, (_, i) => ({
        id: `q${i + 1}`,
        stem: 'Q',
        options: ['1', '2', '3', '4'],
        correctIndex: 0,
        explanation: 'E',
        topic: 'CPU',
        notes: '',
      })),
    });
    recordActivity.mockResolvedValue({ streak: { currentStreak: 1, freezeDays: 0 }, freezeEarned: false });

    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: Array.from({ length: 6 }, (_, i) => ({ questionId: `q${i + 1}`, selectedIndex: 0 })),
        durationSeconds: 10,
      }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    const payload = await response.json();
    expect(payload.score).toBe(6);
  });

  it('rejects quiz submit when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);

    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science', answers: [], durationSeconds: 0 }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    expect(response.status).toBe(401);
  });

  it('rejects quiz submit with invalid subject', async () => {
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'invalid', answers: [], durationSeconds: 0 }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects quiz submit without answers', async () => {
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Answers are required');
  });

  it('rejects quiz submit with invalid answer shapes', async () => {
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: [{ selectedIndex: 0 }],
        durationSeconds: 10,
      }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid answer format');
  });

  it('rejects quiz submit with out-of-range selections', async () => {
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: [{ questionId: 'q1', selectedIndex: 9 }],
        durationSeconds: 10,
      }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid answer selection');
  });

  it('uses x-real-ip when x-forwarded-for is missing', async () => {
    submitQuizAttempt.mockResolvedValue({
      attempt: { id: 'a2', score: 1, topicBreakdown: {} },
      questions: [
        { id: 'q1', stem: 'Q', options: ['1', '2', '3', '4'], correctIndex: 0, explanation: 'E', topic: 'CPU', notes: '' },
      ],
    });
    recordActivity.mockResolvedValue({ streak: { currentStreak: 1, freezeDays: 0 }, freezeEarned: false });

    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '10.0.0.1' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: [{ questionId: 'q1', selectedIndex: 0 }],
        durationSeconds: 1,
      }),
    }) as NextRequest;

    await quizSubmitPost(request);
    expect(submitQuizAttempt.mock.calls[0][4]).toBe('10.0.0.1');
  });

  it('rejects submit with incomplete answers', async () => {
    submitQuizAttempt.mockRejectedValue(new QuizValidationError('Must answer all 6 questions'));
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: [{ questionId: 'q1', selectedIndex: 0 }],
        durationSeconds: 10,
      }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe('Must answer all 6 questions');
  });

  it('returns 500 when quiz submit throws non-validation errors', async () => {
    submitQuizAttempt.mockRejectedValue(new Error('boom'));
    const request = new Request('http://localhost/api/quiz/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'computer-science',
        answers: [{ questionId: 'q1', selectedIndex: 0 }],
        durationSeconds: 10,
      }),
    }) as NextRequest;

    const response = await quizSubmitPost(request);
    expect(response.status).toBe(500);
  });

  it('returns progress summary', async () => {
    getProgressSummary.mockResolvedValue({
      attemptedToday: true,
      todayAttempts: 1,
      todayBestScore: 6,
      last7Days: [],
      weakTopics: [],
    });

    const request = new Request('http://localhost/api/progress?subject=computer-science') as NextRequest;
    const response = await progressGet(request);
    const payload = await response.json();
    expect(payload.todayBestScore).toBe(6);
  });

  it('rejects progress without subject', async () => {
    const request = new Request('http://localhost/api/progress') as NextRequest;
    const response = await progressGet(request);
    expect(response.status).toBe(400);
  });

  it('returns streak status and handles use_freeze action', async () => {
    getStreakStatus.mockResolvedValue({ currentStreak: 2, freezeDays: 1, maxFreezes: 2, streakActive: true, lastActivityDate: null, daysUntilStreakLoss: 1, frozeToday: false });
    checkAndApplyFreeze.mockResolvedValue({ streak: { currentStreak: 2, freezeDays: 1 }, frozeApplied: false, missedDays: 0 });
    useFreeze.mockResolvedValue({ success: true, message: 'ok', streak: { currentStreak: 2, freezeDays: 0 } });

    const getRequest = new Request('http://localhost/api/streak?subject=computer-science&timezone=Europe/London') as NextRequest;
    const getResponse = await streakGet(getRequest);
    expect(getResponse.status).toBe(200);

    const postRequest = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'use_freeze', subject: 'overall', timezone: 'Europe/London' }),
    }) as NextRequest;
    const postResponse = await streakPost(postRequest);
    const payload = await postResponse.json();
    expect(payload.success).toBe(true);
  });

  it('returns streaks for all subjects when no subject is provided', async () => {
    getStreakStatus.mockResolvedValue({ currentStreak: 1, freezeDays: 0, maxFreezes: 0, streakActive: false, lastActivityDate: null, daysUntilStreakLoss: 0, frozeToday: false });
    checkAndApplyFreeze.mockResolvedValue({ streak: { currentStreak: 1, freezeDays: 0 }, frozeApplied: false, missedDays: 0 });

    const request = new Request('http://localhost/api/streak?timezone=Europe/London') as NextRequest;
    const response = await streakGet(request);
    const payload = await response.json();
    expect(payload.overallStreak).toBeDefined();
  });

  it('returns overall streak without recording subject activity', async () => {
    getStreakStatus.mockResolvedValue({ currentStreak: 1, freezeDays: 0, maxFreezes: 0, streakActive: true, lastActivityDate: null, daysUntilStreakLoss: 0, frozeToday: false });
    checkAndApplyFreeze.mockResolvedValue({ streak: { currentStreak: 1, freezeDays: 0 }, frozeApplied: false, missedDays: 0 });

    const request = new Request('http://localhost/api/streak?subject=overall') as NextRequest;
    await streakGet(request);
    expect(recordActivity).not.toHaveBeenCalled();
  });

  it('rejects streak requests when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const request = new Request('http://localhost/api/streak?subject=overall') as NextRequest;
    const response = await streakGet(request);
    expect(response.status).toBe(401);
  });

  it('rejects streak with invalid subject', async () => {
    const request = new Request('http://localhost/api/streak?subject=bad') as NextRequest;
    const response = await streakGet(request);
    expect(response.status).toBe(400);
  });

  it('rejects streak actions when unauthenticated', async () => {
    getSessionFromRequest.mockResolvedValue(null);
    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'use_freeze', subject: 'overall' }),
    }) as NextRequest;
    const response = await streakPost(request);
    expect(response.status).toBe(401);
  });

  it('rejects use_freeze when subject is not overall', async () => {
    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'use_freeze', subject: 'biology' }),
    }) as NextRequest;
    const response = await streakPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects update_timezone without timezone', async () => {
    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_timezone', subject: 'computer-science' }),
    }) as NextRequest;
    const response = await streakPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects update_timezone with invalid subject', async () => {
    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_timezone', subject: 'invalid', timezone: 'Europe/London' }),
    }) as NextRequest;
    const response = await streakPost(request);
    expect(response.status).toBe(400);
  });

  it('updates timezone for valid subjects', async () => {
    updateTimezone.mockResolvedValue(undefined);
    getStreakStatus.mockResolvedValue({ currentStreak: 1, freezeDays: 0, maxFreezes: 0, streakActive: true, lastActivityDate: null, daysUntilStreakLoss: 0, frozeToday: false });

    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'update_timezone', subject: 'computer-science', timezone: 'Europe/London' }),
    }) as NextRequest;
    const response = await streakPost(request);
    const payload = await response.json();
    expect(payload.success).toBe(true);
  });

  it('defaults timezone when use_freeze omits it', async () => {
    useFreeze.mockResolvedValue({ success: true, message: 'ok', streak: { currentStreak: 1, freezeDays: 0 } });

    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'use_freeze', subject: 'overall' }),
    }) as NextRequest;
    await streakPost(request);
    expect(useFreeze.mock.calls[0][2]).toBe('Europe/London');
  });

  it('rejects unknown streak actions', async () => {
    const request = new Request('http://localhost/api/streak', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'unknown' }),
    }) as NextRequest;
    const response = await streakPost(request);
    expect(response.status).toBe(400);
  });

  it('returns admin preview', async () => {
    generateTomorrowPreview.mockResolvedValue({
      date: '2026-02-06',
      subject: 'computer-science',
      questions: [
        { id: 'q1', stem: 'Q', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', notes: '', difficulty: 1 },
      ],
    });

    const request = new Request('http://localhost/api/admin/preview?subject=computer-science') as NextRequest;
    const response = await adminPreviewGet(request);
    const payload = await response.json();
    expect(payload.subject).toBe('computer-science');
  });

  it('rejects admin preview without subject', async () => {
    const request = new Request('http://localhost/api/admin/preview') as NextRequest;
    const response = await adminPreviewGet(request);
    expect(response.status).toBe(400);
  });

  it('handles admin questions CRUD', async () => {
    getAllQuestions.mockResolvedValue([{ id: 'q1' }]);
    addQuestion.mockResolvedValue('q1');
    bulkImportQuestions.mockResolvedValue(1);
    getQuestionById.mockResolvedValue({ id: 'q1' });

    const getReq = new Request('http://localhost/api/admin/questions') as NextRequest;
    const getRes = await adminQuestionsGet(getReq);
    expect((await getRes.json()).questions).toHaveLength(1);

    const postReq = new Request('http://localhost/api/admin/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questions: [
        { stem: 'Q', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1 },
      ] }),
    }) as NextRequest;
    const postRes = await adminQuestionsPost(postReq);
    expect((await postRes.json()).imported).toBe(1);

    const params = { params: Promise.resolve({ id: 'q1' }) };
    const getIdRes = await adminQuestionGet(getReq, params);
    expect((await getIdRes.json()).question.id).toBe('q1');

    const putReq = new Request('http://localhost/api/admin/questions/q1', { method: 'PUT', body: JSON.stringify({ stem: 'Updated' }) }) as NextRequest;
    await adminQuestionPut(putReq, params);
    expect(updateQuestion).toHaveBeenCalled();

    const deleteReq = new Request('http://localhost/api/admin/questions/q1', { method: 'DELETE' }) as NextRequest;
    await adminQuestionDelete(deleteReq, params);
    expect(deleteQuestion).toHaveBeenCalled();
  });

  it('rejects admin questions with invalid subject', async () => {
    const request = new Request('http://localhost/api/admin/questions?subject=bad') as NextRequest;
    const response = await adminQuestionsGet(request);
    expect(response.status).toBe(400);
  });

  it('rejects admin question create with missing fields', async () => {
    const request = new Request('http://localhost/api/admin/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject: 'computer-science' }),
    }) as NextRequest;
    const response = await adminQuestionsPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects admin question create with invalid options length', async () => {
    const request = new Request('http://localhost/api/admin/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stem: 'Q',
        options: ['1', '2'],
        correctIndex: 0,
        explanation: 'E',
        topic: 'CPU',
        subject: 'computer-science',
        difficulty: 1,
      }),
    }) as NextRequest;
    const response = await adminQuestionsPost(request);
    expect(response.status).toBe(400);
  });

  it('rejects admin question create with invalid correct index', async () => {
    const request = new Request('http://localhost/api/admin/questions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stem: 'Q',
        options: ['1', '2', '3', '4'],
        correctIndex: 9,
        explanation: 'E',
        topic: 'CPU',
        subject: 'computer-science',
        difficulty: 1,
      }),
    }) as NextRequest;
    const response = await adminQuestionsPost(request);
    expect(response.status).toBe(400);
  });

  it('returns admin results', async () => {
    getAllAttempts.mockResolvedValue([
      { date: '2026-02-05', userLabel: 'User', score: 5, submittedAt: new Date() },
    ]);
    const request = new Request('http://localhost/api/admin/results') as NextRequest;
    const response = await adminResultsGet(request);
    const payload = await response.json();
    expect(payload.totalAttempts).toBe(1);
  });

  it('returns admin results for a date range with unknown users', async () => {
    getAttemptsByDateRange.mockResolvedValue([
      {
        date: '2026-02-05',
        score: 0,
        submittedAt: new Date('2026-02-05T10:00:00Z'),
        topicBreakdown: { CPU: { correct: 0, total: 0 } },
      },
    ]);
    const request = new Request('http://localhost/api/admin/results?startDate=2026-02-01&endDate=2026-02-05') as NextRequest;
    const response = await adminResultsGet(request);
    const payload = await response.json();
    expect(payload.byUser.Unknown).toHaveLength(1);
    expect(payload.topicStats[0].correctRate).toBe(0);
  });

  it('rejects admin results for non-admin session', async () => {
    getSessionFromRequest.mockResolvedValue({ label: 'User', isAdmin: false, iat: 0, exp: 0 });
    const request = new Request('http://localhost/api/admin/results') as NextRequest;
    const response = await adminResultsGet(request);
    expect(response.status).toBe(403);
  });

  it('returns 500 when admin results retrieval fails', async () => {
    getAllAttempts.mockRejectedValue(new Error('boom'));
    const request = new Request('http://localhost/api/admin/results') as NextRequest;
    const response = await adminResultsGet(request);
    expect(response.status).toBe(500);
  });

  it('returns admin question stats', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        get: async () => ({ docs: [{ data: () => ({ questionId: 'q1', userLabel: 'User', attempts: 1, correct: 1 }) }] }),
      }),
    });
    getQuestionsByIds.mockResolvedValue([{ id: 'q1', stem: 'Q', topic: 'CPU', difficulty: 1 }]);

    const request = new Request('http://localhost/api/admin/stats') as NextRequest;
    const response = await adminStatsGet(request);
    const payload = await response.json();
    expect(payload.questions).toHaveLength(1);
  });

  it('returns empty stats when no questions exist', async () => {
    getDb.mockReturnValue({
      collection: () => ({ get: async () => ({ docs: [] }) }),
    });
    const request = new Request('http://localhost/api/admin/stats') as NextRequest;
    const response = await adminStatsGet(request);
    const payload = await response.json();
    expect(payload.questions).toHaveLength(0);
  });

  it('runs account deletion job with cron secret', async () => {
    process.env.CRON_SECRET = 'secret';
    runAccountDeletionJob.mockResolvedValue({ processed: 1, deleted: 1, errors: 0 });

    const request = new Request('http://localhost/api/admin/account-deletion/run', {
      method: 'POST',
      headers: { 'x-cron-secret': 'secret' },
    }) as NextRequest;
    const response = await adminDeletionPost(request);
    const payload = await response.json();
    expect(payload.deleted).toBe(1);
  });

  it('rejects account deletion job without secret', async () => {
    process.env.CRON_SECRET = 'secret';
    const request = new Request('http://localhost/api/admin/account-deletion/run', { method: 'POST' }) as NextRequest;
    const response = await adminDeletionPost(request);
    expect(response.status).toBe(401);
  });
});
