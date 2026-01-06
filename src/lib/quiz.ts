import { getDb, COLLECTIONS } from './firebase';
import { DailyAssignment, Attempt, Answer, TopicBreakdown, Question } from '@/types';
import { getTodayLisbon } from './date';
import { selectQuizQuestions, getQuestionsByIds } from './questions';
import crypto from 'crypto';

/**
 * Get or create today's daily assignment
 */
export async function getOrCreateDailyAssignment(): Promise<DailyAssignment> {
  const db = getDb();
  const today = getTodayLisbon();
  const docRef = db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(today);

  const doc = await docRef.get();

  if (doc.exists) {
    const data = doc.data()!;
    return {
      id: doc.id,
      date: data.date,
      quizVersion: data.quizVersion,
      generatedAt: data.generatedAt?.toDate() || new Date(),
      questionIds: data.questionIds,
    };
  }

  // Create new assignment
  const questions = await selectQuizQuestions();
  const assignment: Omit<DailyAssignment, 'id'> = {
    date: today,
    quizVersion: 1,
    generatedAt: new Date(),
    questionIds: questions.map((q) => q.id),
  };

  await docRef.set(assignment);

  return {
    id: today,
    ...assignment,
  };
}

/**
 * Get the current quiz version and questions for today
 */
export async function getTodayQuiz(): Promise<{
  quizVersion: number;
  questions: Question[];
}> {
  const assignment = await getOrCreateDailyAssignment();
  const questions = await getQuestionsByIds(assignment.questionIds);

  return {
    quizVersion: assignment.quizVersion,
    questions,
  };
}

/**
 * Generate a new quiz version (for retry)
 */
export async function generateNewQuizVersion(): Promise<{
  quizVersion: number;
  questions: Question[];
}> {
  const db = getDb();
  const today = getTodayLisbon();
  const docRef = db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(today);

  // Get questions used today
  const attemptsSnapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', today)
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
  const questions = await selectQuizQuestions(usedToday);
  const newVersion = currentDoc.exists ? (currentDoc.data()!.quizVersion || 1) + 1 : 1;

  await docRef.set(
    {
      date: today,
      quizVersion: newVersion,
      generatedAt: new Date(),
      questionIds: questions.map((q) => q.id),
    },
    { merge: false }
  );

  return {
    quizVersion: newVersion,
    questions,
  };
}

/**
 * Get today's attempts for a user
 */
export async function getTodayAttempts(userLabel: string): Promise<Attempt[]> {
  const db = getDb();
  const today = getTodayLisbon();

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('date', '==', today)
    .where('userLabel', '==', userLabel)
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
 * Submit a quiz attempt
 */
export async function submitQuizAttempt(
  userLabel: string,
  answers: Answer[],
  durationSeconds: number,
  ipAddress?: string
): Promise<{
  attempt: Attempt;
  questions: Question[];
}> {
  const db = getDb();
  const today = getTodayLisbon();
  const assignment = await getOrCreateDailyAssignment();

  // Validate answers
  if (answers.length !== 5) {
    throw new Error('Must answer all 5 questions');
  }

  const assignedIds = new Set(assignment.questionIds);
  for (const answer of answers) {
    if (!assignedIds.has(answer.questionId)) {
      throw new Error(`Question ${answer.questionId} is not part of today's quiz`);
    }
  }

  // Get questions to score
  const questions = await getQuestionsByIds(assignment.questionIds);

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

  // Get attempt number
  const existingAttempts = await getTodayAttempts(userLabel);
  const attemptNumber = existingAttempts.length + 1;

  // Create attempt document
  const attemptData: Omit<Attempt, 'id'> = {
    date: today,
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
 * Check if user has attempted today's quiz
 */
export async function hasAttemptedToday(userLabel: string): Promise<boolean> {
  const attempts = await getTodayAttempts(userLabel);
  return attempts.length > 0;
}

/**
 * Get progress summary for a user
 */
export async function getProgressSummary(
  userLabel: string,
  days: number = 7
): Promise<{
  attemptedToday: boolean;
  todayAttempts: number;
  todayBestScore: number;
  last7Days: { date: string; bestScore: number; attempts: number }[];
  weakTopics: { topic: string; correctRate: number; totalQuestions: number }[];
}> {
  const db = getDb();
  const today = getTodayLisbon();

  // Get attempts for last N days
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  const snapshot = await db
    .collection(COLLECTIONS.ATTEMPTS)
    .where('userLabel', '==', userLabel)
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
