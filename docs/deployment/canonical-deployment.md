# Canonical Deployment Rules

## STAGE is canonical

The STAGE deployment (`sportclubevo-webapp-stage`) is the single source of truth for testing and verification.

- **Production Branch** in Vercel is set to `STAGE`
- Every push to `STAGE` triggers a Production deployment on the STAGE Vercel project
- Only the STAGE Production deployment URL is valid for testing

---

## Preview deployments are disposable

Feature branches trigger Vercel Preview deployments automatically.

Preview deployments:
- have a URL like `*-<hash>-<project>.vercel.app`
- **may not have** DATABASE_URL, AUTH_SECRET/NEXTAUTH_SECRET, or NEXTAUTH_URL configured
- are **not canonical** — do not use them as test/validation targets
- will return 503 from `/api/health` if env vars are missing (this is expected)

**Rule:** If a Preview deployment crashes or shows white screens, check `/api/health` first.  
If DATABASE_URL or AUTH_SECRET/NEXTAUTH_SECRET is missing, the issue is the Preview env config — not the app code.

---

## Required env vars per environment

### STAGE (Vercel project: sportclubevo-webapp-stage)

| Variable | Scope | Required |
|---|---|---|
| `NODE_ENV` | Production | `production` |
| `APP_ENV` | Production | `stage` |
| `APP_BASE_URL` | Production | canonical stage URL |
| `NEXTAUTH_URL` | Production | canonical stage URL |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | Production, Preview, Development | unique stage secret |
| `DATABASE_URL` | Production, Preview, Development | stage database URL |
| `DIRECT_URL` | Production, Preview, Development | stage direct database URL |

> Enable `DATABASE_URL` and `AUTH_SECRET`/`NEXTAUTH_SECRET` for **Preview** and **Development**  
> environments too, otherwise preview deployments will report `503` from `/api/health`.

---

## Auth.js v5 secret naming

This app uses `next-auth` v5 (Auth.js). Auth.js v5 reads `AUTH_SECRET` by default and falls back to `NEXTAUTH_SECRET` for backwards compatibility.

**Preferred variable name:** `AUTH_SECRET`  
**Legacy variable name:** `NEXTAUTH_SECRET` (still supported, but prefer AUTH_SECRET)

The `/api/health` endpoint reports both `hasAuthSecret` and `hasNextAuthSecret` to make it easy to diagnose which is set.

---

## Deployment verification checklist

After any Vercel project change or env var update:

1. Open `/api/health` on the STAGE Production URL
2. Confirm:
   - `"ok": true`
   - `"isPreview": false`
   - `"hasDatabaseUrl": true`
   - `"hasNextAuthSecret": true`
   - `"database": { "ok": true }`
   - `"warnings": []` (or only informational warnings)
3. Open `/dashboard/runtime` (requires admin login)
4. Confirm no errors or preview warnings shown

---

## Debug flow for broken deployments

```
1. Is it a Preview URL (*-hash-*.vercel.app)?
   YES → Expected. Check env vars in Vercel for Preview environment.
   NO  → Proceed to step 2.

2. Open /api/health on the STAGE Production URL
   - "ok": false and "hasDatabaseUrl": false → Add DATABASE_URL in Vercel for Production
   - "ok": false and "hasNextAuthSecret": false → Add AUTH_SECRET in Vercel for Production
   - "database": { "ok": false } → Database connection issue, check DATABASE_URL value

3. If env vars are all present but app still crashes:
   - Check Vercel deployment logs
   - Look for TypeScript/build errors in the deployment build log
   - Check STAGE branch commit history for recent merges
```
