# TDD Development

Aim for 100% test coverage on new or changed code.

# Deployment

Use Cloud Build to deploy the backend to Cloud Run.

Prerequisites:
- Authenticate with gcloud (`gcloud auth login`).
- Set the project (`gcloud config set project gcse-cs-1`).

Deploy:
1) Type check:
   `npx tsc --noEmit`
2) Submit build and deploy (set version tag):
   `gcloud builds submit --config=cloudbuild.yaml --project=gcse-cs-1 --substitutions=COMMIT_SHA=vX`

Notes:
- Cloud Run service: `gcse-quiz`
- Region: `europe-west1`
- URL: https://gcse-quiz-997951122924.europe-west1.run.app/
