# Daily 5 GCSE Quiz

A web application that serves a daily 5-question quiz plus 1 bonus (6 total) for GCSE preparation. Supports Biology, Chemistry, and Computer Science. Includes a companion iOS mobile app built with React Native (Expo). Designed to run on Google Cloud Platform free tier but may still incur costs - use at own risk.

## Features

- Daily 5-question multiple choice quiz + bonus question with extra difficulty (6 total)
- Multiple subjects: Biology, Chemistry, Computer Science
- Must answer all 6 questions before submitting
- Immediate feedback with explanations
- Retry with new questions
- Progress tracking (last 7 days)
- Topic performance analysis
- Streak tracking with freeze days
- Admin interface for question management
- Secure access code authentication (web) and email/OAuth authentication (mobile)
- Mobile app with Apple/Google OAuth, subscriptions (RevenueCat), and account deletion
- Subscription management via Apple IAP, Google Play, and RevenueCat webhooks

## Tech Stack

- **Frontend/Backend**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Google Cloud Firestore
- **Hosting**: Google Cloud Run
- **Authentication**: Access codes with JWT sessions (web), email/password + OAuth (mobile)
- **Subscriptions**: RevenueCat, Apple App Store Server Library, Google Play
- **Mobile**: React Native (Expo) iOS app

## Prerequisites

- Node.js 20+
- npm
- Google Cloud account (for deployment)
- Firebase/Firestore project

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url>
cd gcse
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Required: Session secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secret-here

# Option A: Use Firestore Emulator (recommended for local dev)
FIRESTORE_EMULATOR_HOST=localhost:8080

# Option B: Use real Firestore with service account
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
# FIREBASE_PROJECT_ID=your-project-id
```

### 3. Run with Firestore Emulator (Recommended)

Install Firebase tools:

```bash
npm install -g firebase-tools
firebase login
```

Start the emulator:

```bash
firebase emulators:start --only firestore
```

In a new terminal, seed the database:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run seed
```

Start the development server:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev
```

### 4. Access the Application

Open [http://localhost:3000](http://localhost:3000)

Default access codes (set by seed script):
- **Student**: `student2024`
- **Admin**: `admin2024`

## Seeding the Database

The seed script creates:
- Access codes (student and admin)
- 150+ GCSE CS questions covering all topics

```bash
# First time seeding
npm run seed

# Force re-seed (deletes existing questions)
npm run seed:force
```

## Running Tests

```bash
npm test
```

35 test suites with 400+ tests covering:
- Quiz submission validation and scoring
- Date handling in Europe/London timezone
- Mobile authentication (register, login, OAuth linking)
- Account deletion flows (request, confirm, cancel, job runner)
- Subscription verification (Apple, Google, RevenueCat webhooks)
- Streak logic (freeze days, activity recording)
- Question management (CRUD, bulk import, selection algorithm)
- API route handlers (admin, mobile, quiz, progress, v1)
- Profanity filtering, onboarding, active subjects

## Project Structure

```
gcse/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes (32 endpoints)
│   │   │   ├── admin/
│   │   │   │   ├── account-deletion/run/
│   │   │   │   ├── preview/
│   │   │   │   ├── questions/
│   │   │   │   ├── questions/[id]/
│   │   │   │   ├── results/
│   │   │   │   ├── stats/
│   │   │   │   └── subscription-override/
│   │   │   ├── login/
│   │   │   ├── login/mobile/
│   │   │   ├── logout/
│   │   │   ├── mobile/
│   │   │   │   ├── account/delete/request/
│   │   │   │   ├── account/delete/confirm/
│   │   │   │   ├── account/delete/cancel/request/
│   │   │   │   ├── account/delete/cancel/confirm/
│   │   │   │   ├── login/
│   │   │   │   ├── oauth/apple/
│   │   │   │   ├── oauth/google/
│   │   │   │   ├── register/
│   │   │   │   ├── subscription/verify/
│   │   │   │   ├── username/check/
│   │   │   │   └── username/update/
│   │   │   ├── progress/
│   │   │   ├── quiz/
│   │   │   │   ├── today/
│   │   │   │   ├── submit/
│   │   │   │   └── retry/
│   │   │   ├── streak/
│   │   │   ├── v1/
│   │   │   │   ├── me/
│   │   │   │   ├── me/subjects/
│   │   │   │   ├── subscription/identify/
│   │   │   │   ├── subscription/sync/
│   │   │   │   └── subscription/webhook/
│   │   │   └── version/
│   │   ├── quiz/              # Quiz pages
│   │   ├── progress/          # Progress page
│   │   └── admin/             # Admin pages
│   ├── lib/                   # Core libraries
│   │   ├── account-deletion.ts       # Deletion request management
│   │   ├── account-deletion-job.ts   # Scheduled deletion runner
│   │   ├── active-subjects.ts        # Subject validation
│   │   ├── auth.ts                   # Authentication (web + mobile JWT)
│   │   ├── date.ts                   # Timezone handling
│   │   ├── email.ts                  # Email utilities
│   │   ├── firebase.ts               # Firestore connection & collection constants
│   │   ├── me-client.ts              # User profile client
│   │   ├── mobile-auth.ts            # Mobile auth (register, login, OAuth)
│   │   ├── mobile-oauth.ts           # OAuth token verification
│   │   ├── mobile-user-store.ts      # Mobile user Firestore store
│   │   ├── onboarding.ts             # Onboarding logic
│   │   ├── profanity-filter.ts       # Username profanity filter
│   │   ├── question-stats.ts         # Per-question attempt statistics
│   │   ├── questions.ts              # Question CRUD & selection algorithm
│   │   ├── quiz.ts                   # Quiz logic (assignments, attempts, progress)
│   │   ├── quiz-scoring.ts           # Score calculation
│   │   ├── revenuecat.ts             # RevenueCat webhook helpers
│   │   ├── streak.ts                 # Streak tracking with freeze days
│   │   ├── subscription.ts           # Subscription status computation
│   │   ├── subscription-verification.ts  # Apple/Google IAP verification
│   │   ├── use-me.tsx                # React hook for user profile
│   │   └── user-profile-store.ts     # Web user profile store
│   ├── types/                 # TypeScript types
│   └── middleware.ts          # Route protection
├── mobile/                    # React Native (Expo) iOS app
│   ├── app/                   # Expo Router screens
│   ├── components/            # Shared components
│   ├── src/                   # Mobile source (API client, hooks, stores)
│   └── assets/                # App icons and images
├── docs/                      # Documentation
│   ├── admin-override.md
│   ├── firestore-indexes.md
│   ├── openapi.yaml           # OpenAPI specification
│   └── subscriptions.md
├── seed/
│   └── questions.json         # Seed questions
├── scripts/
│   └── seed.ts               # Database seeding
├── __tests__/                 # Test files (35 suites, 400+ tests)
├── Dockerfile                 # Container configuration
├── cloudbuild.yaml           # Cloud Build configuration
└── README.md
```

## API Routes

### Web Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/login` | Login with access code |
| POST | `/api/login/mobile` | Login with access code (mobile web) |
| POST | `/api/logout` | Clear session |

### Quiz
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/quiz/today` | Get today's quiz questions |
| POST | `/api/quiz/submit` | Submit quiz answers |
| POST | `/api/quiz/retry` | Generate new quiz version |

### Progress & Streaks
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/progress` | Get progress summary |
| GET | `/api/streak` | Get streak status |

### Admin
| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/admin/questions` | List/create questions |
| PUT/DELETE | `/api/admin/questions/[id]` | Update/delete a question |
| GET | `/api/admin/results` | Get all attempts |
| GET | `/api/admin/stats` | Get question statistics |
| GET | `/api/admin/preview` | Preview tomorrow's quiz |
| POST | `/api/admin/account-deletion/run` | Run account deletion job |
| POST | `/api/admin/subscription-override` | Set admin subscription override |

### Mobile Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/mobile/register` | Register email/password |
| POST | `/api/mobile/login` | Login email/password |
| POST | `/api/mobile/oauth/apple` | Apple OAuth sign-in |
| POST | `/api/mobile/oauth/google` | Google OAuth sign-in |
| POST | `/api/mobile/username/check` | Check username availability |
| POST | `/api/mobile/username/update` | Change username |

### Mobile Account Deletion
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/mobile/account/delete/request` | Request account deletion |
| POST | `/api/mobile/account/delete/confirm` | Confirm with verification code |
| POST | `/api/mobile/account/delete/cancel/request` | Request cancellation of deletion |
| POST | `/api/mobile/account/delete/cancel/confirm` | Confirm cancellation |

### Mobile Subscription
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/mobile/subscription/verify` | Verify Apple/Google IAP receipt |

### V1 API (Mobile)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/v1/me` | Get current user profile |
| PUT | `/api/v1/me/subjects` | Update active subjects |
| POST | `/api/v1/subscription/identify` | Link RevenueCat user ID |
| POST | `/api/v1/subscription/sync` | Sync subscription state |
| POST | `/api/v1/subscription/webhook` | RevenueCat webhook receiver |

### Utility
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/version` | Get backend version |

## Deployment to Google Cloud Run

### Versioning Policy (Required Before Each Deploy)

We track the backend version in `package.json`, which is returned by `/api/version`.

Before every deployment, update the version:
- Routine deploy: bump the patch version (the "minor minor" number). Example: `0.1.0` → `0.1.1`.
- Major fix or new feature: bump the minor version instead. Example: `0.1.0` → `0.2.0`.

Tip: `npm version patch` or `npm version minor` updates both `package.json` and `package-lock.json`.

### 1. Set Up GCP Project

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Create Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing GCP project
3. Go to Firestore Database > Create database
4. Select **Native mode**
5. Choose a location (e.g., europe-west1 for Portugal)

### 3. Set Up Secrets

```bash
# Create session secret
openssl rand -base64 32 | gcloud secrets create SESSION_SECRET --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding SESSION_SECRET \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Deploy Using Cloud Build

`cloudbuild.yaml` tags images with `$COMMIT_SHA`. When running `gcloud builds submit` locally, that substitution can be empty. Always pass it explicitly:

```bash
gcloud builds submit --config cloudbuild.yaml --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

Or deploy directly with gcloud:

```bash
# Build the image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/gcse-quiz

# Deploy to Cloud Run
gcloud run deploy gcse-quiz \
  --image gcr.io/YOUR_PROJECT_ID/gcse-quiz \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 2 \
  --set-secrets SESSION_SECRET=SESSION_SECRET:latest
```

### 5. Seed Production Database

Set up credentials for production seeding:

```bash
# Create a service account
gcloud iam service-accounts create gcse-seeder

# Grant Firestore access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:gcse-seeder@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=gcse-seeder@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Run seed
GOOGLE_APPLICATION_CREDENTIALS=./key.json FIREBASE_PROJECT_ID=YOUR_PROJECT_ID npm run seed

# Clean up
rm key.json
```

## Data Model

### Collections

#### `accessCodes`
| Field | Type | Description |
|-------|------|-------------|
| codeHash | string | Bcrypt hash of access code |
| label | string | User label (e.g., "Student") |
| isAdmin | boolean | Admin access flag |
| active | boolean | Whether code is active |

#### `questions`
| Field | Type | Description |
|-------|------|-------------|
| stem | string | Question text |
| options | array[4] | Answer options |
| correctIndex | 0-3 | Index of correct answer |
| explanation | string | Answer explanation |
| topic | string | Topic category |
| subject | string | Subject (Biology, Chemistry, Computer Science) |
| difficulty | 1-3 | Difficulty level |
| active | boolean | Whether active |
| createdAt | timestamp | Creation time |

#### `dailyAssignments`
| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD (part of doc ID: `{date}-{subject}`) |
| subject | string | Subject name |
| quizVersion | number | Version counter |
| generatedAt | timestamp | Generation time |
| questionIds | array[6] | Selected question IDs |

#### `attempts`
| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD in London |
| subject | string | Subject name |
| attemptNumber | number | Attempt counter |
| quizVersion | number | Quiz version used |
| questionIds | array[6] | Question IDs |
| answers | array | User answers |
| isComplete | boolean | Submission complete |
| score | 0-6 | Score |
| topicBreakdown | map | Per-topic results |
| submittedAt | timestamp | Submission time |
| durationSeconds | number | Time taken |
| userLabel | string | User identifier |
| ipHash | string | Hashed IP address |

#### `questionStats`
| Field | Type | Description |
|-------|------|-------------|
| questionId | string | Question reference |
| userLabel | string | User identifier |
| attempts | number | Total attempts |
| correct | number | Correct count |
| lastAttemptedAt | timestamp | Last attempt time |

Doc ID format: `{questionId}_{userLabel}`

#### `userStreaks`
| Field | Type | Description |
|-------|------|-------------|
| userLabel | string | User identifier |
| subject | string | Subject or "overall" |
| currentStreak | number | Current consecutive days |
| longestStreak | number | All-time longest streak |
| lastActivityDate | string | YYYY-MM-DD of last activity |
| freezeDays | number | Available freeze days |
| freezeDaysUsed | number | Total freezes consumed |
| timezone | string | User timezone |
| streakStartDate | string | When current streak began |
| lastFreezeEarnedAt | number | Streak length at last freeze earn |
| updatedAt | timestamp | Last update |

Doc ID format: `{userLabel}-{subject}`

#### `streakActivities`
| Field | Type | Description |
|-------|------|-------------|
| userLabel | string | User identifier |
| subject | string | Subject or "overall" |
| date | string | YYYY-MM-DD |
| activityType | string | "quiz_submit" or "login" |
| createdAt | timestamp | Creation time |

#### `mobileUsers`
| Field | Type | Description |
|-------|------|-------------|
| email | string | User email |
| emailLower | string | Lowercase email (for lookups) |
| username | string | Display name |
| usernameLower | string | Lowercase username (for lookups) |
| passwordHash | string | Bcrypt hash |
| oauthProvider | string | "google" or "apple" (optional) |
| oauthSubject | string | OAuth subject ID (optional) |
| activeSubjects | array | Selected subjects |
| onboardingComplete | boolean | Onboarding status |
| revenueCatAppUserId | string | RevenueCat user ID (optional) |
| subscriptionStart | timestamp | Subscription start (optional) |
| subscriptionExpiry | timestamp | Subscription expiry (optional) |
| graceUntil | timestamp | Grace period end (optional) |
| subscriptionProvider | string | Provider name (optional) |
| entitlement | string | "premium", "free", or "none" |
| subscriptionStatus | string | "active", "grace", "expired", "unknown" |
| adminOverride | boolean | Manual premium override |
| deletionStatus | string | "none", "pending", "cancelled", "deleted" |
| deletionRequestedAt | timestamp | When deletion was requested |
| deletionScheduledFor | timestamp | Scheduled deletion date |
| deletionCancelledAt | timestamp | When deletion was cancelled |

#### `userProfiles`
| Field | Type | Description |
|-------|------|-------------|
| label | string | User label |
| labelLower | string | Lowercase label (for lookups) |
| activeSubjects | array | Selected subjects |
| onboardingComplete | boolean | Onboarding status |
| createdAt | timestamp | Creation time |
| (subscription fields) | various | Same subscription fields as mobileUsers |

#### `accountDeletionRequests`
| Field | Type | Description |
|-------|------|-------------|
| userId | string | Mobile user ID |
| email | string | User email |
| codeHash | string | Bcrypt hash of verification code |
| createdAt | timestamp | When request was created |
| expiresAt | timestamp | Code expiration time |
| attemptCount | number | Verification attempt count |
| status | string | "pending", "verified", "expired", "cancelled" |
| type | string | "delete" or "cancel" |

## Subjects and Topics

### Computer Science
- CPU (architecture, registers, FDE cycle)
- RAM & ROM (volatile vs non-volatile)
- Storage (HDD, SSD, optical, cloud)
- Operating Systems (functions, management)
- Embedded Systems
- Networks Basics (LAN, WAN, topologies)
- Protocols (TCP/IP, HTTP, DNS)
- Security (malware, encryption, attacks)
- Ethics, Law & Environment
- Performance factors

### Biology
Topics configured via question database.

### Chemistry
Topics configured via question database.

## Security Considerations

- Access codes are hashed with bcrypt (cost factor 12)
- Sessions use signed JWTs with HttpOnly cookies
- All quiz scoring happens server-side
- Admin routes require admin access code
- No sensitive data exposed to client

## Customization

### Changing Access Codes

Edit `scripts/seed.ts` to modify default codes before seeding, or manually update hashes in Firestore.

### Adding Questions

1. Add to `seed/questions.json` and re-seed, or
2. Use admin interface at `/admin/questions`, or
3. Use bulk import in admin with JSON array

### Changing Timezone

Modify `TIMEZONE` constant in `src/lib/date.ts`:

```typescript
const TIMEZONE = 'Europe/London';  // Change to your timezone
```

## License

Private/Internal Use
