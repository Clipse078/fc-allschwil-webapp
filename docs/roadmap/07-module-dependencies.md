# SportClubEvo Module Dependencies

> **Document type:** Module dependency map  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo engineering team

---

## Purpose

This document defines the dependency order between SportClubEvo modules. A module may not be built or considered production-ready until all of its dependencies are stable. This map drives the execution sequence in `01-roadmap.md`.

---

## Primary Dependency Chain

The core dependency chain runs from foundational data models upward to consumer surfaces:

```
Organisation Builder
    └── Permissions
            └── People
                    └── Teams
                            └── Seasons
                                    └── Planner (Wochenplan / Week Planner / Season Planner)
                                                └── Website (publishing & cache)
                                                            └── InfoBoard
                                                                        └── Mobile
```

Each layer depends on all layers above it being stable and multi-tenant-safe.

---

## Module Dependency Detail

### Organisation Builder

**Depends on:** Authentication, Roles & Permissions (RBAC system)

**Provides:** `OrgUnit` (with `archivedAt`), `OrgUnitMembership`, `TargetGroup` — the structural backbone for all groupings within a club. Foundation v1 complete: CRUD, hierarchy management, archive/restore, tenant isolation, membership management.

**Phase 2 (pending):** Organisation-based permission checks — `ActorContext.orgUnitIds` wired to permission guards; `visibleOrgUnitRefs` checks in `canSeeEntity()`. See `TODO(Phase 2)` comment in `/dashboard/org-units/page.tsx`.

**Consumers:** People (person-to-org-unit membership), Vereinsleitung governance, Sponsor portal (post-v1), Volunteer management (post-v1)

---

### Permissions (RBAC)

**Depends on:** Authentication (`User` model, session management)

**Provides:** `Role`, `Permission`, `UserRole`, `RolePermission`, four-eye governance rules — the access control layer for all modules

**Consumers:** Every module — all API routes enforce permissions derived from this system

---

### People

**Depends on:** Organisation Builder (org unit membership), Permissions (person data is tenant-scoped)

**Provides:** `Person` model — the canonical representation of any individual in the club (player, trainer, parent, board member)

**Consumers:** Teams (squad membership), Meetings (participants), Initiatives, Registrations, PeoplePicker (shared component), Mobile Backend Foundation (parent-child model)

---

### Teams

**Depends on:** People (`PlayerSquadMember`, `TrainerTeamMember` link people to teams), Seasons (team season records)

**Provides:** `Team`, `TeamSeason`, `PlayerSquadMember`, `TrainerTeamMember` — the operational team structure

**Consumers:** Planner (which team uses which pitch), Events (team matches), Mobile App (My Teams, Team Calendar), Website (team publishing)

---

### Seasons

**Depends on:** Tenant (seasons are tenant-scoped), Organisation Builder (seasons may apply to specific org units)

**Provides:** `Season` model — the leading temporal entity for all planning and membership

**Consumers:** Teams (TeamSeason), Planner (season-scoped week plans), Events (season-scoped fixtures), Website (season-scoped published data)

---

### Planner (Wochenplan / Week Planner / Season Planner)

**Depends on:** Seasons, Teams, Facilities (`Facility`, `FacilityResource`), Events (match and training events feed the planner)

**Provides:** `WochenplanPublication`, conflict engine, weekly and seasonal resource allocation — the operational planning layer

**Consumers:**
- Website (publishing the active Week Plan to the public website)
- InfoBoard (displaying current day pitch and dressing room allocations)
- Season Planner (high-level view built on top of Week Planner data)

**Key constraint:** Conflict detection (`lib/wochenplan/conflict-engine.ts`) must run before any plan is saved or published.

---

### Website (Publishing & Cache)

**Depends on:**
- Planner (Week Plan published to website)
- Teams (team data published to website)
- Events (match and event data published to website)
- News (articles published via editorial workflow)
- Pages (`WebsitePage` managed in WebApp)
- Media (`MediaAsset` via Vercel Blob)
- Public API v1 surface (versioned endpoints consumed by website)

**Provides:** Approved, published content accessible via `/api/public/v1/**` — the content supply for the public website

**Consumers:**
- Public website (separate Next.js deployment)
- InfoBoard (news and event data)

**Key constraint:** Only content with `approvedDataOnly` flag respected and publishing status = Published may be delivered. Cache revalidation mechanism must be resolved (see `03-technical-debt.md`).

---

### InfoBoard

**Depends on:**
- Events (today's matches and events)
- Planner (pitch and dressing room allocations for today)
- Facilities (`Facility`, `FacilityResource` — room and pitch names)
- Sponsors (screensaver content — sponsor publishing must be available)
- Weather provider (external dependency — provider TBD, see `03-technical-debt.md`)

**Provides:** `/infoboard` public route — real-time, auto-refreshing display for club facilities

**Key constraint:** InfoBoard is read-only. It must never require manual editing after a Week Plan is published.

---

### Mobile Backend Foundation

**Depends on:**
- People (parent-child relationship model anchors on `Person`)
- Teams (team calendar, squad membership)
- Events (attendance per event per player)
- Seasons (team calendar is season-scoped)
- Permissions (all mobile endpoints are permission-aware)

**Provides:** Versioned, mobile-optimised API endpoints — mobile auth, parent-child model, attendance API, event participation API, team calendar API, news API, push notification foundation

**Key constraint:** Mobile authentication requires a separate token flow (JWT + refresh token) from the existing NextAuth cookie sessions. This must be decided before Epic 4 begins (see `03-technical-debt.md`).

---

### Mobile App

**Depends on:**
- Mobile Backend Foundation (all features are API-driven)
- Push notification provider (external dependency — provider TBD, see `03-technical-debt.md`)
- Tenant branding (tenant logo and colours displayed in-app)

**Provides:** The SportClubEvo mobile application — tenant selection, login, team calendar, attendance, push notifications, news, match details, events, basic trainer view

**Key constraint:** The mobile framework decision (React Native, Expo, etc.) must be made before Epic 4 begins, as it influences API design for Epic 4.

---

### Training Designer (Post-v1)

**Depends on:** People, Teams, Seasons, Events (training events provide the scheduling context), Exercise Library

**Provides:** Structured training session design and assignment

**Note:** Post-v1 module. Do not build until Exercise Library model is defined.

---

### Finance / ClubFinance (Post-v1)

**Depends on:** People, Sponsors (`Sponsor` model — not yet in schema), Memberships (not yet in schema), QR-bill configuration

**Provides:** Invoicing, membership fee management, QR-bill generation

**Note:** Post-v1 module. Requires new schema models (`Sponsor` upgrade, `Membership`, `Invoice`).

---

## Dependency Summary Table

| Module | Hard Dependencies | Optional Dependencies | Key External Deps |
|---|---|---|---|
| Organisation Builder | Auth, RBAC | — | — |
| Permissions (RBAC) | Auth | — | — |
| People | Org Builder, RBAC | — | — |
| Teams | People, Seasons | — | — |
| Seasons | Tenant, Org Builder | — | — |
| Planner | Seasons, Teams, Facilities, Events | — | — |
| Website | Planner, Teams, Events, News, Pages, Media, Public API | — | Website deployment |
| InfoBoard | Events, Planner, Facilities, Sponsors | Weather provider | Weather API |
| Mobile Backend | People, Teams, Events, Seasons, RBAC | Communication model | Push provider |
| Mobile App | Mobile Backend | Tenant branding | Push provider, App stores |
| Training Designer | People, Teams, Seasons, Events, Exercise Library | — | — |
| Finance | People, Sponsors, Memberships | QR-bill config | Payment rails |
