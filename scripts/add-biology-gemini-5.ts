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

const INPUT_PATH = 'gemini_5.json';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

function normalizeStem(stem: string): string {
  return stem.split('?')[0].toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeDifficulty(difficulty?: number): number | undefined {
  if (difficulty === 3) return 2;
  if (difficulty === 5) return 3;
  return difficulty;
}

async function addGemini5() {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const data = JSON.parse(raw);
  const questions: GeminiQuestion[] = Array.isArray(data) ? data : [];

  console.log(`Loaded ${questions.length} Gemini 5 questions`);

  const existingSnapshot = await db.collection('questions').where('subject', '==', 'biology').get();
  const existingNormalized = new Set<string>();

  for (const doc of existingSnapshot.docs) {
    const stem = doc.data().stem;
    if (typeof stem === 'string' && stem.trim()) {
      existingNormalized.add(normalizeStem(stem));
    }
  }

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

    const normalizedStem = normalizeStem(stem);
    if (existingNormalized.has(normalizedStem)) {
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
      difficulty: normalizeDifficulty(q.difficulty) || 2,
      tags: [],
      active: true,
      createdAt: new Date(),
    });
    existingNormalized.add(normalizedStem);
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
  console.log(`Skipped ${skipped} questions (missing fields or duplicate)`);
}

addGemini5().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
