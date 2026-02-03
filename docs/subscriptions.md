# Subscriptions (Backend)

## Overview
The backend verifies App Store / Google Play purchases and sets a **fixed 18‑month unlock** in Firestore:
- `subscriptionStart`: purchase date from the store
- `subscriptionExpiry`: purchase date + 18 months
- `subscriptionProvider`: `apple` or `google`

The app reads the subscription status from `/api/v1/me` and gates subject access accordingly.

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

## Notes
- Apple verification uses the App Store Server API and decodes the signed transaction payload to read the purchase date.
- Google verification uses the Play Developer API `purchases.subscriptionsv2.get`.
- The endpoint returns `400` for invalid payloads and `401` if the user is not authenticated.
