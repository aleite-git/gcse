# Performance & Infrastructure Review

**Date:** 2026-02-05

---

## 1. Database Performance

### 1.1 CRITICAL -- N+1 Sequential Reads in `getRecentlyUsedQuestionIds`

**File:** `src/lib/questions.ts:91-128`

This function iterates over the last 7 days with **separate sequential Firestore reads per day**:

```typescript
for (const date of recentDates) {
  const docId = `${date}-${subject}`;
  const doc = await db.collection(COLLECTIONS.DAILY_ASSIGNMENTS).doc(docId).get();
}
```

Each read incurs ~20-50ms network latency. Total: 140-350ms of avoidable latency. Called on every quiz generation.

**Recommendation:** Use `Promise.all()` to parallelize, or `getAll()` for batched reads.

### 1.2 CRITICAL -- Full Question Collection Scan

**File:** `src/lib/questions.ts:138`

```typescript
const allQuestions = await getActiveQuestions(subject);
```

Loads **every active question** for a subject into memory to select just 6 questions. As the question bank grows, this becomes increasingly expensive in both Firestore reads and memory.

**Recommendation:** Pre-filter with Firestore queries (by difficulty/topic), or cache the question pool with a short TTL.

### 1.3 HIGH -- Sequential Reads in `getQuestionsByIds` Chunks

**File:** `src/lib/questions.ts:67-81`

Chunks of 30 IDs are queried sequentially. With 60+ IDs, the second batch waits for the first.

**Recommendation:** Use `Promise.all()` for parallel chunk queries.

### 1.4 HIGH -- Excessive Firestore Reads in Streak Logic

**File:** `src/lib/streak.ts:230-339`

`recordActivity` for the "overall" subject path performs ~8+ Firestore reads (multiple calls to `getOrCreateUserStreak`, `syncOverallFreezeDays`, `getMaxSubjectStreak`). In the quiz submit route, `recordActivity` is called **twice** (once for subject, once for overall), totaling ~12-16 reads just for streak tracking.

**Recommendation:** Cache streak data within the request, reduce redundant reads, batch related operations.

### 1.5 HIGH -- Redundant Reads in `submitQuizAttempt`

**File:** `src/lib/quiz.ts:170-266`

Sequential reads: assignment read, 6 questions read, attempts query. Steps 2 and 3 are independent and could be parallelized.

### 1.6 MEDIUM -- No Transaction for Daily Assignment Creation

**File:** `src/lib/quiz.ts:11-47`

The create-if-not-exists pattern uses simple read-then-write without a Firestore transaction. Two concurrent requests for the same day/subject can both create the assignment, with the second overwriting the first.

**Recommendation:** Use `db.runTransaction()` for atomic create-if-not-exists.

### 1.7 MEDIUM -- Missing Composite Index Documentation

**File:** `docs/firestore-indexes.md`

Only one composite index is documented. The codebase uses several queries likely requiring composite indexes (`attempts` with `date` + `userLabel` + `subject` + `orderBy`). If the database is recreated, these queries will fail.

**Recommendation:** Audit all Firestore queries and document required indexes.

---

## 2. API Performance

### 2.1 CRITICAL -- bcrypt Loop Over All Access Codes

**File:** `src/lib/auth.ts:35-55`

Loads **all active access codes** and performs sequential `bcrypt.compare` against each. With cost factor 12, each comparison takes ~100-200ms. For 20 codes, worst case (invalid code) is ~3 seconds. This is both a performance and DoS concern.

**Recommendation:** Store a fast hash (SHA-256) alongside bcrypt for initial filtering, or use a lookup-by-hash pattern.

### 2.2 HIGH -- Sequential Streak Queries for All Subjects

**File:** `src/app/api/streak/route.ts:58-59`

When no subject specified, streak status for every subject is fetched sequentially in a `for` loop. Each involves 1+ Firestore reads.

**Recommendation:** Use `Promise.all()` to parallelize.

### 2.3 HIGH -- Unbounded Admin Endpoint Reads

- `src/app/api/admin/stats/route.ts:37` -- fetches **every** document in `questionStats` with no limit
- `src/app/api/admin/questions/route.ts:29` -- loads all questions
- `src/app/api/admin/results/route.ts` -- returns duplicated views of the same data (3x payload)

**Recommendation:** Add pagination, or cursor-based loading.

### 2.4 MEDIUM -- No Response Caching Headers

No API routes set `Cache-Control` headers. The daily quiz is the same for all users of a given subject, yet it's regenerated every request.

**Recommendation:** Add `s-maxage=60` for quiz/today and similar read endpoints.

### 2.5 MEDIUM -- Double JWT Verification

Middleware verifies the JWT and sets headers (`x-user-label`, `x-user-is-admin`). Then route handlers call `getSessionFromRequest()` which re-verifies the same JWT.

**Recommendation:** Route handlers should read from middleware-set headers instead of re-verifying.

---

## 3. Docker & Deployment

### 3.1 GOOD -- Multi-Stage Build

Three-stage build (deps, builder, runner) is well-structured. Uses `node:20-alpine`, non-root user, standalone output, disabled telemetry.

### 3.2 GOOD -- .dockerignore

Correctly excludes node_modules, .git, tests, mobile directory, docs, and seed data.

### 3.3 MEDIUM -- Cold Start Risk

**File:** `cloudbuild.yaml:44`

With `min-instances: 0`, the service scales to zero. Cold starts for Next.js + Firebase Admin can take 3-5 seconds. For a daily quiz app with predictable usage (morning activity), the first user each day gets a slow response.

**Recommendation:** Set `min-instances: 1` during school hours, or use Cloud Scheduler warmup.

### 3.4 LOW -- No Health Check Endpoint

No `/health` or `/readiness` endpoint exists for monitoring or load balancer configuration.

---

## 4. Scalability Concerns

### 4.1 streakActivities Collection Grows Unbounded

**File:** `src/lib/streak.ts:252`

Every activity creates a new document. No TTL, cleanup, or archival.

**Recommendation:** Add TTL policy or periodic cleanup.

### 4.2 No Retry Logic Anywhere

Zero retry logic in the entire codebase. Firestore operations can fail transiently (network hiccups, quota limits, 503s). No retry wrappers, exponential backoff, or circuit breakers.

### 4.3 No Graceful Degradation

If Firestore is unavailable, every endpoint returns a generic 500. No fallback to cached data, no circuit breaker, no degraded mode.

### 4.4 Error Messages May Leak Internal State

**File:** `src/app/api/quiz/submit/route.ts:119-131`

Unhandled error messages are returned directly to the client. Firestore errors containing internal paths could be exposed.

---

## 5. Mobile App

### 5.1 HIGH -- No Offline Support

No offline queue, no local storage of quiz data, no optimistic UI updates. Quiz loading and submission fail entirely on poor connections.

### 5.2 MEDIUM -- No Retry Logic in API Client

**File:** `mobile/src/api/client.ts`

The `apiRequest` function is a thin fetch wrapper with no retry, backoff, timeout, or cancellation. Mobile networks are unreliable.

### 5.3 MEDIUM -- No Caching Strategy

**File:** `mobile/src/api/endpoints.ts`

Every API call goes to the server with no caching. The daily quiz doesn't change, yet it hits the server every time.

### 5.4 LOW -- Hardcoded Production URL

**File:** `mobile/src/config.ts`

Production Cloud Run URL hardcoded as fallback. URL changes require new app builds.

### 5.5 LOW -- No Response Type Validation

**File:** `mobile/src/api/client.ts:27`

Response is cast as `T` without runtime validation. Server shape changes cause runtime crashes.

---

## Summary Table

| Priority | Finding | Location |
|----------|---------|----------|
| CRITICAL | bcrypt O(N) login loop | `src/lib/auth.ts:35-55` |
| CRITICAL | N+1 sequential reads (7 per quiz) | `src/lib/questions.ts:91-128` |
| CRITICAL | Full question collection loaded every quiz | `src/lib/questions.ts:138` |
| HIGH | ~16 Firestore reads per quiz submission (streaks) | `src/lib/streak.ts:230-339` |
| HIGH | No race condition protection for assignments | `src/lib/quiz.ts:11-47` |
| HIGH | Sequential streak queries for all subjects | `src/app/api/streak/route.ts:58-59` |
| HIGH | Unbounded admin endpoint reads | `admin/stats/route.ts`, `admin/questions/route.ts` |
| HIGH | Zero retry logic anywhere | Throughout |
| HIGH | No mobile offline support | `mobile/src/api/` |
| MEDIUM | Double JWT verification | `middleware.ts` + route handlers |
| MEDIUM | No response caching | All API routes |
| MEDIUM | Cold start risk (min-instances=0) | `cloudbuild.yaml:44` |
| MEDIUM | Missing composite index documentation | `docs/firestore-indexes.md` |
| MEDIUM | No mobile retry/caching | `mobile/src/api/client.ts` |
| LOW | No health check endpoint | N/A |
| LOW | Hardcoded production URL in mobile | `mobile/src/config.ts` |
