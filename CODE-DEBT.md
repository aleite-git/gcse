# Code Debt Tracker

Generated from code review on 2026-02-05. Tickets ordered by priority within each category.

---

## CRITICAL

### DEBT-001: Add rate limiting to authentication endpoints
**Area:** Security
**Files:** `src/lib/auth.ts`, `src/app/api/login/route.ts`, `src/app/api/mobile/login/route.ts`, `src/app/api/mobile/register/route.ts`, `src/app/api/mobile/oauth/google/route.ts`, `src/app/api/mobile/oauth/apple/route.ts`
**Problem:** No rate limiting on any auth endpoint. The access code login at `auth.ts:35-55` iterates ALL active codes with `bcrypt.compare` per attempt (~150ms each). With 20 codes, an invalid login takes ~3s of CPU. This is both a brute-force and DoS vector.
**Fix:** Add a Firestore-based or in-memory rate limiter (e.g., sliding window by IP). Consider a fast pre-filter (SHA-256 prefix) before bcrypt to short-circuit invalid codes.
**Effort:** Medium

---

### ~~DEBT-002: Parallelize `getRecentlyUsedQuestionIds` Firestore reads~~ DONE
**Status:** Fixed. Replaced sequential `for` loop with `Promise.all()` in `src/lib/questions.ts:96-102`. All tests pass.

---

### DEBT-003: Eliminate full question collection scan on quiz generation
**Area:** Performance
**Files:** `src/lib/questions.ts:138`
**Problem:** `getActiveQuestions(subject)` loads every active question for a subject into memory to select just 6. Unbounded Firestore reads and memory usage that worsens as the question bank grows.
**Fix:** Pre-filter via Firestore queries (by difficulty + subject), or cache the question pool with a short TTL (questions change rarely). Alternatively, use a two-phase approach: query counts first, then fetch only needed difficulty buckets.
**Effort:** Medium

---

### ~~DEBT-004: Add Firestore transaction for daily assignment creation~~ DONE
**Status:** Fixed. `getOrCreateDailyAssignment` now uses `db.runTransaction()` for atomic create-if-not-exists. Added `Transaction` class to the Firestore test mock. All tests pass.

---

### ~~DEBT-005: Add test and type-check steps to CI/CD pipeline~~ DONE
**Status:** Fixed. Added `npm ci && npx tsc --noEmit && npm test` step before Docker build in `cloudbuild.yaml`. All tests pass.

---

## HIGH

### ~~DEBT-006: Enforce password complexity requirements~~ CLOSED
**Status:** Closed -- accepted risk. Simple passwords are fine for this use case.

---

### ~~DEBT-007: Use timing-safe comparison for webhook secrets~~ DONE
**Status:** Fixed. Both webhook routes now use `crypto.timingSafeEqual` with length pre-check. All tests pass.

---

### DEBT-008: Reduce Firestore reads in streak tracking
**Area:** Performance
**Files:** `src/lib/streak.ts:230-339`
**Problem:** `recordActivity` for "overall" performs ~8+ Firestore reads (multiple `getOrCreateUserStreak`, `syncOverallFreezeDays`, `getMaxSubjectStreak` calls). Called twice per quiz submission (subject + overall), totaling ~12-16 reads.
**Fix:** Cache streak data within the request context. Batch `getOrCreateUserStreak` calls. Refactor `syncOverallFreezeDays` to accept pre-fetched data instead of re-reading.
**Effort:** Medium

---

### ~~DEBT-009: Add email allowlist to admin subscription override~~ DONE
**Status:** Fixed. `verifyGoogleIdToken` now extracts `payload.email` and checks against `ADMIN_EMAILS` env var (defaults to `armando.leite@gmail.com`). All tests pass.

---

### ~~DEBT-010: Fix timezone mismatch in scripts~~ DONE
**Status:** Fixed. Replaced all `Europe/Lisbon` references with `Europe/London` across 9 script files. All tests pass.

---

### DEBT-011: Declare all secrets in cloudbuild.yaml
**Area:** Infrastructure / Security
**Files:** `cloudbuild.yaml:49-50`
**Problem:** Only 3 secrets are declared (`SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`). Missing: `CRON_SECRET`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_API_KEY`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, `ADMIN_OVERRIDE_AUDIENCE`.
**Fix:** Add all required secrets to the `--set-secrets` flag using Secret Manager references.
**Effort:** Small

---

### DEBT-012: Extract duplicated code into shared utilities
**Area:** Code Quality
**Files:** `src/lib/account-deletion.ts:26-47`, `src/lib/questions.ts:6-14`, `src/lib/streak.ts:118-124`, `src/lib/mobile-auth.ts:203-222`, `src/app/api/v1/me/route.ts:8-46`, `src/app/api/v1/me/subjects/route.ts:8-43`, `src/app/api/v1/subscription/webhook/route.ts:19-27`, `src/app/api/v1/subscription/sync/route.ts:19-21`
**Problem:** Multiple pieces of logic are duplicated across files:
- Firestore timestamp resolution (4 implementations)
- `toProfileResponse` (2 identical copies)
- `normalizeEntitlementForStatus` (2 copies)
- `SESSION_COOKIE_NAME` / `getSecretKey()` / `verifyToken` (duplicated between `auth.ts` and `middleware.ts`)
- Quiz question mapping (duplicated between `today/route.ts` and `retry/route.ts`)
**Fix:** Create shared utility modules: `src/lib/firestore-utils.ts` (timestamp resolution), `src/lib/profile-response.ts` (toProfileResponse), move `normalizeEntitlementForStatus` into `subscription.ts`. Document the `middleware.ts` duplication as intentional (edge runtime constraint).
**Effort:** Medium

---

### ~~DEBT-013: Replace string-based error classification with custom error classes~~ DONE
**Status:** Fixed. Created `QuizValidationError` class in `src/lib/quiz.ts`, updated `submitQuizAttempt` to throw it, and updated submit route to use `instanceof` check. All tests pass.

---

### ~~DEBT-014: Fix `scoring.test.ts` and `validation.test.ts` to import actual source~~ DONE
**Status:** Fixed. Extracted `calculateScore` and `validateSubmission` into `src/lib/quiz-scoring.ts`. Tests now import from actual source. `submitQuizAttempt` uses `calculateScore` from the module. All tests pass.

---

### DEBT-015: Add mobile app test infrastructure
**Area:** Testing
**Files:** `mobile/` directory
**Problem:** The mobile app (Expo React Native) has zero tests -- no component tests, no hook tests, no integration tests.
**Fix:** Set up React Native Testing Library. Start with tests for critical paths: auth context (`mobile/src/state/auth.tsx`), quiz state (`mobile/src/state/quiz.tsx`), API client (`mobile/src/api/client.ts`).
**Effort:** Large

---

## MEDIUM

### ~~DEBT-016: Add JWT issuer and audience claims~~ DONE
**Status:** Fixed. Added `iss: gcse-quiz` and `aud: gcse-quiz-web` to token creation and verification in both `auth.ts` and `middleware.ts`. All tests pass.

---

### DEBT-017: Add session revocation mechanism
**Area:** Security
**Files:** `src/lib/auth.ts:8`
**Problem:** Sessions last 7 days with no server-side revocation. Compromised tokens and revoked admin access persist until expiry.
**Fix:** Consider a Firestore-based token denylist with TTL matching session duration. Alternatively, shorten session duration to 24 hours and implement refresh tokens.
**Effort:** Medium

---

### DEBT-018: Extract magic numbers to named constants
**Area:** Code Quality
**Files:** `src/lib/questions.ts`, `src/lib/quiz.ts`, `src/lib/auth.ts`, `src/lib/mobile-auth.ts`, `src/lib/account-deletion.ts`, `src/app/api/quiz/today/route.ts`, `src/app/api/quiz/retry/route.ts`
**Problem:** Hard-coded values scattered throughout: `5` (bonus index), `6` (quiz size), `3`/`2` (easy/medium counts), `7` (repeat avoidance days), `30` (Firestore 'in' limit), `12` (bcrypt rounds), `100` (default limit).
**Fix:** Create `src/lib/constants.ts` with named exports: `QUIZ_SIZE`, `REGULAR_QUESTION_COUNT`, `BONUS_QUESTION_INDEX`, `EASY_COUNT`, `MEDIUM_COUNT`, `REPEAT_AVOIDANCE_DAYS`, `FIRESTORE_IN_LIMIT`, `BCRYPT_ROUNDS`, `DEFAULT_ATTEMPT_LIMIT`.
**Effort:** Small

---

### DEBT-019: Add runtime validation for Firestore reads
**Area:** Code Quality
**Files:** `src/lib/questions.ts:29-33`, `src/lib/quiz.ts:141-145`, `src/app/api/admin/stats/route.ts:38-41`
**Problem:** Firestore `.data()` results are cast with `as` to target types with no runtime shape validation. Missing or wrong-typed fields produce silently incorrect objects.
**Fix:** Add a lightweight validation layer (Zod schemas or manual checks) for Firestore reads on critical paths (questions, attempts, user records).
**Effort:** Medium

---

### DEBT-020: Add runtime input validation to admin question endpoints
**Area:** Security / Code Quality
**Files:** `src/app/api/admin/questions/[id]/route.ts:54-58`, `src/app/api/admin/questions/route.ts:54-65`
**Problem:** PATCH passes entire request body to Firestore with only TypeScript assertion. Bulk import validates only `subject`, not `stem`, `options`, `correctIndex`, etc.
**Fix:** Create a shared `validateQuestionInput()` function and apply it to both single and bulk operations.
**Effort:** Small

---

### DEBT-021: Add CORS configuration
**Area:** Security
**Files:** `next.config.ts` or `src/middleware.ts`
**Problem:** No CORS policy exists. Bearer token auth from mobile is callable from any origin.
**Fix:** Add CORS headers in middleware for API routes. Allow the production domain and mobile app origins.
**Effort:** Small

---

### ~~DEBT-022: Parallelize independent Firestore reads in quiz submission~~ DONE
**Status:** Fixed. Used `Promise.all` to parallelize `getQuestionsByIds` and `getTodayAttempts` in `submitQuizAttempt`. All tests pass.

---

### ~~DEBT-023: Parallelize streak queries for all subjects~~ DONE
**Status:** Fixed. Replaced sequential `for` loop with `Promise.all` in streak route GET handler. All tests pass.

---

### DEBT-024: Add pagination to admin endpoints
**Area:** Performance
**Files:** `src/app/api/admin/stats/route.ts:37`, `src/app/api/admin/questions/route.ts:29`, `src/app/api/admin/results/route.ts`
**Problem:** Admin endpoints fetch entire collections with no limit. The results endpoint returns the same data 3x in different shapes.
**Fix:** Add `limit` and `offset` (or cursor) query parameters. Deduplicate response payload for results endpoint.
**Effort:** Medium

---

### DEBT-025: Add response caching headers
**Area:** Performance
**Files:** All API routes, especially `src/app/api/quiz/today/route.ts`
**Problem:** No API routes set `Cache-Control` headers. The daily quiz is identical for all users of a subject but regenerated every request.
**Fix:** Add `Cache-Control: s-maxage=60, stale-while-revalidate=300` for read endpoints like quiz/today, progress, streak status.
**Effort:** Small

---

### DEBT-026: Eliminate double JWT verification
**Area:** Performance
**Files:** `src/middleware.ts`, all route handlers calling `getSessionFromRequest`
**Problem:** Middleware verifies the JWT and sets `x-user-label` / `x-user-is-admin` headers. Route handlers then re-verify the same JWT via `getSessionFromRequest()`.
**Fix:** Create a `getSessionFromHeaders(request)` utility that reads from middleware-set headers. Use it in route handlers instead of re-verifying.
**Effort:** Medium

---

### ~~DEBT-027: Use exact matching for public API routes in middleware~~ DONE
**Status:** Fixed. Changed `pathname.startsWith(route)` to `publicApiRoutes.includes(pathname)` for exact matching. All tests pass.

---

### ~~DEBT-028: Add `typecheck` script to package.json~~ DONE
**Status:** Fixed. Added `"typecheck": "tsc --noEmit"` to package.json scripts.

---

### DEBT-029: Update README with current project state
**Area:** Documentation
**Files:** `README.md`
**Problem:** Project structure diagram, data model, topics covered, and test coverage sections are significantly outdated. Missing: `mobile/`, `docs/`, v1 API routes, 6 Firestore collections, Biology/Chemistry subjects, 30+ test descriptions.
**Fix:** Rewrite the project structure section, expand data model to all 10 collections, add Biology/Chemistry to topics, update test coverage section.
**Effort:** Medium

---

### DEBT-030: Complete the OpenAPI specification
**Area:** Documentation
**Files:** `docs/openapi.yaml`
**Problem:** Title is misleading ("Mobile Auth API"). Missing core routes: quiz/today, quiz/submit, quiz/retry, progress, login, logout, all admin routes. Has duplicate YAML `examples` keys (lines 286-300) causing silent data loss.
**Fix:** Rename title, add missing route definitions, fix duplicate keys.
**Effort:** Medium

---

### DEBT-031: Update `.env.example` with all environment variables
**Area:** Documentation / Developer Experience
**Files:** `.env.example`
**Problem:** Missing `CRON_SECRET`, `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `ADMIN_OVERRIDE_AUDIENCE`, and related variables. Developers must consult BACKGROUND.md separately.
**Fix:** Add all env vars with descriptive comments.
**Effort:** Small

---

### DEBT-032: Document all required Firestore composite indexes
**Area:** Documentation
**Files:** `docs/firestore-indexes.md`
**Problem:** Only one composite index documented. Multiple queries in `quiz.ts` and elsewhere likely require composite indexes that are auto-created but not documented.
**Fix:** Audit all Firestore queries with `where` + `orderBy` combinations. Document each required index with the fields and sort order.
**Effort:** Small

---

### DEBT-033: Add mobile API client retry logic and caching
**Area:** Mobile / Performance
**Files:** `mobile/src/api/client.ts`, `mobile/src/api/endpoints.ts`
**Problem:** The API client is a thin fetch wrapper with no retry, backoff, timeout, cancellation, or caching. Mobile networks are unreliable. The daily quiz doesn't change but hits the server every time.
**Fix:** Add exponential backoff retry (3 attempts for network errors), request timeout (15s), and in-memory cache for daily quiz and progress data.
**Effort:** Medium

---

### DEBT-034: Configure Prettier for consistent code formatting
**Area:** Developer Experience
**Files:** Project root (new file)
**Problem:** No Prettier or formatting tool is configured. Code style relies on individual developer setups.
**Fix:** Add `.prettierrc` with project conventions and a `"format"` script in package.json.
**Effort:** Small

---

### ~~DEBT-035: Fix `getYesterdayInTimezone` timezone bug~~ DONE
**Status:** Fixed. Rewrote using `toZonedTime` + `subDays` + `formatInTimeZone` from date-fns-tz, matching the pattern used in `date.ts`. All tests pass.

---

### ~~DEBT-036: Remove or use dead code (`requireAuth` / `requireAdmin`)~~ DONE
**Status:** Fixed. Commented out with explanation — kept for future adoption as shared route guards. Removed associated tests. All tests pass.

---

### DEBT-037: Add direct tests for `/api/v1/me` route handlers
**Area:** Testing
**Files:** `__tests__/` (new file), `src/app/api/v1/me/route.ts`, `src/app/api/v1/me/subjects/route.ts`
**Problem:** The GET/PATCH `/api/v1/me` and PUT `/api/v1/me/subjects` route handlers have complex logic (profile creation, premium gating, subject validation) with only indirect test coverage.
**Fix:** Create `__tests__/v1-me-routes.test.ts` covering happy paths, auth failures, premium gating, and edge cases.
**Effort:** Small

---

### DEBT-038: Expand `login-mobile-route.test.ts` coverage
**Area:** Testing
**Files:** `__tests__/login-mobile-route.test.ts`
**Problem:** Contains a single happy-path test. No tests for invalid input, missing code, inactive codes, or error responses.
**Fix:** Add test cases for: missing code, invalid code, inactive code, server error.
**Effort:** Small

---

## LOW

### DEBT-039: Add salt to IP address hashing
**Area:** Security
**Files:** `src/lib/quiz.ts:314-316`
**Problem:** IP addresses are SHA-256 hashed without a salt. IPv4 space is small enough for precomputation attacks.
**Fix:** Add a server-side salt (from env var or constant) to the hash input.
**Effort:** Small

---

### DEBT-040: Fix OAuth linking password replacement
**Area:** Security
**Files:** `src/lib/mobile-auth.ts:362-367`
**Problem:** When linking to OAuth, the password hash is replaced with `bcrypt.hash(profile.subject, 12)`, silently disabling password login. If an attacker knows the OAuth subject ID, they could authenticate via the password endpoint.
**Fix:** Set `passwordHash` to `null` or a sentinel value that always fails comparison when OAuth is linked. Add a check in `loginMobileUser` to reject password auth for OAuth-linked accounts.
**Effort:** Small

---

### DEBT-041: Validate timezone parameter in API routes
**Area:** Code Quality
**Files:** `src/app/api/quiz/submit/route.ts:84`, `src/app/api/streak/route.ts:27`
**Problem:** Timezone strings from user input are not validated. Invalid values could cause unexpected behavior in date calculations.
**Fix:** Validate against `Intl.supportedValuesOf('timeZone')` or a try/catch around `Intl.DateTimeFormat`.
**Effort:** Small

---

### DEBT-042: Fix `studyNotes.ts` key mismatch with topic types
**Area:** Code Quality
**Files:** `src/lib/studyNotes.ts`
**Problem:** Biology keys use strings like `'Cell biology'` which don't match the `BiologyTopic` type values (`CellBiology`). Same for Chemistry. This causes runtime lookup failures.
**Fix:** Align keys with the typed topic union values, or add a mapping layer.
**Effort:** Small

---

### ~~DEBT-043: Rename `questionStats.ts` to kebab-case~~ DONE
**Status:** Fixed. Renamed to `question-stats.ts` and updated all imports (source + tests). All tests pass.

---

### DEBT-044: Remove test helper from production code
**Area:** Code Quality
**Files:** `src/lib/profanity-filter.ts:115-118`
**Problem:** `__resetProfanityCacheForTests` is exported from production code. Test utilities should not be in production modules.
**Fix:** Use dependency injection or `jest.resetModules()` instead.
**Effort:** Small

---

### DEBT-045: Set `min-instances: 1` for Cloud Run during school hours
**Area:** Infrastructure
**Files:** `cloudbuild.yaml:44`
**Problem:** With `min-instances: 0`, the service scales to zero. Cold starts for Next.js + Firebase Admin take 3-5s. The first user each morning gets a slow response.
**Fix:** Set `min-instances: 1`, or use Cloud Scheduler to send warmup requests before peak hours.
**Effort:** Small

---

### DEBT-046: Add health check endpoint
**Area:** Infrastructure
**Files:** `src/app/api/` (new route)
**Problem:** No `/health` or `/readiness` endpoint for monitoring or load balancer configuration.
**Fix:** Add `src/app/api/health/route.ts` returning `{ status: 'ok' }`.
**Effort:** Trivial

---

### DEBT-047: Add TTL or cleanup for `streakActivities` collection
**Area:** Performance
**Files:** `src/lib/streak.ts:252`
**Problem:** Every streak activity creates a new Firestore document. No TTL, cleanup, or archival. Collection grows unbounded.
**Fix:** Add a Firestore TTL policy (e.g., 90 days), or add cleanup logic to the existing deletion cron job.
**Effort:** Small

---

### DEBT-048: Add mobile offline support
**Area:** Mobile
**Files:** `mobile/src/api/client.ts`, `mobile/src/api/endpoints.ts`, `mobile/src/state/quiz.tsx`
**Problem:** No offline queue, no local storage of quiz data, no optimistic UI. Quiz loading and submission fail entirely on poor connections.
**Fix:** Cache the daily quiz in AsyncStorage after first fetch. Queue submissions locally and sync when connectivity returns. Show cached progress data when offline.
**Effort:** Large

---

## Summary

| Priority | Open | Closed | Quick Wins Remaining |
|----------|------|--------|----------------------|
| CRITICAL | 2 | 3 (002, 004, 005) | — |
| HIGH | 4 | 6 (006, 007, 009, 010, 013, 014) | DEBT-011 |
| MEDIUM | 16 | 7 (016, 022, 023, 027, 028, 035, 036) | DEBT-018, DEBT-020, DEBT-021, DEBT-025, DEBT-031, DEBT-032, DEBT-034, DEBT-037, DEBT-038 |
| LOW | 9 | 1 (043) | DEBT-039, DEBT-040, DEBT-041, DEBT-042, DEBT-044, DEBT-046 |
| **Total** | **31 open** | **17 closed** | **16 quick wins** |
