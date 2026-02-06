# Code Quality & Patterns Review

**Date:** 2026-02-05

---

## 1. Code Organization & Architecture

### 1.1 Overall Structure -- GOOD

The project follows a clean Next.js App Router structure:
- `src/types/` -- shared type definitions
- `src/lib/` -- business logic and data access
- `src/app/api/` -- API route handlers
- `src/app/` -- pages (React)
- `src/components/` -- shared UI components

Business logic is properly separated from route handlers.

---

## 2. Code Duplication -- SIGNIFICANT

### 2.1 `toProfileResponse` Duplicated Verbatim

- `src/app/api/v1/me/route.ts:8-46`
- `src/app/api/v1/me/subjects/route.ts:8-43`

Both define the exact same function with the same inline type parameter.

**Recommendation:** Extract to `src/lib/profile-response.ts`.

### 2.2 Timestamp Resolution Duplicated 4+ Times

- `src/lib/account-deletion.ts:26-47` -- `resolveTimestamp`
- `src/lib/questions.ts:6-14` -- `resolveCreatedAt`
- `src/lib/streak.ts:118-124` -- inline Firestore timestamp resolution
- `src/lib/mobile-auth.ts:203-222` -- `resolveUsernameChangedAt`

All do the same thing: resolve a Firestore Timestamp / Date / number to a `Date`.

**Recommendation:** Create a single `resolveFirestoreDate()` utility in a shared module.

### 2.3 Quiz Question Mapping Duplicated

- `src/app/api/quiz/today/route.ts:22-29`
- `src/app/api/quiz/retry/route.ts:33-40`

Identical mapping from full Question to QuizQuestion, including the bonus detection logic.

### 2.4 `SESSION_COOKIE_NAME` and `getSecretKey()` Duplicated

- `src/lib/auth.ts:7` and `src/middleware.ts:5` -- same constant
- `src/lib/auth.ts:10-16` and `src/middleware.ts:27-33` -- identical function
- `src/lib/auth.ts:76-83` and `src/middleware.ts:35-45` -- duplicated JWT verification

The middleware duplication exists due to Next.js edge runtime constraints, but should be documented.

### 2.5 `normalizeEntitlementForStatus` Duplicated

- `src/app/api/v1/subscription/webhook/route.ts:19-27`
- `src/app/api/v1/subscription/sync/route.ts:19-21`

**Recommendation:** Move to the shared `subscription.ts` module.

---

## 3. TypeScript Quality

### 3.1 Unsafe Type Assertions After Firestore `.data()`

Multiple files spread Firestore document data and cast `as` the target type with no runtime validation:

- `src/lib/questions.ts:29-33` -- `}) as Question[]`
- `src/lib/quiz.ts:141-145` -- `}) as Attempt[]`
- `src/app/api/admin/stats/route.ts:38-41` -- `}) as QuestionStats[]`

This is a systemic pattern. If a document field is missing or has the wrong type, silently incorrect objects are produced.

**Recommendation:** Consider Zod or a validation layer for Firestore reads.

### 3.2 Double `as unknown as` in JWT Handling

**File:** `src/lib/auth.ts:66,79`

```typescript
return new SignJWT(payload as unknown as JWTPayload)
// and
return payload as unknown as SessionPayload;
```

Bypasses all type checking between `jose` types and app types.

### 3.3 `SubscriptionProvider` Type Defined Differently in Two Files

- `src/lib/subscription.ts:6` -- `'apple' | 'google' | 'manual' | 'revenuecat'`
- `src/lib/subscription-verification.ts:9` -- `'apple' | 'google'`

Same name, different values. Confusing and error-prone.

### 3.4 `requireAuth()` and `requireAdmin()` Are Dead Code

**File:** `src/lib/auth.ts:168-185`

These utility functions exist but are never called by any API route. All routes manually check the session instead.

**Recommendation:** Either use them consistently or remove them.

---

## 4. Error Handling

### 4.1 Fragile String-Based Error Classification

**File:** `src/app/api/quiz/submit/route.ts:122-127`

```typescript
const isValidationError =
  message.startsWith('Must answer all ') ||
  message.startsWith('Question ') ||
  message === 'No quiz available' || ...
```

If error message text changes, the status code logic breaks silently.

**Recommendation:** Use custom error classes with a `statusCode` property (like `MobileAuthError` and `SubscriptionVerificationError` used elsewhere).

### 4.2 Inconsistent `request.json()` Error Handling

Some routes wrap `await request.json()` in try/catch (webhook, subscription verify), but many do not (submit, retry, streak, login). Malformed JSON bodies become generic 500 errors.

### 4.3 Non-Null Assertion After Find

**File:** `src/app/api/quiz/submit/route.ts:69`

```typescript
const answer = answers.find((a) => a.questionId === q.id)!;
```

The `!` relies on prior validation. If logic changes, this throws at runtime.

---

## 5. Magic Numbers and Strings

| Value | Usage | Location |
|-------|-------|----------|
| `5` | Bonus question index | `quiz/today/route.ts:28`, `quiz/retry/route.ts:39`, `admin/preview/route.ts:40` |
| `6` | Quiz size | `questions.ts:253` |
| `3`, `2` | Easy/medium question counts | `questions.ts:163,169,181,190` |
| `7` | Recently-used window (days) | `questions.ts:143` |
| `30` | Firestore 'in' query limit | `questions.ts:65` |
| `100` | Default attempt limit | `quiz.ts:295` |
| `12` | bcrypt rounds | `auth.ts:23`, `mobile-auth.ts:263`, `account-deletion.ts:61` |

**Recommendation:** Extract all to named constants in a shared `constants.ts`.

---

## 6. Code Smells

### 6.1 Overly Long Functions

- `selectQuizQuestions` (`questions.ts:134-254`) -- 120 lines with deep nesting and complex fallback logic
- `recordActivity` (`streak.ts:230-339`) -- 109 lines with complex branching

**Recommendation:** Decompose into smaller helper functions.

### 6.2 Large Static Data File

`src/lib/studyNotes.ts` is 1,321 lines of hardcoded content. Excluded from test coverage. Keys for Biology/Chemistry don't match their typed topic unions (e.g., key `'Cell biology'` vs type `CellBiology`), creating potential runtime lookup failures.

### 6.3 Test Helper Exported from Production Code

`src/lib/profanity-filter.ts:115-118` exports `__resetProfanityCacheForTests`. Test utilities should not be in production code.

### 6.4 `getYesterdayInTimezone` Has Subtle Bug

**File:** `src/lib/streak.ts:87-91`

Uses `setDate()` on system-local `new Date()`, then formats with target timezone. This can yield the wrong "yesterday" near midnight when server and target timezone differ. The `date.ts` module uses `date-fns-tz` correctly; this function should too.

---

## 7. Consistency

### 7.1 Naming Conventions -- Mostly Good

- Files use kebab-case consistently, **except** `questionStats.ts` (camelCase)
- Types use PascalCase -- consistent
- Functions use camelCase -- consistent

### 7.2 API Response Formats -- Mostly Consistent

- Error responses consistently use `{ error: string }`
- Success responses vary: some use `{ success: true, ... }`, others return data directly, webhook returns `{ status: 'ok' }`

### 7.3 Auth Pattern Inconsistency in Admin Routes

Admin routes check `if (!session?.isAdmin)` directly. The `requireAuth()`/`requireAdmin()` utility functions exist in `auth.ts` but are never used.

---

## Summary Table

| Priority | Finding | Location |
|----------|---------|----------|
| HIGH | `toProfileResponse` duplicated | `v1/me/route.ts`, `v1/me/subjects/route.ts` |
| HIGH | Timestamp resolution duplicated 4x | `account-deletion.ts`, `questions.ts`, `streak.ts`, `mobile-auth.ts` |
| HIGH | Fragile string-based error classification | `quiz/submit/route.ts:122-127` |
| HIGH | `SESSION_COOKIE_NAME` / `getSecretKey()` duplicated | `auth.ts`, `middleware.ts` |
| MEDIUM | Magic numbers throughout quiz selection | `questions.ts`, `quiz.ts` |
| MEDIUM | Unsafe `as` casts after Firestore `.data()` | Throughout `src/lib/` |
| MEDIUM | `SubscriptionProvider` type defined differently in 2 files | `subscription.ts`, `subscription-verification.ts` |
| MEDIUM | Dead code: `requireAuth()` / `requireAdmin()` | `auth.ts:168-185` |
| MEDIUM | Inconsistent `request.json()` error handling | Multiple route files |
| LOW | `questionStats.ts` breaks kebab-case convention | `src/lib/questionStats.ts` |
| LOW | `studyNotes.ts` keys don't match topic type unions | `src/lib/studyNotes.ts` |
| LOW | `getYesterdayInTimezone` has subtle timezone bug | `streak.ts:87-91` |
