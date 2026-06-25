# SportClubEvo Product Blueprint

> **Document type:** Product definition — authoritative reference  
> **Status:** Active  
> **Last updated:** 2026-06-25  
> **Maintained by:** SportClubEvo product team

---

## Product Vision

SportClubEvo is the operational platform for amateur and semi-professional sports clubs. It replaces scattered spreadsheets, email threads, and disconnected websites with a single, integrated WebApp that manages every operational dimension of a club — from planning and communication to public presence and performance tracking.

The long-term vision: every sports club in the German-speaking world runs on SportClubEvo.

---

## Mission

Give club managers, trainers, coordinators, parents, and players a beautifully designed, reliable, and multi-tenant platform that makes running a sports club feel effortless.

---

## Target Users

| User | Role | Primary needs |
|---|---|---|
| Club Administrator | Platform power user | Configure tenants, manage users, oversee all operations |
| Coordinator | Day-to-day operations | Season planning, team management, registrations |
| Trainer | Team-level operations | View schedule, manage attendance, communicate with parents |
| Vereinsleitung / Board | Governance | Meetings, decisions, initiatives, KPI oversight |
| Parent | Family representative | View team calendar, manage child attendance, receive news |
| Player | Club member | View schedule, team news, match details |
| Website Visitor | Public | View news, teams, fixtures, events, sponsor information |
| InfoBoard Viewer | On-site | Real-time pitch and schedule display at the club facility |

---

## Product Positioning

SportClubEvo is not a generic event management tool and is not a social network. It is a focused, operational club management platform.

**It is differentiated by:**

- Deep sports club domain model (seasons, pitches, dressing rooms, training squads, match day logistics)
- Multi-tenant architecture — one platform, many clubs, each fully isolated
- WebApp as operational source of truth — the public website and InfoBoard are consumers, not editors
- Premium, minimal UX — not enterprise bloatware
- Configuration over customisation — clubs configure, they do not fork

---

## MVP Definition

The SportClubEvo v1.0 MVP is defined as the point at which FC Allschwil can run its full operational lifecycle — from season planning through match day execution, parent communication, public website, and on-site InfoBoard — exclusively inside SportClubEvo, without using any external spreadsheet, email, or manual website editing workflow.

MVP is **not** defined as feature completeness across all five epics. It is defined as **FC Allschwil going live in production**.

---

## v1.0 Exit Criteria

The v1.0 release is complete when all of the following are true:

1. FC Allschwil has gone live in production.
2. All five v1.0 epics have met their acceptance criteria (see `sportclubevo-v1-master-backlog.md`).
3. The go-live readiness checklist (`02-go-live-checklist.md`) is fully checked.
4. No critical or high-severity security issues remain open.
5. Tenant isolation has been independently verified across all API routes.
6. The Admin Guide, Trainer Guide, and Coordinator Guide are written and reviewed.
7. Backup and restore procedures have been tested end-to-end.
8. The production deployment has operated stably for at least one full match day.

---

## Current Release Focus

The current active focus is **FC Allschwil Website ↔ WebApp Integration** (Epic 1), running in parallel with finalising the **Planner foundation** (Epic 2 wochenplan work already in progress).

See `01-roadmap.md` for the full agreed execution sequence.

---

## Locked Product Decisions

The following decisions are locked and are not subject to re-discussion during v1.0 development.

| Decision | Summary |
|---|---|
| Season is the leading entity | All scheduling, squad membership, and planning is anchored to a Season |
| Multi-tenant is mandatory | Every feature is built multi-tenant from its first commit |
| WebApp is the operational source of truth | The public website and InfoBoard are read-only consumers of WebApp-approved data |
| Public API must be versioned | External-facing routes follow `/api/public/v1/` versioning |
| Organisation Builder is generic | Not Vereinsleitung-specific; applies to all org unit types |
| Week Planner is resource-based | It allocates real-world resources (pitches, dressing rooms, time slots), not calendar appointments |
| One PeoplePicker across the platform | No per-module person-selection components |
| No duplicate business logic | Every formatter, validator, and business rule lives once in `lib/` |

See `05-architecture-decisions.md` for full ADR entries.

---

## Non-Negotiable Rules

These rules apply unconditionally. No exception is permitted during normal development.

1. **STAGE is the only source of truth.** Development never starts from `master`, stale local branches, or unverified state.
2. **Do not reset passwords, modify auth secrets, or change production credentials** during development or testing.
3. **Do not run bootstrap or seed scripts in production.**
4. **Every endpoint must enforce tenant-scoped, role-based permission checks server-side.**
5. **Audit logging is mandatory for all sensitive mutations** (user management, impersonation, role changes, financial operations).
6. **No tenant's data may be accessible to another tenant** — not via API, not via UI, not via query.
7. **TypeScript build and lint must pass** before any merge.

See `06-engineering-principles.md` for the full set of engineering rules.

---

## Quality Gates

Every pull request must pass all of the following before merge:

| Gate | Requirement |
|---|---|
| TypeScript build | `npm run build` exits 0 |
| Lint | `npm run lint` exits 0 with no errors |
| No new any types | TypeScript `any` usage is not introduced without explicit justification |
| Tenant safety | All new queries include `tenantId` scoping where applicable |
| Permission check | All new API routes enforce RBAC server-side |
| No hardcoded values | No tenant-specific values embedded in application code |
| Documentation | Significant new features include or update relevant docs |

---

## Relationship to the Master Backlog

This blueprint defines **what** SportClubEvo is and **why** it exists.

`sportclubevo-v1-master-backlog.md` defines the detailed **what will be built** — every feature, its status, priority, and release target.

`01-roadmap.md` defines **when** things will be built — the agreed execution sequence.

This blueprint takes precedence when there is ambiguity about product direction. The master backlog takes precedence when there is ambiguity about scope or priority of individual features.
