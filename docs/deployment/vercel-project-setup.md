# Vercel Project Setup

## Target projects

Create 2 separate Vercel projects:

1. `sportclubevo-webapp-stage` (canonical)
2. `fc-allschwil-webapp-prod`

Do not combine STAGE and PROD into one shared project.

---

## Git branch mapping

- STAGE project -> branch `STAGE`
- PROD project -> branch `main`

Feature branches remain preview deployments only and are not canonical runtime truth.

---

## Required environment variables

Set these in both Vercel projects with project-specific values:

- `NODE_ENV`
- `APP_ENV`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`

Optional now, likely needed later:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `CRON_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SENTRY_DSN`

Note:
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_DEPLOYMENT_ID`

are provided by Vercel automatically and should not be manually overridden unless there is a special reason.

---

## Stage project values

- `NODE_ENV=production`
- `APP_ENV=stage`
- `APP_BASE_URL=https://your-stage-url.example.com`
- `NEXTAUTH_URL=https://your-stage-url.example.com`
- `NEXTAUTH_SECRET=<unique-stage-secret>`
- `DATABASE_URL=<stage-db-url>`
- `DIRECT_URL=<stage-direct-db-url>`

---

## Prod project values

- `NODE_ENV=production`
- `APP_ENV=prod`
- `APP_BASE_URL=https://your-prod-url.example.com`
- `NEXTAUTH_URL=https://your-prod-url.example.com`
- `NEXTAUTH_SECRET=<unique-prod-secret>`
- `DATABASE_URL=<prod-db-url>`
- `DIRECT_URL=<prod-direct-db-url>`

---

## Hard rules

- never reuse the same secret between STAGE and PROD
- never reuse the same database between STAGE and PROD
- never point STAGE to PROD URLs
- never point PROD to localhost
- run migrations in STAGE first
- verify `/api/health` in STAGE before promoting to PROD

---

## Recommended first DNS targets later

- STAGE: `stage-webapp.fcallschwil.ch`
- PROD: `webapp.fcallschwil.ch`

---

## Verification after Vercel setup

1. Open `/api/health`
2. Confirm:
   - `appEnv`
   - `vercelEnv`
   - DB/auth env presence states
   - warnings/errors
3. Open `/dashboard/runtime`
4. Confirm:
   - deployment metadata visible
   - protected access works
   - stage banner only appears in STAGE

## Manual check reminder

On Vercel, make sure these variables are enabled for all scopes (**Production**, **Preview**, **Development**):

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
