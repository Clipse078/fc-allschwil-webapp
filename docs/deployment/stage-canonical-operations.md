# WebApp Runtime + Deployment Debug Playbook

## Canonical deployment rule

- Canonical project: `sportclubevo-webapp-stage`
- Canonical branch: `STAGE`
- Review health and runtime state only on the STAGE production deployment URL.
- Treat random preview URLs (for example `*-lv26aclog-*`) as disposable diagnostics only.

## Required Vercel environment variables

Set these for **Production**, **Preview**, and **Development** in the WebApp project:

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET` (at least one must be present)
- `NEXTAUTH_URL`

Recommended supporting values:

- `APP_ENV=stage` on STAGE project
- `NODE_ENV=production` on deployed environments

## First debug route

Use `/api/health` before investigating UI routes.

`/api/health` reports:

- app status (`ok` or `degraded`)
- `APP_ENV`, `NODE_ENV`, `VERCEL_ENV`
- presence checks for `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- deployment metadata (`branch`, `commitSha`, `deploymentId`)
- preview warning when running on `VERCEL_ENV=preview`

The endpoint never returns secret values, only `present`/`missing`.

## Runtime failure policy

- Missing `DATABASE_URL` must create a controlled warning/degraded health response.
- Missing DB config must not crash the whole app at module import time.
- Database failures are allowed to fail fast only when an actual DB operation runs.
