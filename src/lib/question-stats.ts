import { getDb, COLLECTIONS } from './firebase';
import { QuestionStats } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Generate document ID for question stats (composite key)
 */
function getStatsDocId(questionId: string, userLabel: string): string {
  return `${questionId}_${userLabel}`;
}

/**
 * Record a question attempt for a user
 */
export async function recordQuestionAttempt(
  questionId: string,
  userLabel: string,
  isCorrect: boolean
): Promise<void> {
  const db = getDb();
  const docId = getStatsDocId(questionId, userLabel);
  const docRef = db.collection(COLLECTIONS.QUESTION_STATS).doc(docId);

  await docRef.set(
    {
      questionId,
      userLabel,
      attempts: FieldValue.increment(1),
      correct: FieldValue.increment(isCorrect ? 1 : 0),
      lastAttemptedAt: new Date(),
    },
    { merge: true }
  );
}

/**
 * Record multiple question attempts (batch operation)
 */
export async function recordQuestionAttempts(
  attempts: { questionId: string; userLabel: string; isCorrect: boolean }[]
): Promise<void> {
  const db = getDb();
  const batch = db.batch();

  for (const attempt of attempts) {
    const docId = getStatsDocId(attempt.questionId, attempt.userLabel);
    const docRef = db.collection(COLLECTIONS.QUESTION_STATS).doc(docId);

    batch.set(
      docRef,
      {
        questionId: attempt.questionId,
        userLabel: attempt.userLabel,
        attempts: FieldValue.increment(1),
        correct: FieldValue.increment(attempt.isCorrect ? 1 : 0),
        lastAttemptedAt: new Date(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}

/**
 * Get question stats for a specific user
 */
export async function getQuestionStatsForUser(
  userLabel: string
): Promise<QuestionStats[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.QUESTION_STATS)
    .where('userLabel', '==', userLabel)
    .get();

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    lastAttemptedAt: doc.data().lastAttemptedAt?.toDate() || new Date(),
  })) as QuestionStats[];
}

/**
 * Get stats for a specific question across all users
 */
export async function getStatsForQuestion(
  questionId: string
): Promise<QuestionStats[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.QUESTION_STATS)
    .where('questionId', '==', questionId)
    .get();

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    lastAttemptedAt: doc.data().lastAttemptedAt?.toDate() || new Date(),
  })) as QuestionStats[];
}

/**
 * Get aggregated stats for a question (total attempts and correct across all users)
 */
export async function getAggregatedQuestionStats(
  questionId: string
): Promise<{ totalAttempts: number; totalCorrect: number; successRate: number }> {
  const stats = await getStatsForQuestion(questionId);

  const totalAttempts = stats.reduce((sum, s) => sum + s.attempts, 0);
  const totalCorrect = stats.reduce((sum, s) => sum + s.correct, 0);
  const successRate = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  return { totalAttempts, totalCorrect, successRate };
}

/**
 * Get a user's stats for a specific question
 */
export async function getUserQuestionStats(
  questionId: string,
  userLabel: string
): Promise<QuestionStats | null> {
  const db = getDb();
  const docId = getStatsDocId(questionId, userLabel);
  const doc = await db.collection(COLLECTIONS.QUESTION_STATS).doc(docId).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    ...data,
    lastAttemptedAt: data.lastAttemptedAt?.toDate() || new Date(),
  } as QuestionStats;
}
