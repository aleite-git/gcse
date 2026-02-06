# Documentation & Developer Experience Review

**Date:** 2026-02-05

---

## 1. Documentation Quality

### README.md -- Needs Update

**Strengths:**
- Thorough getting-started guide covering clone, install, env setup, emulator, seeding, deployment
- Data model tables are clear and well-formatted

**Issues:**
- **Project structure diagram is outdated.** Missing `mobile/`, `docs/`, v1 API routes, streak routes, and many lib files (`streak.ts`, `subscription.ts`, `revenuecat.ts`, `mobile-auth.ts`, `account-deletion.ts`, `mobile-user-store.ts`, `active-subjects.ts`, `profanity-filter.ts`, etc.)
- **"Topics Covered" only lists Computer Science.** Biology and Chemistry are now active subjects
- **Data model documents only 4 of 10 collections.** Missing: `questionStats`, `userStreaks`, `streakActivities`, `mobileUsers`, `userProfiles`, `accountDeletionRequests`. Also missing the `subject` field on `questions` and `dailyAssignments`
- **"Tests cover" section mentions only 3 items,** while there are 35 test files covering auth, mobile auth, OAuth, subscriptions, RevenueCat, account deletion, streaks, onboarding, profanity filtering, and more

### BACKGROUND.md -- Excellent

The best documentation file in the project. Clearly explains the dual auth models, quiz flow step-by-step, streaks, subscriptions, account deletion, and admin tools. The "Known Design Assumptions" and "Maintenance Guidance" sections are particularly valuable for onboarding.

### AGENTS.md -- Minor Inconsistency

States "Maintain 100% automated test coverage" but jest.config.js enforces 90%. BACKGROUND.md correctly clarifies this as an interim threshold.

### docs/firestore-indexes.md -- Incomplete

Only documents one composite index (for account deletion). Likely additional indexes are needed for `attempts` queries combining `where` and `orderBy` on different fields.

### docs/admin-override.md -- Good

Clear and well-structured with working curl examples. One inaccuracy: references "Flutter app" (line 4) but the mobile app is Expo/React Native.

### docs/subscriptions.md -- Good

Good coverage of both direct verification and RevenueCat integration.

### docs/openapi.yaml -- Incomplete

**Issues:**
- Title says "GCSE Mobile Auth API" but covers much more than auth
- Duplicate `examples` keys at lines 286-300 (YAML silently overwrites earlier keys -- OAuth link examples are lost)
- Does not document core routes: `/api/quiz/today`, `/api/quiz/submit`, `/api/quiz/retry`, `/api/progress`, `/api/login`, `/api/logout`, `/api/login/mobile`, `/api/admin/questions`, `/api/admin/results`, `/api/admin/stats`, `/api/admin/preview`

---

## 2. Developer Experience

### Package.json Scripts -- Good with Gaps

- Standard scripts: `dev`, `build`, `start`, `lint`, `seed`, `seed:force`, `test`
- **Missing:** `typecheck` script (despite CLAUDE.md referencing `npx tsc --noEmit` as pre-deployment step)
- **Missing:** No formatting command (no Prettier config exists)

**Recommendation:** Add `"typecheck": "tsc --noEmit"` and configure Prettier.

### Environment Setup -- Split Source Problem

- `.env.example` covers core variables clearly with three auth options documented
- **Missing from `.env.example`:** `CRON_SECRET`, `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `ADMIN_OVERRIDE_AUDIENCE`
- These are documented in BACKGROUND.md but not in `.env.example`, creating a split-source problem

### No Formatter Configured

No Prettier configuration exists anywhere. Code formatting relies entirely on individual developer setups, which leads to inconsistent style.

---

## 3. Code Documentation

### JSDoc/TSDoc -- Present but Brief

Every exported function in core lib files has a JSDoc comment. However, comments describe WHAT but rarely WHY or what business rules they encode.

**Example:** `selectQuizQuestions` has the comment "Select 5 regular questions + 1 bonus hard question" which is good, but the inner algorithm (3 easy + 2 medium + 1 hard, fallback cascades, topic spreading) across 120 lines has no inline documentation.

### Complex Business Rules Lacking Documentation

| Area | File | Issue |
|------|------|-------|
| Streak freeze logic | `streak.ts:230-339` | Most complex algorithm in codebase, branching logic needs inline comments |
| Subscription status | `subscription.ts:42-65` | Interaction between `normalizeEntitlement`, `computeSubscriptionStatus`, and `getSubscriptionSummary` unclear |
| OAuth account linking | `mobile-auth.ts:335-434` | `oauth_link_required` error code and `allowLinkExisting` flag underdocumented |

### Types File -- Good

`src/types/index.ts` is well-organized with helpful inline comments on fields (e.g., `lastActivityDate` -- "YYYY-MM-DD in user's timezone").

---

## 4. Maintainability Concerns

### 4.1 HIGH -- Scripts Directory Not Version-Controlled

The entire `scripts/` directory is gitignored (`.gitignore` line 147). This means:
- 30 migration/data-fix scripts exist only locally
- Other developers can't see migration history or reuse scripts
- The `seed.ts` file (referenced by `npm run seed`) is gitignored -- contradicts README instructions

### 4.2 HIGH -- Timezone Mismatch in Scripts

Some scripts use `Europe/Lisbon` while the application uses `Europe/London`:
- `scripts/fix-assignments.ts:11` -- `Europe/Lisbon`
- `scripts/regenerate-today-tomorrow.ts:25` -- `Europe/Lisbon`
- `scripts/backfill-freezes.js:19` -- `Europe/Lisbon`
- `src/lib/date.ts:4` -- `Europe/London`

`Europe/Lisbon` and `Europe/London` differ by one hour during portions of the year (different DST transition rules). Running these scripts during those periods produces wrong dates.

### 4.3 MEDIUM -- Firebase Init Duplicated

Firebase initialization logic is duplicated between `src/lib/firebase.ts` and `scripts/seed.ts` with slight differences in credential detection order.

### 4.4 MEDIUM -- Mixed Languages in Scripts

Most scripts are TypeScript, but `backfill-freezes.js`, `regenerate-quizzes.js`, `update-chem-notes.js`, and `import-gemini-chem.js` are plain JavaScript with CommonJS requires.

### 4.5 MEDIUM -- Hardcoded User Credentials in Seed Script

**File:** `scripts/seed.ts:63`

Contains actual user-specific access codes (e.g., `pimpolho2009` with label `Pimpolho`). While scripts/ is gitignored, the code contains real credentials.

### 4.6 LOW -- No Versioning Strategy

Package version is `0.1.0` with no indication of strategy. Deployment uses manual `vX` tagging. The API has a partial versioning scheme: newer endpoints under `/api/v1/`, older under `/api/`.

---

## 5. API Design

### Route Structure -- Three Patterns

1. **Original web routes** (no prefix): `/api/login`, `/api/quiz/*`, `/api/progress`, `/api/streak`
2. **Mobile-specific:** `/api/mobile/login`, `/api/mobile/register`, `/api/mobile/oauth/*`, `/api/mobile/account/*`
3. **V1 API:** `/api/v1/me`, `/api/v1/me/subjects`, `/api/v1/subscription/*`

Plus legacy `/api/login/mobile` alongside newer `/api/mobile/login`.

### RESTful Design -- Mixed

**Good:**
- Proper HTTP method usage (GET for reads, POST for actions, PATCH for updates, PUT for replacements)
- Consistent JSON error responses with `{ error: string }` and appropriate status codes

**Concerns:**
- **Verb-based routes:** `/api/quiz/submit`, `/api/quiz/retry`, `/api/mobile/username/check`, `/api/mobile/username/update`
- **Inconsistent namespacing:** `/api/streak` serves both web and mobile but is not under `/api/v1/`. Subscriptions split between `/api/mobile/subscription/verify` and `/api/v1/subscription/*`
- **RPC pattern in streak:** `POST /api/streak` with `action` body field dispatches different behaviors. Separate endpoints would be clearer
- **Dual login route:** Both `/api/login/mobile` and `/api/mobile/login` exist

---

## Summary Table

| Priority | Finding |
|----------|---------|
| HIGH | Scripts directory gitignored (seed script, migration history lost) |
| HIGH | Timezone mismatch: scripts use `Europe/Lisbon` vs app's `Europe/London` |
| HIGH | OpenAPI spec has duplicate YAML keys causing silent data loss |
| HIGH | README project structure, data model, and tests sections outdated |
| MEDIUM | `.env.example` missing several environment variables |
| MEDIUM | OpenAPI spec missing core quiz/admin API routes |
| MEDIUM | No Prettier / formatting tool configured |
| MEDIUM | Firebase initialization duplicated between app and seed script |
| MEDIUM | Mixed TypeScript/JavaScript in scripts directory |
| MEDIUM | Hardcoded user credentials in seed script |
| LOW | API routes use verb-based naming instead of RESTful nouns |
| LOW | API versioning applied inconsistently |
| LOW | No automated versioning or changelog strategy |
| LOW | `studyNotes.ts` won't scale well with more subjects |
