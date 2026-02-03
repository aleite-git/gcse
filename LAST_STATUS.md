# GCSE Quiz App - Status Document

**Last Updated:** 2026-02-03

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
- Mobile API endpoints for account deletion + subscription gating

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
- **Latest Revision (last confirmed):** gcse-quiz-00051-c97

## Database Collections

| Collection | Description |
|------------|-------------|
| `questions` | All quiz questions with subject, topic, difficulty |
| `dailyAssignments` | Daily question assignments (key: `{date}-{subject}`) |
| `attempts` | User quiz attempts and scores |
| `streaks` | User streak data per subject |
| `questionStats` | Per-question performance statistics |
| `mobileUsers` | Mobile user profiles and subscription fields |
| `accountDeletionRequests` | Account deletion workflow records |
| `userProfiles` | Mobile user profile data |

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
│   ├── studyNotes.ts   # Study notes content
│   └── subscription.ts # Subscription entitlement logic
└── types/              # TypeScript types

scripts/                # Data loading and maintenance scripts
seed/                   # Seed data files
```

## Admin Access

Admin users are defined by email in `src/lib/auth.ts`. Check the `ADMIN_EMAILS` array.

## Recent Changes

1. **Subscriptions (backend)**
   - Added subscription fields to mobile users and `/api/v1/me` responses.
   - Added entitlement logic (active/grace/expired/admin override).
   - Added `/api/mobile/subscription/verify` to validate purchases and set 18-month unlock.

2. **Account deletion**
   - Added per-user cleanup to prevent cross-user deletion status leaks.
   - Added CRON secret for the deletion job and updated Cloud Run env vars.
   - Updated resend emails to include the help link: https://www.quizzwizz.app/.

3. **Cloud build configuration**
   - Cloud Build now injects `RESEND_API_KEY` and `RESEND_FROM_EMAIL` secrets.

4. **Admin override (backend-only)**
   - Added a backend-only admin override endpoint protected by Google ID tokens (Cloud Run Invoker).
   - Admin override unlocks all subjects regardless of subscription status.
   - Documentation is in `docs/admin-override.md`.
5. **Subscription verification**
   - Added backend verification endpoint for Apple/Google receipts.
   - Documentation is in `docs/subscriptions.md`.

## Account Deletion Status

Backend implementation exists for the account deletion flow:
- Request/confirm deletion and request/confirm cancellation endpoints are implemented.
- Deletion requests are stored in Firestore with rate limits, code TTL, and attempt limits.
- User records include deletion fields (requested/scheduled/cancelled/status).
- A deletion job function exists to remove user data when scheduled.
- Manual job run endpoint exists (`/api/admin/account-deletion/run`) and requires `x-cron-secret`.

**Scheduler status:** Verified. Cloud Scheduler job `account-deletion-job` is ENABLED and targets `/api/admin/account-deletion/run` on the Cloud Run URL.

## Pending/Future Work

- Confirm Cloud Scheduler job exists and points at the deletion run endpoint.
- Implement subscription purchase validation/receipts and 18-month unlock enforcement (backend).
- Configure Apple App Store Server API and Google Play Developer API credentials in production.
- Add audit/admin logging for deletion + subscription changes (if needed).
- Ensure callers use a Google ID token with Cloud Run Invoker access for admin override.
- Optional: set `ADMIN_OVERRIDE_AUDIENCE` if using a custom domain.
- Keep `docs/firestore-indexes.md` in sync with new Firestore queries.

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
