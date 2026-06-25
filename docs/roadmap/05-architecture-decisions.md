# SportClubEvo Architecture Decision Records

> **Document type:** Architecture Decision Record (ADR) log  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo engineering team

---

## About ADRs

Each entry in this document records a significant architectural decision — the context that led to it, the decision itself, and the consequences. Once accepted, an ADR is locked. It is not reopened without a formal new ADR that supersedes it.

ADR statuses: **Accepted** | **Superseded** | **Deprecated** | **Proposed**

---

## ADR-001 — Season Is the Leading Entity

**Status:** Accepted

### Context

Sports clubs operate in seasons (e.g. summer season, winter season, annual league year). Teams, squad membership, training schedules, match fixtures, and resource planning all change between seasons. Without a leading temporal entity, queries become complex and cross-season data leaks become common.

### Decision

`Season` is the leading entity for all planning, squad membership, and scheduling. Every `TeamSeason`, `PlayerSquadMember`, `TrainerTeamMember`, and planning record is anchored to a `Season`. Queries that span multiple seasons must be explicit.

### Consequences

- All scheduling and membership queries include a season filter.
- Season transitions (end of season, new season setup) are explicit operations.
- Reporting across seasons is possible but requires deliberate cross-season query design.
- The admin UI exposes a season selector that controls the active planning context.

---

## ADR-002 — Multi-Tenant Architecture Is Mandatory

**Status:** Accepted

### Context

SportClubEvo is designed to serve many sports clubs (tenants) from a single platform. FC Allschwil is the first tenant, but the architecture must accommodate future tenants from day one. A single-tenant-first approach would require expensive and error-prone retrofitting later.

### Decision

Every feature is built multi-tenant from its first commit. All database queries that access tenant-scoped data must include a `tenantId` filter. No tenant's data may be accessible to another tenant. Tenant identity is carried in the session (`session.user.tenantId`) and must be validated server-side on every request.

### Consequences

- Every API route that returns tenant-scoped data must include `tenantId` in the where clause.
- Platform admin routes (cross-tenant) are explicitly identified and access-controlled.
- Public API routes must also filter by `tenantSlug` or `tenantId` derived from the request context.
- New features are reviewed for tenant isolation before merge.
- Known gap: some public API routes have TODO items for tenant filtering (tracked in `03-technical-debt.md`).

---

## ADR-003 — Public Website Consumes WebApp API Only

**Status:** Accepted

### Context

The FC Allschwil public website needs to display operational content (news, teams, fixtures, events, sponsors). Without a clear boundary, website editors editing content directly on the website creates duplicated, inconsistent, and unapproved data. The WebApp already holds the authoritative operational data.

### Decision

The public website is a read-only consumer of the WebApp public API. Website editors do not edit operational content directly on the website. Only content that has passed the WebApp review workflow (Draft → In Review → Published) may be delivered to the public website. The `approvedDataOnly` flag on the `Tenant` model enforces this at the API level.

### Consequences

- The public website has no write path to operational content.
- Cache invalidation is triggered from the WebApp on publish/unpublish (mechanism TBD — see `03-technical-debt.md`).
- The public API contract (`docs/public-website-feed-contract-v1.md`) must be maintained.
- Breaking changes to the public API require a version bump to `/v2/`.

---

## ADR-004 — Tenant Branding Is Configurable; UX System Is Shared

**Status:** Accepted

### Context

Each club needs its own visual identity (logo, primary colour, secondary colour). However, building a fully custom UI per tenant would be unmaintainable. The shared UX system must remain consistent and high-quality.

### Decision

The `Tenant` model carries `logoUrl`, `primaryColor`, and `secondaryColor`. These are injected as CSS custom properties at runtime by the admin shell layout. All UI components consume the CSS variables — they do not reference tenant-specific colours directly. The UX system (component library, typography, spacing) is shared and not configurable per tenant.

### Consequences

- New UI components must use CSS variables for brand colours, not hardcoded values.
- Tenants get meaningful visual personalisation without the cost of a fully custom UI.
- The CSS variable injection in `(admin)/layout.tsx` is the single injection point — it must not be bypassed.
- The shared UX system defines the quality baseline; per-tenant overrides are limited to the defined variables.

---

## ADR-005 — Week Planner Is Resource-Based, Not a Calendar Clone

**Status:** Accepted

### Context

Early product discussions considered building the Week Planner as an Outlook-style calendar. This would be familiar to users but would fail to model the real-world constraints of a club: pitches have finite space, dressing rooms have finite capacity, time slots have hard boundaries.

### Decision

The Week Planner is a resource allocation tool, not a general-purpose calendar. It models real-world resources (pitches, dressing rooms, time slots) and enforces constraints (no double-booking, half/full pitch modes, conflict detection). The conflict engine (`lib/wochenplan/conflict-engine.ts`) is the authoritative source for allocation validity.

### Consequences

- The Week Planner UI is designed around resource grids, not calendar event flows.
- Conflict detection runs before every save and before every publish action.
- Time slots are tenant-configurable, not free-form.
- This model is more powerful for club operations but has a steeper onboarding curve than a calendar UI.

---

## ADR-006 — Organisation Builder Is Generic, Not Vereinsleitung-Specific

**Status:** Accepted

### Context

The `OrgUnit` model was initially discussed as a Vereinsleitung (board/governance) tool. However, sports clubs have many types of org units — committees, departments, working groups, sponsor groups — that are not governance-specific.

### Decision

`OrgUnit` and `OrgUnitMembership` are generic structural entities. They represent any organisational grouping within a club. The Vereinsleitung module uses them, but it does not own them. Permission scoping controls which org units are visible to which roles.

### Consequences

- The same `OrgUnit` model serves governance, operational, and social groupings.
- UI filters and permission rules distinguish between org unit types.
- Future modules (e.g. Sponsor portal, Volunteer management) can use `OrgUnit` without schema changes.

---

## ADR-007 — Public API Must Be Versioned

**Status:** Accepted

### Context

The public website and InfoBoard are external consumers of the WebApp API. If API response shapes change without versioning, external consumers break silently. This is especially problematic once the mobile app is consuming the same endpoints.

### Decision

All externally-consumed API routes follow the `/api/public/v1/` path prefix. Breaking changes require a new version prefix (`/v2/`). The `/v1/` routes are stable contracts. The public API contract is documented in `docs/public-website-feed-contract-v1.md`.

### Consequences

- All new external-facing routes must be placed under `/api/public/v1/` or a later version.
- Existing routes that do not follow this pattern are tracked as technical debt (see `03-technical-debt.md`).
- Deprecation of a version requires a migration notice period and documented consumer migration path.

---

## ADR-008 — Federation Imports Use Adapter Architecture

**Status:** Accepted

### Context

Swiss football clubs receive fixture and player data from federation systems (e.g. FVNWS via Clubcorner). Different federations and leagues use different data formats and APIs. Hardcoding Clubcorner import logic into the core application would make adding new federation sources expensive.

### Decision

Federation imports use an adapter pattern. Each federation source (Clubcorner, CSV, future sources) is an adapter that transforms source data into the SportClubEvo canonical event and player models. The import pipeline (`app/api/events/import/**`) accepts adapters; the core application is source-agnostic.

### Consequences

- New federation sources require a new adapter, not changes to core logic.
- The `EventImportRun` model tracks import history regardless of source.
- CSV import is available as a fallback adapter for any federation that does not have a direct integration.

---

## ADR-009 — One Reusable PeoplePicker Across the Platform

**Status:** Accepted

### Context

Many features require selecting people: assigning a trainer to a team, adding a participant to a meeting, linking a person to an initiative, selecting a player for a squad. Without a shared component, each feature builds its own people-selection UI, leading to inconsistent UX and duplicated search logic.

### Decision

One shared `PeoplePicker` component is used everywhere a person needs to be selected. It encapsulates search, display, and selection logic. Per-module people-selection components are not built.

### Consequences

- Any person-selection UI change is made once and applies everywhere.
- The `PeoplePicker` must support tenant-scoped queries (it must never show people from other tenants).
- Feature teams must use the shared component; new per-module pickers are rejected in code review.

---

## ADR-010 — No Duplicated Business Logic or Formatting Helpers

**Status:** Accepted

### Context

As the codebase grows, formatting functions (date formatting, currency formatting, name formatting) and business rules (permission checks, status calculations) tend to be re-implemented locally in components or pages. This leads to inconsistencies and bugs when the underlying rule changes.

### Decision

Every formatter, validator, and business logic helper lives once in `lib/`. Components and pages import from `lib/`. No business logic is defined inline in components. If a helper does not exist in `lib/`, it is created there before use.

### Consequences

- `lib/` is the single source of truth for business rules and formatting.
- Code review rejects duplicated logic in components or pages.
- The `lib/` directory structure organises helpers by domain (`lib/auth`, `lib/tenant-runtime`, `lib/wochenplan`, etc.).

---

## ADR-011 — STAGE Is the Trusted Development Source

**Status:** Accepted

### Context

Drift between local branches and the canonical branch is a major source of bugs and deployment failures. Without a strict anti-drift policy, developers work on stale state and merge conflicts accumulate.

### Decision

`STAGE` is the only trusted development source. Development never begins from `master`, stale local branches, or unverified state. Before any work begins: verify current branch is `STAGE`, verify `STAGE` matches `origin/STAGE`, stop immediately if there is local drift or uncommitted work. Feature branches are created from `STAGE` using the `cursor/<name>-fc79` naming convention.

### Consequences

- All feature branches are created from `STAGE`.
- Agents and developers must verify clean state before starting work (documented in AGENTS.md).
- `STAGE` receives all PRs; `master` is not used as a development branch.
- The `StageEnvironmentBanner` component surfaces the current environment in the admin UI.

---

## ADR-012 — Never Modify Passwords During Normal Development or Test Work

**Status:** Accepted

### Context

Development and test workflows occasionally generate scripts or automation that reset or change user passwords. In a multi-tenant production environment, accidental password resets can lock real users out of the system. Auth credentials are treated as inviolable during normal development work.

### Decision

Do not reset passwords, change authentication secrets, modify production credentials, or run bootstrap/seed scripts outside of a controlled, explicitly authorised operation. If authentication is broken, stop and report the exact issue — do not attempt to fix it by modifying credentials.

### Consequences

- Bootstrap and seed scripts exist (`prisma/bootstrap-admin.ts`, `prisma/seed.ts`) but are only run under explicit authorisation.
- Agents and developers are instructed not to run these scripts during normal development tasks.
- Authentication issues are escalated rather than self-healed with credential resets.

---

## ADR Template

Copy this template to add a new ADR.

```
## ADR-XXX — Title

**Status:** Proposed | Accepted | Superseded | Deprecated

### Context

Why was this decision needed? What was the problem or situation?

### Decision

What was decided?

### Consequences

What are the outcomes, trade-offs, or follow-on constraints?
```
