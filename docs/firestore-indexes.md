# Firestore Composite Indexes

This app uses Firestore composite indexes for queries that combine multiple
`.where()` clauses with range operators or `.orderBy()` on different fields.
If a query fails with "The query requires an index", create the index listed
below. Firestore usually prints a direct link to create it in the error message.

---

## `accountDeletionRequests`

### Rate-limit check

Used by `countRecentDeletionRequests` in `src/lib/account-deletion.ts`.

```
Collection: accountDeletionRequests
Fields:
  - userId    Ascending
  - type      Ascending
  - createdAt Ascending
```

Query: `.where('userId', '==', ...).where('type', '==', ...).where('createdAt', '>=', ...)`

---

## `attempts`

### Get today's attempts for a user + subject

Used by `getTodayAttempts` in `src/lib/quiz.ts`.

```
Collection: attempts
Fields:
  - date          Ascending
  - userLabel     Ascending
  - subject       Ascending
  - attemptNumber Ascending
```

Query: `.where('date', '==', ...).where('userLabel', '==', ...).where('subject', '==', ...).orderBy('attemptNumber', 'asc')`

### Get attempts by date range (admin results)

Used by `getAttemptsByDateRange` in `src/lib/quiz.ts`.

```
Collection: attempts
Fields:
  - date        Ascending
  - submittedAt Descending
```

Query: `.where('date', '>=', ...).where('date', '<=', ...).orderBy('date', 'desc').orderBy('submittedAt', 'desc')`

Note: When range filters and `orderBy` reference the same field (`date`),
Firestore requires the range field to be the first `orderBy`. The second
`orderBy('submittedAt', 'desc')` adds the composite requirement.

### Get progress summary (user + subject + date range)

Used by `getProgressSummary` in `src/lib/quiz.ts`.

```
Collection: attempts
Fields:
  - userLabel Ascending
  - subject   Ascending
  - date      Ascending
```

Query: `.where('userLabel', '==', ...).where('subject', '==', ...).where('date', '>=', ...)`

### Get attempts by date + subject (retry exclusion)

Used by `generateNewQuizVersion` in `src/lib/quiz.ts` and
`getRecentlyUsedQuestionIds` in `src/lib/questions.ts`.

```
Collection: attempts
Fields:
  - date    Ascending
  - subject Ascending
```

Query: `.where('date', '==', ...).where('subject', '==', ...)`

Note: Equality-only queries on two fields may be auto-merged by Firestore
without a composite index, but create one if you see an index error.

---

## `questions`

### Get all questions by subject ordered by creation date (admin)

Used by `getAllQuestions` in `src/lib/questions.ts`.

```
Collection: questions
Fields:
  - subject   Ascending
  - createdAt Descending
```

Query: `.where('subject', '==', ...).orderBy('createdAt', 'desc')`

### Get active questions by subject

Used by `getActiveQuestions` in `src/lib/questions.ts`.

```
Collection: questions
Fields:
  - active  Ascending
  - subject Ascending
```

Query: `.where('active', '==', true).where('subject', '==', ...)`

Note: Equality-only queries on two fields may be auto-merged by Firestore
without a composite index, but create one if you see an index error.

---

## `mobileUsers`

### Find users pending deletion

Used by `runAccountDeletionJob` in `src/lib/account-deletion-job.ts`.

```
Collection: mobileUsers
Fields:
  - deletionStatus       Ascending
  - deletionScheduledFor Ascending
```

Query: `.where('deletionStatus', '==', 'pending').where('deletionScheduledFor', '<=', now)`

### Find user by OAuth provider + subject

Used by `getByOAuth` in `src/lib/mobile-user-store.ts`.

```
Collection: mobileUsers
Fields:
  - oauthProvider Ascending
  - oauthSubject  Ascending
```

Query: `.where('oauthProvider', '==', ...).where('oauthSubject', '==', ...)`

Note: Equality-only queries on two fields may be auto-merged by Firestore
without a composite index, but create one if you see an index error.

---

## TTL Policies

### streakActivities

A Firestore TTL policy should be configured on the `streakActivities` collection to
prevent unbounded document growth. Configure this in the Firebase console:

- Collection: `streakActivities`
- TTL field: `createdAt`
- Expiration: 90 days

This ensures old streak activity records are automatically cleaned up by Firestore.
