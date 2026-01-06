#!/bin/bash
# GCP Setup Script for Daily 5 GCSE CS Quiz
# Project ID: gcse-cs-1

set -e

PROJECT_ID="gcse-cs-1"
REGION="europe-west1"

echo "=== Setting up GCP project: $PROJECT_ID ==="

# Set project
echo "Setting active project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo "Project number: $PROJECT_NUMBER"

# Create session secret
echo "Creating session secret..."
if ! gcloud secrets describe SESSION_SECRET --project=$PROJECT_ID &>/dev/null; then
    openssl rand -base64 32 | gcloud secrets create SESSION_SECRET --data-file=- --project=$PROJECT_ID
    echo "Session secret created"
else
    echo "Session secret already exists"
fi

# Grant Cloud Run access to secret
echo "Granting secret access to Cloud Run service account..."
gcloud secrets add-iam-policy-binding SESSION_SECRET \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$PROJECT_ID

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Create Firestore database in Firebase Console (Native mode, $REGION)"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/firestore"
echo ""
echo "2. Seed the database:"
echo "   # Create service account for seeding"
echo "   gcloud iam service-accounts create gcse-seeder --project=$PROJECT_ID"
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "     --member='serviceAccount:gcse-seeder@$PROJECT_ID.iam.gserviceaccount.com' \\"
echo "     --role='roles/datastore.user'"
echo "   gcloud iam service-accounts keys create key.json \\"
echo "     --iam-account=gcse-seeder@$PROJECT_ID.iam.gserviceaccount.com"
echo "   GOOGLE_APPLICATION_CREDENTIALS=./key.json FIREBASE_PROJECT_ID=$PROJECT_ID npm run seed"
echo "   rm key.json"
echo ""
echo "3. Deploy to Cloud Run:"
echo "   gcloud builds submit --config cloudbuild.yaml"
echo ""
echo "   Or manually:"
echo "   gcloud builds submit --tag gcr.io/$PROJECT_ID/gcse-quiz"
echo "   gcloud run deploy gcse-quiz \\"
echo "     --image gcr.io/$PROJECT_ID/gcse-quiz \\"
echo "     --platform managed \\"
echo "     --region $REGION \\"
echo "     --allow-unauthenticated \\"
echo "     --memory 512Mi \\"
echo "     --min-instances 0 \\"
echo "     --max-instances 2 \\"
echo "     --set-secrets SESSION_SECRET=SESSION_SECRET:latest"
