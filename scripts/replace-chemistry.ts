import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

async function replaceChemistry() {
  // Step 1: Delete all existing chemistry questions
  console.log('Step 1: Deleting existing chemistry questions...');

  const existingQuery = db.collection('questions').where('subject', '==', 'chemistry');
  const existingDocs = await existingQuery.get();

  console.log(`Found ${existingDocs.size} existing chemistry questions to delete`);

  let deleteCount = 0;
  let deleteBatch = db.batch();

  for (const doc of existingDocs.docs) {
    deleteBatch.delete(doc.ref);
    deleteCount++;

    if (deleteCount % 500 === 0) {
      await deleteBatch.commit();
      console.log(`  Deleted ${deleteCount}...`);
      deleteBatch = db.batch();
    }
  }

  if (deleteCount % 500 !== 0) {
    await deleteBatch.commit();
  }

  console.log(`Deleted ${deleteCount} chemistry questions`);

  // Step 2: Load new chemistry questions
  console.log('\nStep 2: Loading new chemistry questions...');

  const data = JSON.parse(fs.readFileSync('AQA_GCSE_Chemistry_1000_Questions_ExamGrade.json', 'utf-8'));
  console.log(`Loading ${data.length} new chemistry questions...`);

  let batch = db.batch();
  let count = 0;

  for (const q of data) {
    const docRef = db.collection('questions').doc();
    batch.set(docRef, {
      stem: q.stem,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      topic: q.topic,
      subject: 'chemistry', // Normalize to lowercase
      difficulty: q.difficulty,
      tags: q.tags || [],
      active: true,
      createdAt: new Date(),
    });
    count++;

    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Loaded ${count}...`);
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }

  console.log(`\nSuccessfully loaded ${count} new chemistry questions!`);

  // Step 3: Delete stale daily assignment for chemistry
  console.log('\nStep 3: Cleaning up daily assignments...');
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  for (const date of [today, tomorrow]) {
    const assignmentRef = db.collection('dailyAssignments').doc(`chemistry-${date}`);
    const assignment = await assignmentRef.get();
    if (assignment.exists) {
      await assignmentRef.delete();
      console.log(`  Deleted assignment for chemistry-${date}`);
    }
  }

  console.log('\nDone! Chemistry questions have been replaced.');
}

replaceChemistry().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
