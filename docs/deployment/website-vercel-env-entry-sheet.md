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

NEXT_PUBLIC_API_BASE_URL=https://fcallschwil.sportclubevo.com
NEXT_PUBLIC_WEBSITE_BASE_URL=https://www.fcallschwil.ch

## Notes

- Website NEVER talks to ClubCorner directly
- Website ONLY talks to WebApp API
- API base URL must always point to correct WebApp environment

- STAGE website → STAGE WebApp (`https://stage-webapp.fcallschwil.ch`)
- PROD website → PROD WebApp — canonical SportClubEvo tenant (`https://fcallschwil.sportclubevo.com`)

- never mix environments
- never point PROD to STAGE
- verify data flow via:
  - matches
  - spielplan
  - news

- Website is read-only consumer
- WebApp is the single source of truth

## DNS / Vercel manual actions required (PROD)

- Add `fcallschwil.sportclubevo.com` as a custom domain on the
  `fc-allschwil-webapp-prod` Vercel project.
- DNS: add a CNAME record `fcallschwil` → `cname.vercel-dns.com` in the
  `sportclubevo.com` zone (or follow the Vercel domain verification flow).
- After DNS propagates, verify:
  - `https://fcallschwil.sportclubevo.com/api/health` returns healthy
  - `https://fcallschwil.sportclubevo.com/api/public/fcallschwil/website/matches` returns data
