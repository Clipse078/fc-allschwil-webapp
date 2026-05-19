# Runtime Diagnostics

## Canonical deployment rule

- Canonical WebApp deployment: `sportclubevo-webapp-stage`
- Canonical branch: `STAGE`
- Review runtime health only on the STAGE production deployment
- Treat random preview URLs as disposable diagnostics targets, not operational truth

## First debug route

- Always start with `/api/health`
- `/api/health` is designed to respond even when `DATABASE_URL` is missing
- It reports presence/missing states only (no secret values are exposed)

## `/api/health` response contract

The endpoint returns runtime diagnostics for:

- app status (`healthy` / `degraded`)
- environment (`APP_ENV`, `NODE_ENV`, `VERCEL_ENV`)
- env presence checks:
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
- deployment metadata (branch/commit/deployment id if available)
- preview warning when running on `VERCEL_ENV=preview`

## Required Vercel env wiring

Before assuming route or app-level regressions, verify Vercel env variable scopes:

- `DATABASE_URL` enabled for **Production**, **Preview**, **Development**
- `AUTH_SECRET` or `NEXTAUTH_SECRET` enabled for **Production**, **Preview**, **Development**
- `NEXTAUTH_URL` set correctly for the canonical STAGE URL

## Related runtime surfaces

- `components/admin/deployment/StageEnvironmentBanner.tsx` (STAGE marker)
- `app/(admin)/dashboard/runtime/page.tsx` (admin runtime diagnostics page)
