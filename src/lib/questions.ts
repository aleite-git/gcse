import { getDb, COLLECTIONS } from './firebase';
import { Question, QuestionInput, Topic } from '@/types';
import { getTodayLisbon, getLastNDaysLisbon } from './date';

/**
 * Get all active questions
 */
export async function getActiveQuestions(): Promise<Question[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.QUESTIONS)
    .where('active', '==', true)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
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
    createdAt: data.createdAt?.toDate() || new Date(),
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
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Question);
    }
  }

  // Maintain the order from the input IDs
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => questionMap.get(id)).filter((q): q is Question => q !== undefined);
}

/**
 * Get question IDs used in the last N days
 */
export async function getRecentlyUsedQuestionIds(days: number): Promise<Set<string>> {
  const db = getDb();
  const recentDates = getLastNDaysLisbon(days);
  const usedIds = new Set<string>();

  for (const date of recentDates) {
    const doc = await db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(date).get();
    if (doc.exists) {
      const data = doc.data()!;
      // Get all question IDs from all versions
      if (data.questionIds) {
        for (const id of data.questionIds) {
          usedIds.add(id);
        }
      }
    }
  }

  // Also check attempts for questions used today
  const attemptsSnapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', getTodayLisbon())
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

/**
 * Select 5 questions for a quiz with topic balancing and repeat avoidance
 */
export async function selectQuizQuestions(
  excludeIds: Set<string> = new Set()
): Promise<Question[]> {
  const allQuestions = await getActiveQuestions();
  const recentlyUsed = await getRecentlyUsedQuestionIds(7);

  // Combine exclusions
  const allExclusions = new Set([...excludeIds, ...recentlyUsed]);

  // Separate questions into fresh and used
  const freshQuestions = allQuestions.filter((q) => !allExclusions.has(q.id));
  const usedQuestions = allQuestions.filter((q) => allExclusions.has(q.id));

  // Get all available topics from fresh questions
  const topicCounts = new Map<Topic, Question[]>();
  for (const q of freshQuestions) {
    const list = topicCounts.get(q.topic) || [];
    list.push(q);
    topicCounts.set(q.topic, list);
  }

  const selected: Question[] = [];
  const usedTopics = new Set<Topic>();

  // Strategy: Try to pick from at least 3 different topics
  // First pass: pick one from each topic (up to 5)
  const topics = Array.from(topicCounts.keys());
  shuffleArray(topics);

  for (const topic of topics) {
    if (selected.length >= 5) break;

    const topicQuestions = topicCounts.get(topic)!;
    if (topicQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * topicQuestions.length);
      const question = topicQuestions[randomIndex];
      selected.push(question);
      usedTopics.add(topic);
      // Remove from pool
      topicQuestions.splice(randomIndex, 1);
    }
  }

  // Second pass: fill remaining slots from any topic
  if (selected.length < 5) {
    const remaining = freshQuestions.filter((q) => !selected.includes(q));
    shuffleArray(remaining);

    for (const q of remaining) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // If still not enough, use previously used questions
  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const fallback = usedQuestions.filter((q) => !selectedIds.has(q.id));
    shuffleArray(fallback);

    for (const q of fallback) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // Final fallback: if we still don't have 5, use any questions
  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const anyQuestions = allQuestions.filter((q) => !selectedIds.has(q.id));
    shuffleArray(anyQuestions);

    for (const q of anyQuestions) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // Shuffle the final selection
  shuffleArray(selected);

  return selected.slice(0, 5);
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
 * Get all questions (including inactive) for admin
 */
export async function getAllQuestions(): Promise<Question[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.QUESTIONS)
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
  })) as Question[];
}

/**
 * Bulk import questions
 */
export async function bulkImportQuestions(questions: QuestionInput[]): Promise<number> {
  const db = getDb();
  const batch = db.batch();
  let count = 0;

  for (const q of questions) {
    const docRef = db.collection(COLLECTIONS.QUESTIONS).doc();
    batch.set(docRef, {
      ...q,
      active: q.active ?? true,
      createdAt: new Date(),
    });
    count++;

    // Firestore batches are limited to 500 operations
    if (count % 500 === 0) {
      await batch.commit();
    }
  }

  if (count % 500 !== 0) {
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
