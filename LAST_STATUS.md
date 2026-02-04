# GCSE Quiz App - Status Document

**Last Updated:** 2026-02-04

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
