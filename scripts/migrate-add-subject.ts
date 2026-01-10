import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
function initializeFirebase() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  // Check for Firestore emulator
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('Using Firestore emulator at:', process.env.FIRESTORE_EMULATOR_HOST);
    initializeApp({ projectId: projectId || 'demo-gcse' });
  }
  // Local development with service account key
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('Using service account credentials');
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      projectId,
    });
  }
  // Use Application Default Credentials (ADC)
  else if (projectId) {
    console.log('Using Application Default Credentials for project:', projectId);
    initializeApp({ projectId });
  }
  // Inline credentials
  else if (process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Using inline credentials');
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  }
  else {
    throw new Error(
      'Firebase credentials not configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_* env vars, or FIRESTORE_EMULATOR_HOST for emulator.'
    );
  }

  return getFirestore();
}

async function migrateQuestions(db: FirebaseFirestore.Firestore) {
  console.log('\n--- Migrating Questions: Adding subject field ---');

  const questionsCollection = db.collection('questions');

  // Get all questions without subject field
  const snapshot = await questionsCollection.get();

  console.log(`  Found ${snapshot.docs.length} total questions`);

  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Only update if subject is missing
    if (!data.subject) {
      batch.update(doc.ref, { subject: 'computer-science' });
      updated++;
    }

    count++;

    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Processed ${count} questions (${updated} updated)...`);
      batch = db.batch();
    }
  }

  // Commit remaining
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`  Migration complete: ${updated} questions updated with subject='computer-science'`);
}

async function main() {
  console.log('=== GCSE Quiz Migration: Add Subject Field ===');

  try {
    const db = initializeFirebase();
    await migrateQuestions(db);
    console.log('\n=== Migration Complete ===');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
