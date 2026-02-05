import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';
import { getTodayLondon, getTomorrowLondon } from '@/lib/date';
import type { Question } from '@/types';

const getDb = jest.fn();
const selectQuizQuestions = jest.fn();
const getQuestionsByIds = jest.fn();
const recordQuestionAttempts = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

jest.unstable_mockModule('@/lib/questions', () => ({
  selectQuizQuestions,
  getQuestionsByIds,
}));

jest.unstable_mockModule('@/lib/questionStats', () => ({
  recordQuestionAttempts,
}));

let getOrCreateDailyAssignment: typeof import('@/lib/quiz').getOrCreateDailyAssignment;
let generateNewQuizVersion: typeof import('@/lib/quiz').generateNewQuizVersion;
let generateTomorrowPreview: typeof import('@/lib/quiz').generateTomorrowPreview;
let getProgressSummary: typeof import('@/lib/quiz').getProgressSummary;
let submitQuizAttempt: typeof import('@/lib/quiz').submitQuizAttempt;
let getAttemptById: typeof import('@/lib/quiz').getAttemptById;
let getTodayAttempts: typeof import('@/lib/quiz').getTodayAttempts;
let getAllAttempts: typeof import('@/lib/quiz').getAllAttempts;
let getAttemptsByDateRange: typeof import('@/lib/quiz').getAttemptsByDateRange;
let hasAttemptedToday: typeof import('@/lib/quiz').hasAttemptedToday;
let getTodayQuiz: typeof import('@/lib/quiz').getTodayQuiz;

const baseQuestion = (id: string, difficulty: 1 | 2 | 3): Question => ({
  id,
  stem: `Q-${id}`,
  options: ['1', '2', '3', '4'],
  correctIndex: 0,
  explanation: 'E',
  topic: 'CPU',
  subject: 'computer-science',
  difficulty,
  active: true,
  createdAt: new Date(),
});

beforeAll(async () => {
  ({
    getOrCreateDailyAssignment,
    generateNewQuizVersion,
    generateTomorrowPreview,
    getProgressSummary,
    submitQuizAttempt,
    getAttemptById,
    getTodayAttempts,
    getAllAttempts,
    getAttemptsByDateRange,
    hasAttemptedToday,
    getTodayQuiz,
  } = await import('@/lib/quiz'));
});

beforeEach(() => {
  getDb.mockReset();
  selectQuizQuestions.mockReset();
  getQuestionsByIds.mockReset();
  recordQuestionAttempts.mockReset();
});

describe('quiz lib', () => {
  const ts = (value: Date) => ({ toDate: () => value });

  it('creates a daily assignment when missing', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);
    const questions = [baseQuestion('q1', 1), baseQuestion('q2', 2), baseQuestion('q3', 3)];
    selectQuizQuestions.mockResolvedValue(questions);

    const assignment = await getOrCreateDailyAssignment('computer-science');
    expect(assignment.questionIds).toEqual(['q1', 'q2', 'q3']);

    const stored = await db
      .collection(COLLECTIONS.DAILY_ASSIGNMENTS)
      .doc(`${getTodayLondon()}-computer-science`)
      .get();
    expect(stored.exists).toBe(true);
  });

  it('returns today quiz details with questions', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 2,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2'],
        },
      },
    });
    getDb.mockReturnValue(db);
    const questions = [baseQuestion('q1', 1), baseQuestion('q2', 2)];
    getQuestionsByIds.mockResolvedValue(questions);

    const todayQuiz = await getTodayQuiz('computer-science');
    expect(todayQuiz.quizVersion).toBe(2);
    expect(todayQuiz.questions).toHaveLength(2);
  });

  it('returns existing daily assignment when present', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 2,
          generatedAt: ts(new Date()),
          questionIds: ['a', 'b'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const assignment = await getOrCreateDailyAssignment('computer-science');
    expect(assignment.quizVersion).toBe(2);
    expect(selectQuizQuestions).not.toHaveBeenCalled();
  });

  it('uses a fallback generatedAt when stored data is missing', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          questionIds: ['a'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const assignment = await getOrCreateDailyAssignment('computer-science');
    expect(assignment.generatedAt).toBeInstanceOf(Date);
  });

  it('generates a new quiz version for retry', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: new Date(),
          questionIds: ['q1', 'q2'],
        },
      },
      [COLLECTIONS.ATTEMPTS]: {},
    });
    getDb.mockReturnValue(db);
    selectQuizQuestions.mockResolvedValue([baseQuestion('q3', 1), baseQuestion('q4', 2)]);

    const next = await generateNewQuizVersion('computer-science');
    expect(next.quizVersion).toBe(2);
    expect(next.questions.map((q) => q.id)).toEqual(['q3', 'q4']);
  });

  it('creates version 1 when no assignment exists yet', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.ATTEMPTS]: {
        attempt1: {
          date: getTodayLondon(),
          subject: 'computer-science',
        },
      },
    });
    getDb.mockReturnValue(db);
    selectQuizQuestions.mockResolvedValue([baseQuestion('q1', 1)]);

    const next = await generateNewQuizVersion('computer-science');
    expect(next.quizVersion).toBe(1);
  });

  it('includes today attempt questions when generating a retry quiz', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: new Date(),
          questionIds: ['q1', 'q2'],
        },
      },
      [COLLECTIONS.ATTEMPTS]: {
        attempt1: {
          date: today,
          subject: 'computer-science',
          questionIds: ['q3'],
        },
      },
    });
    getDb.mockReturnValue(db);
    selectQuizQuestions.mockResolvedValue([baseQuestion('q4', 1)]);

    await generateNewQuizVersion('computer-science');
    const usedIds = selectQuizQuestions.mock.calls[0][1] as Set<string>;
    expect(usedIds.has('q3')).toBe(true);
    expect(usedIds.has('q1')).toBe(true);
  });

  it('generates a London-aware preview for tomorrow', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);
    const questions = [baseQuestion('q1', 1), baseQuestion('q2', 2), baseQuestion('q3', 3)];
    selectQuizQuestions.mockResolvedValue(questions);
    getQuestionsByIds.mockResolvedValue(questions);

    const preview = await generateTomorrowPreview('computer-science');
    expect(preview.date).toBe(getTomorrowLondon());

    const stored = await db
      .collection(COLLECTIONS.DAILY_ASSIGNMENTS)
      .doc(`${getTomorrowLondon()}-computer-science`)
      .get();
    expect(stored.exists).toBe(true);
  });

  it('returns existing preview when tomorrow assignment already exists', async () => {
    const tomorrow = getTomorrowLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${tomorrow}-computer-science`]: {
          date: tomorrow,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1'],
        },
      },
    });
    getDb.mockReturnValue(db);
    getQuestionsByIds.mockResolvedValue([baseQuestion('q1', 1)]);

    const preview = await generateTomorrowPreview('computer-science');
    expect(preview.questions).toHaveLength(1);
  });

  it('excludes today questions when generating a new preview', async () => {
    const today = getTodayLondon();
    const tomorrow = getTomorrowLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2'],
        },
      },
    });
    getDb.mockReturnValue(db);
    selectQuizQuestions.mockResolvedValue([baseQuestion('q3', 1)]);

    const preview = await generateTomorrowPreview('computer-science');
    expect(preview.date).toBe(tomorrow);

    const excludeSet = selectQuizQuestions.mock.calls[0][1] as Set<string>;
    expect(excludeSet.has('q1')).toBe(true);
    expect(excludeSet.has('q2')).toBe(true);
  });

  it('computes progress summary for last N days', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.ATTEMPTS]: {
        a1: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          score: 4,
          topicBreakdown: { CPU: { correct: 1, total: 2 } },
        },
        a2: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          score: 6,
          topicBreakdown: { CPU: { correct: 2, total: 2 } },
        },
      },
    });
    getDb.mockReturnValue(db);

    const summary = await getProgressSummary('student', 'computer-science', 3);
    expect(summary.attemptedToday).toBe(true);
    expect(summary.todayBestScore).toBe(6);
    expect(summary.last7Days[0].date).toBe(today);
  });

  it('handles progress summaries with no attempts or mismatched dates', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.ATTEMPTS]: {
        a1: {
          date: `${today}-extra`,
          subject: 'computer-science',
          userLabel: 'student',
          score: 0,
        },
        a2: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          score: 0,
          topicBreakdown: { CPU: { correct: 0, total: 0 } },
        },
      },
    });
    getDb.mockReturnValue(db);

    const summary = await getProgressSummary('student', 'computer-science', 2);
    expect(summary.attemptedToday).toBe(true);
    expect(summary.todayBestScore).toBe(0);
    expect(summary.weakTopics).toHaveLength(0);
  });

  it('surfaces weak topics below the accuracy threshold', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.ATTEMPTS]: {
        a1: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          score: 2,
          topicBreakdown: {
            CPU: { correct: 1, total: 3 },
            RAM: { correct: 2, total: 2 },
          },
        },
      },
    });
    getDb.mockReturnValue(db);

    const summary = await getProgressSummary('student', 'computer-science', 3);
    expect(summary.weakTopics).toHaveLength(1);
    expect(summary.weakTopics[0].topic).toBe('CPU');
  });

  it('submits a quiz attempt and stores stats', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const questions = Array.from({ length: 6 }, (_, i) => ({
      ...baseQuestion(`q${i + 1}`, 1),
    }));
    getQuestionsByIds.mockResolvedValue(questions);

    const answers = questions.map((q) => ({ questionId: q.id, selectedIndex: 0 }));

    const result = await submitQuizAttempt('student', 'computer-science', answers, 12, '1.2.3.4');
    expect(result.attempt.score).toBe(6);
    expect(recordQuestionAttempts).toHaveBeenCalled();

    const attempts = await db.collection(COLLECTIONS.ATTEMPTS).get();
    expect(attempts.size).toBe(1);
  });

  it('submits a shorter quiz when fewer questions are assigned', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2', 'q3', 'q4'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const questions = Array.from({ length: 4 }, (_, i) => ({
      ...baseQuestion(`q${i + 1}`, 1),
    }));
    getQuestionsByIds.mockResolvedValue(questions);

    const answers = questions.map((q) => ({ questionId: q.id, selectedIndex: 0 }));

    const result = await submitQuizAttempt('student', 'computer-science', answers, 12, '1.2.3.4');
    expect(result.attempt.score).toBe(4);
    expect(recordQuestionAttempts).toHaveBeenCalled();
  });

  it('counts incorrect answers without incrementing score', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const questions = [baseQuestion('q1', 1), baseQuestion('q2', 1)];
    getQuestionsByIds.mockResolvedValue(questions);

    const answers = [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
    ];

    const result = await submitQuizAttempt('student', 'computer-science', answers, 12);
    expect(result.attempt.score).toBe(1);
  });

  it('submits with missing answers and no ip hash', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2', 'q3'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const questions = [
      baseQuestion('q1', 1),
      baseQuestion('q2', 1),
      baseQuestion('q3', 1),
    ];
    getQuestionsByIds.mockResolvedValue(questions);

    const answers = [
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q1', selectedIndex: 1 },
      { questionId: 'q2', selectedIndex: 0 },
    ];

    const result = await submitQuizAttempt('student', 'computer-science', answers, 12);
    expect(result.attempt.score).toBe(1);
    expect(result.attempt.ipHash).toBeUndefined();
  });

  it('reads attempts and attempt status helpers', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.ATTEMPTS]: {
        a1: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          attemptNumber: 1,
          submittedAt: ts(new Date()),
        },
        a2: {
          date: today,
          subject: 'computer-science',
          userLabel: 'student',
          attemptNumber: 2,
        },
      },
    });
    getDb.mockReturnValue(db);

    const todayAttempts = await getTodayAttempts('student', 'computer-science');
    expect(todayAttempts).toHaveLength(2);

    const found = await getAttemptById('a1');
    expect(found?.id).toBe('a1');

    const missing = await getAttemptById('missing');
    expect(missing).toBeNull();

    const all = await getAllAttempts();
    expect(all).toHaveLength(2);

    const range = await getAttemptsByDateRange(today, today);
    expect(range).toHaveLength(2);

    const attempted = await hasAttemptedToday('student', 'computer-science');
    expect(attempted).toBe(true);
  });

  it('rejects submit when answers are incomplete', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
        },
      },
    });
    getDb.mockReturnValue(db);
    getQuestionsByIds.mockResolvedValue([baseQuestion('q1', 1)]);

    await expect(
      submitQuizAttempt('student', 'computer-science', [{ questionId: 'q1', selectedIndex: 0 }], 5)
    ).rejects.toThrow('Must answer all 6 questions');
  });

  it('rejects submit when answers are not part of the assignment', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'],
        },
      },
    });
    getDb.mockReturnValue(db);
    getQuestionsByIds.mockResolvedValue([
      baseQuestion('q1', 1),
      baseQuestion('q2', 1),
      baseQuestion('q3', 1),
      baseQuestion('q4', 1),
      baseQuestion('q5', 1),
      baseQuestion('q6', 1),
    ]);

    const answers = [
      { questionId: 'bad1', selectedIndex: 0 },
      { questionId: 'bad2', selectedIndex: 0 },
      { questionId: 'bad3', selectedIndex: 0 },
      { questionId: 'bad4', selectedIndex: 0 },
      { questionId: 'bad5', selectedIndex: 0 },
      { questionId: 'bad6', selectedIndex: 0 },
    ];

    await expect(
      submitQuizAttempt('student', 'computer-science', answers, 5)
    ).rejects.toThrow(`Question bad1 is not part of today's quiz`);
  });

  it('rejects submit when no questions are available', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-computer-science`]: {
          date: today,
          subject: 'computer-science',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: [],
        },
      },
    });
    getDb.mockReturnValue(db);

    await expect(
      submitQuizAttempt('student', 'computer-science', [], 5)
    ).rejects.toThrow('No quiz available');
  });
});
