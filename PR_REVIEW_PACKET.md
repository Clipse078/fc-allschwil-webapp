# PR Review Packet — SportClubEvo WebApp

> **Purpose:** Structured review packet for all 4 open draft PRs, intended for external review (e.g. ChatGPT).
> Generated from actual `git diff`, `git log`, and file inspection — no synthetic data.

---

## Table of Contents

1. [PR #9 — Targets Module](#pr-9--targets-module)
2. [PR #10 — Governance Foundation](#pr-10--governance-foundation)
3. [PR #11 — Cross-Module Linking](#pr-11--cross-module-linking)
4. [PR #12 — Meetings DB Promotion](#pr-12--meetings-db-promotion)
5. [Combined: Migration Order](#combined-migration-order)
6. [Combined: Prisma Schema Risk Review](#combined-prisma-schema-risk-review)
7. [Combined: Route Conflict Review](#combined-route-conflict-review)
8. [Combined: Permission Conflict Review](#combined-permission-conflict-review)
9. [Recommended Merge Order](#recommended-merge-order)

---

## PR #9 — Targets Module

| Field | Value |
|-------|-------|
| **PR number** | #9 |
| **Title** | feat(targets): Targets Progress Tracking + Curated Template Catalog |
| **Branch** | `cursor/targets-progress-templates-a008` |
| **Base branch** | `master` |
| **State** | Open (Draft) |
| **Commits** | 1 (`44a1c38`) |
| **Build** | ✅ Pass — 51 routes, 0 errors |
| **Lint** | ✅ 0 errors, 3 pre-existing warnings |

### Purpose

Introduces the Targets strategic intelligence module from scratch: DB-backed `Target`, `TargetMetric`, and `TargetDataPoint` models; full CRUD API; progress-tracking UI with direction-aware progress bars; a 13-template curated catalog; inline data-point recording on the detail page.

### Changed Files Summary

**New files (14):**
```
app/(admin)/vereinsleitung/targets/[id]/edit/page.tsx
app/(admin)/vereinsleitung/targets/[id]/page.tsx
app/(admin)/vereinsleitung/targets/new/page.tsx
app/(admin)/vereinsleitung/targets/page.tsx
app/api/targets/[id]/metrics/[metricId]/datapoints/route.ts
app/api/targets/[id]/route.ts
app/api/targets/route.ts
components/admin/targets/TargetDataPointForm.tsx
components/admin/targets/TargetForm.tsx
components/admin/targets/TargetMetricProgress.tsx
components/admin/targets/TargetNewPageClient.tsx
components/admin/targets/TargetTemplateSuggestions.tsx
lib/targets/queries.ts
lib/targets/templates.ts
```

**Modified files (9):**
```
components/admin/layout/AdminPageHeader.tsx  — adds /targets/* route headers
components/admin/layout/AdminSidebar.tsx     — adds "Ziele" nav item + Target icon
components/admin/vereinsleitung/VereinsleitungGoalsCard.tsx  — links to /targets
components/admin/vereinsleitung/VereinsleitungKpiCard.tsx    — adds TODO comment
lib/permissions/get-visible-admin-nav.ts     — adds Ziele nav entry
lib/permissions/permissions.ts              — adds TARGETS_VIEW, TARGETS_MANAGE
package-lock.json                           — net −108 lines (lock cleanup, no new deps)
prisma/schema.prisma                        — see Prisma changes below
prisma/migrations/20260518120000_add_targets_module/migration.sql
```

### Migration Files

**`prisma/migrations/20260518120000_add_targets_module/migration.sql`**

```sql
-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS';

-- CreateEnum: TargetCategory, TargetStatus, TargetPeriod, TargetMetricType, TargetDirection

-- CreateTable: Target (id, title, description, category, status, period,
--   periodLabel, moduleKey, sportCategory, ageGroupHint, startsAt, endsAt,
--   nudgeJson, createdAt, updatedAt)
-- CreateTable: TargetMetric (id, targetId FK→Target CASCADE, label, type,
--   direction, targetValue, currentValue, unit, notes, sortOrder, timestamps)
-- CreateTable: TargetDataPoint (id, metricId FK→TargetMetric CASCADE,
--   value, note, measuredAt, createdAt)
-- Indexes: category, status, period on Target; targetId+sortOrder on TargetMetric;
--   metricId, measuredAt on TargetDataPoint
-- FKs: TargetMetric→Target (CASCADE), TargetDataPoint→TargetMetric (CASCADE)
```

### Prisma Schema Changes

- **`PermissionModule` enum**: +`TARGETS`
- **New enums**: `TargetCategory` (6 values), `TargetStatus` (5), `TargetPeriod` (4), `TargetMetricType` (4), `TargetDirection` (3)
- **New models**: `Target`, `TargetMetric`, `TargetDataPoint`
- No existing models altered.

### API Route Changes

| Method | Route | New/Mod |
|--------|-------|---------|
| GET, POST | `/api/targets` | New |
| GET, PUT, DELETE | `/api/targets/[id]` | New |
| POST | `/api/targets/[id]/metrics/[metricId]/datapoints` | New |

Auth: session-only (no permission key enforcement at API level — consistent with Vereinsleitung pattern).

### Page/Route Changes

| Route | Type | Change |
|-------|------|--------|
| `/vereinsleitung/targets` | Server page | New |
| `/vereinsleitung/targets/new` | Server + client | New |
| `/vereinsleitung/targets/[id]` | Server page | New |
| `/vereinsleitung/targets/[id]/edit` | Server page | New |

`AdminPageHeader.tsx` and `AdminSidebar.tsx` modified to handle `/targets/*` routes. "Ziele" added to `ADMIN_NAV_ITEMS` as a Vereinsleitung child.

### Permission Changes

`lib/permissions/permissions.ts`:
```ts
TARGETS_VIEW: "targets.view",
TARGETS_MANAGE: "targets.manage",
```
Constants defined but **not enforced** on API endpoints (phase 1 pattern). No `PermissionModule` DB records seeded.

### Package / Package-Lock Changes

- `package.json`: **unchanged**
- `package-lock.json`: net −108 lines. No new runtime or dev dependencies. Lock file re-normalized during `npm install --ignore-scripts` run in the agent environment.

### Known Risks

1. **`ALTER TYPE "PermissionModule" ADD VALUE 'TARGETS'`**: In PostgreSQL, `ALTER TYPE ... ADD VALUE` cannot run inside a transaction. If the migration runner wraps in a transaction, this will fail. Mitigation: wrap in `BEGIN; ... COMMIT;` or use `--no-transaction` flag in `prisma migrate deploy`. Same risk applies to PR #10's `WorkflowDomain` additions.
2. **`currentValue` denormalization**: `POST /api/targets/[id]/metrics/[metricId]/datapoints` sets `TargetMetric.currentValue` to the latest recorded value. There is no rollback if the data-point write succeeds but the metric update fails (two separate Prisma calls — not a transaction). Low severity for current usage.
3. **No seed data**: The `Target` table starts empty. The Vereinsleitung dashboard's `VereinsleitungGoalsCard` still shows hard-coded demo goals; it only links to `/targets`. No data loss, but users see an empty list until Targets are created.
4. **`package-lock.json` lock cleanup**: The 108-line reduction is from a re-normalized lock file. Should be harmless but warrants a quick `npm ci` check in the target environment.

---

## PR #10 — Governance Foundation

| Field | Value |
|-------|-------|
| **PR number** | #10 |
| **Title** | feat(governance): Module Governance Foundation |
| **Branch** | `cursor/governance-foundation-a008` |
| **Base branch** | `master` (PR branches on a linear chain; depends on PR #9) |
| **State** | Open (Draft) |
| **Commits** | 2 (`44a1c38` ← PR #9, `e3c2baf` ← this PR) |
| **Build** | ✅ Pass — 52 routes, 0 errors |
| **Lint** | ✅ 0 errors, 3 pre-existing warnings |

### Purpose

Adds a reusable governance/review-stage layer shared across all strategic modules. Extends `WorkflowDomain` with three new values, adds four governance fields to `Target`, creates `lib/governance/review-stage.ts` (domain-agnostic helpers), adds a `PATCH /api/targets/[id]/stage` endpoint, creates the reusable `ReviewStageBadge` component, and adds a Governance sidebar panel to the Target detail page.

### Changed Files Summary (incremental over PR #9)

**New files (5):**
```
app/api/targets/[id]/stage/route.ts
components/admin/shared/ReviewStageBadge.tsx
components/admin/targets/TargetStageActions.tsx
lib/governance/review-stage.ts
prisma/migrations/20260518130000_add_governance_foundation/migration.sql
```

**Modified files (7):**
```
app/(admin)/vereinsleitung/targets/[id]/page.tsx   — adds governance sidebar panel
app/(admin)/vereinsleitung/targets/page.tsx         — adds ReviewStageBadge per card
components/admin/vereinsleitung/VereinsleitungInitiativenList.tsx — TODO comment
components/admin/vereinsleitung/VereinsleitungMeetingsList.tsx    — TODO comment
lib/targets/queries.ts    — adds reviewStage/governance fields to select
lib/workflow/review-policy.ts  — adds TARGETS, MEETINGS, INITIATIVES policy entries
prisma/schema.prisma
```

### Migration Files

**`prisma/migrations/20260518130000_add_governance_foundation/migration.sql`**

```sql
-- AlterEnum (×3)
ALTER TYPE "WorkflowDomain" ADD VALUE 'MEETINGS';
ALTER TYPE "WorkflowDomain" ADD VALUE 'INITIATIVES';
ALTER TYPE "WorkflowDomain" ADD VALUE 'TARGETS';

-- AlterTable: Add governance fields to Target
ALTER TABLE "Target"
  ADD COLUMN "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "requiresFourEyeReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Target_reviewStage_idx" ON "Target"("reviewStage");
```

### Prisma Schema Changes

- **`WorkflowDomain` enum**: +`MEETINGS`, +`INITIATIVES`, +`TARGETS`
- **`Target` model**: +4 columns (`reviewStage NOT NULL DEFAULT 'DRAFT'`, `requiresFourEyeReview BOOLEAN NOT NULL DEFAULT false`, `reviewedByUserId TEXT`, `reviewedAt TIMESTAMP`)
- No new models.
- No existing models removed or broken.

### API Route Changes

| Method | Route | New/Mod |
|--------|-------|---------|
| PATCH | `/api/targets/[id]/stage` | New |

Validates transition with `canTransitionTo()` from `lib/governance/review-stage.ts`. Returns `422` on invalid transitions. Stamps `reviewedByUserId` + `reviewedAt` when moving to `APPROVED` or `REJECTED`.

### Page/Route Changes

- `/vereinsleitung/targets/[id]`: adds Governance sidebar panel (ReviewStageBadge + stage transition buttons)
- `/vereinsleitung/targets`: adds ReviewStageBadge (sm) to each list card

### Permission Changes

None in this PR. Uses existing session-only auth pattern.

### Package / Package-Lock Changes

No changes.

### Known Risks

1. **Three `ALTER TYPE ... ADD VALUE` statements in one migration**: same PostgreSQL transaction risk as PR #9. All three must run outside a transaction or with `BEGIN/COMMIT` per statement.
2. **`ALTER TABLE "Target" ADD COLUMN "reviewStage" NOT NULL DEFAULT 'DRAFT'`**: Safe on an empty table. On a populated table, PostgreSQL will backfill existing rows with `'DRAFT'` — correct intent. No data loss.
3. **`reviewedByUserId` is a plain `TEXT` field, not a FK to `User`**: Deliberate (avoids cascade complexity), but means referential integrity is not DB-enforced. A deleted user's ID will remain as a dead reference. Acceptable for phase 1.
4. **Dependency on `ReviewWorkflowStage` enum**: this enum was introduced in an earlier migration (`20260413101943_add_events_foundation`). PR #10 reuses it. If that migration hasn't run, PR #10's `ALTER TABLE` will fail. This should not be an issue on any environment where Events are already deployed.
5. **`lib/workflow/review-policy.ts` now references `"targets" | "meetings" | "initiatives"` in `ReviewTargetDomain`**: If any existing code pattern-matches exhaustively on `ReviewTargetDomain`, it may need updating. Grep result: only `event-review-policy.ts` imports from `review-policy.ts`, and it does not exhaustively match the domain union — no breakage.

---

## PR #11 — Cross-Module Linking Foundation

| Field | Value |
|-------|-------|
| **PR number** | #11 |
| **Title** | feat(linking): Cross-Module Linking Foundation |
| **Branch** | `cursor/cross-module-linking-a008` |
| **Base branch** | `master` (depends on PR #9 and #10) |
| **State** | Open (Draft) |
| **Commits** | 3 (PR #9 + PR #10 + `00e02fc` this PR) |
| **Build** | ✅ Pass — 53 routes, 0 errors |
| **Lint** | ✅ 0 errors, 3 pre-existing warnings |

### Purpose

Adds a lightweight phase-1 cross-module linking architecture. Because Meeting and Initiative have no Prisma models yet, links are stored as validated JSON ref arrays (`[{slug, title, url?}][]`) on `Target`. Introduces `lib/linking/` with types, static stubs, and helpers. Adds `PATCH /api/targets/[id]/links`, `TargetLinksPanel` (display), and `TargetLinkEditor` (client toggle-chip UI on edit page). Architecture TODOs document the phase-2 FK migration path.

### Changed Files Summary (incremental over PR #10)

**New files (7):**
```
app/api/targets/[id]/links/route.ts
components/admin/targets/TargetLinkEditor.tsx
components/admin/targets/TargetLinksPanel.tsx
lib/linking/helpers.ts
lib/linking/stubs.ts
lib/linking/types.ts
prisma/migrations/20260518140000_add_cross_module_links/migration.sql
```

**Modified files (7):**
```
app/(admin)/vereinsleitung/targets/[id]/edit/page.tsx  — adds TargetLinkEditor section
app/(admin)/vereinsleitung/targets/[id]/page.tsx       — adds TargetLinksPanel to sidebar
components/admin/vereinsleitung/VereinsleitungDashboard.tsx  — TODO comment
components/admin/vereinsleitung/VereinsleitungInitiativesCard.tsx — TODO comment
components/admin/vereinsleitung/VereinsleitungMeetingDetail.tsx   — TODO comment
lib/targets/queries.ts  — adds linkedInitiativeRefs, linkedMeetingRefs to select
prisma/schema.prisma
```

### Migration Files

**`prisma/migrations/20260518140000_add_cross_module_links/migration.sql`**

```sql
-- AlterTable: Target gets two JSONB columns
ALTER TABLE "Target"
  ADD COLUMN "linkedInitiativeRefs" JSONB,
  ADD COLUMN "linkedMeetingRefs" JSONB;
```

### Prisma Schema Changes

- **`Target` model**: +`linkedInitiativeRefs JSONB` (nullable), +`linkedMeetingRefs JSONB` (nullable)
- No enum changes. No new models.

### API Route Changes

| Method | Route | New/Mod |
|--------|-------|---------|
| PATCH | `/api/targets/[id]/links` | New |

Accepts `{ initiativeRefs: EntityRef[], meetingRefs: EntityRef[] }`. Validates slugs against `INITIATIVE_STUBS` / `MEETING_STUBS` before writing (phase-1 guard). Atomically replaces both sets.

### Page/Route Changes

- `/vereinsleitung/targets/[id]`: sidebar gains `TargetLinksPanel` showing linked initiatives + meetings with navigation links and empty-state copy.
- `/vereinsleitung/targets/[id]/edit`: gains `TargetLinkEditor` section below the main form (toggle-chip UI, saves via PATCH `/links`, `router.refresh()`).

### Permission Changes

None. Uses existing session-only auth.

### Package / Package-Lock Changes

No changes.

### Known Risks

1. **JSON refs are not referentially integrity-enforced**: `linkedInitiativeRefs` and `linkedMeetingRefs` store free-form JSONB. If a Meeting or Initiative slug changes or is deleted, stale refs will silently persist. Acceptable for phase 1; phase 2 must replace with FK junction tables.
2. **Slug validation against static stubs only**: `validateLinkPayload()` rejects slugs not in `INITIATIVE_STUBS` / `MEETING_STUBS`. After PR #12 merges (Meeting model added), this guard will reject real DB meeting slugs that are not in the hardcoded stub list. **This is a known limitation**: the stubs and real DB records may diverge. The fix is documented in `lib/linking/stubs.ts` — replace stub imports with a real `getMeetingStubs()` async helper and pass the result as a prop.
3. **`TargetLinkEditor` imports `INITIATIVE_STUBS` + `MEETING_STUBS` directly** (client component): once Meeting becomes DB-backed (PR #12), the editor should receive available meetings as a prop from the server page rather than importing the static list. This is a tech-debt item, not a blocker.
4. **No index on JSONB columns**: queries filtering by initiative/meeting slug inside JSONB are not indexed. Low risk for current data volumes; a GIN index can be added in a future migration if needed.

---

## PR #12 — Meetings DB Promotion

| Field | Value |
|-------|-------|
| **PR number** | #12 |
| **Title** | feat(meetings): Promote Meeting to DB-backed model with governance |
| **Branch** | `cursor/meetings-db-promotion-a008` |
| **Base branch** | `master` (depends on PRs #9, #10, #11) |
| **State** | Open (Draft) |
| **Commits** | 4 (PRs #9–#11 + `81e97f5` this PR) |
| **Build** | ✅ Pass — 57 routes, 0 errors |
| **Lint** | ✅ 0 errors, 3 pre-existing warnings |

### Purpose

Promotes Meeting from a fully static mock to a DB-backed Prisma model with governance fields from day one. Adds full CRUD API plus a stage-transition endpoint mirroring the Target pattern. Updates the meetings list page to query real DB data. Updates the detail page with a zero-regression strategy: shows a governance banner if the slug exists in DB, falls through to existing mock cards if not. `MEETING_STUBS` comment updated with the concrete async DB migration path.

### Changed Files Summary (incremental over PR #11)

**New files (7):**
```
app/api/meetings/[id]/route.ts
app/api/meetings/[id]/stage/route.ts
app/api/meetings/route.ts
components/admin/meetings/MeetingGovernanceBanner.tsx
components/admin/meetings/MeetingStageActions.tsx
lib/meetings/queries.ts
prisma/migrations/20260518150000_add_meeting_model/migration.sql
```

**Modified files (6):**
```
app/(admin)/vereinsleitung/meetings/page.tsx         — now a server component with DB query
app/(admin)/vereinsleitung/meetings/[slug]/page.tsx  — governance banner + mock fallback
components/admin/vereinsleitung/VereinsleitungMeetingsList.tsx  — rewritten to accept props
lib/linking/stubs.ts      — MEETING_STUBS comment updated with DB migration path
lib/permissions/permissions.ts  — adds MEETINGS_VIEW, MEETINGS_MANAGE
prisma/schema.prisma
```

### Migration Files

**`prisma/migrations/20260518150000_add_meeting_model/migration.sql`**

```sql
-- CreateEnum: MeetingStatus ('PLANNED', 'COMPLETED', 'CANCELLED')

-- CreateTable: Meeting
--   id TEXT PK, slug TEXT UNIQUE, title TEXT, description TEXT?,
--   meetingDate TIMESTAMP NOT NULL, location TEXT?, attendeeCount INT?,
--   status MeetingStatus DEFAULT 'PLANNED',
--   reviewStage ReviewWorkflowStage DEFAULT 'DRAFT',
--   requiresFourEyeReview BOOLEAN DEFAULT false,
--   reviewedByUserId TEXT?, reviewedAt TIMESTAMP?,
--   createdAt, updatedAt

-- CreateIndex: Meeting_slug_key (unique), meetingDate_idx, status_idx, reviewStage_idx
```

### Prisma Schema Changes

- **New enum**: `MeetingStatus` (PLANNED, COMPLETED, CANCELLED)
- **New model**: `Meeting` with slug-based unique key and full governance fields (`reviewStage`, `requiresFourEyeReview`, `reviewedByUserId`, `reviewedAt`)
- No existing models altered.

### API Route Changes

| Method | Route | New/Mod |
|--------|-------|---------|
| GET, POST | `/api/meetings` | New |
| GET, PUT, DELETE | `/api/meetings/[id]` | New |
| PATCH | `/api/meetings/[id]/stage` | New |

`POST /api/meetings` auto-generates `slug` from `title` if not supplied (`title.toLowerCase().replace(/[^a-z0-9]+/g, '-')`). Returns `409` on slug collision. All endpoints use session-only auth (consistent with Vereinsleitung pattern).

### Page/Route Changes

| Route | Change |
|-------|--------|
| `/vereinsleitung/meetings` | Now a server component; queries `getMeetings()`; shows empty state if DB empty |
| `/vereinsleitung/meetings/[slug]` | Tries `getMeetingBySlug(slug)`; renders `MeetingGovernanceBanner` if found; existing mock cards always rendered |

**Behaviour regression check**: Existing mock slugs (`vorstandssitzung-april`, etc.) are not in the DB post-migration. The detail page will render exactly as before (mock-only) until real Meeting records are seeded. The list page will show an empty state (previously showed 3 hardcoded cards). This is an intentional transition.

### Permission Changes

`lib/permissions/permissions.ts`:
```ts
MEETINGS_VIEW: "meetings.view",
MEETINGS_MANAGE: "meetings.manage",
```
String constants only. `PermissionModule` enum **not** extended (avoids a fourth `ALTER TYPE` across four sprints). Not enforced on API endpoints.

### Package / Package-Lock Changes

No changes.

### Known Risks

1. **Meetings list goes empty after merge**: Once PR #12 is merged and migrations applied, the meetings list shows an empty state until real Meeting records are seeded or created via `POST /api/meetings`. If the Vereinsleitung dashboard is being actively used, users will see an empty list instead of the previous mock content. Mitigation: seed the three mock meetings via a one-time script or the API before announcing the deployment.
2. **Mock detail sub-cards remain hardcoded**: `VereinsleitungMeetingDetail` and its sub-components (`VereinsleitungMeetingInfoCard`, `VereinsleitungMeetingAgendaCard`, etc.) still display static data (date: "16. April 2024", hardcoded agenda items, etc.). They are unaffected by the DB Meeting record. This is by design (complexity is deferred) but creates a visual inconsistency once real DB meetings are created.
3. **`reviewedByUserId` not FK-constrained**: same as PR #10's Target note — plain TEXT, not a FK to User.
4. **`MEETING_STUBS` / `TargetLinkEditor` divergence** (from PR #11): after this PR, real meetings exist in DB but `MEETING_STUBS` still contains hardcoded slugs. The slug validation in `PATCH /api/targets/[id]/links` still validates against stubs. Real meeting slugs not in the stub list will be rejected. Requires a follow-up sprint to replace stubs with a DB query helper.
5. **Slug uniqueness and auto-generation**: auto-slugging from title (`title.toLowerCase().replace(...)`) may produce collisions for meetings with similar titles. The API returns `409` on collision, but there is no retry/increment logic. Users must supply a unique slug manually in that case.

---

## Combined: Migration Order

All 4 sprint migrations must be applied in strict ascending timestamp order. They are additive and non-destructive on each other.

| # | Timestamp | File | PRs |
|---|-----------|------|-----|
| 1 | `20260518120000` | `add_targets_module` | PR #9 |
| 2 | `20260518130000` | `add_governance_foundation` | PR #10 |
| 3 | `20260518140000` | `add_cross_module_links` | PR #11 |
| 4 | `20260518150000` | `add_meeting_model` | PR #12 |

**Pre-existing migrations** (already on master, must have run before any of these):
```
20260410225355_init
20260411142054_add_team_audit_and_trainingsgruppe
20260411191906_add_player_squad_model
20260413100139_add_seasons_permission_module
20260413101943_add_events_foundation          ← defines ReviewWorkflowStage enum
20260413134413_add_event_import_runs
20260418-194927_deployment_catchup
```

**Critical dependency**: migration `20260518130000` uses `"ReviewWorkflowStage"` (referenced in `ALTER TABLE "Target" ADD COLUMN "reviewStage" "ReviewWorkflowStage"` and implicitly in `20260518150000`). This type must exist before those migrations run, which it does — it was created in `20260413101943_add_events_foundation`.

**`ALTER TYPE ... ADD VALUE` warning**: migrations `20260518120000` and `20260518130000` each contain `ALTER TYPE ... ADD VALUE` statements. In PostgreSQL, these **cannot run inside a transaction**. `prisma migrate deploy` wraps each migration in a transaction by default. If the migrations fail with `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`, apply them with:

```bash
# Apply manually, outside transaction
psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE 'TARGETS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'MEETINGS';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'INITIATIVES';"
psql $DATABASE_URL -c "ALTER TYPE \"WorkflowDomain\" ADD VALUE 'TARGETS';"
```

Then mark the migrations as applied:
```bash
npx prisma migrate resolve --applied 20260518120000_add_targets_module
npx prisma migrate resolve --applied 20260518130000_add_governance_foundation
```

Alternatively, check if your Prisma version handles this automatically via `--no-transaction` migration options.

---

## Combined: Prisma Schema Risk Review

### New enums (all additive, non-breaking)

| Enum | Values | Introduced in |
|------|--------|---------------|
| `TargetCategory` | 6 | PR #9 |
| `TargetStatus` | 5 | PR #9 |
| `TargetPeriod` | 4 | PR #9 |
| `TargetMetricType` | 4 | PR #9 |
| `TargetDirection` | 3 | PR #9 |
| `MeetingStatus` | 3 | PR #12 |

### Extended enums (additive, `ALTER TYPE ... ADD VALUE`)

| Enum | Values added | PR |
|------|--------------|----|
| `PermissionModule` | `TARGETS` | #9 |
| `WorkflowDomain` | `MEETINGS`, `INITIATIVES`, `TARGETS` | #10 |

**Risk**: PostgreSQL requires `ALTER TYPE ... ADD VALUE` outside a transaction. See migration order section above.

### New models

| Model | PR | Notes |
|-------|----|-------|
| `Target` | #9 | No FK to User; `reviewedByUserId` is plain TEXT |
| `TargetMetric` | #9 | FK→Target CASCADE |
| `TargetDataPoint` | #9 | FK→TargetMetric CASCADE |
| `Meeting` | #12 | slug UNIQUE; `reviewedByUserId` is plain TEXT |

### Columns added to existing models

| Model | Column | PR | Notes |
|-------|--------|----|-------|
| `Target` | `reviewStage NOT NULL DEFAULT 'DRAFT'` | #10 | Safe backfill |
| `Target` | `requiresFourEyeReview BOOLEAN NOT NULL DEFAULT false` | #10 | Safe backfill |
| `Target` | `reviewedByUserId TEXT` | #10 | Nullable, no FK |
| `Target` | `reviewedAt TIMESTAMP` | #10 | Nullable |
| `Target` | `linkedInitiativeRefs JSONB` | #11 | Nullable |
| `Target` | `linkedMeetingRefs JSONB` | #11 | Nullable |

### No destructive operations

No `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`, or `ALTER COLUMN ... SET NOT NULL` (on a column without a default) across all 4 PRs. All changes are purely additive.

### Missing FK constraints (intentional, phase 1)

- `Target.reviewedByUserId` → not FK to `User`
- `Meeting.reviewedByUserId` → not FK to `User`
- `Target.linkedInitiativeRefs` / `Target.linkedMeetingRefs` → JSONB, no FK (Initiative has no model yet)

---

## Combined: Route Conflict Review

### New API routes across all 4 PRs

```
/api/targets                                      PR #9
/api/targets/[id]                                 PR #9
/api/targets/[id]/metrics/[metricId]/datapoints   PR #9
/api/targets/[id]/stage                           PR #10
/api/targets/[id]/links                           PR #11
/api/meetings                                     PR #12
/api/meetings/[id]                                PR #12
/api/meetings/[id]/stage                          PR #12
```

**No conflicts** with existing routes on master. The existing API surface includes `/api/events`, `/api/seasons`, `/api/teams`, `/api/people`, `/api/users`, `/api/roles`, `/api/team-seasons`, `/api/audit-logs`, `/api/public/*`, `/api/auth/*`, `/api/health` — no overlaps.

### New app routes across all 4 PRs

```
/vereinsleitung/targets                     PR #9
/vereinsleitung/targets/new                 PR #9
/vereinsleitung/targets/[id]                PR #9
/vereinsleitung/targets/[id]/edit           PR #9
```

### Modified app routes

```
/vereinsleitung/meetings         PR #12 (page.tsx refactored to server component)
/vereinsleitung/meetings/[slug]  PR #12 (adds governance banner, preserves mock cards)
```

**No conflicts** with existing `/vereinsleitung/meetings/*` routes — the page files are modified in place, not duplicated.

### Sidebar and header

- `AdminSidebar.tsx` (PR #9): adds `"Ziele"` to `isVereinsleitungChild()` check and imports `Target` icon from Lucide. Existing nav items unchanged.
- `AdminPageHeader.tsx` (PR #9): adds route-header entries for `/vereinsleitung/targets/*`. No existing entries removed or overridden.

---

## Combined: Permission Conflict Review

### Before these PRs (master state)

`lib/permissions/permissions.ts` defines string keys for: `USERS_*`, `SEASONS_*`, `TEAMS_*`, `PEOPLE_*`, `EVENTS_*`, `FIXTURES_*`, `WOCHENPLAN_MANAGE`, `NEWS_MANAGE`, `WEBSITE_MANAGE`, `INFOBOARD_MANAGE`, `FUNCTIONS_MANAGE`.

### Added by these PRs

| Key | String value | PR | Enforced? |
|-----|--------------|----|-----------|
| `TARGETS_VIEW` | `"targets.view"` | #9 | No — session-only auth on API |
| `TARGETS_MANAGE` | `"targets.manage"` | #9 | No |
| `MEETINGS_VIEW` | `"meetings.view"` | #12 | No |
| `MEETINGS_MANAGE` | `"meetings.manage"` | #12 | No |

**No conflicts** with existing permission keys (all new strings in a distinct namespace).

**No enforcement**: all new API endpoints use `session-only` auth (same pattern as the Vereinsleitung dashboard routes which have no permission requirements in `ADMIN_NAV_ITEMS`). Permission keys are defined for future use.

**`PermissionModule` DB enum**: only `TARGETS` is added (PR #9). `MEETINGS` is **not** added to `PermissionModule` — intentional to avoid a fifth `ALTER TYPE` across the sprint chain. The `Permission` seed table does not include entries for `targets.*` or `meetings.*` in any of these PRs.

### `WorkflowDomain` extension (PR #10)

`MEETINGS`, `INITIATIVES`, `TARGETS` added. These extend the domain enum used by `RoleWorkflowRule`. No existing `RoleWorkflowRule` records are created by these PRs. The extension is purely additive and enables future rule creation against these domains without a schema migration.

---

## Recommended Merge Order

The four branches form a **strict linear chain** — each branch was created from the previous one. They **must** be merged in order:

```
PR #9  →  PR #10  →  PR #11  →  PR #12
```

| Step | PR | Action |
|------|----|--------|
| 1 | #9 | Rebase onto latest `master`, run `prisma migrate deploy` for `20260518120000` |
| 2 | #10 | Merge (will fast-forward), run `prisma migrate deploy` for `20260518130000` |
| 3 | #11 | Merge (will fast-forward), run `prisma migrate deploy` for `20260518140000` |
| 4 | #12 | Merge (will fast-forward), run `prisma migrate deploy` for `20260518150000` |

**After all merges and migrations:**
1. Seed at least three `Meeting` records with slugs matching the former mock data (`vorstandssitzung-april`, `trainer-rapport-rueckrunde`, `medienkoordination-saisonstart`) to restore the meetings list to a non-empty state.
2. Optionally seed sample `Target` records to demonstrate the Targets module on the dashboard.
3. Verify `PATCH /api/targets/[id]/links` slug validation is updated to use real DB meeting slugs (follow-up sprint or hotfix).

**Merge conflict risk**: Low. All PRs touch only new files or clearly isolated modifications. The only shared modified files across multiple PRs are `prisma/schema.prisma` and `lib/targets/queries.ts` — both change in a strictly additive, non-overlapping manner across the chain. `AdminSidebar.tsx` and `AdminPageHeader.tsx` are touched only in PR #9 and not subsequently modified.

**If master has diverged** since the sprint branches were cut: PR #9 will need to be rebased onto current `master` first. PRs #10–#12 can then be rebased sequentially onto their updated predecessors. The `package-lock.json` change in PR #9 may produce a conflict if master's lock file has also changed — resolve by running `npm install` and committing the regenerated lock file.
