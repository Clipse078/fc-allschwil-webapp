> **Part of the SportClubEvo roadmap documentation set.**  
> Start with [`docs/roadmap/README.md`](./README.md) for the full index, or [`docs/roadmap/00-product-blueprint.md`](./00-product-blueprint.md) for the product vision and locked decisions.

---

# SportClubEvo v1.0 Master Backlog

> **Document type:** Living planning document  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo core team

---

## Purpose

This document converts the accumulated SportClubEvo product vision into a structured execution plan for the first commercial release (v1.0).

It is the **single planning document** for all future development work. Every feature, epic, and milestone is tracked here. Nothing enters development without first appearing in this backlog. The document evolves continuously — statuses, priorities, and scope are updated as work progresses.

---

# Current Platform Status

The following foundations have been built on the `STAGE` branch and are in an active, usable state. They are not claimed as 100% complete unless explicitly stated, but they provide a working base for all v1.0 work.

| Foundation | Status | Notes |
|---|---|---|
| Authentication | Largely implemented | NextAuth v5, Credentials provider, JWT sessions, impersonation support |
| Roles & Permissions | Largely implemented | RBAC with `Role`, `Permission`, `UserRole`, `RolePermission` models; permission keys span all major modules |
| Four-Eye Governance | Largely implemented | `RoleWorkflowRule`, `RoleWorkflowReviewAssignment`; review-stage engine in `lib/governance/` |
| STAGE deployment workflow | Implemented | `STAGE` branch is source of truth; `StageEnvironmentBanner` in admin shell; `vercel.json` build config |
| Anti-drift workflow | Implemented | AGENTS.md and branch conventions enforced; no uncommitted drift permitted |
| Registration workflow | Largely implemented | `Registration` model, type variants (Probetraining, Spieleranmeldung, Traineranmeldung, Sponsoranfrage, Kontaktanfrage), admin pages, tenant cockpit |
| Organisation Builder foundation | **Foundation v1 + Phase 2 complete** | `OrgUnit` (+ `archivedAt`), `OrgUnitMembership`, `TargetGroup` models; full admin CRUD at `/dashboard/org-units`; archived units view with restore; `POST /api/org-units/[id]/restore`; tenant-safe hierarchy management; membership management. **Phase 2 complete (2026-06-25):** `loadOrgUnitIds()` excludes archived org units; `canAccessOrgUnit()`, `canManageOrgUnit()`, `canListOrgUnits()` helpers in `lib/visibility/org-unit-access.ts`; org-unit detail and history pages grant access to active unit members; RESTRICTED visibility via `visibleOrgUnitRefs` active for Meetings, Initiatives, Targets. |
| Admin governance foundation | Largely implemented | `AuditLog` model, audit log pages, `/api/audit-logs`, runtime diagnostics |
| Meetings foundation | Largely implemented | `Meeting`, `MeetingAgendaItem`, `MeetingDecision`, `MeetingAction`, `MeetingParticipant` models; Vereinsleitung pages and APIs |
| Initiatives foundation | Largely implemented | `Initiative` model; Vereinsleitung pages and APIs; visibility scopes (Organisation, Restricted, Private) |
| Tenant branding architecture | Largely implemented | `Tenant` model carries `logoUrl`, `primaryColor`, `secondaryColor`; CSS variables injected in admin shell layout; Vercel Blob asset storage |
| Multi-tenant direction | Foundation in place | `tenantId` on `User`; tenant runtime (`lib/tenant-runtime/`); tenant cockpit; public feeds carry tenant context. **Assumption:** full cross-tenant isolation has not been independently verified on all public API routes — known TODO comments exist in `app/api/public/events/route.ts` and related files |
| Website CMS foundation | Largely implemented | `NewsArticle`, `WebsitePage`, `MediaAsset` models; editorial workflow (Draft → In Review → Scheduled → Published → Archived); admin pages for news, pages, media, publishing, settings |
| Planner foundation | Largely implemented | `Event`, `Facility`, `FacilityResource`, `WochenplanPublication` models; conflict engine (`lib/wochenplan/conflict-engine.ts`); wochenplan admin pages and public feed |
| Infoboard foundation | Largely implemented | `InfoboardDisplay` component; public `/infoboard` route; admin infoboard pages; `/api/public/infoboard` |
| Public API surface | Largely implemented | `/api/public/events`, `/api/public/infoboard`, `/api/public/wochenplan`, `/api/public/v1/website/news/**`, `/api/public/v1/website/pages/**` |
| People, Teams, Players, Trainers | Largely implemented | `Person`, `Team`, `TeamSeason`, `PlayerSquadMember`, `TrainerTeamMember`, `Season` models; full admin CRUD pages |
| Targets & KPIs | Foundation in place | `Target`, `TargetMetric`, `TargetDataPoint`, `TargetGroup` models; Vereinsleitung KPI pages |
| Communication Templates | Foundation in place | `CommunicationTemplate` model; templates pages |

> **Open Question:** Auth route protection is currently enforced in the `(admin)` layout, not via `middleware.ts`. Whether this is the intended final architecture or a gap should be confirmed before go-live.

---

# SportClubEvo v1.0 Release Scope

The five epics below define the complete scope of the first commercial release. Everything outside this scope belongs in the Post-v1 Roadmap.

---

## Epic 1 — Website ↔ WebApp Integration

**Goal:** The WebApp becomes the operational source of truth for the public website. Website editors no longer manage operational content directly.

### Features

| Feature | Description |
|---|---|
| Website data API | Unified public API layer exposing approved content to the public website |
| Draft workflow | Content enters as a draft, visible only to editors |
| Review workflow | Draft content requires reviewer sign-off before scheduling |
| Published workflow | Approved content is published and exposed via the public API |
| News publishing | News articles go through draft → review → published lifecycle |
| Team publishing | Team data (squad, trainers) approved and published via WebApp |
| Match publishing | Match results and fixtures approved and published via WebApp |
| Event publishing | Club events approved and published via WebApp |
| Week Planner publishing | Active Wochenplan pushed to public website |
| Sponsor publishing | Sponsor data managed and approved in WebApp, pushed to website |
| Homepage block publishing | Configurable homepage sections (blocks) managed in WebApp |
| Website cache refresh | Trigger incremental revalidation on the public website after publish actions |
| Cache invalidation | On content update or unpublish, invalidate affected website cache entries |

> **Assumption:** The public website is a separate Next.js deployment consuming these APIs. The exact revalidation mechanism (ISR tags, on-demand revalidation webhook) is an open question.

### Acceptance Criteria

- The public website consumes only approved WebApp data.
- Website editors no longer edit operational content (news, teams, matches, events) directly on the website.
- Only content that has passed the review workflow can reach the published state.
- Cache refresh and invalidation are triggered automatically on publish and unpublish actions.

---

## Epic 2 — Planner

**Goal:** Create the complete operational planning system for the club. The Planner replaces all external spreadsheets and coordination tools.

### Features

#### Season Planner

| Feature | Description |
|---|---|
| Season Planner | High-level view of the entire season — league rounds, tournaments, vacation periods |

#### Week Planner

| Feature | Description |
|---|---|
| Week Planner | Weekly planning view — all teams, fields, and time slots in one view |
| Day View | Single-day operational view for match days and training days |
| Tenant-configurable time slot sets | Admin can define and adjust default time slot sets per tenant |
| Facilities configuration | Admin configures available facilities (pitches, halls, rooms) |
| Resources configuration | Admin configures shared resources (bibs, goals, equipment) |
| Pitch allocation | Assign full or partial pitches to teams for training and matches |
| Half pitch mode | Split a pitch into two independent allocations |
| Full pitch mode | Reserve an entire pitch exclusively for one team or event |
| Dressing room allocation | Assign dressing rooms to teams per time slot |
| Conflict detection | Detect and surface allocation conflicts before saving or publishing |
| Standard Week Plan | Define a repeating baseline plan for a standard training week |
| Bad Weather Week Plan | Define an alternative plan activated when weather prevents normal use |
| Publishing to Website | Push the active Week Plan to the public website |
| Publishing to InfoBoard | Push the active Week Plan to the InfoBoard display |

### Acceptance Criteria

- The entire club's facility and resource planning happens inside SportClubEvo.
- Conflicts are visible to planners before they save or publish a plan.
- The active Week Plan controls what the public website and InfoBoard display.
- Switching between Standard and Bad Weather plans requires no manual editing of individual assignments.

---

## Epic 3 — InfoBoard

**Goal:** A fully WebApp-driven public display requiring zero manual editing after initial setup.

### Features

| Feature | Description |
|---|---|
| Public InfoBoard route | `/infoboard` renders automatically from approved planning data |
| Today's matches | Shows all scheduled matches for the current day |
| Today's events | Shows all scheduled events and training sessions for the current day |
| Pitch overview | Visual overview of pitch allocation for the current day |
| Dressing room overview | Visual overview of dressing room allocation for the current day |
| Countdown | Countdown clock to the next match or key event |
| Weather integration | Current weather conditions displayed on screen |
| Sponsor screensaver | Sponsor logos/content displayed during idle or low-activity periods |
| Auto refresh | Screen content refreshes automatically without manual intervention |
| Full-screen mode | InfoBoard can be launched in browser full-screen mode |
| Kiosk mode | Locked display mode suitable for unattended public screens |

> **Open Question:** Weather integration provider (e.g. OpenWeatherMap, MeteoSwiss) is not yet selected.

### Acceptance Criteria

- The InfoBoard requires no manual editing after publishing a Week Plan.
- All display data originates from approved planning and event data in the WebApp.
- Sponsor visibility (which sponsors appear, in what rotation) is managed entirely inside SportClubEvo.

---

## Epic 4 — Mobile Backend Foundation

**Goal:** Provide the API foundation required for the shared SportClubEvo mobile application. This epic delivers backend infrastructure only — no mobile app is in scope here.

### Features

| Feature | Description |
|---|---|
| Mobile authentication | Secure token-based auth flow suitable for mobile clients |
| Parent-child relationship model | Data model linking parent users to child (player) profiles |
| Attendance API | Create, update, and query attendance records per player per event |
| Event participation API | Confirm or decline participation in events and training sessions |
| Team calendar API | Return team-specific calendar data for a given player or parent |
| News API | Mobile-optimised news feed endpoint |
| Communication API | Deliver messages and announcements to mobile clients |
| Push notification foundation | Infrastructure for sending push notifications (APNs / FCM) |
| Permission-aware endpoints | All endpoints enforce tenant-scoped, role-based access |

> **Assumption:** Mobile authentication uses a separate token flow (e.g. short-lived JWT with refresh token) rather than the existing NextAuth session cookies.  
> **Open Question:** Which push notification provider is used (e.g. Firebase FCM, Apple APNs directly, or an abstraction layer)?

### Acceptance Criteria

- The mobile app consumes only official, versioned API endpoints.
- Parent actions (e.g. marking absence) are enforced through permission-scoped endpoints.
- All attendance changes are written to the audit log and are fully auditable.

---

## Epic 5 — Shared SportClubEvo Mobile App

**Goal:** Deliver the first daily-use mobile application for parents, players, and trainers.

### Features

| Feature | Description |
|---|---|
| Tenant selection | Users select their club on first launch |
| Tenant branding | Club logo, primary and secondary colours applied to the app UI |
| Login | Secure login using the Mobile Backend Foundation auth endpoint |
| My Teams | View all teams the logged-in user is associated with |
| Team Calendar | Full team calendar with training sessions, matches, and events |
| Attendance | Parents mark attendance (present / absent) for their child per event |
| Push Notifications | Receive notifications for schedule changes, news, and reminders |
| News | Browse approved published news articles for the tenant |
| Match Details | View match time, location, opponent, and result |
| Events | View club events with description, time, and location |
| Basic Trainer View | Trainers view attendance list for their team sessions |

> **Future Consideration:** Android and iOS platform parity; cross-platform framework choice (e.g. React Native, Expo) is not mandated here but should be decided before Epic 4 begins.

### Acceptance Criteria

- Parents can manage attendance for their children without contacting the club.
- Trainers can view the attendance list for their training sessions.
- FC Allschwil operates as the first live tenant.
- The application architecture remains fully multi-tenant from day one — no FC Allschwil-specific hardcoding.

---

# Go-Live Readiness

The following checklist must be completed before the v1.0 commercial release.

## Infrastructure

- [ ] Production deployment verified and stable
- [ ] Custom domain and DNS configured
- [ ] SSL certificate active and auto-renewing
- [ ] Monitoring configured (uptime and error alerting)
- [ ] Structured logging configured and queryable
- [ ] Environment variables documented and stored securely

## Security

- [ ] Full permission audit — all endpoints verified against RBAC rules
- [ ] Tenant isolation independently verified across all API routes (including public routes)
- [ ] Database backup schedule configured and verified
- [ ] Backup restore procedure tested end-to-end
- [ ] Impersonation audit log entries verified
- [ ] Production secrets rotated from development values

## Quality

- [ ] Responsive design tested across mobile, tablet, and desktop breakpoints
- [ ] Cross-browser testing completed (Chrome, Safari, Firefox, Edge)
- [ ] Device testing on representative iOS and Android devices
- [ ] Performance review — Lighthouse scores reviewed and critical issues resolved
- [ ] Accessibility baseline review completed

## Documentation

- [ ] Admin Guide written and reviewed
- [ ] Trainer Guide written and reviewed
- [ ] Coordinator Guide written and reviewed
- [ ] API integration contract for the public website finalised

## Operations

- [ ] Support process defined (intake channel, response SLA, escalation path)
- [ ] Incident process defined (detection, response, post-mortem)
- [ ] Deployment checklist written and rehearsed
- [ ] Rollback procedure documented and tested

---

# Post-v1 Roadmap

The following capabilities are explicitly scoped to after the first commercial release. They are documented here so that architectural decisions made during v1 development remain compatible with future needs.

| Capability | Notes |
|---|---|
| Training Designer | Create and assign structured training sessions per team |
| Exercise Library | Tenant-managed and platform-managed exercise catalogue |
| Communication Templates | **Foundation in place (model exists).** Full authoring and dispatch UI is post-v1 |
| Polls | Collect structured input from members (e.g. training time preferences) |
| Player Development | Track individual player progress over time |
| Ratings | Structured player and performance ratings |
| Career History | Long-term player career and club history tracking |
| KPI Dashboard | **Foundation in place (Target/TargetMetric/TargetDataPoint models exist).** Full leadership KPI dashboard is post-v1 |
| Analytics | In-app usage and performance analytics for club administrators |
| Google Analytics integration | Embed GA4 into tenant public pages |
| Google Search Console integration | Surface search performance data inside SportClubEvo |
| Microsoft Clarity integration | Heatmap and session recording for UX improvement |
| Tenant onboarding | Self-service onboarding flow for new sports clubs |
| Billing | Subscription invoicing and payment handling |
| Subscription management | Tenant plan upgrades, downgrades, and cancellations |
| Federation adapters | Import fixture data from football federation systems (e.g. FVNWS/Clubcorner) at scale |
| Internationalisation (i18n) | UI language switching; multi-language content support |
| Customer self-service | Tenants manage their own configuration without platform admin involvement |

> **Note:** The `CommunicationTemplate` model and KPI models already exist in the schema. Post-v1 classification means the full feature UI is deferred, not that the data model is absent.

---

# Guiding Principles

These principles govern all SportClubEvo development decisions.

| Principle | Meaning |
|---|---|
| STAGE is the only source of truth | All development targets the `STAGE` branch. No work begins from stale branches, master, or unverified local state. |
| WebApp is the operational source of truth | The public website and InfoBoard display only what the WebApp approves. No direct editing of operational content outside the WebApp. |
| Configuration over hardcoding | Tenant-specific behaviour is driven by configuration fields on the `Tenant` model, not by branching application logic. |
| Premium minimal UX | The interface is clean, focused, and professional. No clutter. Every screen earns its place. |
| Reusable components first | Before building a new component, check whether an existing one can be extended. Shared primitives in `components/ui/` and `components/admin/shared/` are the default starting point. |
| Multi-tenant by design | Every feature is built multi-tenant from the first commit. FC Allschwil is the first tenant, not a special case. |
| Security, backups and tenant isolation are non-negotiable | Permission checks, audit logging, tenant data boundaries, and backup verification are mandatory — not optional polish. |

---

# Master Backlog

This table is the authoritative status register for all v1.0 features.

| Status | Epic | Feature | Priority | Release |
|---|---|---|---|---|
| Done | Foundation | Authentication (NextAuth v5, credentials, JWT) | Critical | v1.0 |
| Done | Foundation | Roles & Permissions (RBAC) | Critical | v1.0 |
| Done | Foundation | Four-Eye Governance workflow | Critical | v1.0 |
| Done | Foundation | STAGE deployment workflow | Critical | v1.0 |
| Done | Foundation | Anti-drift workflow | Critical | v1.0 |
| Done | Foundation | Tenant model & branding architecture | Critical | v1.0 |
| Done | Foundation | Audit logging | High | v1.0 |
| Done | Foundation | Registration workflow | High | v1.0 |
| Done | Foundation | Organisation Builder (OrgUnit, TargetGroup) | High | v1.0 |
| Done | Foundation | Organisation-based Permissions Foundation | High | v1.0 |
| Done | Foundation | Meetings (agenda, decisions, actions, participants) | High | v1.0 |
| Done | Foundation | Initiatives | High | v1.0 |
| Done | Foundation | People, Teams, Players, Trainers | High | v1.0 |
| Done | Foundation | Season management | High | v1.0 |
| Done | Foundation | Event model & import (CSV, Clubcorner) | High | v1.0 |
| Done | Foundation | Impersonation | Medium | v1.0 |
| Done | Foundation | Media asset storage (Vercel Blob) | Medium | v1.0 |
| In Progress | Website ↔ WebApp | Website CMS foundation (news, pages, media) | Critical | v1.0 |
| In Progress | Website ↔ WebApp | Editorial workflow (Draft → Published) | Critical | v1.0 |
| In Progress | Website ↔ WebApp | Public API v1 surface (news, pages feeds) | Critical | v1.0 |
| Planned | Website ↔ WebApp | Website data API (unified public endpoint) | Critical | v1.0 |
| Planned | Website ↔ WebApp | News publishing (full draft→review→published) | Critical | v1.0 |
| Planned | Website ↔ WebApp | Team publishing | High | v1.0 |
| Planned | Website ↔ WebApp | Match publishing | High | v1.0 |
| Planned | Website ↔ WebApp | Event publishing | High | v1.0 |
| Planned | Website ↔ WebApp | Week Planner publishing | High | v1.0 |
| Planned | Website ↔ WebApp | Sponsor publishing | Medium | v1.0 |
| Planned | Website ↔ WebApp | Homepage block publishing | Medium | v1.0 |
| Planned | Website ↔ WebApp | Website cache refresh (ISR / on-demand revalidation) | High | v1.0 |
| Planned | Website ↔ WebApp | Cache invalidation on unpublish | High | v1.0 |
| In Progress | Planner | Wochenplan foundation (facilities, resources, conflict engine) | Critical | v1.0 |
| In Progress | Planner | Week Planner admin UI | Critical | v1.0 |
| In Progress | Planner | Public Wochenplan feed | High | v1.0 |
| Planned | Planner | Season Planner | High | v1.0 |
| Planned | Planner | Day View | High | v1.0 |
| Planned | Planner | Tenant-configurable time slot sets | High | v1.0 |
| Planned | Planner | Facilities configuration UI | High | v1.0 |
| Planned | Planner | Resources configuration UI | Medium | v1.0 |
| Planned | Planner | Pitch allocation | Critical | v1.0 |
| Planned | Planner | Half pitch mode | High | v1.0 |
| Planned | Planner | Full pitch mode | High | v1.0 |
| Planned | Planner | Dressing room allocation | High | v1.0 |
| Planned | Planner | Conflict detection (UI feedback) | Critical | v1.0 |
| Planned | Planner | Standard Week Plan | High | v1.0 |
| Planned | Planner | Bad Weather Week Plan | Medium | v1.0 |
| Planned | Planner | Publishing to Website | High | v1.0 |
| Planned | Planner | Publishing to InfoBoard | High | v1.0 |
| In Progress | InfoBoard | Public InfoBoard route | Critical | v1.0 |
| In Progress | InfoBoard | Today's matches | High | v1.0 |
| In Progress | InfoBoard | Today's events | High | v1.0 |
| Planned | InfoBoard | Pitch overview | High | v1.0 |
| Planned | InfoBoard | Dressing room overview | High | v1.0 |
| Planned | InfoBoard | Countdown | Medium | v1.0 |
| Planned | InfoBoard | Weather integration | Medium | v1.0 |
| Planned | InfoBoard | Sponsor screensaver | Medium | v1.0 |
| Planned | InfoBoard | Auto refresh | High | v1.0 |
| Planned | InfoBoard | Full-screen mode | Medium | v1.0 |
| Planned | InfoBoard | Kiosk mode | Medium | v1.0 |
| Planned | Mobile Backend | Mobile authentication | Critical | v1.0 |
| Planned | Mobile Backend | Parent-child relationship model | Critical | v1.0 |
| Planned | Mobile Backend | Attendance API | Critical | v1.0 |
| Planned | Mobile Backend | Event participation API | Critical | v1.0 |
| Planned | Mobile Backend | Team calendar API | Critical | v1.0 |
| Planned | Mobile Backend | News API (mobile-optimised) | High | v1.0 |
| Planned | Mobile Backend | Communication API | Medium | v1.0 |
| Planned | Mobile Backend | Push notification foundation | High | v1.0 |
| Planned | Mobile Backend | Permission-aware endpoints | Critical | v1.0 |
| Planned | Mobile App | Tenant selection | Critical | v1.0 |
| Planned | Mobile App | Tenant branding | High | v1.0 |
| Planned | Mobile App | Login | Critical | v1.0 |
| Planned | Mobile App | My Teams | Critical | v1.0 |
| Planned | Mobile App | Team Calendar | Critical | v1.0 |
| Planned | Mobile App | Attendance (parent mark present/absent) | Critical | v1.0 |
| Planned | Mobile App | Push Notifications | High | v1.0 |
| Planned | Mobile App | News | High | v1.0 |
| Planned | Mobile App | Match Details | High | v1.0 |
| Planned | Mobile App | Events | High | v1.0 |
| Planned | Mobile App | Basic Trainer View | High | v1.0 |
| Post-v1 | Post-v1 | Training Designer | — | Post-v1 |
| Post-v1 | Post-v1 | Exercise Library | — | Post-v1 |
| Post-v1 | Post-v1 | Polls | — | Post-v1 |
| Post-v1 | Post-v1 | Player Development | — | Post-v1 |
| Post-v1 | Post-v1 | Ratings | — | Post-v1 |
| Post-v1 | Post-v1 | Career History | — | Post-v1 |
| Post-v1 | Post-v1 | KPI Dashboard (full UI) | — | Post-v1 |
| Post-v1 | Post-v1 | Analytics | — | Post-v1 |
| Post-v1 | Post-v1 | Google Analytics integration | — | Post-v1 |
| Post-v1 | Post-v1 | Google Search Console integration | — | Post-v1 |
| Post-v1 | Post-v1 | Microsoft Clarity integration | — | Post-v1 |
| Post-v1 | Post-v1 | Tenant onboarding (self-service) | — | Post-v1 |
| Post-v1 | Post-v1 | Billing & subscription management | — | Post-v1 |
| Post-v1 | Post-v1 | Federation adapters | — | Post-v1 |
| Post-v1 | Post-v1 | Internationalisation (i18n) | — | Post-v1 |
| Post-v1 | Post-v1 | Customer self-service | — | Post-v1 |

---

# Living Progress Checklist

This checklist is the day-to-day progress tracker. Check items off as they reach a fully working, production-quality state.

## Foundation

- [x] Authentication (NextAuth v5, credentials, JWT, impersonation)
- [x] Roles & Permissions (RBAC, four-eye governance)
- [x] STAGE deployment workflow
- [x] Anti-drift workflow
- [x] Registration workflow
- [x] Organisation Builder foundation (OrgUnit, OrgUnitMembership, TargetGroup)
- [x] Organisation-based Permissions Foundation (Phase 2: loadOrgUnitIds excludes archived units; canAccessOrgUnit helpers; RESTRICTED visibility via visibleOrgUnitRefs active for Meetings, Initiatives, Targets)
- [x] Admin governance foundation (AuditLog, runtime diagnostics)
- [x] Meetings foundation (agenda, decisions, actions, participants)
- [x] Initiatives foundation
- [x] Tenant branding architecture (CSS variables, Vercel Blob)
- [x] Multi-tenant direction (tenantId, tenant runtime, cockpit)
- [x] People, Teams, Players, Trainers management
- [x] Season management
- [x] Event model & import (CSV, Clubcorner)
- [x] Media asset storage (Vercel Blob)
- [x] Impersonation support

## Epic 1 — Website ↔ WebApp Integration

- [x] Website CMS foundation (news, pages, media models & admin UI)
- [x] Editorial workflow (Draft → In Review → Scheduled → Published → Archived)
- [x] Public API v1 surface (news and pages feeds)
- [ ] Unified website data API
- [ ] News publishing (full lifecycle, website-ready)
- [ ] Team publishing
- [ ] Match publishing
- [ ] Event publishing
- [ ] Week Planner publishing
- [ ] Sponsor publishing
- [ ] Homepage block publishing
- [ ] Website cache refresh (ISR / on-demand revalidation)
- [ ] Cache invalidation on unpublish

## Epic 2 — Planner

- [x] Wochenplan foundation (Facility, FacilityResource, WochenplanPublication, conflict engine)
- [x] Week Planner admin UI
- [x] Public Wochenplan feed
- [ ] Season Planner
- [ ] Day View
- [ ] Tenant-configurable time slot sets
- [ ] Facilities configuration UI
- [ ] Resources configuration UI
- [ ] Pitch allocation
- [ ] Half pitch mode
- [ ] Full pitch mode
- [ ] Dressing room allocation
- [ ] Conflict detection (UI feedback)
- [ ] Standard Week Plan
- [ ] Bad Weather Week Plan
- [ ] Publishing to Website
- [ ] Publishing to InfoBoard

## Epic 3 — InfoBoard

- [x] Public InfoBoard route (`/infoboard`)
- [x] Today's matches
- [x] Today's events
- [ ] Pitch overview
- [ ] Dressing room overview
- [ ] Countdown
- [ ] Weather integration
- [ ] Sponsor screensaver
- [ ] Auto refresh
- [ ] Full-screen mode
- [ ] Kiosk mode

## Epic 4 — Mobile Backend Foundation

- [ ] Mobile authentication
- [ ] Parent-child relationship model
- [ ] Attendance API
- [ ] Event participation API
- [ ] Team calendar API
- [ ] News API (mobile-optimised)
- [ ] Communication API
- [ ] Push notification foundation
- [ ] Permission-aware mobile endpoints

## Epic 5 — Shared SportClubEvo Mobile App

- [ ] Tenant selection
- [ ] Tenant branding
- [ ] Login
- [ ] My Teams
- [ ] Team Calendar
- [ ] Attendance (parent mark present/absent)
- [ ] Push Notifications
- [ ] News
- [ ] Match Details
- [ ] Events
- [ ] Basic Trainer View

## Go-Live Readiness

- [ ] Production deployment verified
- [ ] DNS & SSL configured
- [ ] Monitoring & logging configured
- [ ] Permission audit completed
- [ ] Tenant isolation verified on all routes
- [ ] Backup schedule configured & restore tested
- [ ] Responsive, browser, and device testing completed
- [ ] Performance review completed
- [ ] Admin, Trainer, and Coordinator guides written
- [ ] Support, incident, and deployment processes defined

---

*This document is a living artefact. Update statuses in the Master Backlog table and the Living Progress Checklist as work is completed. Do not add post-v1 features to the v1 release scope without an explicit product decision.*
