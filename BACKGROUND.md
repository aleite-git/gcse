# GCSE Quiz Codebase Background

## Purpose
This repository powers the Daily 5 GCSE Quiz. It serves a web app (Next.js) and a mobile app (Expo/React Native) that both talk to the same backend API routes. The goal is to deliver a short daily quiz, track progress and streaks, and give admins tools to manage questions and review results.

## Big Picture Architecture
The codebase is a single repo with two apps and shared backend logic:
- Web app: Next.js App Router in `src/app` with server-side API routes under `src/app/api`.
- Backend logic: TypeScript modules in `src/lib` shared by API routes.
- Mobile app: Expo project in `mobile/` that calls the same API endpoints using bearer tokens.
- Database: Google Cloud Firestore via the Firebase Admin SDK.
- Hosting: Google Cloud Run (containerized Next.js) with Cloud Build in `cloudbuild.yaml`.

## Repository Map
These are the most important top-level folders and files:
- `src/` contains the Next.js app, API routes, and backend logic.
- `src/app/` contains UI routes and API handlers (`/api/...`).
- `src/lib/` contains the core logic for auth, quiz selection, streaks, subscriptions, and account deletion.
- `src/types/` contains shared TypeScript types for questions, attempts, API responses, and streaks.
- `mobile/` contains the Expo app for iOS/Android.
- `__tests__/` contains Jest unit tests for core logic and mobile auth routes.
- `scripts/seed.ts` seeds Firestore with access codes and questions.
- `docs/` contains operational documentation (indexes, subscriptions, admin override, OpenAPI).
- `cloudbuild.yaml` and `Dockerfile` define the Cloud Run build and container setup.

## Core Features (What the App Does)
- Daily quiz: 5 regular questions plus 1 bonus question per subject.
- Immediate feedback with explanations and optional study notes.
- Progress tracking for the last 7 days.
- Topic performance analysis and weak-topic detection.
- Streaks with “freeze day” rewards to protect a streak.
- Admin question management, previews, and analytics.
- Mobile user accounts with email/password or OAuth, plus subscription verification.
- Account deletion request and scheduled deletion job.

## Data Model (Firestore)
Main collections and their roles:
- `accessCodes` stores hashed login codes for web access.
- `questions` stores all quiz questions.
- `dailyAssignments` stores the daily question IDs per subject and date.
- `attempts` stores quiz attempts and scores.
- `questionStats` stores per-question correctness stats per user.
- `userStreaks` and `streakActivities` store streak data and activity logs.
- `mobileUsers` stores mobile auth accounts and subscription status.
- `userProfiles` stores profile data for access-code users.
- `accountDeletionRequests` stores deletion/cancellation verification codes.

## Authentication and Sessions
There are two auth models that both use JWTs created in `src/lib/auth.ts`.

Web access code login:
- Route: `POST /api/login`.
- The backend validates the access code against hashed values in `accessCodes`.
- A signed JWT is stored as an HTTP-only cookie (`gcse_session`).
- Middleware in `src/middleware.ts` protects routes and admin pages.

Mobile login:
- Route: `POST /api/login/mobile` for access codes.
- Route: `POST /api/mobile/login` for email/username + password.
- Route: `POST /api/mobile/oauth/google` and `/api/mobile/oauth/apple` for OAuth.
- The backend returns the JWT in JSON (mobile stores it with SecureStore).
- Subsequent requests pass `Authorization: Bearer <token>`.

## Quiz Flow (Step-by-Step)
1. User picks a subject (`/quiz/subjects` or `/quiz/today?subject=...`).
2. Backend calls `getOrCreateDailyAssignment()` in `src/lib/quiz.ts`.
3. `selectQuizQuestions()` in `src/lib/questions.ts` chooses 5 regular + 1 bonus.
4. Client receives questions without correct answers.
5. User submits answers to `POST /api/quiz/submit`.
6. Server scores answers, saves an `attempt`, updates `questionStats`, and updates streaks.
7. Client displays per-question feedback and topic breakdown.

## Streaks and Freeze Days
Streaks are tracked per subject and also as an overall streak:
- Any quiz submit counts as daily activity.
- Every 5 streak days earns a freeze day, capped at 2 stored at once.
- Freeze days can cover missed days to keep the streak alive.
- Streak logic lives in `src/lib/streak.ts` and is exposed via `/api/streak`.

## Subscriptions (Mobile)
Subscriptions are handled for the mobile app only:
- `POST /api/mobile/subscription/verify` verifies Apple or Google purchases.
- Verification uses App Store Server API or Google Play Developer API.
- A fixed 18-month unlock is stored in Firestore.
- `adminOverride` can force premium access for testing or support.

## Account Deletion
Account deletion is a multi-step flow for email/password mobile users:
- Request deletion: `POST /api/mobile/account/delete/request`.
- Confirm deletion via email code: `POST /api/mobile/account/delete/confirm`.
- Cancellation flow has matching request and confirm endpoints.
- A scheduled job `POST /api/admin/account-deletion/run` deletes data after the cool-off window.
- The job requires `CRON_SECRET` in headers.

## Admin Tools (Web)
Admin features are protected by the `isAdmin` flag in the session:
- Question list, edit, delete, bulk import.
- Results dashboard and per-user stats.
- Question performance stats.
- Tomorrow quiz preview per subject.
- Subscription override endpoint secured by Google ID tokens.

## Mobile App Overview
The Expo app lives in `mobile/` and mirrors the core quiz flows:
- Auth state stored in SecureStore (`mobile/src/state/auth.tsx`).
- API wrapper in `mobile/src/api/client.ts`.
- Screens are in `mobile/app/(app)/` for quiz, subjects, results, and progress.
- Navigation uses `expo-router`.

## Configuration and Environment Variables
Common backend env vars:
- `SESSION_SECRET` for JWT signing.
- Firestore credentials: `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_*` or `FIRESTORE_EMULATOR_HOST`.
- Email: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- Subscriptions: `APPLE_IAP_*`, `GOOGLE_PLAY_PACKAGE_NAME`.
- Admin override: `ADMIN_OVERRIDE_AUDIENCE` (optional).
- Account deletion job: `CRON_SECRET`.

Mobile app env var:
- `EXPO_PUBLIC_API_BASE_URL` to point the app at the backend.

## Development Workflows
Key scripts (root project):
```bash
npm run dev
npm run test
npm run seed
npm run seed:force
```

Key scripts (mobile app):
```bash
cd mobile
npm install
npm run start
```

## Tests and Quality Bar
Tests live in `__tests__/` and cover:
- Scoring and validation rules.
- Date and streak calculations.
- Mobile auth and OAuth flows.
- Admin subscription override route.

The project requirement is 100% automated test coverage. We are currently enforcing a **90% global coverage threshold** in Jest as an explicit override, so new logic must still ship with tests and we should work back toward 100%.

## Maintenance Guidance (Based on Current Implementation)
Use this checklist when updating or operating the system:
- Add new questions via the admin UI or by updating `seed/questions.json` and re-running `npm run seed`.
- Keep Firestore indexes in sync; see `docs/firestore-indexes.md` if a query complains about indexes.
- Rotate secrets regularly and never commit `.env` or service account keys.
- Ensure Cloud Run has access to Secret Manager for `SESSION_SECRET` and email credentials.
- Verify that subjects and question difficulty balance remain consistent (3 easy, 2 medium, 1 hard).
- Watch for date logic that assumes London timezone and keep all date math consistent.
- Monitor the account deletion job logs and ensure `CRON_SECRET` is set for cron calls.
- For mobile subscriptions, confirm Apple/Google credentials in production and test with sandbox.

## Known Design Assumptions
These are assumptions the code currently depends on:
- Daily assignments and attempt dates use a consistent timezone (London in most places).
- Access codes are few enough to validate with bcrypt comparisons in a loop.
- Mobile users are stored in `mobileUsers`, while access-code users use `userProfiles`.

Fail-safe behavior for question counts:
- If a subject has fewer than 6 active questions, the quiz shows whatever is available.
- If a subject has zero active questions, the quiz response includes the message “Question bank being revised! No quiz today!” and the UI blocks submission.

If any of those assumptions change, the related logic and tests will need to be updated.
