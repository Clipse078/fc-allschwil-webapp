# SportClubEvo Engineering Principles

> **Document type:** Engineering standards — reference  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo engineering team

---

## Purpose

These principles define how SportClubEvo is built. They are not suggestions. Every pull request is expected to comply. Code review uses this document as a reference for non-negotiable standards.

---

## 1. API-First

All features expose their data through API routes before UI is built on top. The API is not a private implementation detail — it is the contract between the WebApp and its consumers (public website, InfoBoard, mobile app).

**In practice:**
- Define the API response shape before building the component.
- API routes live in `app/api/` and follow RESTful conventions.
- External-facing routes follow the `/api/public/v1/` versioning pattern (see ADR-007).
- API routes return consistent error structures.

---

## 2. Tenant-Safe Queries Everywhere

Every database query that accesses tenant-scoped data must include a `tenantId` filter. Tenant identity is derived from the session — it is never taken from a client-supplied request parameter without server-side validation.

**In practice:**
- All Prisma queries for tenant-scoped models include `where: { tenantId: session.user.tenantId }`.
- Public API routes derive `tenantId` from `tenantSlug` resolved against the database — never from a raw query parameter alone.
- Cross-tenant queries (platform admin only) are explicitly identified, documented, and access-controlled.
- Tenant isolation is tested as part of go-live readiness (see `02-go-live-checklist.md`).

---

## 3. Server-Side Permission Checks

Permission enforcement happens on the server. Client-side UI hiding (removing a button, disabling a link) is a UX convenience — it is not a security control.

**In practice:**
- Every API route that performs a mutation checks the caller's permission keys against the required permission.
- Permission checks use the helpers in `lib/permissions/`.
- Roles are resolved from the session — they are not trusted from client input.
- Impersonation preserves the effective user's permission set, not the actor's.

---

## 4. Configuration Over Hardcoding

Tenant-specific behaviour is driven by configuration fields on the `Tenant` model. No tenant identifier, name, or business rule is embedded in application code.

**In practice:**
- If a behaviour differs by tenant, the `Tenant` model gains a configuration field.
- Default values for configuration fields are defined at the application level, not as code branches keyed on tenant name or slug.
- FC Allschwil is the first tenant, not a special case.

---

## 5. Shared Components Only

Before building a new UI component, check whether an existing one can be extended. New per-feature or per-module components for problems already solved at the shared level are rejected in code review.

**In practice:**
- Shared primitives live in `components/ui/page/` and `components/admin/shared/`.
- Page layouts use `PageShell` and `PageHeader` from the shared library.
- The `PeoplePicker` is the only person-selection component (see ADR-009).
- New shared components are added to the shared library, not duplicated in feature folders.

---

## 6. Shared Helpers Only

Every formatter, validator, and business logic helper lives once in `lib/`. Components and pages import from `lib/`. No business logic is defined inline.

**In practice:**
- Date/time formatting: `lib/tenant-runtime/` (locale and timezone-aware).
- Permission checks: `lib/permissions/`.
- Business rules: domain-specific `lib/<domain>/` folder.
- If a helper does not exist, create it in `lib/` before using it.

---

## 7. No Duplicate Business Logic or Formatting

There is one implementation of every business rule. If you find yourself copy-pasting logic, stop and refactor to `lib/` first.

**In practice:**
- Code review rejects duplicated logic regardless of how minor it appears.
- This applies to formatting helpers, status transitions, permission checks, and query builders.

---

## 8. Soft Delete Where Appropriate

Records that represent real-world entities with history (people, teams, squad members) are soft-deleted, not hard-deleted. Hard deletion is reserved for transient or purely operational records where no audit trail is required.

**In practice:**
- Soft-deleted records carry a `deletedAt` timestamp.
- Queries for active records always filter `WHERE deletedAt IS NULL`.
- Hard deletion is only used when explicitly justified and documented.

---

## 9. Audit Logging for Sensitive Operations

Every sensitive mutation — user management, role assignment, impersonation, permission changes, data deletion — writes an entry to `AuditLog`.

**In practice:**
- Use the audit logging helpers in `lib/audit/`.
- Audit entries include: actor user ID, effective user ID (if impersonating), action type, target entity, timestamp, and tenant ID.
- Audit logs are not deletable by regular admin users.

---

## 10. TypeScript Build and Lint Must Pass

Every merged commit must result in a passing `npm run build` and `npm run lint`. Broken builds are not merged.

**In practice:**
- Run `npm run deploy:check` (which executes `db:generate && lint && build`) before raising a pull request.
- TypeScript `any` usage is not introduced without explicit justification in a code comment.
- ESLint errors are resolved — warnings are reviewed, not ignored by default.

---

## 11. Documentation Updated with Major Changes

Significant new features, API changes, or architectural decisions must be accompanied by documentation updates.

**In practice:**
- New public API routes: update `docs/public-website-feed-contract-v1.md` if the contract changes.
- New architectural decisions: add an ADR to `docs/roadmap/05-architecture-decisions.md`.
- New technical debt: add an entry to `docs/roadmap/03-technical-debt.md`.
- New features: update status in `docs/roadmap/sportclubevo-v1-master-backlog.md`.

---

## 12. STAGE Anti-Drift Workflow

Before starting any development work:

1. Verify the current branch is `STAGE`.
2. Verify `STAGE` matches `origin/STAGE` — run `git diff origin/STAGE --stat`.
3. Stop immediately if there is local drift or uncommitted work.
4. Create a feature branch using the `cursor/<descriptive-name>-fc79` naming convention.
5. Never continue from `master`, stale local branches, or Cursor feature branches.

This workflow is documented in AGENTS.md and is enforced for both human developers and agents.

---

## 13. Auth and Password Safety Rule

Do not reset passwords, change authentication secrets, modify production credentials, or run bootstrap or seed scripts during normal development or testing work.

If authentication is broken, stop and report the exact issue. Do not attempt to self-heal by modifying credentials.

See ADR-012 for the full rationale.
