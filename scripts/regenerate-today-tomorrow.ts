import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

const DEFAULT_SUBJECTS = ['biology', 'chemistry', 'computer-science'] as const;

function parseSubjects(argv: string[]): string[] {
  const subjectFlagIndex = argv.findIndex((arg) => arg === '--subject' || arg === '--subjects');
  if (subjectFlagIndex === -1) return [...DEFAULT_SUBJECTS];

  const value = argv[subjectFlagIndex + 1];
  if (!value) return [...DEFAULT_SUBJECTS];

  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getLisbonDate(date: Date): string {
  const lisbonDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  return lisbonDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

async function regenerate() {
  const now = new Date();
  const today = getLisbonDate(now);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLisbonDate(tomorrowDate);

  const subjects = parseSubjects(process.argv);

  for (const subject of subjects) {
    for (const date of [today, tomorrow]) {
      const docId = `${date}-${subject}`;
      console.log(`Deleting assignment: ${docId}`);
      await db.collection('dailyAssignments').doc(docId).delete();
    }
  }

  console.log('\nDone! Today and tomorrow assignments will regenerate on next request.');
}

regenerate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
