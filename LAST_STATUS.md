# GCSE Quiz App - Status Document

**Last Updated:** 2026-01-10

## Application Overview

A daily quiz application for GCSE students covering three subjects:
- **Computer Science** - 10 topics, ~1000 questions
- **Biology** - 10 topics, 1000 questions
- **Chemistry** - 10 topics, 1000 questions

### Key Features
- Daily quiz with 5 regular questions + 1 bonus hard question per subject
- Streak tracking per subject (separate streaks for each)
- Study notes for weak topics
- Retry functionality with fresh questions
- Admin dashboard for results and question management
- Multi-user support with simple label-based authentication

### Tech Stack
- **Frontend:** Next.js 16 with TypeScript, Tailwind CSS
- **Backend:** Next.js API routes
- **Database:** Firebase Firestore
- **Hosting:** Google Cloud Run (europe-west1)
- **Build:** Cloud Build with Docker

## Current Deployment

- **URL:** https://gcse-quiz-997951122924.europe-west1.run.app
- **Project ID:** gcse-cs-1
- **Region:** europe-west1
- **Current Version:** v8

## Database Collections

| Collection | Description |
|------------|-------------|
| `questions` | All quiz questions with subject, topic, difficulty |
| `dailyAssignments` | Daily question assignments (key: `{date}-{subject}`) |
| `attempts` | User quiz attempts and scores |
| `streaks` | User streak data per subject |
| `questionStats` | Per-question performance statistics |

### Question Counts (as of last update)
- Computer Science: ~1000 questions
- Biology: 1000 questions
- Chemistry: 1000 questions (500 easy, 400 medium, 100 hard)

## Operations Guide

### Prerequisites
```bash
# Install dependencies
npm install

# Authenticate with GCP
gcloud auth login
gcloud auth application-default login
gcloud config set project gcse-cs-1
```

### Deployment

1. **Type check and deploy:**
```bash
npx tsc --noEmit
gcloud builds submit --config=cloudbuild.yaml --project=gcse-cs-1 --substitutions=COMMIT_SHA=v9
```

2. **Version numbering:** Increment version number (v8 -> v9 -> v10, etc.)

### Loading Question Data

**Replace a subject's questions:**
```bash
# Example: Replace chemistry questions
npx tsx scripts/replace-chemistry.ts
```

**Load new questions from JSON:**
```bash
# Create a script similar to scripts/load-biology.ts or scripts/load-chemistry.ts
npx tsx scripts/load-{subject}.ts
```

**Important:** After loading new questions, clear daily assignments:
```bash
npx tsx -e "
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({ projectId: 'gcse-cs-1' });
}
const db = getFirestore();

async function clear() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Replace 'chemistry' with target subject
  await db.collection('dailyAssignments').doc(today + '-chemistry').delete().catch(() => {});
  await db.collection('dailyAssignments').doc(tomorrowStr + '-chemistry').delete().catch(() => {});
  console.log('Cleared assignments');
}

clear().then(() => process.exit(0));
"
```

### Question Data Format

Questions JSON should follow this structure:
```json
{
  "stem": "Question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Explanation of the correct answer",
  "topic": "Topic name matching studyNotes.ts",
  "subject": "chemistry",
  "difficulty": 1
}
```

**Difficulty levels:**
- 1 = Easy (regular questions)
- 2 = Medium (regular questions)
- 3 = Hard (bonus questions only)

**Important:** Each subject needs difficulty 3 questions for bonus selection. Aim for ~100 hard questions per subject.

### Study Notes

Study notes are defined in `src/lib/studyNotes.ts`. Topics must match exactly between:
- Question `topic` field
- `studyNotes.ts` keys
- `TOPICS_BY_SUBJECT` in admin pages

### Common Issues

1. **"Must answer all 6 questions" error with only 5 shown:**
   - Cause: No difficulty 3 questions available for bonus
   - Fix: Upgrade some difficulty 2 questions to difficulty 3

2. **Preview not showing for a subject:**
   - Cause: Stale daily assignment with deleted question IDs
   - Fix: Delete the daily assignment document for that subject

3. **Authentication errors when running scripts:**
   - Fix: Run `gcloud auth application-default login`

## File Structure

```
src/
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── api/            # API routes
│   ├── quiz/           # Quiz pages (subjects, today, result)
│   └── progress/       # Progress page
├── components/         # Reusable components
├── lib/
│   ├── auth.ts         # Authentication
│   ├── firebase.ts     # Firebase config
│   ├── questions.ts    # Question selection logic
│   ├── quiz.ts         # Quiz management
│   ├── streak.ts       # Streak tracking
│   └── studyNotes.ts   # Study notes content
└── types/              # TypeScript types

scripts/                # Data loading and maintenance scripts
seed/                   # Seed data files
```

## Admin Access

Admin users are defined by email in `src/lib/auth.ts`. Check the `ADMIN_EMAILS` array.

## Recent Changes

1. **Multi-subject support** - Added Biology and Chemistry alongside Computer Science
2. **Subject-specific streaks** - Each subject has independent streak tracking
3. **Admin improvements** - Subject filtering, topic grouping in results
4. **Chemistry data refresh** - Replaced with ExamGrade dataset (1000 questions)

## Pending/Future Work

- Consider adding more question variety for Chemistry difficulty 3
- Monitor question performance and update weak questions
- Add more study notes as needed

## Useful Commands

```bash
# Local development
npm run dev

# Type check
npx tsc --noEmit

# Deploy
gcloud builds submit --config=cloudbuild.yaml --project=gcse-cs-1 --substitutions=COMMIT_SHA=vX

# Check Firestore data
npx tsx scripts/check-questions.ts

# Git
git status
git add .
git commit -m "message"
git push origin main
```

## Contact/Notes

- GCP Project: gcse-cs-1
- Region: europe-west1
- Firebase: Same project (gcse-cs-1)
