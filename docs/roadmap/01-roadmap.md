# SportClubEvo Roadmap

> **Document type:** Release roadmap — execution sequence  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo product team

---

## Current v1.0 Release Focus

The current active focus is delivering the **Website ↔ WebApp Integration** and finalising the **Planner foundation**, running in parallel toward the FC Allschwil production go-live.

For detailed feature status, see [`sportclubevo-v1-master-backlog.md`](./sportclubevo-v1-master-backlog.md).

---

## Agreed Execution Sequence

The following ordered phases define how v1.0 will be delivered. Each phase must be in a production-quality, stable state before the next phase begins unless explicitly noted as parallel work.

### Phase 1 — STAGE Recovery ✅

**Goal:** Establish a clean, trusted, drift-free development baseline.

- `STAGE` branch verified and declared source of truth
- Anti-drift workflow documented and enforced (AGENTS.md)
- Branch naming convention established (`cursor/<name>-fc79`)
- Deployment pipeline confirmed stable on Vercel

**Status:** Complete

---

### Phase 2 — Organisation Builder Foundation ✅

**Goal:** The core data model for clubs, teams, people, seasons, and roles is in place and fully operational.

- `OrgUnit`, `OrgUnitMembership`, `TargetGroup` models and admin UI
- `Person`, `Team`, `TeamSeason`, `PlayerSquadMember`, `TrainerTeamMember` models and admin UI
- `Season` management
- `Role`, `Permission`, `UserRole`, `RolePermission` RBAC system
- Four-eye governance workflow (`RoleWorkflowRule`, `RoleWorkflowReviewAssignment`)
- Registration workflow (Probetraining, Spieleranmeldung, Traineranmeldung, Sponsoranfrage, Kontaktanfrage)
- Tenant branding architecture (`logoUrl`, `primaryColor`, `secondaryColor`, CSS variables)
- Audit logging (`AuditLog` model)
- Impersonation support
- **Org Builder Foundation v1 (2026-06-25):** `archivedAt` timestamp on `OrgUnit`; archived units view with tab toggle; `OrgUnitRestoreButton`; `POST /api/org-units/[id]/restore` endpoint; `getArchivedOrgUnits` query; `EmptyActive`/`EmptyArchived` states. Migration: `20260625000000_org_unit_archived_at`.

**Status:** Largely complete — see Current Platform Status in `sportclubevo-v1-master-backlog.md` for precise per-item status

---

### Phase 3 — Website Management Foundation ✅ (largely)

**Goal:** The editorial content system is built and the content lifecycle (draft → review → published) is operational.

- `NewsArticle`, `WebsitePage`, `MediaAsset` models and admin UI
- Editorial workflow: Draft → In Review → Scheduled → Published → Archived
- Public API v1 surface (`/api/public/v1/website/news/**`, `/api/public/v1/website/pages/**`)
- Media asset storage (Vercel Blob)
- Event model and import (CSV, Clubcorner)
- Meetings, Initiatives (Vereinsleitung)

**Status:** Largely complete

---

### Phase 4 — FC Allschwil Website ↔ WebApp Integration 🔄

**Goal:** The public website becomes a pure consumer of WebApp-approved content. FC Allschwil's website editors stop editing operational content directly.

- Unified website data API (teams, matches, events, news, sponsors, homepage blocks)
- Full publishing pipeline for all content types (news, teams, matches, events, week plan, sponsors)
- Homepage block publishing
- Website cache refresh and cache invalidation (ISR / on-demand revalidation)
- `approvedDataOnly` tenant flag enforced on all public routes

**Acceptance criteria:**
- FC Allschwil public website serves only WebApp-approved content
- No direct content editing bypasses the WebApp review workflow
- Cache is invalidated automatically on publish and unpublish

**Status:** In progress

---

### Phase 5 — InfoBoard v1.1 Production Go-Live 🔄

**Goal:** The InfoBoard at FC Allschwil's facility runs fully automatically from approved planning data.

- Pitch overview and dressing room overview
- Countdown to next match or event
- Weather integration
- Sponsor screensaver
- Auto refresh
- Full-screen and kiosk mode

**Acceptance criteria:**
- InfoBoard requires zero manual editing after publishing a Week Plan
- Sponsor rotation managed inside SportClubEvo

**Status:** Foundation in place; v1.1 features planned

---

### Phase 6 — Week Planner Premium

**Goal:** The Wochenplan becomes the full operational facility and resource planner for the club.

- Season Planner overview
- Day View
- Tenant-configurable time slot sets
- Facilities configuration UI
- Resources configuration UI
- Pitch allocation (half and full pitch modes)
- Dressing room allocation
- Conflict detection (UI feedback)
- Standard Week Plan and Bad Weather Week Plan
- Publishing to website and InfoBoard

**Acceptance criteria:**
- All club facility planning happens inside SportClubEvo
- Conflicts are surfaced before saving or publishing
- Active Week Plan controls website and InfoBoard display

**Status:** Foundation in place; premium features planned

---

### Phase 7 — Season Planner

**Goal:** High-level view of the entire season — league rounds, tournaments, vacation periods, team-level season overview.

**Dependency:** Week Planner Premium must be stable.

**Status:** Planned

---

### Phase 8 — Mobile Backend Foundation

**Goal:** The API layer for the mobile application is production-ready, secure, and multi-tenant.

- Mobile authentication (separate token flow)
- Parent-child relationship model
- Attendance API (create, update, query per player per event)
- Event participation API
- Team calendar API
- Mobile-optimised news API
- Communication API
- Push notification foundation (APNs / FCM)
- Permission-aware endpoints (tenant-scoped, role-based)

**Acceptance criteria:**
- All mobile API endpoints enforce tenant isolation and RBAC
- All attendance changes are auditable
- Push notification infrastructure is tested end-to-end

**Status:** Planned

---

### Phase 9 — Mobile App MVP

**Goal:** FC Allschwil parents and trainers use the SportClubEvo mobile app in daily operations.

- Tenant selection and tenant branding
- Login
- My Teams, Team Calendar
- Attendance management (parent: mark present/absent)
- Push notifications
- News, Match Details, Events
- Basic Trainer View (view attendance list)

**Acceptance criteria:**
- FC Allschwil is the first live tenant
- No FC Allschwil-specific hardcoding — architecture is fully multi-tenant
- Parents manage attendance without contacting the club

**Status:** Planned

---

## v1.0 Epics Summary

| Epic | Goal | Status |
|---|---|---|
| 1 — Website ↔ WebApp Integration | WebApp becomes operational source of truth for public website | In Progress |
| 2 — Planner | Complete operational planning (Season, Week, Day) | In Progress |
| 3 — InfoBoard | Fully WebApp-driven public display | In Progress |
| 4 — Mobile Backend Foundation | API layer for mobile app | Planned |
| 5 — Mobile App MVP | First daily-use mobile application | Planned |

For full feature-level detail, acceptance criteria, and individual feature status, see [`sportclubevo-v1-master-backlog.md`](./sportclubevo-v1-master-backlog.md).

---

## Post-v1 Roadmap Summary

The following capabilities are explicitly deferred to after the first commercial release. See [`08-post-v1-ideas.md`](./08-post-v1-ideas.md) for detail.

- Training Designer and Exercise Library
- Finance / ClubFinance
- Polls and Volunteer management
- Sponsor portal / Business Club expansion
- Player Development, Ratings, Career History
- Equipment inventory
- Communication automation and smart nudging
- Analytics, KPI reporting, Google Analytics / Search Console / Clarity integration
- Federation adapters at scale
- Dedicated tenant apps, Marketplace
- Tenant self-service onboarding, Billing, Subscription management
- Internationalisation (i18n)

---

## Reference Documents

| Document | Purpose |
|---|---|
| [`00-product-blueprint.md`](./00-product-blueprint.md) | Product vision, MVP definition, locked decisions, quality gates |
| [`sportclubevo-v1-master-backlog.md`](./sportclubevo-v1-master-backlog.md) | Detailed feature backlog — source of truth for scope and status |
| [`02-go-live-checklist.md`](./02-go-live-checklist.md) | Go-live readiness checklist |
| [`03-technical-debt.md`](./03-technical-debt.md) | Known technical debt register |
| [`05-architecture-decisions.md`](./05-architecture-decisions.md) | ADR log — locked architectural decisions |
| [`06-engineering-principles.md`](./06-engineering-principles.md) | Engineering rules and standards |
