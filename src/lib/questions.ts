import { getDb, COLLECTIONS } from './firebase';
import { Question, QuestionInput, Topic, Subject } from '@/types';
import { getTodayLisbon, getLastNDaysLisbon } from './date';

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
 * Get question IDs used in the last N days for a specific subject
 */
export async function getRecentlyUsedQuestionIds(days: number, subject: Subject): Promise<Set<string>> {
  const db = getDb();
  const recentDates = getLastNDaysLisbon(days);
  const usedIds = new Set<string>();

  for (const date of recentDates) {
    // New key pattern: YYYY-MM-DD-{subject}
    const docId = `${date}-${subject}`;
    const doc = await db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId).get();
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

  // Also check attempts for questions used today for this subject
  const attemptsSnapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', getTodayLisbon())
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

/**
 * Select 5 regular questions + 1 bonus hard question for a quiz
 * with topic balancing and repeat avoidance
 */
export async function selectQuizQuestions(
  subject: Subject,
  excludeIds: Set<string> = new Set()
): Promise<Question[]> {
  const allQuestions = await getActiveQuestions(subject);
  const recentlyUsed = await getRecentlyUsedQuestionIds(7, subject);

  // Combine exclusions
  const allExclusions = new Set([...excludeIds, ...recentlyUsed]);

  // Separate questions into fresh and used
  const freshQuestions = allQuestions.filter((q) => !allExclusions.has(q.id));
  const usedQuestions = allQuestions.filter((q) => allExclusions.has(q.id));

  // Filter out hard questions for bonus selection later
  const regularFreshQuestions = freshQuestions.filter((q) => q.difficulty !== 3);
  const hardFreshQuestions = freshQuestions.filter((q) => q.difficulty === 3);

  // Get all available topics from fresh regular questions
  const topicCounts = new Map<Topic, Question[]>();
  for (const q of regularFreshQuestions) {
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

  // Second pass: fill remaining slots from any topic (non-hard questions)
  if (selected.length < 5) {
    const remaining = regularFreshQuestions.filter((q) => !selected.includes(q));
    shuffleArray(remaining);

    for (const q of remaining) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // If still not enough, use previously used non-hard questions
  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const fallback = usedQuestions.filter((q) => !selectedIds.has(q.id) && q.difficulty !== 3);
    shuffleArray(fallback);

    for (const q of fallback) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // Final fallback: if we still don't have 5, use any non-hard questions
  if (selected.length < 5) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const anyQuestions = allQuestions.filter((q) => !selectedIds.has(q.id) && q.difficulty !== 3);
    shuffleArray(anyQuestions);

    for (const q of anyQuestions) {
      if (selected.length >= 5) break;
      selected.push(q);
    }
  }

  // Shuffle the 5 regular questions
  shuffleArray(selected);

  // Now select 1 bonus hard question (difficulty 3)
  const selectedIds = new Set(selected.map((q) => q.id));
  let bonusQuestion: Question | null = null;

  // Try fresh hard questions first
  if (hardFreshQuestions.length > 0) {
    shuffleArray(hardFreshQuestions);
    bonusQuestion = hardFreshQuestions[0];
  } else {
    // Fallback to used hard questions
    const usedHardQuestions = usedQuestions.filter((q) => q.difficulty === 3 && !selectedIds.has(q.id));
    if (usedHardQuestions.length > 0) {
      shuffleArray(usedHardQuestions);
      bonusQuestion = usedHardQuestions[0];
    } else {
      // Final fallback: any hard question
      const anyHardQuestions = allQuestions.filter((q) => q.difficulty === 3 && !selectedIds.has(q.id));
      if (anyHardQuestions.length > 0) {
        shuffleArray(anyHardQuestions);
        bonusQuestion = anyHardQuestions[0];
      }
    }
  }

  // Add bonus question at the end if found
  if (bonusQuestion) {
    selected.push(bonusQuestion);
  }

  return selected.slice(0, 6);
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
