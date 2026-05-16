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

## Next safe step

Recommended next:
1. add `StageEnvironmentBanner` component
2. add protected admin-only runtime diagnostics page
3. wire `assertRuntimeConfiguration()` into selected server entry points
4. add DB connectivity check to health endpoint
5. add auth callback URL consistency check

Do not add boot-time hard assertions to the root app shell yet unless we first verify current auth/bootstrap paths.
