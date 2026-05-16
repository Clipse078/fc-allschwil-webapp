# FCA Digital Ecosystem — Vercel Project Matrix

## Projects

### 1) FC Allschwil Website — STAGE
- Project name: `fc-allschwil-website-stage`
- Git branch: `STAGE`
- Purpose: internal QA, content review, go-live prep
- Suggested domain later: `stage.fcallschwil.ch`

### 2) FC Allschwil Website — PROD
- Project name: `fc-allschwil-website-prod`
- Git branch: `main`
- Purpose: public live website
- Suggested domain later: `www.fcallschwil.ch`

### 3) FC Allschwil WebApp — STAGE
- Project name: `fc-allschwil-webapp-stage`
- Git branch: `STAGE`
- Purpose: internal QA, operations testing, release validation
- Suggested domain later: `stage-webapp.fcallschwil.ch`

### 4) FC Allschwil WebApp — PROD
- Project name: `fc-allschwil-webapp-prod`
- Git branch: `main`
- Purpose: live internal operations system
- Suggested domain later: `webapp.fcallschwil.ch`

---

## Hard separation rules

- every STAGE and PROD environment gets its own project
- STAGE and PROD must not share secrets
- STAGE and PROD must not share databases
- Website and WebApp remain separate deployments
- feature branches remain preview deployments only

---

## WebApp required env keys

- `NODE_ENV`
- `APP_ENV`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`

Optional later:
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

---

## WebApp target values

### STAGE
- `NODE_ENV=production`
- `APP_ENV=stage`
- `APP_BASE_URL=https://stage-webapp.fcallschwil.ch`
- `NEXTAUTH_URL=https://stage-webapp.fcallschwil.ch`
- `NEXTAUTH_SECRET=<unique-stage-secret>`
- `DATABASE_URL=<stage-db-url>`
- `DIRECT_URL=<stage-direct-db-url>`

### PROD
- `NODE_ENV=production`
- `APP_ENV=prod`
- `APP_BASE_URL=https://webapp.fcallschwil.ch`
- `NEXTAUTH_URL=https://webapp.fcallschwil.ch`
- `NEXTAUTH_SECRET=<unique-prod-secret>`
- `DATABASE_URL=<prod-db-url>`
- `DIRECT_URL=<prod-direct-db-url>`

---

## Vercel-provided runtime metadata

These are provided by Vercel automatically:
- `VERCEL_ENV`
- `VERCEL_GIT_COMMIT_SHA`
- `VERCEL_DEPLOYMENT_ID`

Do not manually override them unless needed for a specific reason.

---

## Release verification

### WebApp STAGE
- `/api/health` returns healthy
- DB ping works
- `/dashboard/runtime` is protected
- deployment metadata is visible
- STAGE banner appears

### WebApp PROD
- `/api/health` returns healthy
- DB ping works
- `/dashboard/runtime` is protected
- deployment metadata is visible
- STAGE banner does not appear
