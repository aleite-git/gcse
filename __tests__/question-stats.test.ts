import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS, makeIncrement } from './helpers/firestore';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (value: number) => makeIncrement(value),
  },
}));

let recordQuestionAttempt: typeof import('@/lib/question-stats').recordQuestionAttempt;
let recordQuestionAttempts: typeof import('@/lib/question-stats').recordQuestionAttempts;
let getQuestionStatsForUser: typeof import('@/lib/question-stats').getQuestionStatsForUser;
let getStatsForQuestion: typeof import('@/lib/question-stats').getStatsForQuestion;
let getAggregatedQuestionStats: typeof import('@/lib/question-stats').getAggregatedQuestionStats;
let getUserQuestionStats: typeof import('@/lib/question-stats').getUserQuestionStats;

beforeAll(async () => {
  ({
    recordQuestionAttempt,
    recordQuestionAttempts,
    getQuestionStatsForUser,
    getStatsForQuestion,
    getAggregatedQuestionStats,
    getUserQuestionStats,
  } = await import('@/lib/question-stats'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('question stats', () => {
  const ts = (value: Date) => ({ toDate: () => value });

  it('records a single question attempt with increments', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    await recordQuestionAttempt('q1', 'user1', true);
    const snapshot = await db.collection(COLLECTIONS.QUESTION_STATS).doc('q1_user1').get();
    const data = snapshot.data();

    expect(snapshot.exists).toBe(true);
    expect(data?.attempts).toBe(1);
    expect(data?.correct).toBe(1);
    expect(data?.questionId).toBe('q1');
    expect(data?.userLabel).toBe('user1');
  });

  it('records incorrect attempts with zero correct increment', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    await recordQuestionAttempt('q2', 'user2', false);
    const snapshot = await db.collection(COLLECTIONS.QUESTION_STATS).doc('q2_user2').get();
    const data = snapshot.data();

    expect(data?.attempts).toBe(1);
    expect(data?.correct).toBe(0);
  });

  it('records multiple question attempts in a batch', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    await recordQuestionAttempts([
      { questionId: 'q1', userLabel: 'user1', isCorrect: true },
      { questionId: 'q2', userLabel: 'user1', isCorrect: false },
    ]);

    const q1 = await db.collection(COLLECTIONS.QUESTION_STATS).doc('q1_user1').get();
    const q2 = await db.collection(COLLECTIONS.QUESTION_STATS).doc('q2_user1').get();

    expect(q1.data()?.attempts).toBe(1);
    expect(q1.data()?.correct).toBe(1);
    expect(q2.data()?.attempts).toBe(1);
    expect(q2.data()?.correct).toBe(0);
  });

  it('fetches stats for a user and aggregates for a question', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTION_STATS]: {
        'q1_user1': { questionId: 'q1', userLabel: 'user1', attempts: 2, correct: 1, lastAttemptedAt: ts(new Date()) },
        'q1_user2': { questionId: 'q1', userLabel: 'user2', attempts: 3, correct: 3, lastAttemptedAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const userStats = await getQuestionStatsForUser('user1');
    expect(userStats).toHaveLength(1);
    expect(userStats[0].questionId).toBe('q1');

    const questionStats = await getStatsForQuestion('q1');
    expect(questionStats).toHaveLength(2);

    const aggregate = await getAggregatedQuestionStats('q1');
    expect(aggregate.totalAttempts).toBe(5);
    expect(aggregate.totalCorrect).toBe(4);
    expect(aggregate.successRate).toBeCloseTo(0.8, 5);
  });

  it('returns zero success rate when no stats exist', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const aggregate = await getAggregatedQuestionStats('missing');
    expect(aggregate.totalAttempts).toBe(0);
    expect(aggregate.successRate).toBe(0);
  });

  it('gets a user question stat by composite id', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTION_STATS]: {
        'q9_user9': { questionId: 'q9', userLabel: 'user9', attempts: 1, correct: 0, lastAttemptedAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const stat = await getUserQuestionStats('q9', 'user9');
    expect(stat?.questionId).toBe('q9');
    expect(stat?.attempts).toBe(1);
  });

  it('uses fallback timestamps when lastAttemptedAt is missing', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTION_STATS]: {
        'q10_user10': { questionId: 'q10', userLabel: 'user10', attempts: 1, correct: 1 },
      },
    });
    getDb.mockReturnValue(db);

    const stats = await getQuestionStatsForUser('user10');
    expect(stats[0].lastAttemptedAt).toBeInstanceOf(Date);

    const questionStats = await getStatsForQuestion('q10');
    expect(questionStats[0].lastAttemptedAt).toBeInstanceOf(Date);

    const userStat = await getUserQuestionStats('q10', 'user10');
    expect(userStat?.lastAttemptedAt).toBeInstanceOf(Date);
  });

  it('returns null when no user question stat exists', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const stat = await getUserQuestionStats('missing', 'user');
    expect(stat).toBeNull();
  });
});
