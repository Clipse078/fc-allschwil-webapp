# WebApp Vercel Env Entry Sheet

## fc-allschwil-webapp-stage

NODE_ENV=production
APP_ENV=stage
APP_BASE_URL=https://stage-webapp.fcallschwil.ch
NEXTAUTH_URL=https://stage-webapp.fcallschwil.ch
NEXTAUTH_SECRET=<paste-unique-stage-secret>
DATABASE_URL=<paste-stage-database-url>
DIRECT_URL=<paste-stage-direct-database-url>

## fc-allschwil-webapp-prod

NODE_ENV=production
APP_ENV=prod
APP_BASE_URL=https://webapp.fcallschwil.ch
NEXTAUTH_URL=https://webapp.fcallschwil.ch
NEXTAUTH_SECRET=<paste-unique-prod-secret>
DATABASE_URL=<paste-prod-database-url>
DIRECT_URL=<paste-prod-direct-database-url>

## Notes

- never reuse NEXTAUTH_SECRET between stage and prod
- never reuse DATABASE_URL between stage and prod
- never reuse DIRECT_URL between stage and prod
- VERCEL_ENV, VERCEL_GIT_COMMIT_SHA, VERCEL_DEPLOYMENT_ID come from Vercel automatically
- verify /api/health after each project is configured
