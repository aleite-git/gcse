# Testing & Coverage Review

**Date:** 2026-02-05

---

## 1. Coverage Configuration

**File:** `jest.config.js`

- **Threshold:** 90% across branches, functions, lines, and statements (enforced)
- **Scope:** `src/lib/**/*.{ts,tsx}` and `src/app/api/**/*.{ts,tsx}`
- **Exclusions:** `studyNotes.ts` (static data), `use-me.tsx` (client-side hook), `*.d.ts`

This is a strong configuration, well above industry averages.

---

## 2. Coverage Map

### Library Modules -- 22 files, all covered

Every library file within the coverage scope has at least one dedicated test file:

| Source Module | Test File(s) |
|---|---|
| `auth.ts` | `auth.test.ts`, `auth-cookies.test.ts` |
| `quiz.ts` | `quiz.test.ts` |
| `questions.ts` | `questions.test.ts` |
| `streak.ts` | `streak.test.ts` |
| `subscription.ts` | `subscription.test.ts` |
| `subscription-verification.ts` | `subscription-verification.test.ts` |
| `mobile-auth.ts` | `mobile-auth.test.ts` |
| `mobile-oauth.ts` | `mobile-oauth.test.ts` |
| `mobile-user-store.ts` | `mobile-user-store.test.ts` |
| `account-deletion.ts` | `account-deletion.test.ts` |
| `account-deletion-job.ts` | `account-deletion-job.test.ts` |
| `firebase.ts` | `firebase.test.ts` |
| `email.ts` | `email.test.ts` |
| `date.ts` | `date.test.ts` |
| `profanity-filter.ts` | `profanity-filter.test.ts`, `profanity-filter.mock.test.ts` |
| `onboarding.ts` | `onboarding.test.ts`, `onboarding-client.test.ts` |
| `active-subjects.ts` | `active-subjects.test.ts` |
| `me-client.ts` | `me-client.test.ts` |
| `revenuecat.ts` | `revenuecat.test.ts` |
| `questionStats.ts` | `question-stats.test.ts` |
| `user-profile-store.ts` | `user-profile-store.test.ts` |

### API Routes -- 30+ routes, mostly covered

The comprehensive `api-routes.test.ts` covers: login, logout, quiz/today, quiz/retry, quiz/submit, progress, streak, admin/preview, admin/questions (CRUD), admin/results, admin/stats, admin/account-deletion/run.

Additional dedicated test files cover mobile auth, OAuth, subscription, RevenueCat, and account deletion routes.

### Coverage Gaps

| Gap | Severity |
|-----|----------|
| `/api/v1/me/route.ts` (GET, PATCH) -- complex `getOrCreateProfile` and PATCH logic | MEDIUM |
| `/api/v1/me/subjects/route.ts` (PUT) -- subject validation and premium gating | MEDIUM |
| `login-mobile-route.test.ts` -- single happy-path test only | MEDIUM |
| Mobile app (`mobile/`) -- zero tests | HIGH |

---

## 3. Test Quality

### Strengths

**Behavioral testing:** Tests overwhelmingly test observable behavior (return values, state changes, error messages) rather than internal implementation details. Example from `auth.test.ts`:
```typescript
it('hashes and verifies access codes', async () => {
  const hash = await hashAccessCode('code123');
  expect(await verifyAccessCode('code123', hash)).toBe(true);
  expect(await verifyAccessCode('bad', hash)).toBe(false);
});
```

**Thorough error/edge case coverage:** Nearly every test file includes tests for error conditions. `streak.test.ts` is particularly impressive, covering future-date recovery, partial freeze usage, empty activity dates, consecutive day scenarios, and freeze cap calculations.

**Proper mock hygiene:** Every test file with mocks includes a `beforeEach` block calling `mockReset()`. `afterEach` restores environment variables and timers. No shared mutable state leaks.

**Fake timers used correctly:** `subscription.test.ts` and `streak.test.ts` use `jest.useFakeTimers().setSystemTime()` and call `jest.useRealTimers()` in `afterEach`, eliminating time-based flakiness.

### Weaknesses

**HIGH -- Two test files test reimplemented logic:**

`scoring.test.ts` and `validation.test.ts` both define their own versions of `calculateScore` and `validateSubmission` inline rather than importing from source modules. This means:
- If real scoring/validation logic drifts from these copies, tests pass but actual code is wrong
- These tests provide no real coverage of source files
- They are tests of test code

**Recommendation:** Import actual functions from source modules.

**MEDIUM -- Dependency injection vs module mocking inconsistency:**

The codebase uses two strategies:
1. Module mocking via `jest.unstable_mockModule` (most files)
2. Dependency injection via function parameters (`mobile-auth.test.ts` passes `InMemoryStore`)

The DI approach is markedly cleaner and less fragile.

---

## 4. Mock Quality

### Firestore Mock -- Excellent

**File:** `__tests__/helpers/firestore.ts` (313 lines)

Sophisticated in-memory Firestore mock providing:
- DocumentSnapshot, DocumentRef, QuerySnapshot, Query, CollectionRef, WriteBatch
- `where()` with `==`, `>=`, `<=`, `in` operators
- `orderBy()`, `limit()` chaining
- `set()` with merge, `update()`, `delete()`, `add()`
- Auto-generated IDs
- Deep cloning to prevent mutation leaks (handles Dates and Firestore timestamps)
- `FieldValue.increment()` simulation

This is one of the strongest aspects of the test infrastructure.

**Limitation:** Does not support composite queries (multiple `where()` clauses), but this appears sufficient for current query patterns.

### External Service Mocks -- Good

| Service | Approach | Quality |
|---------|----------|---------|
| Apple App Store | Class mock with configurable returns | Good |
| Google Auth | GoogleAuth class mock | Good |
| Resend email | `global.fetch` mock | Good |
| RevenueCat | `global.fetch` mock with success/failure/404/502 | Good |
| JOSE/JWT | `jwtVerify` and `createRemoteJWKSet` mocks | Good |

Environment variables are properly saved/restored in `afterEach` blocks.

---

## 5. Test Organization

### Structure
- Flat `__tests__/` directory with clear naming convention
- Single shared helper: `__tests__/helpers/firestore.ts`
- `mobile-auth.test.ts` has its own `createInMemoryStore` helper
- `streak.test.ts` has its own simplified Firestore mock (duplicated from shared helper)

### Isolation
- `beforeEach` resets all mocks
- `afterEach` restores environment and timers
- `jest.resetModules()` used where needed for singleton patterns

---

## 6. CI/CD Integration -- CRITICAL GAP

**The `cloudbuild.yaml` does NOT include a test step.** The pipeline goes straight to Docker build, push, and deploy. While the 90% coverage threshold is enforced by Jest, there is no automated mechanism preventing deployment of untested or failing code. Tests run only locally.

The `CLAUDE.md` mentions `npx tsc --noEmit` as a pre-deployment step, but this is also manual.

**Recommendation:** Add test and type-check steps to `cloudbuild.yaml` before the Docker build:
```yaml
- name: 'node:20'
  entrypoint: 'bash'
  args: ['-c', 'npm ci && npx tsc --noEmit && npm test']
```

---

## Summary Table

| Priority | Finding |
|----------|---------|
| CRITICAL | No test step in CI/CD pipeline |
| HIGH | Mobile app has zero tests |
| HIGH | `scoring.test.ts` and `validation.test.ts` test reimplemented logic, not actual source |
| MEDIUM | `/api/v1/me/` route handlers lack direct server-side tests |
| MEDIUM | `login-mobile-route.test.ts` has only one happy-path test |
| MEDIUM | Duplicated Firestore mock in `streak.test.ts` vs shared helper |
| LOW | `use-me.tsx` excluded from coverage (may contain testable logic) |
