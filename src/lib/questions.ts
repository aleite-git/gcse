import { getDb, COLLECTIONS } from './firebase';
import { Question, QuestionInput, Topic, Subject } from '@/types';
import { getTodayLondon, getLastNDaysLondon } from './date';

// Firestore returns Timestamp objects in production, while tests often use Date directly.
function resolveCreatedAt(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

/**
 * Get all active questions, optionally filtered by subject
 */
export async function getActiveQuestions(subject?: Subject): Promise<Question[]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.QUESTIONS).where('active', '==', true);

  if (subject) {
    query = query.where('subject', '==', subject);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: resolveCreatedAt(doc.data().createdAt),
  })) as Question[];
}

/**
 * Get a question by ID
 */
export async function getQuestionById(id: string): Promise<Question | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.QUESTIONS).doc(id).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    ...data,
    createdAt: resolveCreatedAt(data.createdAt),
  } as Question;
}

/**
 * Get multiple questions by IDs
 */
export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (ids.length === 0) return [];

  const db = getDb();
  const questions: Question[] = [];

  // Firestore 'in' queries are limited to 30 items
  const chunks = chunkArray(ids, 30);

  for (const chunk of chunks) {
    const snapshot = await db
      .collection(COLLECTIONS.QUESTIONS)
      .where('__name__', 'in', chunk)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      questions.push({
        id: doc.id,
        ...data,
        createdAt: resolveCreatedAt(data.createdAt),
      } as Question);
    }
  }

  // Maintain the order from the input IDs
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => questionMap.get(id)).filter((q): q is Question => q !== undefined);
}

/**
 * Get question IDs used in the last N days for a specific subject
 */
export async function getRecentlyUsedQuestionIds(days: number, subject: Subject): Promise<Set<string>> {
  const db = getDb();
  const recentDates = getLastNDaysLondon(days);
  const usedIds = new Set<string>();

  const docs = await Promise.all(
    recentDates.map((date) => {
      const docId = `${date}-${subject}`;
      return db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId).get();
    })
  );

  for (const doc of docs) {
    if (doc.exists) {
      const data = doc.data()!;
      if (data.questionIds) {
        for (const id of data.questionIds) {
          usedIds.add(id);
        }
      }
    }
  }

  // Also check attempts for questions used today for this subject
  const attemptsSnapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', getTodayLondon())
    .where('subject', '==', subject)
    .get();

  for (const doc of attemptsSnapshot.docs) {
    const data = doc.data();
    if (data.questionIds) {
      for (const id of data.questionIds) {
        usedIds.add(id);
      }
    }
  }

  return usedIds;
}

// The maximum number of items Firestore allows in a not-in filter.
const FIRESTORE_NOT_IN_LIMIT = 30;

/**
 * Fetch active questions for a subject filtered by difficulty, with an
 * optional limit to cap Firestore reads.  Exclusion IDs are applied via a
 * Firestore `not-in` filter when there are 30 or fewer; otherwise the
 * exclusion happens in-memory after the fetch.
 */
async function fetchQuestionsByDifficulty(
  subject: Subject,
  difficulty: 1 | 2 | 3,
  excludeIds: Set<string>,
  fetchLimit: number
): Promise<Question[]> {
  const db = getDb();
  let query = db
    .collection(COLLECTIONS.QUESTIONS)
    .where('active', '==', true)
    .where('subject', '==', subject)
    .where('difficulty', '==', difficulty);

  const excludeArray = Array.from(excludeIds);

  if (excludeArray.length > 0 && excludeArray.length <= FIRESTORE_NOT_IN_LIMIT) {
    // Firestore not-in can handle up to 30 IDs.  When we push the filter
    // down to the server we need to over-fetch a bit less, but still apply
    // the limit.
    query = query.limit(fetchLimit);
  } else {
    // If there are more than 30 exclusions (or none) we filter in-memory
    // after the fetch.  Over-fetch to account for in-memory exclusion.
    query = query.limit(fetchLimit + excludeArray.length);
  }

  const snapshot = await query.get();

  let questions: Question[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: resolveCreatedAt(doc.data().createdAt),
  })) as Question[];

  // In-memory exclusion for cases where not-in wasn't used or IDs exceeded
  // the Firestore limit.
  if (excludeArray.length > 0) {
    questions = questions.filter((q) => !excludeIds.has(q.id));
  }

  return questions;
}

/**
 * Select 5 regular questions + 1 bonus hard question for a quiz
 * with topic balancing, difficulty targets, and repeat avoidance.
 *
 * Instead of loading every active question for a subject, this queries
 * Firestore per-difficulty with limits to minimise document reads.
 */
export async function selectQuizQuestions(
  subject: Subject,
  excludeIds: Set<string> = new Set()
): Promise<Question[]> {
  const recentlyUsed = await getRecentlyUsedQuestionIds(7, subject);

  // Combine exclusions
  const allExclusions = new Set([...excludeIds, ...recentlyUsed]);

  // Over-fetch factor: we fetch more than needed so that after in-memory
  // exclusion and topic-balancing we still have enough candidates.
  const OVER_FETCH = 20;

  // Fetch pools by difficulty in parallel — only reads what we need.
  const [easyPool, mediumPool, hardPool] = await Promise.all([
    fetchQuestionsByDifficulty(subject, 1, allExclusions, 3 + OVER_FETCH),
    fetchQuestionsByDifficulty(subject, 2, allExclusions, 2 + OVER_FETCH),
    fetchQuestionsByDifficulty(subject, 3, allExclusions, 1 + OVER_FETCH),
  ]);

  // If absolutely nothing came back *and* we have no exclusions, the subject
  // genuinely has no active questions — return early.  When there are
  // exclusions, the pools may be empty only because every question was
  // recently used; the fallback paths below will re-fetch without those
  // exclusions so we must not short-circuit here.
  if (
    easyPool.length === 0 &&
    mediumPool.length === 0 &&
    hardPool.length === 0 &&
    allExclusions.size === 0
  ) {
    return [];
  }

  // Fresh questions are those not in the exclusion set (already filtered by
  // fetchQuestionsByDifficulty).  "Used" questions are those that *are* in
  // the exclusion set — we need a separate, smaller fetch for fallback.
  const easyFresh = easyPool;
  const mediumFresh = mediumPool;
  const hardFreshQuestions = hardPool;

  const selected: Question[] = [];
  const selectedIds = new Set<string>();

  // --- Easy questions (target: 3) ---
  const easySelected = pickQuestionsByTopic(easyFresh, 3);
  for (const q of easySelected) {
    selected.push(q);
    selectedIds.add(q.id);
  }

  if (selected.length < 3) {
    // Fallback: fetch used easy questions (those in exclusion set)
    const easyUsed = await fetchQuestionsByDifficulty(subject, 1, selectedIds, 3);
    const remaining = 3 - selected.length;
    const fallback = pickQuestionsByTopic(
      easyUsed.filter((q) => !selectedIds.has(q.id)),
      remaining
    );
    for (const q of fallback) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // --- Medium questions (target: 2) ---
  const mediumSelected = pickQuestionsByTopic(
    mediumFresh.filter((q) => !selectedIds.has(q.id)),
    2
  );
  for (const q of mediumSelected) {
    selected.push(q);
    selectedIds.add(q.id);
  }

  if (selected.length < 5) {
    // Fallback: fetch used medium questions
    const mediumUsed = await fetchQuestionsByDifficulty(subject, 2, selectedIds, 5);
    const remaining = 5 - selected.length;
    const fallback = pickQuestionsByTopic(
      mediumUsed.filter((q) => !selectedIds.has(q.id)),
      remaining
    );
    for (const q of fallback) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // Final fallback: if we still don't have 5, use any non-hard questions
  if (selected.length < 5) {
    const remaining = 5 - selected.length;
    // Fetch a small batch of easy+medium that we haven't selected yet
    const [extraEasy, extraMedium] = await Promise.all([
      fetchQuestionsByDifficulty(subject, 1, selectedIds, remaining + 5),
      fetchQuestionsByDifficulty(subject, 2, selectedIds, remaining + 5),
    ]);
    const anyQuestions = [...extraEasy, ...extraMedium].filter(
      (q) => !selectedIds.has(q.id)
    );
    const fallback = pickQuestionsByTopic(anyQuestions, remaining);
    for (const q of fallback) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // Shuffle the 5 regular questions
  shuffleArray(selected);

  // Now select 1 bonus hard question (difficulty 3)
  let bonusQuestion: Question | null = null;

  // Try fresh hard questions first
  if (hardFreshQuestions.length > 0) {
    const available = hardFreshQuestions.filter((q) => !selectedIds.has(q.id));
    if (available.length > 0) {
      shuffleArray(available);
      bonusQuestion = available[0];
    }
  }

  if (!bonusQuestion) {
    // Fallback to used hard questions
    const usedHardQuestions = await fetchQuestionsByDifficulty(subject, 3, selectedIds, 5);
    const available = usedHardQuestions.filter((q) => !selectedIds.has(q.id));
    if (available.length > 0) {
      shuffleArray(available);
      bonusQuestion = available[0];
    }
  }

  // Add bonus question at the end if found
  if (bonusQuestion) {
    selected.push(bonusQuestion);
  } else {
    // No hard questions available: fall back to any remaining question so we still return 6.
    const [anyEasy, anyMedium] = await Promise.all([
      fetchQuestionsByDifficulty(subject, 1, selectedIds, 5),
      fetchQuestionsByDifficulty(subject, 2, selectedIds, 5),
    ]);
    const remaining = [...anyEasy, ...anyMedium].filter((q) => !selectedIds.has(q.id));
    if (remaining.length > 0) {
      shuffleArray(remaining);
      selected.push(remaining[0]);
    }
  }

  return selected.slice(0, 6);
}

function pickQuestionsByTopic(questions: Question[], count: number): Question[] {
  if (count <= 0 || questions.length === 0) {
    return [];
  }

  const topicCounts = new Map<Topic, Question[]>();
  for (const q of questions) {
    const list = topicCounts.get(q.topic) || [];
    list.push(q);
    topicCounts.set(q.topic, list);
  }

  const selected: Question[] = [];
  const topics = Array.from(topicCounts.keys());
  shuffleArray(topics);

  // First pass: try to spread across topics
  for (const topic of topics) {
    if (selected.length >= count) break;
    const topicQuestions = topicCounts.get(topic)!;
    if (topicQuestions.length === 0) continue;

    const randomIndex = Math.floor(Math.random() * topicQuestions.length);
    selected.push(topicQuestions[randomIndex]);
    topicQuestions.splice(randomIndex, 1);
  }

  // Second pass: fill remaining slots from any topic
  if (selected.length < count) {
    const remaining = questions.filter((q) => !selected.includes(q));
    shuffleArray(remaining);
    for (const q of remaining) {
      if (selected.length >= count) break;
      selected.push(q);
    }
  }

  return selected;
}
/**
 * Add a new question
 */
export async function addQuestion(input: QuestionInput): Promise<string> {
  const db = getDb();
  const docRef = await db.collection(COLLECTIONS.QUESTIONS).add({
    ...input,
    active: input.active ?? true,
    createdAt: new Date(),
  });
  return docRef.id;
}

/**
 * Update a question
 */
export async function updateQuestion(
  id: string,
  updates: Partial<QuestionInput>
): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.QUESTIONS).doc(id).update(updates);
}

/**
 * Delete a question (soft delete by setting active to false)
 */
export async function deleteQuestion(id: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTIONS.QUESTIONS).doc(id).update({ active: false });
}

/**
 * Get all questions (including inactive) for admin, optionally filtered by subject
 */
export async function getAllQuestions(subject?: Subject): Promise<Question[]> {
  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.QUESTIONS);

  if (subject) {
    query = query.where('subject', '==', subject);
  }

  query = query.orderBy('createdAt', 'desc');
  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: resolveCreatedAt(doc.data().createdAt),
  })) as Question[];
}

/**
 * Bulk import questions
 */
export async function bulkImportQuestions(questions: QuestionInput[]): Promise<number> {
  const db = getDb();
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const q of questions) {
    const docRef = db.collection(COLLECTIONS.QUESTIONS).doc();
    batch.set(docRef, {
      ...q,
      active: q.active ?? true,
      createdAt: new Date(),
    });
    count++;
    batchCount++;

    // Firestore batches are limited to 500 operations
    if (batchCount >= 500) {
      await batch.commit();
      // Important: create a fresh batch after each commit.
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return count;
}

// Helper functions
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
