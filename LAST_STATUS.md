# GCSE Quiz App - Status Document

**Last Updated:** 2026-02-05

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

## Recent Changes

1. **OAuth linking with user confirmation (backend)**
   - Google/Apple OAuth now returns `code: oauth_link_required` when email already exists.
   - Client must confirm linking; backend then links OAuth and replaces the password login.
   - `linkExisting: true` added to OAuth request payloads.
   - `docs/openapi.yaml` updated with new request field + error code.

2. **OpenAPI error shape**
   - `ErrorResponse` now includes optional `code` for machine-readable errors.

3. **Timezone locked to Europe/London**
   - App-level timezone helpers now use London for quiz dates and progress summaries.
   - Progress summary now builds the last-N days list using London dates to avoid UTC drift.

## Review Findings (Tracked)

1. **Progress window uses UTC dates, not London**
   - **Location:** `src/lib/quiz.ts:406`
   - **Status:** Resolved (2026-02-05)
   - **Note:** Progress dates now use London helpers (`getLastNDaysLondon`), so date keys match stored attempt dates.

2. **Bulk import breaks for >500 questions**
   - **Location:** `src/lib/questions.ts` (`bulkImportQuestions`)
   - **Status:** Resolved (2026-02-05)
   - **Note:** The import now creates a fresh Firestore batch after each commit, so imports >500 complete safely.

3. **Timezone drift in “tomorrow preview” date**
   - **Location:** `src/lib/quiz.ts` (`generateTomorrowPreview`)
   - **Status:** Resolved (2026-02-05)
   - **Note:** Uses London-aware helper (`getTomorrowLondon`) to build the YYYY-MM-DD doc ID.

4. **Coverage requirement not enforced by tooling**
   - **Location:** `jest.config.js`, `package.json`
   - **Status:** Adjusted (2026-02-05)
   - **Note:** Coverage thresholds are now set to 90% as an explicit override of the 100% guideline. We still aim to increase coverage over time.

5. **Documentation mismatch**
   - **Location:** `README.md`, `package.json`
   - **Status:** Ignored (per decision)
   - **Why:** README claims Next.js 15, but `package.json` pins `next` to `16.1.1`. This is intentionally left as-is.

6. **Ignored folders are present**
   - **Location:** `.gitignore`
   - **Status:** Open
   - **Why:** `mobile/` and `android/` are ignored but exist in the repo, which can confuse contributors about what is actually tracked.

7. **Quiz length assumes 6 questions are always available**
   - **Location:** `src/lib/questions.ts`, `src/lib/quiz.ts`
   - **Status:** Resolved (2026-02-05)
   - **Note:** The quiz now supports fewer than 6 questions. If no questions are available, the API returns the message “Question bank being revised! No quiz today!” and the UI blocks submission.

## Account Deletion Status

Backend implementation exists for the account deletion flow:
- Request/confirm deletion and request/confirm cancellation endpoints are implemented.
- Deletion requests are stored in Firestore with rate limits, code TTL, and attempt limits.
- User records include deletion fields (requested/scheduled/cancelled/status).
- A deletion job function exists to remove user data when scheduled.
- Manual job run endpoint exists (`/api/admin/account-deletion/run`) and requires `x-cron-secret`.

**Scheduler status:** Verified. Cloud Scheduler job `account-deletion-job` is ENABLED and targets `/api/admin/account-deletion/run` on the Cloud Run URL.

## Pending / Next Steps

- Deploy the OAuth linking changes to Cloud Run.
- Confirm `GOOGLE_CLIENT_ID` is set in Cloud Run for Google token verification.
- Configure Apple App Store Server API and Google Play Developer API credentials in production.
- Add audit/admin logging for deletion + subscription changes (if needed).
- Optional: set `ADMIN_OVERRIDE_AUDIENCE` if using a custom domain.

## Useful Commands

```bash
# Local development
npm run dev

# Type check
npx tsc --noEmit

# Tests
npm test

# Deploy
gcloud builds submit --config=cloudbuild.yaml --project=gcse-cs-1 --substitutions=COMMIT_SHA=vX
```
