#papeo-backend

# Deployment
### lambda deploy:
in /src folder run:
* serverless deploy --stage <dev || staging>

### firebase functions deploy
in /firebase run:
* firebase deploy -P staging --only functions
* for dev: firebase deploy --only functions

# Tests
run in /src folder:
* npm run test
* aws --endpoint-url=http://localhost:4566 s3api create-bucket --bucket papeo-test

# Environment variables
````
MONGODB_URI=
SENTRY_ENV=local
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
S3_BUCKET=papeo-uploads-staging
REGION=eu-central-1
PORT=3000
EMAIL_CLIENT=development
SEND_MAIL_FROM=no-reply@papeo.party
JWT_SIGNING_SECRET=
GOOGLE_MAPS_API_KEY=
S3_THUMBNAIL_BUCKET=papeo-uploads-thumbnails-staging
REVENUECAT_WEBHOOK_SECRET=
REVENUECAT_API_KEY=
STRIPE_PRIVATE=
DOMAIN_FRONTEND=
GOOGLE_TRANSLATE_KEY=
STRIPE_WEBHOOK_SIGNING_SECRET=
APP_HASH=1nOBYWU1UaG
TZ=Germany/Berlin
````

### Testing environment variables
````
TEST_PHONE_NUMBERS=+491761000001,+491761000002,+491761000003
OVERWRITE_VERIFICATION_CODE=999999
TEST=TRUE
REQUIRE_SHARP=TRUE
DISABLE_GOOGLE_MAPS=TRUE
LOADTEST=TRUE
`````
