# AUTH_SAFETY — Password Mutation Policy & Login Diagnosis Runbook

> **TL;DR** — Passwords in STAGE and PROD are protected by default.  
> No script or migration may touch a `passwordHash` column without an explicit opt-in flag.

---

## 1. Password Change Policy

### Default: forbidden in STAGE / PROD

`prisma/bootstrap-admin.ts` (and any future seeding script that sets passwords)
**will refuse to run in STAGE or PROD** unless the operator provides:

```
ALLOW_PASSWORD_CHANGE=true
```

This means a forgotten `BOOTSTRAP_ADMIN_PASSWORD` in a CI job or a careless
re-run of a fix script **cannot** silently overwrite an existing credential.

### How the guardrail works

1. The script reads `APP_ENV` (`local` | `stage` | `prod`).
2. If `APP_ENV=stage` or `APP_ENV=prod` **and** `ALLOW_PASSWORD_CHANGE` is not
   `"true"`, the script prints a clear error and exits with code 1.
3. The `upsert` `update` block in `bootstrap-admin.ts` **does not contain
   `passwordHash`** — so even in LOCAL mode a re-run will not overwrite an
   existing password. The hash is only written on the `create` path (first run).

### Correct way to intentionally change a password in STAGE/PROD

> **Important:** `bootstrap-admin.ts` only sets `passwordHash` on the **`create`
> path** (user does not yet exist). For an existing user the bootstrap `update`
> block intentionally omits `passwordHash`. To change a password for an existing
> user you must use one of the paths below.

**Path A — Use the application reset-password API (preferred)**

While authenticated as any active super_admin, call:

```
POST /api/users/<userId>/reset-password
{ "newPassword": "<new-secure-password>" }
```

This is the safest path: it is audited, requires an active session, and never
requires direct database access.

**Path B — Direct database update (DBA only, STAGE/PROD)**

Only when no admin session is available. Requires explicit approval from the
team lead. Generate the bcrypt hash out-of-band and apply:

```sql
UPDATE "User"
SET "passwordHash" = crypt('<new-password>', gen_salt('bf', 12))
WHERE email = 'admin@fcallschwil.ch';
```

Or use a one-off Node.js snippet to generate the hash safely, then apply it
via the Vercel Postgres console or a DBA connection.

**Path C — Bootstrap for a freshly wiped database only**

If the STAGE database has been fully reset and the user does not exist yet:

```bash
# Only with explicit approval. Creates user from scratch.
ALLOW_PASSWORD_CHANGE=true \
  BOOTSTRAP_ADMIN_PASSWORD=<new-secure-password> \
  APP_ENV=stage \
  DATABASE_URL=<stage-url> \
  npx tsx prisma/bootstrap-admin.ts
```

Document the change in the team's incident/change log.

---

## 2. Login Diagnosis Steps

Use these steps to diagnose a STAGE / PROD login failure **without changing any password**.

### Step A — Confirm the user exists and is active

Connect to the STAGE database (read-only replica or psql) and run:

```sql
SELECT id, email, "isActive", "tenantId", "lastLoginAt", LENGTH("passwordHash") AS hash_len
FROM "User"
WHERE email = 'admin@fcallschwil.ch';
```

Expected results:
- Row exists → ✓
- `isActive = true` → ✓
- `tenantId` is NOT NULL → ✓ (NULL means tenant-scoped pages will 404)
- `hash_len` is around 60 characters (bcrypt hash) → ✓

### Step B — Confirm database connectivity

Hit the health endpoint:

```
GET https://<stage-domain>/api/health
```

Check:
- `ok: true`
- `database.ok: true`
- `environment.appEnv: "stage"`
- `databaseHost` matches the expected STAGE host

### Step C — Confirm email casing

The auth flow normalises the input email with `.trim().toLowerCase()` before
querying Prisma. Confirm the stored email is already lowercase:

```sql
SELECT email FROM "User" WHERE lower(email) = 'admin@fcallschwil.ch';
```

If this returns a row but Step A did not (e.g. stored as `Admin@fcallschwil.ch`),
run a one-off SQL update (approved by DBA):

```sql
UPDATE "User" SET email = lower(email) WHERE lower(email) = 'admin@fcallschwil.ch';
```

### Step D — Confirm bcrypt hash is valid

The stored hash should start with `$2b$` or `$2a$`. If the column contains a
plaintext value or a truncated/corrupted hash, `bcrypt.compare()` will always
return false.

```sql
SELECT LEFT("passwordHash", 7) AS hash_prefix FROM "User" WHERE email = 'admin@fcallschwil.ch';
```

Expected: `$2b$12$` or `$2a$12$`

### Step E — Check server logs

After a failed login attempt, search Vercel Function logs for:

```
[auth] authorize:
```

The authorize function logs exactly which step failed:
- `user lookup failed` — DB connectivity or Prisma error
- `no user found for email prefix` — email not found (wrong email or casing)
- `user inactive` — `isActive = false`
- `bcrypt comparison failed — wrong password or stale hash` — password mismatch

### Step F — Confirm NEXTAUTH_SECRET is set and consistent

A missing or rotated `NEXTAUTH_SECRET` does not break login itself but will
invalidate all existing sessions. Check the STAGE environment variables in the
Vercel dashboard.

---

## 3. Root Cause History

### Incident — Jun 2026: STAGE login failure for admin@fcallschwil.ch

**Root cause:** `prisma/bootstrap-admin.ts` used `prisma.user.upsert()` with
`passwordHash` present in the `update` block. When the script was re-run on
STAGE to fix a missing `tenantId` (commit `3dd2759`), it unconditionally
overwrote the password hash with whatever `BOOTSTRAP_ADMIN_PASSWORD` was
provided at that time — silently rotating the credential without the operator
intending to change the password.

**Fix applied (this PR):**
- `passwordHash` removed from the `upsert` `update` block; only present in the
  `create` block (first-run only).
- STAGE/PROD guardrail added: script exits with an error unless
  `ALLOW_PASSWORD_CHANGE=true` is set.
- Validation scripts (`scripts/validate-*.ts`) annotated with an explicit safety
  invariant confirming they never touch `User` rows.

**Confirmation:** No password was changed as part of this fix. The existing
`passwordHash` in the STAGE database is preserved. To perform a controlled
credential recovery for `admin@fcallschwil.ch`, see Section 2 Step D (confirm
hash validity) and Section 1 Path A or B above.

---

## 4. Rules for Future Scripts and Migrations

| Rule | Detail |
|------|--------|
| **Never put `passwordHash` in a seed `update` block** | Use `create`-only or a dedicated reset API |
| **Never add `passwordHash` to a migration** | Schema changes to the column type require DBA sign-off |
| **Validation/smoke scripts must not touch `User` rows** | Add the safety invariant comment block from `validate-public-feed.ts` to any new script |
| **ALLOW_PASSWORD_CHANGE=true required for STAGE/PROD** | Enforced in `bootstrap-admin.ts`; must be replicated in any future admin-creation script |
| **Document all intentional password changes** | Log the change in the incident/change log with date, operator, and reason |
