import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;

function getFirebaseApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Check for credentials
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  // Running on GCP with workload identity
  if (process.env.K_SERVICE) {
    app = initializeApp({
      projectId,
    });
  }
  // Local development with service account key
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
  }
  // Local development with inline credentials
  else if (process.env.FIREBASE_PRIVATE_KEY) {
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  }
  // Firestore emulator
  else if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId: projectId || 'demo-gcse' });
  }
  else {
    throw new Error(
      'Firebase credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars.'
    );
  }

  return app;
}

export function getDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    db = getFirestore(app);
  }
  return db;
}

// Collection names as constants
export const COLLECTIONS = {
  ACCESS_CODES: 'accessCodes',
  QUESTIONS: 'questions',
  DAILY_ASSIGNMENTS: 'dailyAssignments',
  ATTEMPTS: 'attempts',
  QUESTION_STATS: 'questionStats',
  USER_STREAKS: 'userStreaks',
  STREAK_ACTIVITIES: 'streakActivities',
  MOBILE_USERS: 'mobileUsers',
  USER_PROFILES: 'userProfiles',
} as const;
