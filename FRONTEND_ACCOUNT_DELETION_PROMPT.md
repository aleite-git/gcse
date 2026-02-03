# Frontend Account Deletion Prompt (For FE Agent)

You are building the **frontend UI** for account deletion in a Next.js app. The backend is already implemented. Please provide a beginner‑friendly plan and code guidance.

## Goals
Implement a **two‑step account deletion flow** and a **cancellation flow** for mobile users (email/password only). The flow uses 6‑digit email codes and a 15‑day cool‑off period.

## Constraints
- Only **email/password** accounts can delete (OAuth users must be blocked with a friendly message).
- Use API endpoints below.
- User must confirm twice before deletion is scheduled.
- After deletion is confirmed, user can **cancel within 15 days**.

## API Endpoints
1) **Request deletion code**  
`POST /api/mobile/account/delete/request`  
Auth: Bearer token  
Body: none  
Response: `{ requestId, expiresAt }`

2) **Confirm deletion**  
`POST /api/mobile/account/delete/confirm`  
Auth: Bearer token  
Body: `{ requestId, code }`  
Response: `{ success: true }`

3) **Request cancellation code**  
`POST /api/mobile/account/delete/cancel/request`  
Auth: Bearer token  
Body: none  
Response: `{ requestId, expiresAt }`

4) **Confirm cancellation**  
`POST /api/mobile/account/delete/cancel/confirm`  
Auth: Bearer token  
Body: `{ requestId, code }`  
Response: `{ success: true }`

## UI Screens / Components

### 1) Account Deletion Settings Screen
Add a section in Settings:
- Title: **Delete Account**
- Text: “Deleting your account removes your data after a 15‑day cool‑off period.”
- Primary button: **Request Deletion Code**
- For OAuth users: disable button and show:  
  “This account uses Google/Apple sign‑in. Deletion is only available for email/password accounts right now.”

### 2) Confirm Deletion Modal (Step 1)
After requesting a code:
- Show: “We sent a 6‑digit code to your email.”
- Input: 6‑digit code
- Button: **Verify Code**
- Error handling:
  - 400: “Invalid code. Try again.”
  - 410: “Code expired. Request a new code.”
  - 429: “Too many attempts. Please wait.”
  - 401: “Session expired. Please log in again.”

### 3) Final Confirm Modal (Step 2)
If code verified:
- Show warning:  
  “Are you sure? Your account will be deleted after 15 days. You can cancel within that period.”
- Checkbox: “I understand this is permanent.”
- Confirm button: **Schedule Deletion**
- Cancel button: **Never mind**

On success:
- Show success screen:  
  “Deletion scheduled. You can cancel within 15 days.”

### 4) Cancellation Flow (only while pending)
If deletion is scheduled:
- Show banner:  
  “Your account is scheduled for deletion on **[DATE]**.”
- Button: **Cancel Deletion**
- When clicked, request cancel code → show code input (same as deletion confirm).
- On success:  
  “Deletion cancelled. Your account is active.”

## States to Track in UI
You must display these states:
- `none` (normal)
- `pending` (deletion scheduled)
- `cancelled` (recently cancelled; reset to none after display)

## Required UI Logic
- Use local state to store `requestId` and `expiresAt` after requesting code.
- When user submits code, call confirm endpoint.
- If confirm deletion succeeds, show scheduled state and optionally log the user out.
- If user cancels deletion, clear pending state.

## Error Handling (from API)
- 400 invalid code / invalid request
- 401 unauthorized
- 403 already scheduled
- 404 no pending deletion to cancel
- 409 already confirmed / already cancelled
- 410 code expired
- 429 too many attempts

## UX Notes
- Show a small countdown to expiry using `expiresAt`.
- Provide a “resend code” button if expired (call request endpoint again).
- Always keep copy clear and gentle for beginners.

## Deliverables
- New Settings section or screen for deletion
- Modal/dialog UI for code verification
- UI for scheduled deletion + cancel option
- Clean error handling, loading states, and disabled buttons
