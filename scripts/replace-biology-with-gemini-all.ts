import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

type GeminiQuestion = {
  topic?: string;
  difficulty?: number;
  question?: string;
  options?: string[];
  correctIndex?: number;
  notes?: string;
};

const INPUT_PATH = 'gemini_all.json';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

function loadQuestions(): GeminiQuestion[] {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function deleteAllBiologyQuestions() {
  const snapshot = await db.collection('questions').where('subject', '==', 'biology').get();
  let batch = db.batch();
  let deleted = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    deleted++;
    if (deleted % 500 === 0) {
      await batch.commit();
      console.log(`  Deleted ${deleted}...`);
      batch = db.batch();
    }
  }

  if (deleted % 500 !== 0) {
    await batch.commit();
  }

  console.log(`Deleted ${deleted} biology questions`);
}

async function insertGeminiQuestions(questions: GeminiQuestion[]) {
  let batch = db.batch();
  let added = 0;
  let skipped = 0;

  for (const q of questions) {
    const stem = q.question;
    if (typeof stem !== 'string' || !stem.trim()) {
      skipped++;
      continue;
    }

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      skipped++;
      continue;
    }

    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
      skipped++;
      continue;
    }

    const docRef = db.collection('questions').doc();
    batch.set(docRef, {
      stem,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.notes || '',
      notes: q.notes || '',
      topic: q.topic || 'Cell biology',
      subject: 'biology',
      difficulty: q.difficulty || 2,
      tags: [],
      active: true,
      createdAt: new Date(),
    });
    added++;

    if (added % 500 === 0) {
      await batch.commit();
      console.log(`  Added ${added}...`);
      batch = db.batch();
    }
  }

  if (added % 500 !== 0) {
    await batch.commit();
  }

  console.log(`Added ${added} biology questions`);
  console.log(`Skipped ${skipped} questions (missing fields)`);
}

async function replace() {
  const questions = loadQuestions();
  console.log(`Loaded ${questions.length} Gemini questions`);

  console.log('\nStep 1: Deleting existing biology questions...');
  await deleteAllBiologyQuestions();

  console.log('\nStep 2: Adding Gemini questions...');
  await insertGeminiQuestions(questions);
}

replace().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
