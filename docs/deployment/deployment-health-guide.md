# Deployment Health Guide

## Canonical Deployment

| Property | Value |
|----------|-------|
| Canonical branch | `STAGE` |
| Vercel project | `sportclubevo-webapp-stage` |
| Production deployment | Branch-deployed from `STAGE` |
| Preview deployments | Disposable — NOT operational truth |

**Rule**: Only use the STAGE/Production deployment for debugging and verification.
Preview URLs (e.g. `*-lv26aclog-*`) may lack environment variables and should never
be treated as the canonical application state.

---

## Required Environment Variables

These must be configured in Vercel → Settings → Environment Variables for both
**Production** and **Preview** environments:

| Variable | Required for | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Production, Preview | PostgreSQL connection string |
| `DIRECT_URL` | Production (recommended) | Direct connection for migrations |
| `NEXTAUTH_SECRET` | Production, Preview | JWT signing secret |
| `AUTH_SECRET` | Production, Preview | Alternative to NEXTAUTH_SECRET (NextAuth v5) |
| `NEXTAUTH_URL` | Production | Canonical app URL |
| `APP_BASE_URL` | Production | Canonical app URL |
| `APP_ENV` | Production | `stage` or `prod` |

### Preview Environment Caveat

Preview deployments may not have all environment variables configured.
The app is designed to survive missing `DATABASE_URL` at import time (lazy Prisma
client). Pages that require DB access will fail gracefully when the database is
unavailable, but the app shell and health endpoint will still render.

---

## Health Endpoint

**`GET /api/health`** is the first route to check when debugging deployment issues.

It returns JSON with:
- `ok` — overall health status
- `deployment` — environment, branch, commit SHA, deployment ID, preview flag
- `environment` — APP_ENV, NODE_ENV, VERCEL_ENV, computed flags
- `checks` — boolean presence checks for all critical env vars
- `database` — connection test result
- `warnings` — non-fatal configuration issues
- `errors` — fatal configuration issues
- `timestamp` — server time

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | All checks passed |
| 503 | One or more checks failed (missing env vars, DB unreachable) |

### Debugging Flow

1. Open `/api/health` on the deployment
2. Check `deployment.isPreview` — if true, you may be on a preview URL
3. Check `checks.hasDatabaseUrl` — if false, DATABASE_URL is missing in Vercel
4. Check `checks.hasAuthSecret` — if false, neither AUTH_SECRET nor NEXTAUTH_SECRET is set
5. Check `database.ok` — if false, read `database.message` for the connection error
6. Review `warnings` and `errors` arrays for configuration guidance

---

## Runtime Crash Prevention

### Lazy Prisma Client (`lib/db/prisma.ts`)

The Prisma client is exported as a `Proxy`. Importing the module never throws —
the actual PrismaClient is only constructed when a database method is called.

This prevents the crash chain:
```
page.tsx → auth() → auth.ts imports prisma
→ lib/db/prisma.ts threw at module import if DATABASE_URL was missing
→ every page crashed before rendering
```

Now:
- Module import always succeeds
- DB errors surface only when actual DB operations are attempted
- Non-DB pages render normally even without DATABASE_URL
- `/api/health` survives and reports the missing variable

---

## Canonical Routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | Operations cockpit |
| `/meetings` | Meetings list (canonical) |
| `/initiatives` | Initiatives list (canonical) |
| `/targets` | Targets/goals list (canonical) |
| `/templates` | Communication templates (canonical) |
| `/vereinsleitung` | Governance hub |
| `/vereinsleitung/kpis` | KPI dashboard |
| `/api/health` | Deployment health check |

### Legacy Redirects

These legacy paths redirect to canonical routes via server-side `redirect()`:

| Legacy Path | Redirects To |
|-------------|-------------|
| `/vereinsleitung/meetings` | `/meetings` |
| `/vereinsleitung/initiativen` | `/initiatives` |
| `/vereinsleitung/targets` | `/targets` |
| `/vereinsleitung/templates` | `/templates` |

All sidebar navigation and dashboard links use canonical routes exclusively.
