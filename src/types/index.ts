// Types for the Daily 5 GCSE Quiz Application

// Subject definitions
export type Subject = 'computer-science' | 'biology' | 'chemistry';

export const SUBJECTS: Record<Subject, { name: string; icon: string; color: string }> = {
  'computer-science': { name: 'Computer Science', icon: '💻', color: 'from-purple-500 to-pink-500' },
  'biology': { name: 'Biology', icon: '🧬', color: 'from-green-500 to-emerald-500' },
  'chemistry': { name: 'Chemistry', icon: '⚗️', color: 'from-slate-600 to-sky-600' },
};

// Computer Science topics
export type CSTopic =
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

// Biology topics
export type BiologyTopic =
  | 'CellBiology'
  | 'Organisation'
  | 'Infection'
  | 'Bioenergetics'
  | 'Homeostasis'
  | 'Inheritance'
  | 'Variation'
  | 'Ecology';

// Chemistry topics
export type ChemistryTopic =
  | 'AtomicStructure'
  | 'BondingStructure'
  | 'QuantitativeChemistry'
  | 'ChemicalChanges'
  | 'EnergyChanges'
  | 'RatesReactions'
  | 'OrganicChemistry'
  | 'ChemicalAnalysis'
  | 'AtmosphereResources';

// Union of all topics (for backward compatibility)
export type Topic = CSTopic | BiologyTopic | ChemistryTopic;

export interface Question {
  id: string;
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  notes?: string;
  topic: Topic;
  subject: Subject;
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
  notes?: string;
  topic: Topic;
  subject: Subject;
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
  id: string; // YYYY-MM-DD-{subject}
  date: string;
  subject: Subject;
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
  subject: Subject;
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
  notes?: string;
}

export interface QuizResponse {
  quizVersion: number;
  subject: Subject;
  questions: QuizQuestion[];
  startedAt: string;
}

export interface SubmitRequest {
  subject: Subject;
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
  notes?: string;
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

export type StreakSubject = Subject | 'overall';

// Streak system types
export interface UserStreak {
  userLabel: string;
  subject: StreakSubject;
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
  subject: StreakSubject;
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
