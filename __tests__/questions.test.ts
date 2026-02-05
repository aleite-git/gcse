import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createFirestoreMock, COLLECTIONS } from './helpers/firestore';
import { getTodayLondon } from '@/lib/date';
import type { QuestionInput } from '@/types';

const getDb = jest.fn();

jest.unstable_mockModule('@/lib/firebase', () => ({
  getDb,
  COLLECTIONS,
}));

let getQuestionsByIds: typeof import('@/lib/questions').getQuestionsByIds;
let bulkImportQuestions: typeof import('@/lib/questions').bulkImportQuestions;
let selectQuizQuestions: typeof import('@/lib/questions').selectQuizQuestions;
let getQuestionById: typeof import('@/lib/questions').getQuestionById;
let addQuestion: typeof import('@/lib/questions').addQuestion;
let getAllQuestions: typeof import('@/lib/questions').getAllQuestions;

beforeAll(async () => {
  ({
    getQuestionsByIds,
    bulkImportQuestions,
    selectQuizQuestions,
    getQuestionById,
    addQuestion,
    getAllQuestions,
  } = await import('@/lib/questions'));
});

beforeEach(() => {
  getDb.mockReset();
});

describe('questions lib', () => {
  const ts = (value: Date) => ({ toDate: () => value });

  it('returns questions in input order', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        a1: { stem: 'A', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        b2: { stem: 'B', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'RAM_ROM', subject: 'computer-science', difficulty: 2, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const result = await getQuestionsByIds(['b2', 'a1']);
    expect(result.map((q) => q.id)).toEqual(['b2', 'a1']);
  });

  it('returns an empty list when no ids are provided', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const result = await getQuestionsByIds([]);
    expect(result).toEqual([]);
  });

  it('returns null when a question is missing', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const result = await getQuestionById('missing');
    expect(result).toBeNull();
  });

  it('resolves createdAt values without Firestore timestamps', async () => {
    const createdAt = new Date('2026-02-05T00:00:00Z');
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: {
          stem: 'Q',
          options: ['1', '2', '3', '4'],
          correctIndex: 0,
          explanation: 'E',
          topic: 'CPU',
          subject: 'computer-science',
          difficulty: 1,
          active: true,
          createdAt,
        },
      },
    });
    getDb.mockReturnValue(db);

    const question = await getQuestionById('q1');
    expect(question?.createdAt).toBeInstanceOf(Date);
  });

  it('uses a fallback createdAt when missing', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: {
          stem: 'Q',
          options: ['1', '2', '3', '4'],
          correctIndex: 0,
          explanation: 'E',
          topic: 'CPU',
          subject: 'computer-science',
          difficulty: 1,
          active: true,
        },
      },
    });
    getDb.mockReturnValue(db);

    const question = await getQuestionById('q1');
    expect(question?.createdAt).toBeInstanceOf(Date);
  });

  it('returns all active questions when no subject is provided', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'A', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'B', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CellBiology', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const { getActiveQuestions } = await import('@/lib/questions');
    const all = await getActiveQuestions();
    expect(all).toHaveLength(2);
  });

  it('bulk imports questions in batches >500', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const questions: QuestionInput[] = Array.from({ length: 501 }, (_, i) => ({
      stem: `Q${i}`,
      options: ['1', '2', '3', '4'],
      correctIndex: 0,
      explanation: 'E',
      topic: 'CPU',
      subject: 'computer-science',
      difficulty: 1,
    }));

    const count = await bulkImportQuestions(questions);
    expect(count).toBe(501);

    const snapshot = await db.collection(COLLECTIONS.QUESTIONS).get();
    expect(snapshot.size).toBe(501);
  });

  it('bulk imports zero questions without committing', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const count = await bulkImportQuestions([]);
    expect(count).toBe(0);
  });

  it('selects 6 questions even without hard questions', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CellBiology', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'Q2', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'Organisation', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q3: { stem: 'Q3', options: ['1','2','3','4'], correctIndex: 2, explanation: 'E', topic: 'Infection', subject: 'biology', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q4: { stem: 'Q4', options: ['1','2','3','4'], correctIndex: 3, explanation: 'E', topic: 'Bioenergetics', subject: 'biology', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q5: { stem: 'Q5', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Homeostasis', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q6: { stem: 'Q6', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'Inheritance', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-biology`]: { date: today, subject: 'biology', quizVersion: 1, generatedAt: ts(new Date()), questionIds: ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] },
      },
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('biology');
    expect(selected).toHaveLength(6);
    expect(selected.some((q) => q.difficulty === 3)).toBe(false);

    const ids = new Set(selected.map((q) => q.id));
    expect(ids.size).toBe(6);
  });

  it('returns fewer than 6 when not enough questions exist', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CellBiology', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'Q2', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'Organisation', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q3: { stem: 'Q3', options: ['1','2','3','4'], correctIndex: 2, explanation: 'E', topic: 'Infection', subject: 'biology', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q4: { stem: 'Q4', options: ['1','2','3','4'], correctIndex: 3, explanation: 'E', topic: 'Bioenergetics', subject: 'biology', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q5: { stem: 'Q5', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Homeostasis', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('biology');
    expect(selected).toHaveLength(5);
  });

  it('fills regular slots from any non-hard questions when mediums are unavailable', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'Q2', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q3: { stem: 'Q3', options: ['1','2','3','4'], correctIndex: 2, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q4: { stem: 'Q4', options: ['1','2','3','4'], correctIndex: 3, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q5: { stem: 'Q5', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q6: { stem: 'Q6', options: ['1','2','3','4'], correctIndex: 1, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 3, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('biology');
    expect(selected).toHaveLength(6);
    expect(selected.filter((q) => q.difficulty === 3)).toHaveLength(1);
  });

  it('uses a previously used hard question when no fresh hard questions exist', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        hard1: { stem: 'H', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Hard', subject: 'biology', difficulty: 3, active: true, createdAt: ts(new Date()) },
        e1: { stem: 'E1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        e2: { stem: 'E2', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        e3: { stem: 'E3', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        e4: { stem: 'E4', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
        e5: { stem: 'E5', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Core', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('biology', new Set(['hard1']));
    expect(selected.some((q) => q.id === 'hard1')).toBe(true);
  });

  it('filters active questions by subject', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        a1: { stem: 'A', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        b1: { stem: 'B', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CellBiology', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const { getActiveQuestions } = await import('@/lib/questions');
    const cs = await getActiveQuestions('computer-science');
    expect(cs).toHaveLength(1);
    expect(cs[0].subject).toBe('computer-science');
  });

  it('updates and soft-deletes a question', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const { updateQuestion, deleteQuestion, getQuestionById } = await import('@/lib/questions');
    await updateQuestion('q1', { stem: 'Updated' });
    const updated = await getQuestionById('q1');
    expect(updated?.stem).toBe('Updated');

    await deleteQuestion('q1');
    const afterDelete = await getQuestionById('q1');
    expect(afterDelete?.active).toBe(false);
  });

  it('collects recently used question ids from assignments and attempts', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-biology`]: {
          date: today,
          subject: 'biology',
          quizVersion: 1,
          generatedAt: ts(new Date()),
          questionIds: ['q1', 'q2'],
        },
      },
      [COLLECTIONS.ATTEMPTS]: {
        attempt1: {
          date: today,
          subject: 'biology',
          questionIds: ['q3'],
        },
      },
    });
    getDb.mockReturnValue(db);

    const { getRecentlyUsedQuestionIds } = await import('@/lib/questions');
    const ids = await getRecentlyUsedQuestionIds(1, 'biology');
    expect(ids.has('q1')).toBe(true);
    expect(ids.has('q3')).toBe(true);
  });

  it('skips missing question ids when collecting recently used ids', async () => {
    const today = getTodayLondon();
    const { db } = createFirestoreMock({
      [COLLECTIONS.DAILY_ASSIGNMENTS]: {
        [`${today}-biology`]: {
          date: today,
          subject: 'biology',
          quizVersion: 1,
          generatedAt: ts(new Date()),
        },
      },
      [COLLECTIONS.ATTEMPTS]: {
        attempt1: {
          date: today,
          subject: 'biology',
        },
      },
    });
    getDb.mockReturnValue(db);

    const { getRecentlyUsedQuestionIds } = await import('@/lib/questions');
    const ids = await getRecentlyUsedQuestionIds(1, 'biology');
    expect(ids.size).toBe(0);
  });

  it('uses hard question when available', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'Q2', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'RAM_ROM', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q3: { stem: 'Q3', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Storage', subject: 'computer-science', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q4: { stem: 'Q4', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'OS', subject: 'computer-science', difficulty: 2, active: true, createdAt: ts(new Date()) },
        q5: { stem: 'Q5', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Security', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q6: { stem: 'Q6', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'Protocols', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q7: { stem: 'Q7', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 3, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('computer-science');
    expect(selected).toHaveLength(6);
    expect(selected.some((q) => q.difficulty === 3)).toBe(true);
  });

  it('adds and fetches questions for admin lists', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const id = await addQuestion({
      stem: 'Stem',
      options: ['1', '2', '3', '4'],
      correctIndex: 0,
      explanation: 'E',
      topic: 'CPU',
      subject: 'computer-science',
      difficulty: 1,
      active: false,
    });

    const questions = await getAllQuestions();
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(id);
  });

  it('filters admin questions by subject', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {
        q1: { stem: 'Q1', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CPU', subject: 'computer-science', difficulty: 1, active: true, createdAt: ts(new Date()) },
        q2: { stem: 'Q2', options: ['1','2','3','4'], correctIndex: 0, explanation: 'E', topic: 'CellBiology', subject: 'biology', difficulty: 1, active: true, createdAt: ts(new Date()) },
      },
    });
    getDb.mockReturnValue(db);

    const questions = await getAllQuestions('biology');
    expect(questions).toHaveLength(1);
    expect(questions[0].subject).toBe('biology');
  });

  it('returns empty when no active questions exist', async () => {
    const { db } = createFirestoreMock({
      [COLLECTIONS.QUESTIONS]: {},
    });
    getDb.mockReturnValue(db);

    const selected = await selectQuizQuestions('chemistry');
    expect(selected).toEqual([]);
  });

  it('defaults new questions to active when not specified', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    const id = await addQuestion({
      stem: 'Stem',
      options: ['1', '2', '3', '4'],
      correctIndex: 0,
      explanation: 'E',
      topic: 'CPU',
      subject: 'computer-science',
      difficulty: 1,
    });

    const stored = await getQuestionById(id);
    expect(stored?.active).toBe(true);
  });

  it('preserves inactive flags during bulk import', async () => {
    const { db } = createFirestoreMock();
    getDb.mockReturnValue(db);

    await bulkImportQuestions([
      {
        stem: 'Inactive',
        options: ['1', '2', '3', '4'],
        correctIndex: 0,
        explanation: 'E',
        topic: 'CPU',
        subject: 'computer-science',
        difficulty: 1,
        active: false,
      },
    ]);

    const snapshot = await db.collection(COLLECTIONS.QUESTIONS).get();
    const first = snapshot.docs[0].data();
    expect(first.active).toBe(false);
  });
});
