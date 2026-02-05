# Latest Status

**Last Updated:** 2026-02-05

## Review Findings To Address Next

1. **Progress window uses UTC dates, not Lisbon**
   - **Location:** `src/lib/quiz.ts:406`
   - **Severity:** P2 (important but not blocking)
   - **What happens:** The progress summary builds the last-N-days list using `new Date()` and `toISOString()`. Those are UTC dates, but quiz attempts are stored using Lisbon dates (`getTodayLisbon()`). Around midnight, this can shift a day and miscount today's attempts or the last 7 days.
   - **Why it matters:** Users can see missing or misplaced progress stats right after midnight in Lisbon.
   - **Fix idea:** Build the date list using the Lisbon helpers (for example `getDaysAgoLisbon()` or `getLastNDaysLisbon()`), so the date keys match stored attempt dates.

## Notes
- We will implement and test the fix in the next work session.
