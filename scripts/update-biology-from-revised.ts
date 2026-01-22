import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

type RevisedQuestion = {
  id?: string;
  notes?: string;
  options?: string[];
};

const INPUT_PATH = 'biology_all_questions-revised.json';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

function loadRevised(): RevisedQuestion[] {
  const raw = fs.readFileSync(INPUT_PATH, 'utf-8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function updateFirestore() {
  const revised = loadRevised();
  console.log(`Loaded ${revised.length} revised biology questions`);

  let batch = db.batch();
  let updated = 0;
  let skipped = 0;

  for (const q of revised) {
    if (!q.id || !Array.isArray(q.options)) {
      skipped++;
      continue;
    }

    const docRef = db.collection('questions').doc(q.id);
    batch.update(docRef, {
      notes: q.notes || '',
      options: q.options,
    });
    updated++;

    if (updated % 500 === 0) {
      await batch.commit();
      console.log(`  Updated ${updated}...`);
      batch = db.batch();
    }
  }

  if (updated % 500 !== 0) {
    await batch.commit();
  }

  console.log(`Updated ${updated} questions`);
  console.log(`Skipped ${skipped} questions (missing id/options)`);
}

updateFirestore()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
