# Website Vercel Env Entry Sheet

## fc-allschwil-website-stage

NODE_ENV=production
APP_ENV=stage
NEXT_PUBLIC_APP_ENV=stage

NEXT_PUBLIC_API_BASE_URL=https://stage-webapp.fcallschwil.ch
NEXT_PUBLIC_WEBSITE_BASE_URL=https://stage.fcallschwil.ch

## fc-allschwil-website-prod

NODE_ENV=production
APP_ENV=prod
NEXT_PUBLIC_APP_ENV=prod

NEXT_PUBLIC_API_BASE_URL=https://webapp.fcallschwil.ch
NEXT_PUBLIC_WEBSITE_BASE_URL=https://www.fcallschwil.ch

## Notes

- Website NEVER talks to ClubCorner directly
- Website ONLY talks to WebApp API
- API base URL must always point to correct WebApp environment

- STAGE website → STAGE WebApp
- PROD website → PROD WebApp

- never mix environments
- never point PROD to STAGE
- verify data flow via:
  - matches
  - spielplan
  - news

- Website is read-only consumer
- WebApp is the single source of truth
