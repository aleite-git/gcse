# Account Deletion Plan — Backend Spec

## Overview
End‑user deletion uses email code verification (2FA) and two confirmations on the client.
Backend provides endpoints to request/confirm deletion and to request/confirm cancellation.
After deletion is confirmed, a **15‑day cool‑off** period starts. During this window the user can log in and cancel deletion using a 2FA email code. After the window ends, the account is deleted by a background job that runs on the **1st and 15th of each month**.
We only support **email/password login** for this flow (OAuth deletion is out of scope for now).

## Data Model Additions
- `accountDeletionRequests` table/collection
  - `id` (requestId)
  - `userId`
  - `email`
  - `codeHash` (hashed random code)
  - `createdAt`
  - `expiresAt`
  - `attemptCount`
  - `status`: `pending | verified | expired | cancelled`
  - `type`: `delete | cancel`
- `users` table additions
  - `deletionRequestedAt` (timestamp)
  - `deletionScheduledFor` (timestamp, 15 days after confirmation)
  - `deletionCancelledAt` (timestamp, optional)
  - `deletionStatus` (string flag, optional: `none | pending | cancelled | deleted`)

## Endpoints

### 1) Request deletion
- **POST** `/api/mobile/account/delete/request`
- **Auth:** required
- **Body:** none
- **Behavior:**
  - Verify session user.
  - Determine email from the authenticated user record.
  - If deletion is already scheduled: return a message saying it is pending and due in **N days**.
  - Generate random 6‑digit code.
  - Store hashed code with `expiresAt` (e.g., 15 min).
  - Send email with code.
  - Return `requestId` and `expiresAt`.
- **Response:** `{ "requestId": "...", "expiresAt": "..." }`

### 2) Confirm deletion
- **POST** `/api/mobile/account/delete/confirm`
- **Auth:** required
- **Body:** `{ "requestId": "...", "code": "123456" }`
- **Behavior:**
  - Validate requestId belongs to user.
  - Check not expired, not used.
  - Compare hashed code.
  - If valid: mark request `verified`, set `deletionRequestedAt`, and set `deletionScheduledFor = now + 15 days`.
  - Revoke sessions immediately after confirming deletion.
  - If already confirmed, return current status (idempotent).
  - Return success.
- **Response:** `{ "success": true }`

### 3) Request cancellation (cool‑off window)
- **POST** `/api/mobile/account/delete/cancel/request`
- **Auth:** required
- **Body:** none
- **Behavior:**
  - Verify user has a pending deletion scheduled and is within the 15‑day window.
  - Determine email from the authenticated user record.
  - Generate random 6‑digit code.
  - Store hashed code with `expiresAt` (e.g., 15 min) and `type = cancel`.
  - Send email with code.
  - Return `requestId` and `expiresAt`.
- **Response:** `{ "requestId": "...", "expiresAt": "..." }`

### 4) Confirm cancellation
- **POST** `/api/mobile/account/delete/cancel/confirm`
- **Auth:** required
- **Body:** `{ "requestId": "...", "code": "123456" }`
- **Behavior:**
  - Validate requestId belongs to user and `type = cancel`.
  - Check not expired, not used.
  - Compare hashed code.
  - If valid: clear `deletionScheduledFor`, set `deletionCancelledAt`, and mark request `verified`.
  - If already cancelled, return current status (idempotent).
  - Return success.
- **Response:** `{ "success": true }`

## Security / Abuse Controls
- Rate limit delete requests per user/email (e.g., 3 per hour).
- Limit confirm attempts per request (e.g., 5 attempts).
- Code TTL: 10–15 minutes.
- Invalidate request on success.

## Deletion Behavior
- Cool‑off: **15 days** after delete confirmation.
- A background job deletes accounts whose `deletionScheduledFor` is in the past. The job runs on the **1st and 15th of each month**.
- Scope: **all user‑related data** including quiz scores, streaks, and login details (username, email, auth records).
- Recommended: **hard delete** if required by product.
- Alternative: **soft delete** for recovery window.
  - `deletedAt` field; anonymize personal data.
- Always revoke auth tokens immediately.

## Email Template
- Subject: “Confirm account deletion”
- Body: “Your code is 123456. This code expires in 15 minutes.”
- Include support link.
## Email Provider
- Use **Resend** for transactional email.
- Env vars: `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.

## Admin / Audit
- Log deletion events: userId, timestamp, IP/device, reason if provided.
- Optional admin override: allow support to cancel pending deletion request.

## Error Codes
- 400: invalid requestId or code
- 401: unauthorized
- 403: deletion already scheduled; include remaining days in message
- 404: no pending deletion to cancel
- 409: already confirmed or already cancelled (idempotent confirm)
- 410: code expired
- 429: too many attempts
