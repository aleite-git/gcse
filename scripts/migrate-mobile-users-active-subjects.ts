import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

async function migrateMobileUsers(db: FirebaseFirestore.Firestore) {
  console.log('\n--- Migrating Mobile Users: add activeSubjects and onboardingComplete ---');

  const collection = db.collection('mobileUsers');
  const snapshot = await collection.get();

  console.log(`  Found ${snapshot.docs.length} total mobile users`);

  let batch = db.batch();
  let count = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const update: Record<string, unknown> = {};

    if (!Array.isArray(data.activeSubjects)) {
      update.activeSubjects = [];
    }
    if (typeof data.onboardingComplete !== 'boolean') {
      update.onboardingComplete = false;
    }

    if (Object.keys(update).length > 0) {
      batch.update(doc.ref, update);
      updated++;
    }

    count++;
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Processed ${count} users (${updated} updated)...`);
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`  Migration complete: ${updated} users updated`);
}

async function main() {
  console.log('=== GCSE Quiz Migration: Mobile Users Active Subjects ===');

  try {
    const db = initializeFirebase();
    await migrateMobileUsers(db);
    console.log('\n=== Migration Complete ===');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
