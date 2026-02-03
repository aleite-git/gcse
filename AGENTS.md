# Codex Notes

## Account Deletion Tasklist
- See `PLAN_ACCOUNT_DELETION_BACKEND.md` for the full task list and spec.

## Quality Bar
- Maintain 100% automated test coverage for the project.

## Documentation
- Document any code you write or change. Add brief, clear comments or update relevant docs so a beginner can understand what changed and why.

## Admin Override (Backend-Only)
- The subscription admin override is a **backend-only** API endpoint and is **not** exposed in the frontend.
- Authentication uses **Google ID tokens** (Cloud Run Invoker) instead of a shared secret.
- See `docs/admin-override.md` for the exact request format and how to obtain a token with `gcloud`.
