# Subscriptions Tickets — Backend (RevenueCat)

## BE-301 — Subscription Product Decisions (Blocking) (Pending)

**Goal**: Confirm the product strategy before any code work.

**Tasks**
- Decide subscription length (keep 18‑month or move to monthly/yearly).
- Decide whether it is auto‑renewing or fixed‑term.
- Choose final product IDs and prices.
- Confirm entitlement name (recommended: `premium`).
- Decide identity strategy for RevenueCat `appUserId` (recommended: backend `userId`).

**Acceptance**
- Decisions are documented and shared with FE/BE.
- Product IDs and entitlement name are final and will not change.

---

## BE-302 — Subscription Data Model + /api/v1/me (Pending)

**Goal**: Store subscription state and expose it to the app.

**Tasks**
- Add fields to user subscription model:
  - `subscriptionProvider` (`revenuecat`)
  - `entitlement` (`premium` or `none`)
  - `subscriptionStatus` (`active`, `grace`, `expired`, `unknown`)
  - `subscriptionExpiry` (datetime)
  - `graceUntil` (datetime, optional)
  - `productId` (string)
  - `store` (`app_store` or `play_store`)
  - `environment` (`sandbox` or `production`)
  - `revenueCatAppUserId` (string)
  - `lastRevenueCatEventId` (string)
- Update `GET /api/v1/me` to return these fields.

**Acceptance**
- App can read subscription state from `/api/v1/me`.
- 100% line coverage for new backend code.

---

## BE-303 — RevenueCat Webhook Handler (Pending)

**Goal**: Receive RevenueCat events and update user entitlements.

**Tasks**
- Create webhook endpoint (e.g., `POST /api/v1/subscription/webhook`).
- Validate webhook signature using RevenueCat secret.
- Handle key event types: purchase, renewal, cancellation, expiration, billing issue.
- Update user subscription fields based on event payload.
- Implement idempotency using `lastRevenueCatEventId`.

**Acceptance**
- Webhook events correctly update entitlements.
- Duplicate events are ignored.
- 100% line coverage for new backend code.

---

## BE-304 — Subscription Identify + Sync Endpoints (Pending)

**Goal**: Allow the app to map users to RevenueCat and request a sync.

**Tasks**
- Add `POST /api/v1/subscription/identify` to store `revenueCatAppUserId`.
- (Optional but recommended) Add `POST /api/v1/subscription/sync` to pull current CustomerInfo from RevenueCat REST API and update user record.
- Store RevenueCat REST API key securely in backend config.

**Acceptance**
- Backend can map app users to RevenueCat customers.
- Sync endpoint updates subscription status.
- 100% line coverage for new backend code.

---

## BE-305 — Entitlement Enforcement (Pending)

**Goal**: Enforce premium access on the server.

**Tasks**
- Implement entitlement logic:
  - `active` if now <= `subscriptionExpiry` and entitlement is `premium`.
  - `grace` if now <= `graceUntil`.
  - `expired` otherwise.
- Enforce subject selection rule:
  - If not premium, block multi‑subject updates and return a clear error.

**Acceptance**
- Server blocks extra subjects for free users.
- 100% line coverage for new backend code.

---

## BE-306 — Webhook + API Tests (Pending)

**Goal**: Full automated coverage of subscription backend logic.

**Tasks**
- Unit tests for webhook event parsing and signature validation.
- Unit tests for entitlement logic edge cases.
- Integration tests for `/api/v1/me` and subscription endpoints.

**Acceptance**
- 100% line coverage for new backend code.
- All tests pass.
