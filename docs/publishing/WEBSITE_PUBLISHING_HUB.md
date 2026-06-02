# MVP Website Publishing Hub
## Gap Analysis, Architecture & Roadmap

> Status: **DESIGN PHASE** — no implementation yet  
> Date: 2026-06-02  
> Author: Cloud Agent (Sonnet 4.6 High)  
> Scope: MVP Foundation — Website Publishing Hub  
> Principle: WebApp is the single source of truth. Website consumes only published content.

---

## Table of Contents

1. [Current-State Audit](#1-current-state-audit)
2. [Gap Analysis](#2-gap-analysis)
3. [Recommended Implementation Order](#3-recommended-implementation-order)
4. [MVP Website Publishing Hub Roadmap](#4-mvp-website-publishing-hub-roadmap)

---

## 1. Current-State Audit

### 1.1 Architecture Overview

The FC Allschwil platform consists of two separate Next.js deployments:

```
┌────────────────────────────────────────────────────┐
│  WebApp (single source of truth)                   │
│  webapp.fcallschwil.ch                             │
│                                                    │
│  Admin shell (NextAuth, RBAC, Workflows)           │
│  ├── Events, Teams, Seasons, People                │
│  ├── Governance (Targets, Meetings, Initiatives)   │
│  ├── Org Builder (OrgUnit, TargetGroup)            │
│  └── api/public/* ← unauthenticated JSON feeds     │
└──────────────────┬─────────────────────────────────┘
                   │ HTTP GET (no auth)
                   ▼
┌────────────────────────────────────────────────────┐
│  Website (consumer, read-only)                     │
│  www.fcallschwil.ch                                │
│                                                    │
│  Public-facing club website                        │
│  Reads data from /api/public/* only                │
└────────────────────────────────────────────────────┘
```

**Deployment matrix:** 4 Vercel projects (Website + WebApp × STAGE + PROD), each with isolated secrets and databases.

### 1.2 Existing Public API Layer

Three unauthenticated endpoints exist today:

| Endpoint | Surface | Filter Logic |
|----------|---------|--------------|
| `GET /api/public/events` | `homepage`, `wochenplan`, `trainingsplan`, `team-page`, `infoboard`, `all` | Visibility flags + EventStatus IN (SCHEDULED, LIVE, COMPLETED, POSTPONED) |
| `GET /api/public/wochenplan` | Day-grouped event calendar | Same as `wochenplan` surface |
| `GET /api/public/infoboard` | Slim event projection for digital board | `infoboardVisible = true` |

**Critical gap:** None of these endpoints filter by `reviewStage`. An event with `reviewStage = SUBMITTED` and `websiteVisible = true` is served publicly — the four-eye gate is unenforced at the delivery layer.

### 1.3 Existing Review Workflow Infrastructure

The following review infrastructure already exists and is ready for reuse:

#### ReviewWorkflowStage enum (Prisma)
```
DRAFT → SUBMITTED → APPROVED → PUBLISHED
                       ↓
                   REJECTED → DRAFT | SUBMITTED
```

Applied to: `Event`, `Target`, `Meeting`, `Initiative`, `CommunicationTemplate`

#### State machine (`lib/governance/review-stage.ts`)
- `canTransitionTo(from, to)` — validates transitions
- `canEditDraft(stage)` — DRAFT and REJECTED are editable
- `isReviewPending(stage)` — SUBMITTED awaits review
- `isPublishedLikeState(stage)` — APPROVED or PUBLISHED
- `getDefaultReviewStage(domain)` — events start at SUBMITTED

#### Four-eye enforcement (`lib/governance/four-eye.ts`)
- `assertFourEyeAllowed(actorId, entityCreatorId)` — blocks same-user approve
- Used in: Targets, Meetings, Initiatives stage API routes

#### Review policy layer (`lib/workflow/`)
- `REVIEW_POLICY.EVENTS` — mode = `REVIEW_REQUIRED`
- `EVENT_REVIEW_POLICIES` — maps actions (create, update, delete, publish_website, publish_infoboard, approve_series, reject_series) to policies
- Policy is defined but **not enforced at API runtime** — no stage transition endpoint for events exists

#### RBAC (`lib/permissions/permissions.ts`)
Publishing-relevant permissions already seeded:
- `events.publish_website` — held by `match_coordinator`, `website_publisher`
- `events.publish_infoboard` — held by `match_coordinator`
- `fixtures.publish_website`, `fixtures.publish_infoboard` — seeded, no implementation
- `news.manage` — seeded, no implementation
- `website.manage` — seeded, no implementation
- `wochenplan.manage` — seeded, no implementation
- `infoboard.manage` — seeded, no implementation

#### Workflow rule schema (`RoleWorkflowRule`, `RoleWorkflowReviewAssignment`)
- Schema exists, migration applied
- **Never seeded, never queried at runtime**
- All workflow capability checks are currently static per-role hardcode

### 1.4 Domain-by-Domain Current State

#### 1.4.1 Events (Matches, Trainings, Tournaments)

Events are the most mature domain.

**Schema:**
- `Event` model with `type = MATCH | TOURNAMENT | TRAINING | OTHER | VACATION_PERIOD`
- `reviewStage: ReviewWorkflowStage` (DRAFT default changes to SUBMITTED via `getDefaultReviewStage`)
- Full audit trail: `reviewRequestedAt`, `reviewedAt`, `publishedAt`, `reviewNotes`
- Actor tracking: `createdByUserId`, `reviewedByUserId`, `approvedByUserId`, `rejectedByUserId`, `publishedByUserId`
- Channel flags: `websiteVisible`, `infoboardVisible`, `homepageVisible`, `wochenplanVisible`, `trainingsplanVisible`, `teamPageVisible`

**Admin UI:**
- Event hub and create-by-type forms: implemented
- Import from ClubCorner / CSV: implemented
- Event planner (season/week/day views): implemented
- Wochenplan board (pitch/room allocation): implemented, publish button is a disabled stub

**API:**
- `GET/POST /api/events` — create + list with permission gate
- `POST /api/events/import` — import pipeline
- **Missing:** `PATCH /api/events/[id]`, `DELETE /api/events/[id]`, `PATCH /api/events/[id]/stage`

**Public feed:**
- `/api/public/events`, `/api/public/wochenplan`, `/api/public/infoboard` — operational
- **Bug:** Feed ignores `reviewStage` — SUBMITTED events leak publicly

**Workflow:**
- Policy layer defined in `lib/workflow/event-review-policy.ts`
- Default stage at creation is SUBMITTED (from `getDefaultReviewStage`)
- No runtime enforcement — no stage transition API exists for events

#### 1.4.2 Teams

**Schema:**
- `Team` + `TeamSeason` models with `websiteVisible`, `infoboardVisible`, `squadWebsiteVisible`, `trainerTeamWebsiteVisible` flags
- `TeamSeasonStatus: ACTIVE | INACTIVE | ARCHIVED`
- No `reviewStage` on Team or TeamSeason

**Admin UI:**
- Team CRUD and detail pages: implemented
- TeamSeason management: implemented

**API:**
- Full CRUD via `/api/teams` and `/api/teams/[teamId]/team-seasons`
- **Missing:** No public team API for website consumption

**Public feed:** None

**Workflow:** `REVIEW_REQUIRED` policy defined, not enforced

#### 1.4.3 Players

**Schema:**
- `Person` model with `isPlayer = true` flag
- `PlayerSquadMember` model: `status`, `shirtNumber`, `positionLabel`, `isCaptain`, `isViceCaptain`, `isWebsiteVisible`, `sortOrder`
- `PlayerSquadStatus: ACTIVE | INACTIVE | INJURED | ABSENT | ARCHIVED`
- No `reviewStage` on person/squad records

**Admin UI:**
- Players overview page: UI shell, passes empty array (hardcoded `[]`)
- Squad member management under team-season: implemented via separate team UI

**API:**
- Squad member CRUD via `/api/teams/[teamId]/team-seasons/[teamSeasonId]/squad-members`
- **Missing:** No standalone `/api/players`, no public player/squad API

**Public feed:** None

**Workflow:** None

#### 1.4.4 Trainers

**Schema:**
- `Person` model with `isTrainer = true` flag
- `TrainerTeamMember` model: `status`, `roleLabel`, `isWebsiteVisible`, `sortOrder`
- `TrainerTeamStatus: ACTIVE | INACTIVE | ARCHIVED`
- No `reviewStage` on person/trainer records

**Admin UI:**
- Trainers overview page: UI shell, passes empty array
- Trainer management under team-season: implemented

**API:**
- Trainer member CRUD via `/api/teams/[teamId]/team-seasons/[teamSeasonId]/trainer-members`
- **Missing:** No standalone `/api/trainers`, no public trainer API

**Public feed:** None

**Workflow:** None

#### 1.4.5 News

**Schema:** No `News` model exists. Only the `PermissionModule.NEWS` enum value and `news.manage` permission are present.

**Admin UI:** None

**API:** None

**Public feed:** None

**Workflow:** `WorkflowDomain.NEWS` enum exists, no policy, no implementation

#### 1.4.6 Wochenplan

**Schema:**
- Not a separate model — implemented as a view over `Event` records with `wochenplanVisible = true`
- Conflict engine exists in `lib/wochenplan/conflict-engine.ts`

**Admin UI:**
- Wochenplan board with pitch/room allocation grid: implemented
- `WochenplanPublishBar`: UI button present, wired to nothing

**API:**
- `/api/public/wochenplan` — public grouped feed, operational
- **Missing:** Publish action endpoint; admin board reads events but cannot trigger bulk publish/unpublish

**Workflow:** None at publish layer; event-level `wochenplanVisible` flag is set on individual events

#### 1.4.7 Tournaments

Tournaments are a subset of the Events domain (`EventType.TOURNAMENT`).

**Status:** Same as Events — schema, admin UI, and import pipeline implemented; no stage transition API; public feed does not enforce `reviewStage`.

#### 1.4.8 Matches

Matches are a subset of the Events domain (`EventType.MATCH`).

**Status:** Same as Events. ClubCorner / FVNWS import is the primary source for match schedules. Editability rules exist in `lib/events/editability-rules.ts` to prevent editing imported matches without override.

#### 1.4.9 Trainings

Trainings are a subset of the Events domain (`EventType.TRAINING`).

**Status:** Same as Events. Recurring training series creation and approval are represented in policy layer (`approve_series`, `reject_series` actions in `EVENT_REVIEW_POLICIES`) but no API endpoint implements batch series approval.

---

## 2. Gap Analysis

### 2.1 Summary Matrix

| Domain | Schema | Admin UI | Admin API (CRUD) | Stage API | Public Feed | Workflow Gate | Overall |
|--------|--------|----------|-----------------|-----------|-------------|---------------|---------|
| **News** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **Missing** |
| **Events** (all types) | ✅ | ✅ | ⚠️ Partial | ❌ | ✅ Exists but leaks drafts | ⚠️ Policy only | **Partially implemented** |
| **Matches** | ✅ | ✅ | ⚠️ Via events | ❌ | ✅ Leaks | ⚠️ Policy only | **Partially implemented** |
| **Trainings** | ✅ | ✅ | ⚠️ Via events | ❌ | ✅ Leaks | ⚠️ Policy only | **Partially implemented** |
| **Tournaments** | ✅ | ✅ | ⚠️ Via events | ❌ | ✅ Leaks | ⚠️ Policy only | **Partially implemented** |
| **Wochenplan** | ✅ (view) | ✅ Stub publish | ⚠️ Via events | ❌ | ✅ Leaks | ❌ None | **Partially implemented** |
| **Teams** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | **Partially implemented** |
| **Players** | ✅ | ⚠️ Empty shell | ⚠️ Via squad | ❌ | ❌ | ❌ | **Partially implemented** |
| **Trainers** | ✅ | ⚠️ Empty shell | ⚠️ Via trainers | ❌ | ❌ | ❌ | **Partially implemented** |

### 2.2 Detailed Gap Analysis

#### GAP-01: Public feeds do not enforce `reviewStage`

**Severity:** Critical  
**Affects:** Events, Matches, Trainings, Tournaments, Wochenplan  
**Current behaviour:** `getPublicEvents()` in `lib/events/public-event-feed.ts` filters by `websiteVisible = true` and `EventStatus`, but has no `reviewStage` filter. Any event that gets `websiteVisible = true` regardless of whether it has been reviewed is served to the public website.  
**Required fix:** Add `reviewStage: ReviewWorkflowStage.PUBLISHED` filter to all public feed queries. This is a single-line change but has high impact.

#### GAP-02: No event stage transition API

**Severity:** Critical  
**Affects:** Events, Matches, Trainings, Tournaments, Wochenplan  
**Current behaviour:** Events are created with `reviewStage = SUBMITTED` (from `getDefaultReviewStage`) but there is no `PATCH /api/events/[id]/stage` endpoint. The state machine exists but is unreachable from the API layer.  
**Required fix:** Implement `PATCH /api/events/[id]/stage` following the pattern of `PATCH /api/targets/[id]/stage`. Enforce four-eye principle: the reviewer must differ from the creator.

#### GAP-03: No event edit or delete API

**Severity:** High  
**Affects:** Events, Matches, Trainings, Tournaments  
**Current behaviour:** `POST /api/events` creates events. No `PATCH /api/events/[id]` or `DELETE /api/events/[id]` exists. Edits go through server actions in the planner, bypassing the review workflow.  
**Required fix:** Implement `PATCH /api/events/[id]` that resets `reviewStage` to DRAFT (or SUBMITTED if direct-manage is allowed) and `DELETE /api/events/[id]` with appropriate permission checks.

#### GAP-04: Wochenplan publish button is a non-functional stub

**Severity:** High  
**Affects:** Wochenplan  
**Current behaviour:** `WochenplanPublishBar` renders a "Für Website & Infoboard publizieren" button that is disabled with no server action connected.  
**Required fix:** Wire the button to a server action or API call that bulk-sets `wochenplanVisible = true` and triggers the stage workflow for all events in the selected date range.

#### GAP-05: No public API for Teams, Players, Trainers

**Severity:** High  
**Affects:** Teams, Players, Trainers  
**Current behaviour:** `Team.websiteVisible`, `PlayerSquadMember.isWebsiteVisible`, `TrainerTeamMember.isWebsiteVisible` flags exist but no public endpoints serve this data to the website.  
**Required fix:** Implement:
- `GET /api/public/teams` — list of active, website-visible teams for current season
- `GET /api/public/teams/[slug]` — team detail with squad and trainer roster
- `GET /api/public/teams/[slug]/squad` — player squad for team/season
- `GET /api/public/teams/[slug]/trainers` — trainer list for team/season

#### GAP-06: Players and Trainers overview pages show empty data

**Severity:** Medium  
**Affects:** Players, Trainers  
**Current behaviour:** `/dashboard/players` and `/dashboard/trainers` pages have UI components but pass hardcoded empty arrays. No data loading logic is wired.  
**Required fix:** Connect pages to existing `lib/teams/team-squad-queries.ts` and equivalent trainer queries. Add pagination and filtering by team/season.

#### GAP-07: No News domain exists

**Severity:** High  
**Affects:** News  
**Current behaviour:** Only `PermissionModule.NEWS`, `WorkflowDomain.NEWS`, and `news.manage` permission exist. No `News` Prisma model, no admin UI, no API, no public feed.  
**Required fix:** Full domain implementation required:
1. `News` Prisma model (see schema design in Section 4)
2. Admin CRUD API (`/api/news`)
3. Stage transition API (`/api/news/[id]/stage`)
4. Admin UI (list + editor)
5. Public feed (`/api/public/news`)

#### GAP-08: `RoleWorkflowRule` schema is unused

**Severity:** Medium (architectural debt)  
**Affects:** All domains  
**Current behaviour:** `RoleWorkflowRule` and `RoleWorkflowReviewAssignment` tables exist with correct schema but are never seeded or queried. All workflow capability decisions are hardcoded in static policy files.  
**Note:** This is a deliberate Phase 1 decision (noted in `lib/governance/review-stage.ts` TODOs). For MVP, static policy enforcement is acceptable. Dynamic rule evaluation from DB is Phase 2.

#### GAP-09: Wochenplan has no workflow — visibility flags are set directly

**Severity:** Medium  
**Affects:** Wochenplan  
**Current behaviour:** Individual events have `wochenplanVisible` flags set at create time or via planner. There is no bulk publish workflow for the weekly plan as a whole.  
**Required fix:** Decide whether Wochenplan publishing is: (a) a per-event flag managed via the event review workflow, or (b) a batch publish action that marks a set of events as wochenplan-visible after review. Option (b) aligns better with operational reality (trainers submit their week's plan for coordinator review).

#### GAP-10: No `publishedAt` guard separates APPROVED from PUBLISHED

**Severity:** Medium  
**Affects:** Events and all future domains  
**Current behaviour:** `ReviewWorkflowStage.PUBLISHED` exists but the public feed does not require it — only `websiteVisible = true` is checked. `publishedAt` field exists on `Event` but is not populated or used.  
**Required fix:** The PUBLISHED state should be the single gate for public visibility. The `publishedAt` timestamp should be set when `reviewStage` transitions to PUBLISHED.

#### GAP-11: No `reviewStage` on Teams, Players, Trainers

**Severity:** Low for MVP  
**Affects:** Teams, Players, Trainers  
**Current behaviour:** These entities have `websiteVisible` / `isWebsiteVisible` flags but no formal review workflow. Changes to team rosters go live immediately.  
**MVP approach:** Add `reviewStage` to `TeamSeason`, `PlayerSquadMember`, and `TrainerTeamMember` in a future sprint. For MVP, the `websiteVisible` flag acts as a manual publish gate. A trusted admin sets the flag; no formal four-eye review is required for MVP.

#### GAP-12: No rich content fields on Team/Player/Trainer for website display

**Severity:** Low for MVP  
**Affects:** Teams, Players, Trainers  
**Current behaviour:** `Team` has `name`, `slug`, `category`, `genderGroup`, `ageGroup`. No bio, image URL, or extended profile fields exist.  
**MVP approach:** Serve what exists. Image and bio fields can be added in a post-MVP sprint without schema breakage.

---

## 3. Recommended Implementation Order

The implementation order is driven by three priorities:

1. **Fix the security/consistency bug first** — public feeds must not leak unreviewed content
2. **Close the event workflow loop** — events are the most used domain and the furthest along
3. **Add missing public API surfaces** — team/player/trainer feeds unlock the website's team pages

### 3.1 Priority Ranking

| Priority | Item | Rationale |
|----------|------|-----------|
| P0 | Fix public feed `reviewStage` filter | Security/consistency bug. Single-line fix, high impact. |
| P0 | Event stage transition API | Completes the four-eye workflow for the primary domain. |
| P1 | Event edit/delete API | Closes the CRUD loop for events. |
| P1 | Wochenplan publish wire-up | Activates the existing stub; high operational visibility. |
| P1 | Public Teams API | Unlocks team pages on website. Low schema risk. |
| P2 | Public Squad/Trainer APIs | Completes team page content. |
| P2 | Players/Trainers admin pages | Fixes empty-data bug in admin. |
| P2 | News domain — schema + API | New domain; highest website content value. |
| P3 | News admin UI | Depends on schema + API. |
| P3 | News public feed | Depends on admin + workflow. |
| P3 | `reviewStage` on Teams/Players/Trainers | Formal workflow for roster changes. |
| P4 | `RoleWorkflowRule` runtime activation | Dynamic workflow rules from DB. Phase 2. |
| P4 | Batch series approval API | Completes training series workflow. |

### 3.2 Dependency Graph

```
P0: Fix reviewStage filter (no dependencies)
P0: Event stage API (no dependencies)
    ↓
P1: Event edit/delete API
P1: Wochenplan publish (depends on: event stage API)
    ↓
P1: Public Teams API (no dependencies)
    ↓
P2: Public Squad/Trainer APIs (depends on: public teams API)
P2: Players/Trainers admin fix (no hard dependencies)
    ↓
P2: News schema + API (no dependencies; new domain)
    ↓
P3: News admin UI (depends on: news schema + API)
P3: News public feed (depends on: news schema + API)
```

---

## 4. MVP Website Publishing Hub Roadmap

### 4.1 Architecture Principles

1. **WebApp is the single source of truth.** No content lives on the website repo. All data originates from the WebApp database.
2. **Website consumes only published content.** Public API endpoints filter exclusively on `reviewStage = PUBLISHED`. No draft or submitted content is ever served.
3. **Draft / Review / Published lifecycle is mandatory.** Every publishable entity must pass through the `ReviewWorkflowStage` state machine before reaching the public feed.
4. **Four-eye workflow is enforced.** The actor who creates or submits content cannot be the same actor who approves it (enforced by `assertFourEyeAllowed()`).
5. **RBAC is reused without modification.** Existing `events.publish_website`, `news.manage`, `website.manage` permissions are assigned to appropriate roles. No new permission model is introduced for MVP.
6. **White-label readiness.** No FC Allschwil–specific hardcoding in the publishing layer. All publishing flows operate on `tenantId`-scoped data. Future ClubEvo white-labelling requires only environment variable changes, not code changes.

### 4.2 Publishing Hub Module Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  WebApp — Publishing Hub                                        │
│                                                                 │
│  /dashboard/publishing/                                         │
│  ├── overview          ← all pending reviews across domains     │
│  ├── events/           ← event stage queue (match/train/tourn.) │
│  ├── news/             ← news article editor + stage queue      │
│  ├── teams/            ← team/squad website visibility control  │
│  └── wochenplan/       ← weekly plan publish control            │
│                                                                 │
│  API layer                                                      │
│  ├── /api/events/[id]/stage    ← four-eye stage transition      │
│  ├── /api/news                 ← news CRUD                      │
│  ├── /api/news/[id]/stage      ← news four-eye transition       │
│  └── /api/public/*             ← website-facing feeds           │
│      ├── /api/public/events    ← PUBLISHED events only          │
│      ├── /api/public/news      ← PUBLISHED news only            │
│      ├── /api/public/teams     ← websiteVisible teams           │
│      ├── /api/public/teams/[slug]/squad                         │
│      └── /api/public/wochenplan ← PUBLISHED wochenplan events   │
│                                                                 │
│  Workflow engine                                                │
│  ├── lib/governance/review-stage.ts    ← existing state machine│
│  ├── lib/governance/four-eye.ts        ← existing four-eye      │
│  └── lib/workflow/event-review-policy.ts ← existing policies   │
└─────────────────────────────────────────────────────────────────┘
           │ JSON over HTTP (no auth)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Website — Content Consumer                                     │
│  www.fcallschwil.ch                                             │
│                                                                 │
│  Pages: Home, Matches, Trainings, Teams, News, Wochenplan      │
│  Data source: /api/public/* only                               │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow: Content Lifecycle

```
Creator                  Reviewer                 Website
   │                        │                        │
   │  create/edit            │                        │
   ├─────────────────────►  │                        │
   │  reviewStage=SUBMITTED  │                        │
   │                         │  review + approve      │
   │                         ├───────────────────►   │
   │                         │  reviewStage=APPROVED  │
   │                         │                        │
   │                         │  publish to website    │
   │                         ├───────────────────►   │
   │                         │  reviewStage=PUBLISHED │
   │                         │  publishedAt=now()     │
   │                         │                        │  GET /api/public/*
   │                         │                        │  (reviewStage=PUBLISHED)
   │                         │                        ├──────────────
   │                         │                        │  ← content delivered
```

Four-eye enforcement: the actor who approves must differ from the actor who created/submitted. Implemented by `assertFourEyeAllowed(actorId, entity.createdByUserId)`.

### 4.4 Sprint 1 — Public Feed Security Fix (P0)

**Goal:** Ensure no unreviewed content reaches the public website.

**Changes required:**

**`lib/events/public-event-feed.ts`**
```typescript
// Add to the WHERE clause in getPublicEvents():
reviewStage: ReviewWorkflowStage.PUBLISHED,
```

This single change immediately closes GAP-01 and GAP-10. All three public feeds (`/api/public/events`, `/api/public/wochenplan`, `/api/public/infoboard`) inherit this fix because they call `getPublicEvents()`.

**Side effect:** Any existing events that have `websiteVisible = true` but `reviewStage != PUBLISHED` will disappear from the public feed. This is the correct behaviour — the database needs a one-time migration step to set `reviewStage = PUBLISHED` on events that were already live before this fix. A migration script must be provided alongside this change.

**Migration script (one-time):**
```sql
-- Mark all currently-visible, scheduled events as PUBLISHED
-- so the website is not broken immediately after deploy.
UPDATE "Event"
SET "reviewStage" = 'PUBLISHED', "publishedAt" = NOW()
WHERE "websiteVisible" = true
  AND "status" IN ('SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED')
  AND "reviewStage" != 'PUBLISHED';
```

**Prisma migration:** Not required (schema change is additive; no DDL change for this fix).

### 4.5 Sprint 2 — Event Stage Transition API (P0)

**Goal:** Implement four-eye publish workflow for events.

**New route:** `PATCH /api/events/[id]/stage`

**Request body:**
```typescript
{
  stage: ReviewWorkflowStage; // target stage
  reviewNotes?: string;
}
```

**Enforcement logic (following `PATCH /api/targets/[id]/stage` pattern):**
1. `requireApiPermission` — check `events.publish_website` or `events.manage`
2. Load event; check `canTransitionTo(event.reviewStage, targetStage)`
3. For APPROVED/REJECTED transitions: `assertFourEyeAllowed(actorId, event.createdByUserId)`
4. For PUBLISHED transition: check actor has `events.publish_website`
5. Update `reviewStage`, set audit timestamps (`reviewedAt`, `approvedByUserId`, `publishedAt`, etc.)
6. Write to `AuditLog`

**Stage permissions matrix:**

| From | To | Required permission |
|------|----|---------------------|
| DRAFT | SUBMITTED | `events.manage` |
| SUBMITTED | APPROVED | `events.publish_website` (and not creator) |
| SUBMITTED | REJECTED | `events.publish_website` |
| SUBMITTED | DRAFT | `events.manage` or `events.publish_website` |
| APPROVED | PUBLISHED | `events.publish_website` |
| APPROVED | REJECTED | `events.publish_website` |
| REJECTED | DRAFT | `events.manage` |
| REJECTED | SUBMITTED | `events.manage` |

**Admin UI additions:**
- Stage badge on event list rows and event detail pages
- "Submit for Review" button for DRAFT events (creators)
- "Approve" / "Reject" action buttons for SUBMITTED events (reviewers, not same actor)
- "Publish to Website" button for APPROVED events (publishers)
- Review notes textarea on rejection
- Stage history timeline (via AuditLog)

### 4.6 Sprint 3 — Event Edit/Delete API + Wochenplan Publish (P1)

**Goal:** Close the event CRUD loop and activate the Wochenplan publish button.

**New routes:**
- `PATCH /api/events/[id]` — edit event; resets `reviewStage` to DRAFT
- `DELETE /api/events/[id]` — soft delete (sets `status = ARCHIVED`)

**Wochenplan publish action:**
`POST /api/wochenplan/publish` (or server action)

Logic:
1. Requires `wochenplan.manage` permission
2. Accept `{ weekStart: string, weekEnd: string }` date range
3. Find all events in range with `wochenplanVisible = true` and `reviewStage = APPROVED`
4. Transition each to PUBLISHED (batch DB update with `publishedAt = now()`)
5. Return count of published events

**WochenplanPublishBar update:**
- Connect button to the publish action
- Show a confirmation dialog listing how many events will be published
- Display success/error toast

### 4.7 Sprint 4 — Public Teams API (P1)

**Goal:** Expose team data to the website.

**New public endpoints:**

`GET /api/public/teams`
```typescript
// Query params: seasonKey?, category?
// Returns: teams where websiteVisible=true, ordered by sortOrder
[{
  id, name, slug, category, genderGroup, ageGroup,
  season: { key, name },
  trainerCount: number, // count of visible trainers
}]
```

`GET /api/public/teams/[slug]`
```typescript
// Returns: full team detail for website team page
{
  id, name, slug, category, genderGroup, ageGroup,
  season: { key, name },
  squad: [{
    id, firstName, lastName, displayName,
    shirtNumber, positionLabel, isCaptain, isViceCaptain,
    sortOrder,
  }], // isWebsiteVisible=true, status=ACTIVE
  trainers: [{
    id, firstName, lastName, displayName,
    roleLabel, sortOrder,
  }], // isWebsiteVisible=true, status=ACTIVE
}
```

**Implementation notes:**
- No `reviewStage` filter needed for Teams in MVP — `websiteVisible` flag is the publish gate
- Trainer/player visibility is controlled by `isWebsiteVisible` flag on the membership record
- Future: add `reviewStage` to `TeamSeason` and filter on PUBLISHED here

### 4.8 Sprint 5 — News Domain (P2)

**Goal:** Implement the complete News domain from schema to public feed.

#### 4.8.1 Prisma Schema Addition

```prisma
enum NewsStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum NewsCategory {
  CLUB_NEWS        // Vereinsnews
  MATCH_REPORT     // Spielbericht
  TOURNAMENT_REPORT // Turnierbericht
  TRAINING_UPDATE  // Trainingsinfo
  ANNOUNCEMENT     // Ankündigung
  PRESS_RELEASE    // Medienmitteilung
  OTHER
}

model News {
  id          String       @id @default(cuid())
  slug        String       @unique
  title       String
  summary     String?
  bodyMarkdown String
  category    NewsCategory @default(CLUB_NEWS)
  status      NewsStatus   @default(DRAFT)
  imageUrl    String?
  tags        Json?        // string[] as JSON

  // Publish workflow (reuses ReviewWorkflowStage)
  reviewStage           ReviewWorkflowStage @default(DRAFT)
  requiresFourEyeReview Boolean             @default(true)
  reviewNotes           String?
  reviewRequestedAt     DateTime?
  reviewedAt            DateTime?
  publishedAt           DateTime?

  // Actor tracking
  createdByUserId   String?
  reviewedByUserId  String?
  approvedByUserId  String?
  publishedByUserId String?

  // Website visibility
  websiteVisible Boolean @default(false)
  homepageVisible Boolean @default(false)

  // Related content
  linkedEventRefs Json?   // [{id, title, type}]
  linkedTeamRefs  Json?   // [{slug, name}]

  // SEO
  metaTitle       String?
  metaDescription String?

  publishedFrom DateTime?  // scheduled publish date
  expiresAt     DateTime?  // auto-archive after date

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([reviewStage])
  @@index([category])
  @@index([publishedAt])
  @@index([websiteVisible])
  @@index([homepageVisible])
  @@index([publishedFrom])
  @@index([expiresAt])
  @@index([slug])
}
```

**Prisma migration:** Safe `CREATE TABLE` + `CREATE TYPE` migration. No existing tables are altered.

#### 4.8.2 Admin API

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/news` | `news.manage` |
| POST | `/api/news` | `news.manage` |
| GET | `/api/news/[id]` | `news.manage` |
| PATCH | `/api/news/[id]` | `news.manage` |
| DELETE | `/api/news/[id]` | `news.manage` (soft delete → ARCHIVED) |
| PATCH | `/api/news/[id]/stage` | `news.manage` (submit/reject) or `website.manage` (approve/publish) |

#### 4.8.3 Public Feed

`GET /api/public/news`
```typescript
// Query params: category?, limit?, dateFrom?, dateTo?, homepageOnly?
// Filter: reviewStage=PUBLISHED, websiteVisible=true, status=PUBLISHED
[{
  id, slug, title, summary, category,
  imageUrl, tags,
  publishedAt,
  linkedTeamRefs,
}]
```

`GET /api/public/news/[slug]`
```typescript
// Full article for news detail page
{
  id, slug, title, summary, bodyMarkdown, category,
  imageUrl, tags,
  publishedAt, publishedFrom, expiresAt,
  linkedEventRefs, linkedTeamRefs,
  metaTitle, metaDescription,
}
```

#### 4.8.4 Permissions Extension

Add to `PERMISSIONS` in `lib/permissions/permissions.ts`:
```typescript
NEWS_SUBMIT: "news.submit",        // for roles that can create + submit
NEWS_REVIEW: "news.review",        // for roles that can approve/reject
NEWS_PUBLISH: "news.publish",      // for roles that can publish to website
```

Assign to seed roles:
- `website_publisher`: `news.manage`, `news.submit`, `news.review`, `news.publish`
- `super_admin`: all (already inherits all permissions)

#### 4.8.5 Admin UI

- `/dashboard/news` — article list with stage badges and filter by stage/category
- `/dashboard/news/new` — article creation form (title, summary, body (markdown editor), category, image URL, linked teams/events)
- `/dashboard/news/[id]` — article detail with stage action buttons
- Stage queue widget on Publishing Hub overview page

### 4.9 Sprint 6 — Publishing Hub Overview Page (P3)

**Goal:** Central publishing control room for the `website_publisher` role.

**Route:** `/dashboard/publishing`

**Features:**
- Pending review queue: events, news articles awaiting SUBMITTED → APPROVED action
- Recent publishes timeline: last 20 items published across all domains
- Domain status cards: count of DRAFT / SUBMITTED / APPROVED / PUBLISHED per domain
- Quick-publish actions: Approve + Publish in one click for `website_publisher`
- Wochenplan status widget: current week events count by stage

**RBAC:** Only visible to users with `website.manage` or `events.publish_website` or `news.publish`

### 4.10 Prisma Schema Additions Summary

For MVP, the only new Prisma model required is `News`. All other domains already have the schema fields needed.

**Migration plan:**

| Migration | Type | Tables affected | Risk |
|-----------|------|-----------------|------|
| `add_news_model` | CREATE TABLE + CREATE TYPE | `News`, `NewsStatus`, `NewsCategory` | None — additive only |
| (data migration) | UPDATE | `Event` | Low — backfill `reviewStage=PUBLISHED` for live events |

No breaking schema changes to existing models are needed for MVP.

### 4.11 RBAC Additions

Extend the `website_publisher` role seed with:
```typescript
{
  key: "website_publisher",
  permissionKeys: [
    // existing
    "seasons.view",
    "events.view",
    "events.import",
    "events.publish_website",
    "fixtures.view",
    "fixtures.publish_website",
    "news.manage",
    "website.manage",
    // new for MVP
    "wochenplan.manage",    // to publish weekly plans
    "teams.view",           // to manage team visibility
  ],
}
```

### 4.12 White-Label (ClubEvo) Alignment

The publishing architecture is already white-label ready at the schema level:

1. **No tenant-specific hardcoding** in publishing logic — all queries use `seasonId` and `teamId` scoped to the active season.
2. **`Tenant` model exists** but publishing logic does not reference it directly. Future: add `tenantId` to `News` for multi-tenant news isolation.
3. **Permission keys are generic** (`news.manage`, `website.manage`) — not FC Allschwil specific.
4. **Public API contract is stable** — website consumers call `/api/public/*`; the URL structure and response shapes do not need to change for white-labelling. Only the `APP_BASE_URL` environment variable changes per tenant.
5. **`PermissionModule.WEBSITE` and `WorkflowDomain.WEBSITE`** are already generic enum values.

Future ClubEvo migration path:
1. Add `tenantId` to `News`, `Event`, and other content models
2. Add `X-Tenant-Id` or subdomain-based tenant resolution middleware
3. Scope all public feed queries by `tenantId`
4. Each club gets its own `/api/public/*` feed at their subdomain

This is a Phase 2 concern and requires no changes to the MVP architecture.

---

## 5. Complete Roadmap Table

| Sprint | Items | Complexity | Blockers |
|--------|-------|------------|----------|
| **S1: Security Fix** | GAP-01: reviewStage filter on public feeds + data migration script | Low | None |
| **S2: Event Workflow** | GAP-02: `PATCH /api/events/[id]/stage`; GAP-03: `PATCH/DELETE /api/events/[id]`; stage UI in admin | Medium | S1 must deploy first |
| **S3: Wochenplan + Teams** | GAP-04: Wochenplan publish wire-up; GAP-05: `/api/public/teams` + `/api/public/teams/[slug]` | Medium | S2 (for wochenplan) |
| **S4: Admin Fixes** | GAP-06: Fix Players/Trainers empty pages; improve event list with stage badges | Low | None |
| **S5: News Domain** | GAP-07: Full News domain (schema, API, admin UI, public feed) | High | None (parallel to S3/S4) |
| **S6: Publishing Hub** | Publishing overview page; stage queues; domain status cards | Medium | S2, S5 |
| **S7: Team Workflow** | GAP-11: Add `reviewStage` to TeamSeason; formal team publish workflow | Medium | S6 |
| **S8: Workflow Rules** | GAP-08: Activate `RoleWorkflowRule` runtime queries; migrate static policies to DB | High | S7 |

---

## 6. Appendix: Files to Create / Modify

### New files

| File | Purpose |
|------|---------|
| `app/api/events/[id]/stage/route.ts` | Event stage transition endpoint |
| `app/api/events/[id]/route.ts` | Event edit/delete endpoint |
| `app/api/news/route.ts` | News list + create |
| `app/api/news/[id]/route.ts` | News detail + edit + delete |
| `app/api/news/[id]/stage/route.ts` | News stage transition |
| `app/api/public/teams/route.ts` | Public teams feed |
| `app/api/public/teams/[slug]/route.ts` | Public team detail |
| `app/api/public/news/route.ts` | Public news feed |
| `app/api/public/news/[slug]/route.ts` | Public news article |
| `app/api/wochenplan/publish/route.ts` | Wochenplan bulk publish |
| `lib/news/queries.ts` | News query helpers |
| `lib/news/public-news-feed.ts` | Public news feed builder |
| `lib/events/stage-transitions.ts` | Event stage transition logic |
| `components/admin/news/NewsList.tsx` | News admin list |
| `components/admin/news/NewsEditor.tsx` | News markdown editor |
| `components/admin/news/NewsStageActions.tsx` | Stage action buttons |
| `components/admin/publishing/PublishingOverview.tsx` | Hub overview page |
| `prisma/migrations/[timestamp]_add_news_model/` | News schema migration |
| `scripts/backfill-event-published-stage.ts` | One-time data migration |
| `docs/publishing/WEBSITE_PUBLISHING_HUB.md` | This document |

### Modified files

| File | Change |
|------|--------|
| `lib/events/public-event-feed.ts` | Add `reviewStage: PUBLISHED` to WHERE clause |
| `lib/permissions/permissions.ts` | Add `NEWS_SUBMIT`, `NEWS_REVIEW`, `NEWS_PUBLISH` |
| `prisma/seed.ts` | Add news permissions to roles; extend `website_publisher` |
| `prisma/schema.prisma` | Add `News` model + enums |
| `lib/workflow/review-policy.ts` | Add NEWS domain to `ReviewTargetDomain` + `REVIEW_POLICY.NEWS` |
| `components/admin/wochenplan/WochenplanPublishBar.tsx` | Wire publish button to server action |
| `app/(admin)/dashboard/players/page.tsx` | Replace hardcoded `[]` with real query |
| `app/(admin)/dashboard/trainers/page.tsx` | Replace hardcoded `[]` with real query |
| `lib/nav/nav-config.ts` | Add Publishing Hub nav section |
| `app/(admin)/dashboard/page.tsx` | Add Publishing Hub module card |

---

*This document is the authoritative design reference for the MVP Website Publishing Hub. Implementation should proceed sprint-by-sprint in the order defined in Section 3. Each sprint must be reviewed and merged before the next begins to avoid workflow state conflicts.*
