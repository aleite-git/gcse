# Subscriptions (Backend)

## Overview
The backend verifies App Store / Google Play purchases and sets a **fixed 18‑month unlock** in Firestore:
- `subscriptionStart`: purchase date from the store
- `subscriptionExpiry`: purchase date + 18 months
- `subscriptionProvider`: `apple` or `google`

The app reads the subscription status from `/api/v1/me` and gates subject access accordingly.

## RevenueCat (Server-side sync)
We also support RevenueCat so the backend can keep subscription state in sync without the app doing receipt validation:
- `POST /api/v1/subscription/identify` stores the RevenueCat `appUserId` for the current user.
- `POST /api/v1/subscription/sync` fetches the latest CustomerInfo from RevenueCat and updates Firestore.
- `POST /api/v1/subscription/webhook` receives RevenueCat events and updates the same fields.

RevenueCat updates the following fields on the user record:
- `entitlement` (`premium` or `none`)
- `subscriptionStatus` (`active`, `grace`, `expired`, `unknown`)
- `subscriptionExpiry`, `graceUntil`, `subscriptionStart`
- `productId`, `store`, `environment`
- `revenueCatAppUserId`, `lastRevenueCatEventId`

## Endpoint
`POST /api/mobile/subscription/verify`

### Auth
Use the same bearer token returned by `/api/mobile/login` or `/api/mobile/oauth/*`.

### Request body (examples)

**Apple**
```json
{
  "provider": "apple",
  "transactionId": "1234567890"
}
```

**Apple with app receipt**
```json
{
  "provider": "apple",
  "appReceipt": "<base64-receipt>"
}
```

**Google**
```json
{
  "provider": "google",
  "purchaseToken": "<purchase-token>",
  "packageName": "com.your.app"
}
```

## Required environment variables

### Apple App Store Server API
- `APPLE_IAP_KEY_ID`
- `APPLE_IAP_ISSUER_ID`
- `APPLE_IAP_BUNDLE_ID`
- `APPLE_IAP_PRIVATE_KEY` (PEM)
- `APPLE_IAP_ENV` (`sandbox` or `production`)

### Google Play Developer API
- `GOOGLE_PLAY_PACKAGE_NAME` (optional if you pass `packageName` in the request)

### RevenueCat
- `REVENUECAT_API_KEY` (for `/api/v1/subscription/sync`)
- `REVENUECAT_WEBHOOK_AUTH` (shared secret for `/api/v1/subscription/webhook`)
- `REVENUECAT_WEBHOOK_AUTH_HEADER` (optional header name, defaults to `authorization`)
- `REVENUECAT_ENTITLEMENT` (optional; defaults to `premium`)

## Notes
- Apple verification uses the App Store Server API and decodes the signed transaction payload to read the purchase date.
- Google verification uses the Play Developer API `purchases.subscriptionsv2.get`.
- The endpoint returns `400` for invalid payloads and `401` if the user is not authenticated.
