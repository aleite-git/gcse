# GCSE Quiz -- Code Review Executive Summary

**Date:** 2026-02-05
**Codebase:** Daily 5 GCSE Quiz (Web + Mobile)
**Stack:** Next.js 16 / TypeScript / Firestore / Expo React Native / Cloud Run

---

## Project Overview

A full-stack educational app delivering daily 5+1 bonus GCSE quiz questions across Computer Science, Biology, and Chemistry. Features include streak tracking with freeze days, subscription gating (Apple/Google/RevenueCat), GDPR-compliant account deletion, and a mobile app with OAuth.

**Scale:** ~5,000 lines of backend logic, ~8,500 lines of tests, 30+ API routes, 10+ Firestore collections.

---

## Overall Assessment

| Area | Grade | Summary |
|------|-------|---------|
| **Security** | C+ | Several high-severity issues: no rate limiting on auth, timing-unsafe webhook auth, no password complexity, admin override lacks account allowlist |
| **Code Quality** | B | Good separation of concerns, but significant duplication (timestamp resolution in 4 places, toProfileResponse in 2 files), magic numbers throughout, and fragile error classification via string matching |
| **Testing** | A- | 90% coverage enforced, 35 test files with thorough edge cases, sophisticated Firestore mock. Gaps: no CI test step, mobile app untested, 2 test files test reimplemented logic |
| **Performance** | C | Critical N+1 queries, full collection scans on every quiz generation, bcrypt O(N) login, excessive Firestore reads in streak logic (~16 per submission), no caching |
| **Infrastructure** | B+ | Solid Docker multi-stage build, proper Cloud Run config. Gaps: cold start risk (min-instances=0), missing secrets in cloudbuild.yaml |
| **Documentation** | B- | Excellent BACKGROUND.md, but README is outdated, OpenAPI spec is incomplete, scripts use wrong timezone (Europe/Lisbon vs Europe/London) |

---

## Critical Findings (Immediate Action Needed)

1. **No rate limiting on authentication endpoints** -- brute-force and DoS via bcrypt loop possible (`src/lib/auth.ts:35-55`)
2. **bcrypt loop over ALL access codes on every login** -- O(N * bcrypt) performance, ~3s for 20 codes with invalid input (`src/lib/auth.ts:35-55`)
3. **Full question collection loaded into memory on every quiz generation** -- unbounded Firestore reads (`src/lib/questions.ts:138`)
4. **N+1 sequential reads** -- 7 sequential Firestore reads in `getRecentlyUsedQuestionIds` (`src/lib/questions.ts:91-128`)
5. **No race condition protection** for daily assignment creation -- concurrent requests can overwrite (`src/lib/quiz.ts:11-47`)

## High-Priority Findings

6. **No password complexity requirements** -- single-character passwords accepted (`src/lib/mobile-auth.ts:161-167`)
7. **Timing-unsafe webhook secret comparison** -- uses `!==` instead of `crypto.timingSafeEqual` (`src/app/api/v1/subscription/webhook/route.ts:49`)
8. **~16 Firestore reads per quiz submission** for streak tracking (`src/lib/streak.ts:230-339`)
9. **Tests not run in CI/CD pipeline** -- `cloudbuild.yaml` has no test step
10. **Admin subscription override accepts ANY valid Google token** -- no email/account allowlist (`src/app/api/admin/subscription-override/route.ts`)
11. **Timezone mismatch in scripts** -- `Europe/Lisbon` vs app's `Europe/London` (`scripts/fix-assignments.ts`)
12. **Missing secrets in cloudbuild.yaml** -- CRON_SECRET, REVENUECAT_*, GOOGLE_CLIENT_ID not declared

---

## Detailed Reports

| Report | File |
|--------|------|
| Security & Authentication | [01-SECURITY.md](./01-SECURITY.md) |
| Code Quality & Patterns | [02-CODE-QUALITY.md](./02-CODE-QUALITY.md) |
| Testing & Coverage | [03-TESTING.md](./03-TESTING.md) |
| Performance & Infrastructure | [04-PERFORMANCE.md](./04-PERFORMANCE.md) |
| Documentation & Developer Experience | [05-DOCUMENTATION.md](./05-DOCUMENTATION.md) |
