import { getDb, COLLECTIONS } from './firebase';
import { DailyAssignment, Attempt, Answer, TopicBreakdown, Question, Subject } from '@/types';
import { getLastNDaysLondon, getTodayLondon, getTomorrowLondon } from './date';
import { selectQuizQuestions, getQuestionsByIds } from './questions';
import { recordQuestionAttempts } from './questionStats';
import crypto from 'crypto';

export class QuizValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Get or create today's daily assignment for a specific subject
 */
export async function getOrCreateDailyAssignment(subject: Subject): Promise<DailyAssignment> {
  const db = getDb();
  const today = getTodayLondon();
  const docId = `${today}-${subject}`;
  const docRef = db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId);

  // Use a transaction to prevent concurrent requests from creating duplicate assignments
  return db.runTransaction(async (transaction: FirebaseFirestore.Transaction) => {
    const doc = await transaction.get(docRef);

    if (doc.exists) {
      const data = doc.data()!;
      return {
        id: doc.id,
        date: data.date,
        subject: data.subject,
        quizVersion: data.quizVersion,
        generatedAt: data.generatedAt?.toDate() || new Date(),
        questionIds: data.questionIds,
      };
    }

    // Create new assignment
    const questions = await selectQuizQuestions(subject);
    const assignment: Omit<DailyAssignment, 'id'> = {
      date: today,
      subject,
      quizVersion: 1,
      generatedAt: new Date(),
      questionIds: questions.map((q) => q.id),
    };

    transaction.set(docRef, assignment);

    return {
      id: docId,
      ...assignment,
    };
  });
}

/**
 * Get the current quiz version and questions for today for a specific subject
 */
export async function getTodayQuiz(subject: Subject): Promise<{
  quizVersion: number;
  subject: Subject;
  questions: Question[];
}> {
  const assignment = await getOrCreateDailyAssignment(subject);
  const questions = await getQuestionsByIds(assignment.questionIds);

  return {
    quizVersion: assignment.quizVersion,
    subject,
    questions,
  };
}

/**
 * Generate a new quiz version (for retry) for a specific subject
 */
export async function generateNewQuizVersion(subject: Subject): Promise<{
  quizVersion: number;
  subject: Subject;
  questions: Question[];
}> {
  const db = getDb();
  const today = getTodayLondon();
  const docId = `${today}-${subject}`;
  const docRef = db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId);

  // Get questions used today for this subject
  const attemptsSnapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', today)
    .where('subject', '==', subject)
    .get();

  const usedToday = new Set<string>();
  for (const doc of attemptsSnapshot.docs) {
    const data = doc.data();
    for (const id of data.questionIds || []) {
      usedToday.add(id);
    }
  }

  // Also get current assignment questions
  const currentDoc = await docRef.get();
  if (currentDoc.exists) {
    const data = currentDoc.data()!;
    for (const id of data.questionIds || []) {
      usedToday.add(id);
    }
  }

  // Select new questions avoiding today's questions
  const questions = await selectQuizQuestions(subject, usedToday);
  const newVersion = currentDoc.exists ? (currentDoc.data()!.quizVersion || 1) + 1 : 1;

  await docRef.set(
    {
      date: today,
      subject,
      quizVersion: newVersion,
      generatedAt: new Date(),
      questionIds: questions.map((q) => q.id),
    },
    { merge: false }
  );

  return {
    quizVersion: newVersion,
    subject,
    questions,
  };
}

/**
 * Get today's attempts for a user for a specific subject
 */
export async function getTodayAttempts(userLabel: string, subject: Subject): Promise<Attempt[]> {
  const db = getDb();
  const today = getTodayLondon();

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', today)
    .where('userLabel', '==', userLabel)
    .where('subject', '==', subject)
    .orderBy('attemptNumber', 'asc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    submittedAt: doc.data().submittedAt?.toDate() || new Date(),
  })) as Attempt[];
}

/**
 * Get an attempt by ID
 */
export async function getAttemptById(id: string): Promise<Attempt | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTIONS.ATTEMPTS).doc(id).get();

  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  return {
    id: doc.id,
    ...data,
    submittedAt: data.submittedAt?.toDate() || new Date(),
  } as Attempt;
}

/**
 * Submit a quiz attempt for a specific subject
 */
export async function submitQuizAttempt(
  userLabel: string,
  subject: Subject,
  answers: Answer[],
  durationSeconds: number,
  ipAddress?: string
): Promise<{
  attempt: Attempt;
  questions: Question[];
}> {
  const db = getDb();
  const today = getTodayLondon();
  const assignment = await getOrCreateDailyAssignment(subject);

  // Validate answers match the number of assigned questions for today.
  if (assignment.questionIds.length === 0) {
    throw new QuizValidationError('No quiz available');
  }
  if (answers.length !== assignment.questionIds.length) {
    throw new QuizValidationError(`Must answer all ${assignment.questionIds.length} questions`);
  }

  const assignedIds = new Set(assignment.questionIds);
  for (const answer of answers) {
    if (!assignedIds.has(answer.questionId)) {
      throw new QuizValidationError(`Question ${answer.questionId} is not part of today's quiz`);
    }
  }

  // Fetch questions and existing attempts in parallel (independent reads)
  const [questions, existingAttempts] = await Promise.all([
    getQuestionsByIds(assignment.questionIds),
    getTodayAttempts(userLabel, subject),
  ]);
  const attemptNumber = existingAttempts.length + 1;

  // Calculate score and topic breakdown
  let score = 0;
  const topicBreakdown: TopicBreakdown = {};

  for (const question of questions) {
    const answer = answers.find((a) => a.questionId === question.id);
    const isCorrect = answer?.selectedIndex === question.correctIndex;

    if (isCorrect) {
      score++;
    }

    // Update topic breakdown
    if (!topicBreakdown[question.topic]) {
      topicBreakdown[question.topic] = { correct: 0, total: 0 };
    }
    topicBreakdown[question.topic].total++;
    if (isCorrect) {
      topicBreakdown[question.topic].correct++;
    }
  }

  // Create attempt document
  const attemptData: Omit<Attempt, 'id'> = {
    date: today,
    subject,
    attemptNumber,
    quizVersion: assignment.quizVersion,
    questionIds: assignment.questionIds,
    answers,
    isComplete: true,
    score,
    topicBreakdown,
    submittedAt: new Date(),
    durationSeconds,
    userLabel,
    ipHash: ipAddress ? hashIp(ipAddress) : undefined,
  };

  const docRef = await db.collection(COLLECTIONS.ATTEMPTS).add(attemptData);

  // Record question-level stats for each answered question
  const questionStatsData = questions.map((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    const isCorrect = answer?.selectedIndex === question.correctIndex;
    return {
      questionId: question.id,
      userLabel,
      isCorrect,
    };
  });
  await recordQuestionAttempts(questionStatsData);

  return {
    attempt: {
      id: docRef.id,
      ...attemptData,
    },
    questions,
  };
}

/**
 * Get attempts for a date range
 */
export async function getAttemptsByDateRange(
  startDate: string,
  endDate: string
): Promise<Attempt[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'desc')
    .orderBy('submittedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    submittedAt: doc.data().submittedAt?.toDate() || new Date(),
  })) as Attempt[];
}

/**
 * Get all attempts (for admin)
 */
export async function getAllAttempts(limit: number = 100): Promise<Attempt[]> {
  const db = getDb();

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .orderBy('submittedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    submittedAt: doc.data().submittedAt?.toDate() || new Date(),
  })) as Attempt[];
}

/**
 * Hash an IP address for privacy
 */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Check if user has attempted today's quiz for a specific subject
 */
export async function hasAttemptedToday(userLabel: string, subject: Subject): Promise<boolean> {
  const attempts = await getTodayAttempts(userLabel, subject);
  return attempts.length > 0;
}

/**
 * Generate and save tomorrow's quiz assignment for a specific subject
 * First call creates the assignment, subsequent calls return the same questions
 * If no admin previews, the quiz is created on-the-fly via getOrCreateDailyAssignment
 */
export async function generateTomorrowPreview(subject: Subject): Promise<{
  date: string;
  subject: Subject;
  questions: Question[];
}> {
  // Get tomorrow's date in Europe/London (avoid UTC drift)
  const tomorrowStr = getTomorrowLondon();
  const docId = `${tomorrowStr}-${subject}`;

  // Check if tomorrow's assignment already exists
  const db = getDb();
  const docRef = db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId);
  const doc = await docRef.get();

  if (doc.exists) {
    // Tomorrow's quiz is already generated
    const data = doc.data()!;
    const questions = await getQuestionsByIds(data.questionIds);
    return {
      date: tomorrowStr,
      subject,
      questions,
    };
  }

  // Get today's questions to exclude from tomorrow's selection
  const today = getTodayLondon();
  const todayDocId = `${today}-${subject}`;
  const todayDoc = await db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(todayDocId).get();
  const todayQuestionIds = new Set<string>();

  if (todayDoc.exists) {
    const data = todayDoc.data()!;
    for (const id of data.questionIds || []) {
      todayQuestionIds.add(id);
    }
  }

  // Select questions for tomorrow (excluding today's questions)
  const questions = await selectQuizQuestions(subject, todayQuestionIds);

  // Save tomorrow's assignment so subsequent previews return the same questions
  const assignment: Omit<DailyAssignment, 'id'> = {
    date: tomorrowStr,
    subject,
    quizVersion: 1,
    generatedAt: new Date(),
    questionIds: questions.map((q) => q.id),
  };

  await docRef.set(assignment);

  return {
    date: tomorrowStr,
    subject,
    questions,
  };
}

/**
 * Get progress summary for a user for a specific subject
 */
export async function getProgressSummary(
  userLabel: string,
  subject: Subject,
  days: number = 7
): Promise<{
  attemptedToday: boolean;
  todayAttempts: number;
  todayBestScore: number;
  last7Days: { date: string; bestScore: number; attempts: number }[];
  weakTopics: { topic: string; correctRate: number; totalQuestions: number }[];
}> {
  const db = getDb();
  const today = getTodayLondon();

  // Get attempts for last N days
  const dates = getLastNDaysLondon(days);

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('userLabel', '==', userLabel)
    .where('subject', '==', subject)
    .where('date', '>=', dates[dates.length - 1])
    .get();

  const attempts = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Attempt[];

  // Calculate today's stats
  const todayAttempts = attempts.filter((a) => a.date === today);
  const todayBestScore = todayAttempts.length > 0 ? Math.max(...todayAttempts.map((a) => a.score)) : 0;

  // Calculate per-day stats
  const dailyStats = new Map<string, { bestScore: number; attempts: number }>();
  for (const date of dates) {
    dailyStats.set(date, { bestScore: 0, attempts: 0 });
  }

  for (const attempt of attempts) {
    const stat = dailyStats.get(attempt.date);
    if (stat) {
      stat.attempts++;
      stat.bestScore = Math.max(stat.bestScore, attempt.score);
    }
  }

  const last7Days = dates.map((date) => ({
    date,
    ...dailyStats.get(date)!,
  }));

  // Calculate weak topics
  const topicStats = new Map<string, { correct: number; total: number }>();

  for (const attempt of attempts) {
    if (attempt.topicBreakdown) {
      for (const [topic, stats] of Object.entries(attempt.topicBreakdown)) {
        const existing = topicStats.get(topic) || { correct: 0, total: 0 };
        existing.correct += stats.correct;
        existing.total += stats.total;
        topicStats.set(topic, existing);
      }
    }
  }

  const weakTopics = Array.from(topicStats.entries())
    .map(([topic, stats]) => ({
      topic,
      correctRate: stats.total > 0 ? stats.correct / stats.total : 0,
      totalQuestions: stats.total,
    }))
    .filter((t) => t.totalQuestions >= 2 && t.correctRate < 0.7)
    .sort((a, b) => a.correctRate - b.correctRate);

  return {
    attemptedToday: todayAttempts.length > 0,
    todayAttempts: todayAttempts.length,
    todayBestScore,
    last7Days,
    weakTopics,
  };
}
