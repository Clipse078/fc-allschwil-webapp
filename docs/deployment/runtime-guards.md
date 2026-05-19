# Runtime Guards

## Goal

Add a safe deployment/runtime validation layer before wiring deeper DB/auth enforcement into the application shell.

This step is intentionally non-destructive:
- no UI changes
- no layout changes
- no auth rewrite
- no middleware changes

---

## Added files

### `lib/env.ts`
Central environment parser for:
- `APP_ENV`
- `NODE_ENV`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- presence checks for DB/auth secrets

### `lib/server/runtime.ts`
Server-side validation layer that:
- evaluates whether local/stage/prod is configured correctly
- returns warnings
- returns hard errors
- can later be used inside protected startup paths

### `app/api/health/route.ts`
Health endpoint for:
- Vercel smoke testing
- deployment verification
- environment debugging

---

## Current behavior

### Local
- tolerant
- allows partial configuration
- only validates basic `NODE_ENV`

### STAGE
Requires:
- `NODE_ENV=production`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `NEXTAUTH_SECRET`

### PROD
Requires:
- `NODE_ENV=production`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- no localhost URLs

---

## Why this is useful now

Before:
- deployment failures are harder to diagnose
- env mistakes are discovered too late
- stage/prod mixups are easier

After:
- health endpoint reveals missing runtime essentials
- future boot checks can fail fast
- safer path to STAGE and PROD rollout

---

## Completed

1. `StageEnvironmentBanner` component — integrated into admin layout
2. Protected admin-only runtime diagnostics page — available at `/admin/runtime`
3. DB connectivity check in `/api/health` — reports connection status
4. Preview deployment detection — relaxed validation, clear warnings
5. `AUTH_SECRET` + `NEXTAUTH_SECRET` dual-check — either satisfies the requirement
6. Lazy Prisma client — import-time crash prevention via Proxy pattern

See also: `docs/deployment/canonical-deployment-rules.md` for the full deployment operations guide.
