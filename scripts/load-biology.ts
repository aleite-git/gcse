import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

async function load() {
  const data = JSON.parse(fs.readFileSync('aqa_gcse_biology_1000_unique_questions.json', 'utf-8'));
  console.log(`Loading ${data.length} biology questions...`);
  
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
      subject: q.subject,
      difficulty: q.difficulty,
      tags: q.tags || [],
      active: true,
      createdAt: new Date(),
    });
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`  Committed ${count}...`);
      batch = db.batch();
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`Successfully loaded ${count} biology questions!`);
}

load().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
