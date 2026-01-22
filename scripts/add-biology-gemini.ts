import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

type GeminiQuestion = {
  id?: string;
  topic?: string;
  difficulty?: number;
  question?: string;
  options?: string[];
  correctIndex?: number;
  notes?: string;
};

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

function normalizeStem(stem: string): string {
  return stem.split('?')[0].toLowerCase().replace(/\s+/g, ' ').trim();
}

function loadJsonFile(path: string): GeminiQuestion[] {
  const raw = fs.readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function addGeminiQuestions() {
  const files = ['gemini_1.json', 'gemini_2.json'];
  const allQuestions = files.flatMap(loadJsonFile);

  console.log(`Loaded ${allQuestions.length} Gemini biology questions from JSON`);

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

  for (const q of allQuestions) {
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

    const normalized = normalizeStem(stem);
    if (existingNormalized.has(normalized)) {
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
    existingNormalized.add(normalized);
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

  console.log(`Added ${added} Gemini biology questions`);
  console.log(`Skipped ${skipped} questions (missing fields or duplicate by text)`);
}

addGeminiQuestions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
