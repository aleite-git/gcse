import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

function initializeFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('Using Firestore emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
    initializeApp({ projectId: projectId || 'demo-gcse' });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Using service account credentials');
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
  } else if (projectId) {
    console.log('Using Application Default Credentials for project:', projectId);
    initializeApp({ projectId });
  } else if (process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Using inline credentials');
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  } else {
    throw new Error(
      'Firebase credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars, or FIRESTORE_EMULATOR_HOST for emulator.'
    );
  }

  return getFirestore();
}

function normalizeQuestion(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  const createdAt =
    data.createdAt && typeof data.createdAt.toDate === 'function'
      ? data.createdAt.toDate().toISOString()
      : data.createdAt;

  return {
    id: doc.id,
    ...data,
    createdAt,
  };
}

async function exportBiologyQuestions() {
  const db = initializeFirebase();

  const snapshot = await db.collection('questions').where('subject', '==', 'biology').get();
  const questions = snapshot.docs.map(normalizeQuestion);

  const outputPath = path.join(process.cwd(), 'biology_all_questions.json');
  fs.writeFileSync(outputPath, JSON.stringify(questions, null, 2));

  console.log(`Saved ${questions.length} biology questions to: ${outputPath}`);
}

exportBiologyQuestions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Export failed:', error);
    process.exit(1);
  });
