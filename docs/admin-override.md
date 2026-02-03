# Admin Override (Backend-Only)

## What it does
The admin override endpoint sets `adminOverride` for a mobile user. When `adminOverride` is `true`, the backend grants **access to all subjects**, regardless of subscription status. This is a backend-only tool and is **not exposed in the Flutter app**.

## Why we use Google ID tokens
We do **not** use a shared secret header. Instead, the endpoint requires a **Google ID token** so only callers with **Cloud Run Invoker** access can use it. If someone can generate that token, they already have GCP access.

## Endpoint
`POST /api/admin/subscription-override`

### Headers
`Authorization: Bearer <GOOGLE_ID_TOKEN>`

### Body (JSON)
Provide either `userId` or `email` plus the `adminOverride` flag.
```json
{
  "email": "user@example.com",
  "adminOverride": true
}
```

## How to call it (example)
```bash
TOKEN=$(gcloud auth print-identity-token --audiences=https://gcse-quiz-997951122924.europe-west1.run.app)

curl -X POST "https://gcse-quiz-997951122924.europe-west1.run.app/api/admin/subscription-override" \
  -H "content-type: application/json" \
  -H "authorization: Bearer $TOKEN" \
  -d '{"email":"user@example.com","adminOverride":true}'
```

## Optional: Custom domain
If we use a **custom domain**, set the environment variable `ADMIN_OVERRIDE_AUDIENCE` to the custom domain URL so token verification uses that audience.

## Notes
- The endpoint returns `401` if the token is missing or invalid.
- The endpoint returns `404` if the user cannot be found.
