# SportClubEvo Acceptance environment runbook

This runbook prepares, but does not authorize creating, the permanent
authenticated Acceptance environment. Acceptance is synthetic-only and must
never share a database or secrets with STAGE or Production.

## Isolation decision

Use a separate Neon project with a database named `sce_acceptance`. A project
boundary gives Acceptance its own credentials, compute lifecycle, quotas, and
operator blast radius. A branch inside the operational STAGE project would be
cheaper but leaves accidental branch/credential selection inside the same
administrative and compute boundary. Current Neon pricing must be verified
externally before creation.

## Safe creation order

1. Obtain explicit infrastructure-mutation authorization.
2. Create the separate Neon project and empty `sce_acceptance` database.
3. Create separate pooled and direct credentials. Do not copy STAGE data.
4. Set the protected operator environment inputs listed below.
5. Run the gated canonical migration deployment once with
   `APPLY_DATABASE_MIGRATIONS=true` and the guarded npm command
   `npm run db:migrate:deploy-if-enabled`. Prisma uses `DIRECT_URL` when
   present and executes `prisma migrate deploy`; it does not run a seed.
6. Return `APPLY_DATABASE_MIGRATIONS=false`.
7. Run `npm run db:bootstrap-acceptance:safe` once. Do not manually compose or
   paste `DATABASE_URL` into PowerShell. The safe runner validates the pooled
   `sce_acceptance` target, prints only host/database/role identity, and then
   invokes the canonical bootstrap script.
8. Re-run the safe bootstrap command to verify idempotency. Existing hashes are
   retained.
9. Validate migration status, fixture counts, tenant isolation, login, and
   runtime identity without printing credentials.
10. Create the Vercel `acceptance` Custom Environment with no tracked branch.
11. Add Acceptance-only variables and attach the internal domain.
12. Apply Deployment Protection before allowing the first exact-SHA deploy.
13. Attach DNS only after Vercel supplies and verifies the required record.

Do not use `prisma db push`, `prisma migrate dev`, the FCA seed, the demo seed,
or `prisma migrate reset`.

## Windows recovery for gated migration deployment

If Acceptance migration deployment fails on Windows, do not run bare
`npx prisma migrate deploy`. Use the guarded npm command so Acceptance
host/database allowlist checks and operational mutation guards still run. The
guarded runner resolves the locally installed Prisma CLI JavaScript entry point
and executes it with `process.execPath`, so it does not depend on `npx`,
`npx.cmd`, or other shell shims:

```powershell
$env:APPLY_DATABASE_MIGRATIONS = "true"
$env:APP_ENV = "acceptance"
$env:VERCEL_TARGET_ENV = "acceptance"
$env:NODE_ENV = "production"
$env:DATABASE_URL = "<acceptance-pooled-url>"
$env:DIRECT_URL = "<acceptance-direct-url>"
$env:ACCEPTANCE_DATABASE_HOST = "<acceptance-pooled-host>"
$env:ACCEPTANCE_DIRECT_DATABASE_HOST = "<acceptance-direct-host>"
npm run db:migrate:deploy-if-enabled
```

Both `ACCEPTANCE_DATABASE_HOST` and `ACCEPTANCE_DIRECT_DATABASE_HOST` must
match the allowlisted remote `sce_acceptance` database identity. After a
successful run, set `APPLY_DATABASE_MIGRATIONS=false` again.

## Bootstrap operator inputs

Preferred one-command workflow:

```powershell
$env:NODE_ENV = "production"
$env:APP_ENV = "acceptance"
$env:VERCEL_TARGET_ENV = "acceptance"
$env:ACCEPTANCE_BOOTSTRAP_CONFIRM = "BOOTSTRAP_ISOLATED_ACCEPTANCE"
$env:SCE_OPERATION_AUTHORIZATION = "bootstrap-acceptance:acceptance"
$env:ACCEPTANCE_DATABASE_HOST = "<acceptance-pooled-host>"
$env:ACCEPTANCE_DATABASE_USER = "<acceptance-database-user>"
$env:ACCEPTANCE_DATABASE_PASSWORD = "<acceptance-database-password>"
$env:ACCEPTANCE_SUPERADMIN_PASSWORD = "<generated-password>"
$env:ACCEPTANCE_ALPHA_ADMIN_PASSWORD = "<generated-password>"
$env:ACCEPTANCE_ALPHA_MEMBER_PASSWORD = "<generated-password>"
$env:ACCEPTANCE_BETA_ADMIN_PASSWORD = "<generated-password>"
$env:ACCEPTANCE_BETA_MEMBER_PASSWORD = "<generated-password>"
npm run db:bootstrap-acceptance:safe
```

The safe runner either accepts an existing `DATABASE_URL` that passes strict
Acceptance validation, or builds one from the non-secret host/user/name inputs
plus the secret `ACCEPTANCE_DATABASE_PASSWORD`. It never prints credentials or
the full connection string, refuses `/neondb`, refuses the direct Neon host for
pooled bootstrap, and refuses localhost plus STAGE/PROD targets before invoking
`scripts/bootstrap-acceptance.ts`.

Names only:

- `NODE_ENV`
- `APP_ENV`
- `VERCEL_TARGET_ENV`
- `ACCEPTANCE_DATABASE_HOST`
- `ACCEPTANCE_DATABASE_USER`
- `ACCEPTANCE_DATABASE_PASSWORD`
- `ACCEPTANCE_BOOTSTRAP_CONFIRM`
- `SCE_OPERATION_AUTHORIZATION`
- `ACCEPTANCE_SUPERADMIN_PASSWORD`
- `ACCEPTANCE_ALPHA_ADMIN_PASSWORD`
- `ACCEPTANCE_ALPHA_MEMBER_PASSWORD`
- `ACCEPTANCE_BETA_ADMIN_PASSWORD`
- `ACCEPTANCE_BETA_MEMBER_PASSWORD`

Optional when the safe runner should reuse a pre-validated pooled URL instead
of building one from parts:

- `DATABASE_URL`

For gated migration deployment, also provide:

- `DIRECT_URL`
- `ACCEPTANCE_DIRECT_DATABASE_HOST`
- `APPLY_DATABASE_MIGRATIONS`

Password inputs must be generated independently, stored only in the protected
Acceptance secret scope, and removed from the execution environment after the
bootstrap. The script never updates an existing User or password hash.

## Vercel Custom Environment

- Project: `sportclubevo-webapp-stage`
- Custom Environment: `acceptance`
- Branch tracking: none
- Deployments: exact commit SHA only, initiated explicitly after engineering
  and security approval
- Domain: `acceptance.sportclubevo.com`
- Application URLs: `APP_BASE_URL` and `NEXTAUTH_URL` both use the HTTPS domain
- Runtime classification: `APP_ENV=acceptance` and Vercel-provided
  `VERCEL_TARGET_ENV=acceptance`
- Migration default: `APPLY_DATABASE_MIGRATIONS=false`

Minimum application variable names:

- `APP_ENV`
- `APP_BASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `ACCEPTANCE_DATABASE_HOST`
- `ACCEPTANCE_DIRECT_DATABASE_HOST`
- `APPLY_DATABASE_MIGRATIONS`

`NODE_ENV`, `VERCEL_TARGET_ENV`, `VERCEL_GIT_COMMIT_SHA`, and
`VERCEL_DEPLOYMENT_ID` are platform-provided metadata and must not be manually
overridden.

Do not configure Resend, inbound email, SFV, public Blob, workspace Blob, ops
backup, website revalidation, or cron credentials initially. The application
Acceptance policy fails these providers closed. Stripe is not implemented;
future Acceptance configuration must accept test-mode keys only and must
explicitly reject live keys.

## Deployment Protection and DNS

Use Vercel Authentication (team-member access) on the Acceptance Custom
Environment. Michael must first authenticate to Vercel protection and then use
the separate synthetic SCE credential at the application login. Do not change
protection for generated Preview deployments or canonical tenant domains.
If Michael is not a Vercel project/team member, grant the narrowest project
access that satisfies Deployment Protection rather than making Acceptance
public.

Repository configuration does not expose the current project-level Deployment
Protection setting, so verify it in Vercel before the first deployment.

Attach `acceptance.sportclubevo.com` to the Custom Environment before changing
DNS. Vercel will then provide the authoritative CNAME or verification record.
Create exactly that record, wait for Vercel verification and TLS issuance, and
only then test the protected login. Do not pre-create or guess a provider value.

## Deliberate reset strategy

No reset command is implemented. The current bootstrap is additive and
non-destructive. When reset automation becomes necessary, create a separate
operator-only tool that requires all of the bootstrap database identity checks
plus a second reset-specific confirmation, verifies that every tenant and user
is Acceptance-namespaced, and replaces the whole isolated Neon project or
database. It must never offer `prisma migrate reset` against a persistent
STAGE/Production connection.
