// Types for the Daily 5 GCSE CS Quiz Application

export type Topic =
  | 'CPU'
  | 'RAM_ROM'
  | 'Storage'
  | 'OS'
  | 'Embedded'
  | 'NetworksBasics'
  | 'Protocols'
  | 'Security'
  | 'Ethics_Law_Env'
  | 'Performance';

export interface Question {
  id: string;
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  topic: Topic;
  difficulty: 1 | 2 | 3;
  tags?: string[];
  active: boolean;
  createdAt: Date;
}

export interface QuestionInput {
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  topic: Topic;
  difficulty: 1 | 2 | 3;
  tags?: string[];
  active?: boolean;
}

export interface AccessCode {
  id: string;
  codeHash: string;
  label: string;
  isAdmin: boolean;
  active: boolean;
}

export interface DailyAssignment {
  id: string; // YYYY-MM-DD
  date: string;
  quizVersion: number;
  generatedAt: Date;
  questionIds: string[];
}

export interface Answer {
  questionId: string;
  selectedIndex: number;
}

export interface TopicBreakdown {
  [topic: string]: {
    correct: number;
    total: number;
  };
}

export interface Attempt {
  id: string;
  date: string; // YYYY-MM-DD in Europe/Lisbon
  attemptNumber: number;
  quizVersion: number;
  questionIds: string[];
  answers: Answer[];
  isComplete: boolean;
  score: number;
  topicBreakdown: TopicBreakdown;
  submittedAt: Date;
  durationSeconds: number;
  userLabel: string;
  ipHash?: string;
}

export interface SessionPayload {
  label: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}

// API Response types
export interface QuizQuestion {
  id: string;
  stem: string;
  options: [string, string, string, string];
  topic: Topic;
  isBonus?: boolean;
}

export interface QuizResponse {
  quizVersion: number;
  questions: QuizQuestion[];
  startedAt: string;
}

export interface SubmitRequest {
  answers: Answer[];
  durationSeconds: number;
}

export interface QuestionFeedback {
  questionId: string;
  stem: string;
  options: [string, string, string, string];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
  topic: Topic;
}

export interface SubmitResponse {
  attemptId: string;
  score: number;
  feedback: QuestionFeedback[];
  topicBreakdown: TopicBreakdown;
}

export interface ProgressSummary {
  attemptedToday: boolean;
  todayAttempts: number;
  todayBestScore: number;
  last7Days: {
    date: string;
    bestScore: number;
    attempts: number;
  }[];
  weakTopics: {
    topic: Topic;
    correctRate: number;
    totalQuestions: number;
  }[];
}

export interface QuestionStats {
  questionId: string;
  userLabel: string;
  attempts: number;
  correct: number;
  lastAttemptedAt: Date;
}

// Streak system types
export interface UserStreak {
  userLabel: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // YYYY-MM-DD in user's timezone
  freezeDays: number; // earned freeze days available
  freezeDaysUsed: number; // total freeze days used historically
  timezone: string; // e.g., "Europe/Lisbon"
  streakStartDate: string; // when current streak began
  lastFreezeEarnedAt: number; // streak day when last freeze was earned (to track 5-day intervals)
  updatedAt: Date;
}

export interface StreakActivity {
  userLabel: string;
  date: string; // YYYY-MM-DD
  activityType: 'quiz_submit' | 'login';
  createdAt: Date;
}

export interface StreakStatus {
  currentStreak: number;
  freezeDays: number;
  maxFreezes: number;
  streakActive: boolean;
  lastActivityDate: string | null;
  daysUntilStreakLoss: number; // 0 = at risk today, 1 = safe for today
  frozeToday: boolean; // whether a freeze was auto-applied today
}
