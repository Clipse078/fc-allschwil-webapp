# Canonical Deployment Rules

## Source of Truth

- **STAGE is the canonical branch** for deployment verification.
- The Vercel project `sportclubevo-webapp-stage` deploys from the `STAGE` branch.
- Only the STAGE Production deployment is operational truth.

## Preview Deployments

Preview deployments (Vercel URLs like `*-lv26aclog-*`) are **disposable**.

- They may not have `DATABASE_URL`, `AUTH_SECRET`, or `NEXTAUTH_SECRET` configured.
- They are NOT operational truth — never use them to diagnose production bugs.
- The `/api/health` endpoint will report `isPreview: true` and emit a warning on previews.
- Runtime validation is relaxed on preview deployments to avoid false-positive errors.

## Required Environment Variables

All of these must be set in Vercel for **Production**, **Preview**, and **Development** scopes:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_URL` | Recommended | Direct DB connection (bypasses pooler) |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | Yes | At least one must be set |
| `NEXTAUTH_URL` | Yes (STAGE/PROD) | Must match canonical domain |
| `APP_BASE_URL` | Yes (STAGE/PROD) | Must match canonical domain |
| `APP_ENV` | Yes | `stage` or `prod` |
| `NODE_ENV` | Yes | Must be `production` for STAGE/PROD |

Vercel auto-provides: `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_DEPLOYMENT_ID`.

## First Debug Route

When diagnosing deployment issues, always start with:

```
GET /api/health
```

This endpoint returns:
- `ok` — overall health status
- `deployment.environment` — LOCAL / STAGE / PROD
- `deployment.isPreview` — whether this is a preview deployment
- `deployment.branch` — git branch from `VERCEL_GIT_COMMIT_REF`
- `deployment.commitSha` — git commit from `VERCEL_GIT_COMMIT_SHA`
- `environment` — parsed runtime configuration
- `checks` — presence checks for all critical env vars
- `database` — DB connectivity result
- `warnings` — non-blocking configuration issues
- `errors` — blocking configuration issues

The endpoint never exposes secret values.

## Verification Checklist

After every deployment to STAGE:

1. Open `/api/health` on the canonical STAGE URL
2. Confirm `deployment.environment` is `STAGE`
3. Confirm `checks.hasDatabaseUrl` is `true`
4. Confirm `checks.hasAuthSecret` or `checks.hasNextAuthSecret` is `true`
5. Confirm `database.ok` is `true`
6. Confirm `warnings` and `errors` are empty (or expected)
7. Navigate to `/dashboard` and verify the page renders
8. Navigate to `/meetings`, `/initiatives`, `/targets`, `/templates`

## Runtime Crash Prevention

The lazy Prisma client pattern (`lib/db/prisma.ts`) ensures that:

- Importing `prisma` never throws at module load time
- `auth.ts` importing `prisma` does not crash all pages
- DB errors only surface when an actual DB operation is attempted
- `/api/health` can survive and report diagnostics even without `DATABASE_URL`

## Canonical Routes

Standalone routes (not under `/vereinsleitung/*`):

- `/meetings`
- `/initiatives`
- `/targets`
- `/templates`

Legacy routes redirect to canonical routes:

- `/vereinsleitung/meetings` → `/meetings`
- `/vereinsleitung/initiativen` → `/initiatives`
- `/vereinsleitung/targets` → `/targets`
- `/vereinsleitung/templates` → `/templates`

The `/vereinsleitung` hub and `/vereinsleitung/kpis` remain active.
