# Canonical Deployment

This document is intentionally short. It captures the rules that
unbreak debugging the SportClubEvo WebApp on Vercel.

---

## 1. Canonical environment

- The **only** canonical deployment is `sportclubevo-webapp-stage`.
- Its **Production Branch is `STAGE`** (not `main` / not `master`).
- The canonical Git branch for source-of-truth work is `STAGE`.
- Review only the STAGE / Production deployment of that project.

If a URL contains `*-lv26aclog-*` or any other Preview-style suffix,
treat it as a disposable Preview deployment. Do **not** use it as
operational truth.

---

## 2. Preview deployments are disposable

Vercel Preview deployments:

- may be missing `DATABASE_URL`, `AUTH_SECRET` / `NEXTAUTH_SECRET`,
  or `NEXTAUTH_URL`
- may render with degraded auth
- may surface "white-screen" symptoms that do **not** reflect bugs
  in canonical STAGE
- are not operational truth

If you see a runtime crash on a Preview URL, first check whether
the env vars are configured for the Preview environment in Vercel
**before** assuming a code regression.

The runtime banner in the admin shell shows `STAGE` only when
`APP_ENV=stage`. Preview deployments do not show this banner — that
absence is itself a signal that you are not on canonical STAGE.

---

## 3. Required env vars per environment

For each Vercel environment (Production, Preview, Development) on
`sportclubevo-webapp-stage`:

| Variable                | Required | Notes                                                |
| ----------------------- | -------- | ---------------------------------------------------- |
| `APP_ENV`               | yes      | `stage` for the canonical project                    |
| `NODE_ENV`              | auto     | `production` on Vercel                               |
| `APP_BASE_URL`          | yes      | Canonical stage URL, no trailing slash, no localhost |
| `NEXTAUTH_URL`          | yes      | Same canonical host as `APP_BASE_URL`                |
| `AUTH_SECRET` _or_ `NEXTAUTH_SECRET` | yes | Either is accepted by NextAuth v5         |
| `DATABASE_URL`          | yes      | Postgres connection string                           |
| `DIRECT_URL`            | optional | Used by Prisma migrations when present               |

**Important:** these must be enabled for **all three** environments
(Production, Preview, Development). Skipping Preview is the
single most common cause of "the app crashes everywhere except
local dev".

---

## 4. First debug route: `/api/health`

The first thing to hit when something looks broken is:

```
GET https://<canonical-stage-host>/api/health
```

It will:

- never throw
- never expose secret values (only presence booleans)
- return `200` when healthy, `503` when degraded
- include APP_ENV, NODE_ENV, VERCEL_ENV
- include presence checks for `DATABASE_URL`,
  `AUTH_SECRET` / `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_BASE_URL`
- include deployment branch (`VERCEL_GIT_COMMIT_REF`) and commit SHA
- include a `previewWarning` field when running on a Preview
  deployment
- attempt a real `SELECT 1` against the database when
  `DATABASE_URL` is set

Example degraded response (DB url missing) — illustrative shape:

```json
{
  "ok": false,
  "status": "degraded",
  "environment": { "APP_ENV": "stage", "NODE_ENV": "production" },
  "checks": {
    "DATABASE_URL": false,
    "AUTH_OR_NEXTAUTH_SECRET": true,
    "NEXTAUTH_URL": true
  },
  "deployment": { "branch": "STAGE", "commitShortSha": "abcd123" },
  "database": { "ok": false, "message": "DATABASE_URL is not configured. ..." },
  "errors": ["STAGE requires DATABASE_URL."],
  "warnings": ["DATABASE_URL is not configured."]
}
```

---

## 5. Lazy Prisma client

`lib/db/prisma.ts` exports a lazy proxy. Importing it does **not**
throw at module load. Only an actual DB call (`prisma.user.findUnique`,
etc.) fails fast if `DATABASE_URL` is missing.

This means:

- pages and API routes that import `auth.ts` (which imports prisma)
  no longer crash the whole app at request time on a misconfigured
  deployment
- `/api/health` can still report cleanly when `DATABASE_URL` is
  missing
- runtime crashes now point at the specific DB call site instead
  of a generic module-load error

If you see a `DATABASE_URL is not set` error in logs, the fix is
**always** in Vercel env vars, not in code. Open
`sportclubevo-webapp-stage → Settings → Environment Variables`,
enable `DATABASE_URL` for the affected environment, redeploy.

---

## 6. Canonical routes & legacy redirects

Canonical strategic routes:

- `/dashboard`
- `/meetings` (and sub-routes)
- `/initiatives` (and sub-routes)
- `/targets` (and sub-routes)
- `/templates` (and sub-routes)
- `/vereinsleitung` (strategic overview)
- `/vereinsleitung/kpis` (KPI subview — no canonical replacement)

Legacy strategic routes redirect server-side (`next/navigation`
`redirect()` from the legacy page file) to the canonical route:

- `/vereinsleitung/meetings*`   → `/meetings*`
- `/vereinsleitung/initiativen*` → `/initiatives*`
- `/vereinsleitung/targets*`    → `/targets*`
- `/vereinsleitung/templates*`  → `/templates*`

The admin sidebar (`lib/permissions/get-visible-admin-nav.ts`) and
the strategic KPI cards link only to canonical routes.
