# WebApp Vercel Env Entry Sheet

## Canonical project

- Use only `sportclubevo-webapp-stage` as the canonical STAGE review target
- Production Branch for the STAGE project: `STAGE`
- Preview deployments are disposable and must not be treated as source-of-truth
- First debug route after every deploy: `/api/health`

## sportclubevo-webapp-stage

NODE_ENV=production
APP_ENV=stage
APP_BASE_URL=https://stage-webapp.fcallschwil.ch
NEXTAUTH_URL=https://stage-webapp.fcallschwil.ch
NEXTAUTH_SECRET=<paste-unique-stage-secret>
DATABASE_URL=<paste-stage-database-url>
DIRECT_URL=<paste-stage-direct-database-url>

## sportclubevo-webapp-prod

NODE_ENV=production
APP_ENV=prod
APP_BASE_URL=https://webapp.fcallschwil.ch
NEXTAUTH_URL=https://webapp.fcallschwil.ch
NEXTAUTH_SECRET=<paste-unique-prod-secret>
DATABASE_URL=<paste-prod-database-url>
DIRECT_URL=<paste-prod-direct-database-url>

## Vercel environment assignment

Enable these keys for Production, Preview, and Development where applicable:

- `DATABASE_URL`
- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

At minimum, the canonical STAGE deployment must have these set for Production.
If Preview is missing any of them, treat it as a deployment configuration problem first.

## Notes

- never reuse NEXTAUTH_SECRET between stage and prod
- never reuse DATABASE_URL between stage and prod
- never reuse DIRECT_URL between stage and prod
- VERCEL_ENV, VERCEL_GIT_COMMIT_SHA, VERCEL_DEPLOYMENT_ID come from Vercel automatically
- verify /api/health after each project is configured
- if `/api/health` reports Preview, review the dedicated STAGE production deployment instead of the preview URL
