# Security & Authentication Review

**Date:** 2026-02-05

---

## 1. Authentication & Authorization

### 1.1 HIGH -- No Rate Limiting on Authentication Endpoints

Rate limiting is only implemented for the account deletion flow. The following endpoints have **no rate limiting**:

- `POST /api/login` -- web access code login
- `POST /api/mobile/login` -- mobile email/password login
- `POST /api/mobile/register` -- mobile registration
- `POST /api/mobile/oauth/google` and `/apple` -- OAuth
- `POST /api/mobile/username/check` and `/update`

The access code login is particularly vulnerable because `validateAccessCode` in `src/lib/auth.ts:35-55` iterates through **all active access codes** and calls `bcrypt.compare` for each. Without rate limiting, an attacker can brute-force codes, and since bcrypt is CPU-intensive, this is also a DoS vector.

**Recommendation:** Add rate limiting (e.g., express-rate-limit or a Firestore-based counter) to all auth endpoints. Consider a fast pre-filter (SHA-256 prefix check) before bcrypt comparison for access codes.

### 1.2 HIGH -- No Password Complexity Requirements

**File:** `src/lib/mobile-auth.ts:161-167`

```typescript
export function validatePasswordFormat(password: unknown): string | null {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return 'Password is required';
  }
  return null;
}
```

A single-character password is accepted. No minimum length, no complexity requirement.

**Recommendation:** Enforce minimum 8 characters, consider checking against common password lists.

### 1.3 HIGH -- Timing-Unsafe Webhook Secret Comparison

**File:** `src/app/api/v1/subscription/webhook/route.ts:49`
**File:** `src/app/api/admin/account-deletion/run/route.ts:14`

Both use JavaScript `!==` for secret comparison, which is vulnerable to timing attacks.

**Recommendation:** Use `crypto.timingSafeEqual()` with Buffer conversion.

### 1.4 MEDIUM -- JWT Lacks Audience/Issuer Claims

**File:** `src/lib/auth.ts:60-71`

The JWT has no `iss` or `aud` claims. If the same `SESSION_SECRET` is reused across environments, tokens could be cross-accepted.

**Recommendation:** Add `iss` and `aud` claims, verify them in `verifySessionToken`.

### 1.5 MEDIUM -- No Session Revocation Mechanism

**File:** `src/lib/auth.ts:8`

Sessions last 7 days with no server-side revocation. A compromised token cannot be invalidated before expiry. The `isAdmin` flag is also baked into the JWT -- admin revocation is delayed up to 7 days.

**Recommendation:** Consider a token denylist in Firestore with TTL, or shorten session duration with refresh tokens.

### 1.6 MEDIUM -- Admin Subscription Override Lacks Account Allowlist

**File:** `src/app/api/admin/subscription-override/route.ts:18-38`

The endpoint verifies a Google ID token is valid, but does **not check which Google account** made the request. Any valid Google account matching the audience can toggle admin overrides.

**Recommendation:** Add an email allowlist (e.g., stored in Firestore or env vars).

### 1.7 MEDIUM -- Middleware Uses `startsWith` for Public Route Matching

**File:** `src/middleware.ts:65`

```typescript
const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route));
```

Any path starting with a public prefix bypasses auth (e.g., `/api/admin/subscription-override/anything`). While not currently exploitable, it is fragile.

**Recommendation:** Use exact matching or regex with `$` anchor.

---

## 2. Input Validation

### 2.1 MEDIUM -- Admin Question Update Accepts Arbitrary Fields

**File:** `src/app/api/admin/questions/[id]/route.ts:54-58`

The PATCH handler passes the entire request body to `updateQuestion` with only a TypeScript type assertion (no runtime validation). Extra fields could be injected.

### 2.2 MEDIUM -- Bulk Question Import Only Validates Subject

**File:** `src/app/api/admin/questions/route.ts:54-65`

Bulk import validates only the `subject` field, then casts to `QuestionInput[]`. Fields like `stem`, `options`, `correctIndex` are not validated for bulk imports (though they are for single creates).

### 2.3 LOW -- Timezone Parameter Not Validated

**Files:** `src/app/api/quiz/submit/route.ts:84`, `src/app/api/streak/route.ts:27`

Timezone strings from user input are not validated against a known list.

### 2.4 GOOD -- Firestore Injection Protection

All Firestore queries use parameterized `.where('field', '==', value)` patterns. User inputs are used as values, not field names or operators.

---

## 3. Secrets & Configuration

### 3.1 HIGH -- Missing Secrets in cloudbuild.yaml

**File:** `cloudbuild.yaml:49-50`

Only `SESSION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` are declared. Missing:
- `CRON_SECRET`
- `REVENUECAT_WEBHOOK_AUTH`
- `REVENUECAT_API_KEY`
- `GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`
- `ADMIN_OVERRIDE_AUDIENCE`

These may be set via Cloud Run console, but they should be declared in the deployment config for reproducibility.

### 3.2 GOOD -- No Hardcoded Secrets

No hardcoded API keys or credentials in source code. All secrets loaded from environment variables.

---

## 4. API Security

### 4.1 MEDIUM -- No CORS Configuration

No CORS policy exists in the codebase. The `sameSite: 'lax'` cookie setting mitigates CSRF for cookie-based auth, but bearer token auth (mobile) is unaffected.

### 4.2 GOOD -- Cookie Configuration

Cookies use `httpOnly: true`, `secure` in production, `sameSite: 'lax'`. Well-implemented.

### 4.3 GOOD -- HSTS Header

HSTS is set in production with 1-year max-age, includeSubDomains, and preload.

### 4.4 GOOD -- Error Handling

API routes return generic error messages for 500s and log details server-side. No stack traces are exposed.

---

## 5. Data Protection

### 5.1 GOOD -- Account Deletion (GDPR)

Thorough implementation: 15-day cool-off period, email verification with bcrypt-hashed 6-digit code and 15-minute TTL, rate limiting (3 requests/hour, 5 code attempts), cancellation flow, comprehensive data deletion from all collections.

### 5.2 GOOD -- Password Hashing

bcrypt with cost factor 12, consistently applied.

### 5.3 MEDIUM -- Unsalted IP Hashing

**File:** `src/lib/quiz.ts:314-316`

IP addresses are SHA-256 hashed without a salt. For IPv4, this is reversible via precomputation.

### 5.4 MEDIUM -- OAuth Linking Replaces Password

**File:** `src/lib/mobile-auth.ts:362-367`

When linking to OAuth, the password hash is replaced with a bcrypt hash of the OAuth subject ID, silently disabling password login. If an attacker knows the OAuth subject ID, they could authenticate via the password endpoint.

---

## Summary Table

| Severity | Finding | Location |
|----------|---------|----------|
| HIGH | No rate limiting on auth endpoints | `src/lib/auth.ts:35-55` |
| HIGH | No password complexity requirements | `src/lib/mobile-auth.ts:161-167` |
| HIGH | Timing-unsafe webhook secret comparison | `src/app/api/v1/subscription/webhook/route.ts:49` |
| HIGH | Missing secrets in cloudbuild.yaml | `cloudbuild.yaml:49-50` |
| MEDIUM | JWT lacks iss/aud claims | `src/lib/auth.ts:60-71` |
| MEDIUM | No session revocation | `src/lib/auth.ts:8` |
| MEDIUM | Admin override lacks account allowlist | `src/app/api/admin/subscription-override/route.ts` |
| MEDIUM | Middleware startsWith matching | `src/middleware.ts:65` |
| MEDIUM | Admin question update -- no runtime validation | `src/app/api/admin/questions/[id]/route.ts:54-58` |
| MEDIUM | No CORS configuration | N/A |
| MEDIUM | Unsalted IP hashing | `src/lib/quiz.ts:314-316` |
| MEDIUM | OAuth linking replaces password | `src/lib/mobile-auth.ts:362-367` |
| LOW | Timezone parameter not validated | `src/app/api/quiz/submit/route.ts:84` |
