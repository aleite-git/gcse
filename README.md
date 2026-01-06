# Daily 5 GCSE CS Quiz

A private web application that serves a daily 5-question quiz for GCSE Computer Science (Computer Systems & Theory). Designed to run on Google Cloud Platform free tier.

## Features

- Daily 5-question multiple choice quiz
- Must answer all 5 questions before submitting
- Immediate feedback with explanations
- Retry with new questions
- Progress tracking (last 7 days)
- Topic performance analysis
- Admin interface for question management
- Secure access code authentication

## Tech Stack

- **Frontend/Backend**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Google Cloud Firestore
- **Hosting**: Google Cloud Run
- **Authentication**: Access codes with JWT sessions

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

Tests cover:
- Submission validation (must answer all 5 questions)
- Scoring correctness
- Date handling in Europe/Lisbon timezone

## Project Structure

```
gcse/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   ├── quiz/
│   │   │   ├── progress/
│   │   │   └── admin/
│   │   ├── quiz/              # Quiz pages
│   │   ├── progress/          # Progress page
│   │   └── admin/             # Admin pages
│   ├── lib/                   # Core libraries
│   │   ├── auth.ts           # Authentication
│   │   ├── firebase.ts       # Firestore connection
│   │   ├── date.ts           # Timezone handling
│   │   ├── questions.ts      # Question management
│   │   └── quiz.ts           # Quiz logic
│   ├── types/                 # TypeScript types
│   └── middleware.ts          # Route protection
├── seed/
│   └── questions.json         # Seed questions
├── scripts/
│   └── seed.ts               # Database seeding
├── __tests__/                 # Test files
├── Dockerfile                 # Container configuration
├── cloudbuild.yaml           # Cloud Build configuration
└── README.md
```

## Deployment to Google Cloud Run

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

```bash
gcloud builds submit --config cloudbuild.yaml
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
| difficulty | 1-3 | Difficulty level |
| active | boolean | Whether active |
| createdAt | timestamp | Creation time |

#### `dailyAssignments`
| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD (doc ID) |
| quizVersion | number | Version counter |
| generatedAt | timestamp | Generation time |
| questionIds | array[5] | Selected question IDs |

#### `attempts`
| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD in Lisbon |
| attemptNumber | number | Attempt counter |
| quizVersion | number | Quiz version used |
| questionIds | array[5] | Question IDs |
| answers | array | User answers |
| isComplete | boolean | Submission complete |
| score | 0-5 | Score |
| topicBreakdown | map | Per-topic results |
| submittedAt | timestamp | Submission time |
| durationSeconds | number | Time taken |
| userLabel | string | User identifier |

## Topics Covered

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
const TIMEZONE = 'Europe/Lisbon';  // Change to your timezone
```

## License

Private/Internal Use
