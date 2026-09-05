# Canonical Environment Manifest

This is the canonical names-and-scopes manifest for the web application. It
contains no deployable values. Environment values remain in the approved
deployment platform or an operator-approved local secret store.

Scope terms:

- **Production** means a canonical deployed runtime, including the dedicated
  STAGE project's Vercel Production scope and the production project.
- **Preview** means a feature-branch deployment. Preview is intentionally
  credential-poor.
- **Local** means developer or isolated test execution.
- **Conditional** means required only when the named feature or operation is
  enabled.
- **Forbidden** means the variable must not exist in that scope.

## Core

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | Canonical runtime classification | No | Required | Required | Optional | Required when deployed | Unknown deployed classification disables privileged operations | Use only supported classifications |
| `APP_BASE_URL` | Canonical application origin and primary security-link origin | No | Required | Allowed | Optional | Required when deployed | Invalid security-link configuration fails closed before email delivery | Deployed value must be an HTTPS origin with no credentials, path, query, or fragment |
| `NEXTAUTH_URL` | Auth callback origin and compatibility fallback for security links | No | Required | Allowed | Optional | Required by current deployed architecture | Invalid fallback fails closed; auth may be unavailable | `APP_BASE_URL` has priority for security links |
| `NEXTAUTH_SECRET` | Legacy-named Auth.js signing/encryption secret | Yes | Required unless `AUTH_SECRET` is the selected alias | Forbidden | Optional | One auth-secret name is required in canonical runtime | Authentication/session handling fails | Never share between environments |
| `AUTH_URL` | Auth.js alias for `NEXTAUTH_URL` | No | Optional | Optional | Optional | Optional alias | Auth.js URL inference may fail if no supported URL is set | Not used as a security-link fallback |
| `AUTH_SECRET` | Auth.js alias for `NEXTAUTH_SECRET` | Yes | Optional alternative | Forbidden | Optional | One auth-secret name is required in canonical runtime | Authentication/session handling fails | Do not configure both aliases with divergent values |

## Database

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | Runtime pooled database connection | Yes | Required | Forbidden | Conditional | Required for database-backed runtime features | Database-backed features remain unavailable | Preview must not use shared STAGE data |
| `DIRECT_URL` | Direct database connection for controlled deployment work | Yes | Conditional | Forbidden | Optional | Conditional | Direct-connection operations remain unavailable | Never copy into Preview |
| `SHADOW_DATABASE_URL` | Disposable Prisma shadow database | Yes | Forbidden | Forbidden | Conditional | Development-only | Migration development cannot use a shadow database | Must never target STAGE or production |
| `DIRECT_DATABASE_URL` | Legacy/operational direct connection alias used by permission scripts | Yes | Forbidden in runtime | Forbidden | Conditional | Script-only | Script refuses to run or falls back where explicitly supported | Supply only for an approved operation |
| `STAGE_DB_URL` | Explicit STAGE database reference used by safety checks/diagnostics | Yes | Forbidden in runtime | Forbidden | Conditional | Break-glass/diagnostic only | Relevant diagnostic or safety comparison is unavailable | Never use as a test target |
| `STAGE_DIRECT_URL` | Explicit direct STAGE reference used by safety checks | Yes | Forbidden in runtime | Forbidden | Conditional | Break-glass/safety only | Relevant safety comparison is unavailable | Never use as a test target |
| `TEST_DATABASE_URL` | Disposable automated-test database target | Yes | Forbidden | Forbidden | Conditional | Test-only | Database integration tests must not run | Must be isolated and must never equal a STAGE URL |
| `APPLY_DATABASE_MIGRATIONS` | Explicit deployment migration intent | No | Conditional | Forbidden | Optional | Optional; required only for an approved migration deployment | Migration wrapper exits without applying migrations | Must never be Preview-scoped |

## Cron and operations

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CRON_SECRET` | Authorizes scheduled routes | Yes | Conditional | Forbidden | Optional | Required for cron execution | Cron request is rejected | Never share with Preview |
| `OPS_BACKUP_READ_WRITE_TOKEN` | Dedicated private operational-backup Blob credential | Yes | Conditional | Forbidden | Optional | Required for backup writes | Backup storage fails closed | Must not fall back to public Blob credentials |
| `OPS_BACKUP_STORE_ID` | Dedicated operational-backup store binding | No | Conditional | Forbidden | Optional | Conditional | Backup store selection is unavailable | Keep scope aligned with its token |
| `OPS_BACKUP_WEBHOOK_PUBLIC_KEY` | Verifies backup-store webhook events | No | Conditional | Forbidden | Optional | Conditional | Webhook verification is unavailable | Public verification material, not a credential |
| `SCE_OPERATION_AUTHORIZATION` | Operation-specific remote mutation authorization | Yes | Forbidden as a persistent runtime variable | Forbidden | Conditional | One approved operation only | Operational mutation guard denies the operation | Value is operation/environment-specific and ephemeral |
| `SCE_PRODUCTION_MUTATION_APPROVAL` | Independent production mutation approval | Yes | Forbidden as a persistent runtime variable | Forbidden | Forbidden | One approved production operation only | Production mutation guard denies the operation | Must be independently supplied and ephemeral |
| `APPLY_PERMISSION_SYNC` | Explicit permission-sync mutation intent | No | Forbidden as a persistent runtime variable | Forbidden | Conditional | Approved script execution only | Permission scripts default to dry-run | Never enable broadly |

## Email

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Outbound email provider credential | Yes | Conditional | Forbidden | Optional | Required for outbound mail | Mailer fails closed | Real provider calls are not available in credential-poor Preview |
| `RESEND_RECEIVING_API_KEY` | Inbound email receiving credential | Yes | Conditional | Forbidden | Optional | Optional dedicated key | Receiving falls back only where explicitly supported | Keep separate from outbound where provisioned |
| `RESEND_WEBHOOK_SECRET` | Verifies inbound provider webhooks | Yes | Conditional | Forbidden | Optional | Required for inbound webhooks | Webhook is rejected | Never log |
| `EMAIL_FROM` | Approved sender identity | No | Conditional | Allowed | Optional | Required for outbound mail | Mailer fails closed | Benign configuration; provider validation still applies |
| `EMAIL_INBOUND_DOMAIN` | Domain used for reply routing | No | Conditional | Allowed | Optional | Required for reply-capable mail | Reply routing is unavailable | Benign configuration |

## Blob storage

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Public-asset Blob read/write credential | Yes | Conditional | Forbidden | Optional | Required for public-asset writes/deletes | Storage operation fails closed or becomes unavailable | Never log |
| `BLOB_STORE_ID` | Public-asset Blob store binding | No | Conditional | Forbidden | Optional | Conditional | Store-specific operations are unavailable | Keep scope aligned with its token |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Verifies public-store webhook events | No | Conditional | Forbidden | Optional | Conditional | Webhook verification is unavailable | Public verification material |
| `WORKSPACE_BLOB_READ_WRITE_TOKEN` | Private Workspace Blob credential | Yes | Conditional | Forbidden | Optional | Required for Workspace storage | Workspace storage returns unavailable | Must not fall back to the public token |
| `WORKSPACE_BLOB_STORE_ID` | Private Workspace store binding | No | Conditional | Forbidden | Optional | Required with Workspace token | Workspace storage returns unavailable | Must not fall back to the public store |
| `WORKSPACE_BLOB_WEBHOOK_PUBLIC_KEY` | Verifies Workspace-store webhook events | No | Conditional | Forbidden | Optional | Conditional | Webhook verification is unavailable | Public verification material |

## SFV

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SFV_TOKEN_URL` | Trusted SFV token endpoint | No | Conditional | Forbidden | Optional | Required for SFV integration | SFV integration is unavailable | Production-only in current Vercel state |
| `SFV_APPLICATION_KEY` | SFV application credential | Yes | Conditional | Forbidden | Optional | Required for SFV integration | SFV authentication fails closed | Never log |
| `SFV_APPLICATION_PASS` | SFV application credential | Yes | Conditional | Forbidden | Optional | Required for SFV integration | SFV authentication fails closed | Never log |
| `SFV_CLUB_ID` | Global club selector for current SFV integration | No | Conditional | Forbidden | Optional | Required by current single-club integration | SFV club-scoped features are unavailable | **Legacy: global scope is a Tenant #2 blocker; do not extend this architecture** |

## Public website

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `PUBLIC_WEBSITE_REVALIDATION_CONFIG` | Tenant endpoint map containing HMAC signing secrets | Yes | Conditional | Forbidden | Optional | Required only for website notifications | Invalid/missing config disables notification; bounded cache TTL remains fallback | Parse failures must never log source content |

## Development and break-glass

Database variables repeated in this category retain the stricter Database table
rules: `SHADOW_DATABASE_URL` and `TEST_DATABASE_URL` are local-only and forbidden
in every deployed runtime scope.

| Name | Purpose | Sensitive | Production | Preview | Local | Required / optional | Failure behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ALLOW_DEMO_SEED` | Explicit demo-seed intent | No | Forbidden | Forbidden | Conditional | Local seed only | Seed guard denies execution | Must not persist |
| `ALLOW_PASSWORD_CHANGE` | Explicit recovery password-change intent | No | Forbidden | Forbidden | Conditional | One approved recovery operation only | Recovery script denies execution | Must not persist |
| `BOOTSTRAP_ADMIN_PASSWORD` | Temporary admin bootstrap credential | Yes | Forbidden | Forbidden | Conditional | One bootstrap operation only | Bootstrap cannot set a password | Remove immediately after use |
| `STAGE_LOGIN_PASSWORD` | Temporary STAGE login verification credential | Yes | Forbidden | Forbidden | Conditional | Break-glass verification only | Verification is unavailable | Never persist or log |
| `TARGET_SUPERADMIN_EMAIL` | Operator-selected existing platform Superadmin | Yes | Forbidden as a persistent runtime variable | Forbidden | Conditional | Break-glass reset or verification only | Tool refuses to run | Never hardcode or persist |
| `BREAK_GLASS_NEW_PASSWORD` | Exceptional platform Superadmin replacement password | Yes | Forbidden as a persistent runtime variable | Forbidden | Conditional | One approved reset only | Reset tool refuses to run | Never persist or log |
| `BREAK_GLASS_CONFIRM` | Exact exceptional-reset confirmation phrase | No | Forbidden as a persistent runtime variable | Forbidden | Conditional | One approved reset only | Reset tool refuses to run | Must equal `RESET_EXISTING_ACTIVE_PLATFORM_SUPERADMIN` |
| `SCE_SUPER_ADMIN_BOOTSTRAP_PASSWORD` | Temporary platform-admin bootstrap credential | Yes | Forbidden | Forbidden | Conditional | One approved bootstrap only | Bootstrap refuses the relevant write | Never persist |
| `FCA_CLUB_ADMIN_BOOTSTRAP_PASSWORD` | Temporary legacy FCA club-admin bootstrap credential | Yes | Forbidden | Forbidden | Conditional | One approved bootstrap only | Bootstrap refuses the relevant write | FCA-specific and temporary; not a Tenant #2 pattern |

## Preview policy

Preview is intentionally credential-poor. It may build and deploy while runtime
features requiring credentials remain unavailable. Operators must not copy
shared STAGE secrets into Preview to make those features work.

Preview must not receive shared STAGE values for:

- `DATABASE_URL`, `DIRECT_URL`, or any direct/test/shadow database URL
- `NEXTAUTH_SECRET` or `AUTH_SECRET`
- `CRON_SECRET`
- `SFV_APPLICATION_KEY`, `SFV_APPLICATION_PASS`, or `SFV_CLUB_ID`
- Resend API keys or webhook secrets
- Blob read/write tokens or store bindings
- OPS backup credentials or store bindings
- `PUBLIC_WEBSITE_REVALIDATION_CONFIG`
- migration, seed, permission-sync, or password-change flags
- bootstrap, recovery, or diagnostic credentials

Benign shared configuration may include `APP_ENV`, `APP_BASE_URL`,
`NEXTAUTH_URL`, `EMAIL_FROM`, and `EMAIL_INBOUND_DOMAIN`. Platform encryption of
these settings does not make them secrets.

## Production policy

- Canonical STAGE/production deployments receive only the operational
  credentials required for enabled runtime features.
- `APPLY_DATABASE_MIGRATIONS` must never be Preview-scoped.
- Bootstrap/recovery password or hash variables must not persist in Vercel
  runtime scopes.
- Test and shadow database URLs must not exist in any deployed runtime scope.
- Shared STAGE credentials must never be copied into Preview.

## Current deployment evidence

The manually verified post-C1 Vercel metadata state is names/scopes-only:

- Production-only privileged names: `DATABASE_URL`, `DIRECT_URL`,
  `NEXTAUTH_SECRET`, `CRON_SECRET`, the four `SFV_*` names, the three Resend
  secret names, all public/Workspace Blob names, all OPS backup names, and
  `APPLY_DATABASE_MIGRATIONS`.
- `PUBLIC_WEBSITE_REVALIDATION_CONFIG` is absent from Preview and from the
  current metadata listing.
- Preview retains only the benign/config names `APP_ENV`, `APP_BASE_URL`,
  `NEXTAUTH_URL`, `EMAIL_FROM`, and `EMAIL_INBOUND_DOMAIN`.
- A fresh credential-poor Preview reached Ready; runtime features requiring
  omitted credentials remain intentionally unavailable.

This document records policy and verified metadata only. It does not authorize
environment changes.
