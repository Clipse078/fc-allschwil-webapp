# SportClubEvo Release History

> **Document type:** Release history — changelog  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo engineering team

---

## How to Use This Document

Add an entry for every production release. Follow the template below each section heading. Entries are listed newest-first within each section.

Use the following change categories:

- **Added** — new features and capabilities
- **Changed** — modifications to existing behaviour
- **Fixed** — bug fixes
- **Security** — security improvements or vulnerability fixes
- **Migration notes** — required actions for the database or infrastructure
- **Deployment notes** — actions required during or after deployment

---

## v0.x — Development Phase (Pre-release)

The v0.x series covers the development and foundation-building period before the first production release. It is not formally versioned with individual release tags. Key milestones are documented below for historical reference.

### Foundation Milestones

| Milestone | Description | Approximate Date |
|---|---|---|
| Initial scaffold | Next.js 16 project created; Prisma, NextAuth, Tailwind CSS v4 configured | 2024 |
| Authentication | NextAuth v5 with Credentials provider, JWT sessions, role-based session augmentation | 2024–2025 |
| RBAC system | `Role`, `Permission`, `UserRole`, `RolePermission` models; permission key system | 2024–2025 |
| Multi-tenant foundation | `Tenant` model; `tenantId` on `User`; tenant runtime and branding architecture | 2024–2025 |
| Organisation Builder | `OrgUnit`, `OrgUnitMembership`, `TargetGroup`, `Person`, `Team`, `TeamSeason`, `PlayerSquadMember`, `TrainerTeamMember` | 2025 |
| Season management | `Season` model; season-scoped planning | 2025 |
| Four-eye governance | `RoleWorkflowRule`, `RoleWorkflowReviewAssignment`; review-stage engine | 2025 |
| Registration workflow | `Registration` model; all registration type variants; tenant cockpit | 2025 |
| Event system | `Event` model; CSV and Clubcorner import; event admin UI | 2025 |
| Website CMS foundation | `NewsArticle`, `WebsitePage`, `MediaAsset`; editorial workflow; public API v1 | 2025 |
| Wochenplan foundation | `Facility`, `FacilityResource`, `WochenplanPublication`; conflict engine; public Wochenplan feed | 2025 |
| InfoBoard foundation | `InfoboardDisplay` component; `/infoboard` public route; admin UI | 2025 |
| Meetings & Initiatives | `Meeting`, agenda/decisions/actions/participants; `Initiative`; Vereinsleitung pages | 2025 |
| Impersonation | Admin impersonation with session switching and stop-impersonation flow | 2025 |
| Audit logging | `AuditLog` model; audit log pages and API | 2025 |
| Deployment documentation | `docs/deployment/` — Vercel project matrix, env entry sheets, runtime diagnostics | 2025–2026 |
| STAGE anti-drift workflow | Branch conventions, AGENTS.md, StageEnvironmentBanner | 2026 |
| Registration inbox premium UX v2 | Enhanced registration inbox and coordinator workflow | 2026 |

---

## v1.0 — First Commercial Release (Planned)

**Target:** FC Allschwil production go-live

### Added

- Website ↔ WebApp Integration (Epic 1) — full publishing pipeline for all content types
- Week Planner Premium (Epic 2) — pitch allocation, dressing room allocation, conflict detection, Standard/Bad Weather plans
- Season Planner (Epic 2)
- InfoBoard v1.1 (Epic 3) — pitch overview, dressing room overview, countdown, weather, sponsor screensaver, kiosk mode
- Mobile Backend Foundation (Epic 4) — mobile auth, parent-child model, attendance API, push notification foundation
- Mobile App MVP (Epic 5) — tenant selection, login, team calendar, attendance, push notifications, news

### Changed

- TBD at release time

### Fixed

- Tenant isolation on public API routes (resolves known TODO debt)
- Auth route protection (middleware vs. layout decision resolved)

### Security

- All secrets rotated to production values
- Permission audit completed
- Cross-tenant isolation independently verified

### Migration notes

- TBD at release time

### Deployment notes

- TBD at release time

---

## Release Template

Copy this template for each new release.

```
## vX.Y.Z — Release Name (YYYY-MM-DD)

### Added
-

### Changed
-

### Fixed
-

### Security
-

### Migration notes
-

### Deployment notes
-
```
