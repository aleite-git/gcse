import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

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

async function seedAccessCodes(db: FirebaseFirestore.Firestore) {
  console.log('\n--- Seeding Access Codes ---');

  const accessCodesCollection = db.collection('accessCodes');

  // Default access codes (change these in production!)
  const codes = [
    { code: 'student2024', label: 'Student', isAdmin: false },
    { code: 'admin2024', label: 'Admin', isAdmin: true },
  ];

  for (const { code, label, isAdmin } of codes) {
    const codeHash = await bcrypt.hash(code, 12);

    // Check if code with this label already exists
    const existing = await accessCodesCollection.where('label', '==', label).get();

    if (existing.empty) {
      await accessCodesCollection.add({
        codeHash,
        label,
        isAdmin,
        active: true,
      });
      console.log(`  Created access code for: ${label} (code: ${code})`);
    } else {
      // Update existing
      const docId = existing.docs[0].id;
      await accessCodesCollection.doc(docId).update({
        codeHash,
        isAdmin,
        active: true,
      });
      console.log(`  Updated access code for: ${label} (code: ${code})`);
    }
  }
}

async function seedQuestions(db: FirebaseFirestore.Firestore) {
  console.log('\n--- Seeding Questions ---');

  const questionsCollection = db.collection('questions');

  // Load questions from JSON file
  const questionsPath = path.join(__dirname, '..', 'seed', 'questions.json');

  if (!fs.existsSync(questionsPath)) {
    console.error('Questions file not found:', questionsPath);
    return;
  }

  const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));
  console.log(`  Found ${questionsData.length} questions in seed file`);

  // Check existing questions count
  const existingCount = (await questionsCollection.count().get()).data().count;
  console.log(`  Existing questions in database: ${existingCount}`);

  if (existingCount > 0) {
    console.log('  Skipping question seeding - questions already exist');
    console.log('  To re-seed, delete existing questions first or use --force flag');

    if (process.argv.includes('--force')) {
      console.log('  --force flag detected, deleting existing questions...');
      const existing = await questionsCollection.get();
      const batch = db.batch();
      existing.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  Deleted ${existing.docs.length} existing questions`);
    } else {
      return;
    }
  }

  // Batch write questions
  let batch = db.batch();
  let count = 0;

  for (const question of questionsData) {
    const docRef = questionsCollection.doc();
    batch.set(docRef, {
      stem: question.stem,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      topic: question.topic,
      difficulty: question.difficulty,
      tags: question.tags || [],
      active: true,
      createdAt: new Date(),
    });

    count++;

    // Firestore batch limit is 500
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Committed ${count} questions...`);
      batch = db.batch();
    }
  }

  // Commit remaining
  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`  Successfully seeded ${count} questions`);
}

async function main() {
  console.log('=== GCSE Quiz Database Seeding ===');

  try {
    const db = initializeFirebase();

    await seedAccessCodes(db);
    await seedQuestions(db);

    console.log('\n=== Seeding Complete ===');
    console.log('\nDefault access codes:');
    console.log('  Student: student2024');
    console.log('  Admin: admin2024');
    console.log('\nIMPORTANT: Change these codes in production!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main();
