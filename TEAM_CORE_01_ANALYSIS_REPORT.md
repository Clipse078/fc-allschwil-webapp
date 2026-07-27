# TEAM-CORE-01 — Seasonal Team Registration, Organisation Unit Assignment and SFV Mapping Inventory

**Analysis Branch:** `feature/team-core-01-seasonal-registration-inventory`
**Base:** `STAGE` @ `e5ebb037df049d87de84d4ccb473a035a8065772`
**Tenant in scope:** FC Allschwil
**Date:** 2026-07-27
**Status:** Read-only inventory. No code, schema, migration, or data changes made.

---

## A. Repository State

| Property | Value |
|---|---|
| Repository root | `/workspace` |
| Remote origin | `https://github.com/Clipse078/sportclubevo-webapp` |
| Starting branch | `STAGE` |
| Analysis branch | `feature/team-core-01-seasonal-registration-inventory` |
| Starting HEAD (STAGE) | `e5ebb037df049d87de84d4ccb473a035a8065772` |
| `origin/STAGE` SHA | `e5ebb037df049d87de84d4ccb473a035a8065772` |
| Working-tree status | Clean — no uncommitted changes |
| Active git operations | None |

Branch created from the exact `origin/STAGE` SHA. No STAGE modifications made.

---

## B. Current Team and Season Architecture

### B.1 Models

#### `Team` — `prisma/schema.prisma`

The permanent identity layer. Fields that live on `Team`:

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | Stable permanent key |
| `name` | `String` | Official team name |
| `slug` | `String @unique` | **Globally unique across all tenants** — critical gap |
| `category` | `TeamCategory` | Enum: `KINDERFUSSBALL`, `JUNIOREN`, `AKTIVE`, `FRAUEN`, `SENIOREN`, `TRAININGSGRUPPE` |
| `genderGroup` | `String?` | Optional free-text, e.g. "Boys" |
| `ageGroup` | `String?` | Optional free-text, e.g. "E", "D9" |
| `sortOrder` | `Int @default(0)` | Display ordering |
| `isActive` | `Boolean @default(true)` | Soft-archive flag |
| `websiteVisible` | `Boolean @default(true)` | **On Team, not TeamSeason** — major architecture gap |
| `infoboardVisible` | `Boolean @default(true)` | **On Team, not TeamSeason** — major architecture gap |
| `orgUnitId` | `String?` | FK to one `OrgUnit` — single, optional — **not mandatory, not multi-valued** |
| `tenantId` | `String?` | Nullable — backfilled post-creation (migration `20260626000000_team_tenant_isolation`) |
| `createdAt`, `updatedAt` | `DateTime` | Standard timestamps |

Relations on `Team`:
- `teamSeasons TeamSeason[]`
- `events Event[]`
- `eventImportRuns EventImportRun[]`
- `orgUnit OrgUnit?` (single, via `orgUnitId`)
- `externalMappings TeamExternalMapping[]`
- `homeMatchMappings MatchExternalMapping[]`
- `awayMatchMappings MatchExternalMapping[]`

#### `TeamSeason` — `prisma/schema.prisma`

The operational seasonal record. Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `teamId` | `String` | FK to `Team` |
| `seasonId` | `String` | FK to `Season` |
| `displayName` | `String` | Season-specific display name, e.g. "FC Allschwil Aktive 1" |
| `shortName` | `String?` | Short form |
| `status` | `TeamSeasonStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `websiteVisible` | `Boolean @default(true)` | Season-level website gate |
| `infoboardVisible` | `Boolean @default(true)` | Season-level infoboard gate |
| `squadWebsiteVisible` | `Boolean @default(true)` | Controls whether squad is exposed publicly |
| `trainerTeamWebsiteVisible` | `Boolean @default(true)` | Controls whether trainer staff is exposed publicly |
| `createdAt`, `updatedAt` | `DateTime` | |

Unique constraint: `@@unique([teamId, seasonId])` — one TeamSeason per (Team, Season) combination.

Relations:
- `playerSquadMembers PlayerSquadMember[]`
- `trainerTeamMembers TrainerTeamMember[]`

#### `Season` — `prisma/schema.prisma`

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id` | |
| `key` | `String @unique` | e.g. "2025/2026" or "2025-26" |
| `name` | `String` | Display name |
| `startDate`, `endDate` | `DateTime` | |
| `isActive` | `Boolean @default(false)` | Only one should be true at a time (not DB-enforced) |

Season is **not tenant-scoped** — seasons are global. This creates potential multi-tenant season isolation issues.

### B.2 Relationships and Ownership

```
Season (global, not tenant-scoped)
└── TeamSeason (operational, seasonal)
    ├── PlayerSquadMember (seasonal roster)
    └── TrainerTeamMember (seasonal staff)

Team (permanent identity, tenant-scoped nullable)
├── TeamSeason[] (one per active season)
├── OrgUnit? (single optional FK — not mandatory, not multi-valued)
├── TeamExternalMapping[] (SFV mapping — linked to Team, NOT TeamSeason)
├── MatchExternalMapping[] (home/away references on matches)
└── Event[] (training/match events reference Team directly, not TeamSeason)
```

### B.3 Current UX Mismatches

1. **Team is the UX entry point, not Season.** `app/(admin)/dashboard/teams/new/page.tsx` shows a general form. The season selector is one field among many, not the initial required step.

2. **`websiteVisible` and `infoboardVisible` live on both `Team` AND `TeamSeason`.** Dual-layered visibility creates confusion. The public API (`lib/website/public-teams-feed.ts`) applies `Team.isActive + Team.websiteVisible` filters, and then TeamSeason-level visibility for squad/trainer sections. But the top-level team visibility toggle is on `Team`, not on the seasonal record.

3. **`TeamCategory` enum duplicates what Organisationseinheiten already provide.** The six enum values (`KINDERFUSSBALL`, `JUNIOREN`, `AKTIVE`, `FRAUEN`, `SENIOREN`, `TRAININGSGRUPPE`) map exactly to the FC Allschwil public groupings that should be driven by OrgUnit names, not a hardcoded enum.

4. **`Team.slug` is `@unique` globally** — not tenant-scoped. If two tenants have a team named "Aktive 1", only one slug can be "aktive-1" across the entire platform. The public website resolves by `slug + tenantId` (`lib/website/public-teams-feed.ts`), but the uniqueness constraint prevents the second tenant from using the same slug.

5. **`Team.orgUnitId` is optional and single-valued.** No many-to-many join exists. A team can reference at most one OrgUnit, and that reference is optional. The form shows it as "optionale Verknüpfung."

6. **`TeamExternalMapping` is linked to `Team`, not `TeamSeason`.** A single Team can have multiple `TeamExternalMapping` rows (one per season + provider combination via the `externalSeasonId` field), but the link is to the permanent identity, not the operational season record.

7. **`Season` is not tenant-scoped.** Seasons are shared across all tenants. This creates a multi-tenant operational coupling.

8. **`buildTeamSeasonDisplayName` hardcodes "FC Allschwil".** `lib/teams/team-season-rules.ts` line 19: `return "FC Allschwil " + normalizeTeamName(teamName);` — this is an FC Allschwil-specific hardcode in shared business logic.

### B.4 Archive Behaviour

- `Team.isActive = false` acts as a soft archive.
- `TeamSeason.status = ARCHIVED` archives a seasonal record.
- No `archivedAt` timestamp on `Team` or `TeamSeason`.
- No dedicated restore endpoint for `Team` (OrgUnit has one at `app/api/org-units/[id]/restore/route.ts`).

### B.5 Season Uniqueness

`@@unique([teamId, seasonId])` prevents duplicate TeamSeason for the same (Team, Season) pair. The POST endpoint at `app/api/teams/[teamId]/team-seasons/route.ts` enforces this explicitly.

Only one `TeamSeason` can exist per (Team, Season) combination — correct. Multiple teams may exist in the same season.

### B.6 Can a Team Have Multiple TeamSeasons?

Yes. A Team may have one TeamSeason per season, accumulating history over time. The queries in `lib/teams/queries.ts` fetch all TeamSeasons ordered by `season.startDate` descending.

---

## C. Organisation Builder Integration

### C.1 Current OrgUnit Model

`OrgUnit` (`prisma/schema.prisma`, line 1080):

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id` | |
| `tenantId` | `String?` | Nullable — backfilled pattern |
| `parentId` | `String?` | Self-referencing hierarchy |
| `type` | `OrgUnitType` | `CLUB`, `DIVISION`, `DEPARTMENT`, `SUB_DEPARTMENT`, `TEAM`, `COMMITTEE`, `PROJECT_GROUP`, `CUSTOM` |
| `status` | `OrgUnitStatus` | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `key` | `String` | Tenant-scoped unique `@@unique([tenantId, key])` |
| `name` | `String` | |
| `description` | `String?` | |
| `sortOrder` | `Int @default(0)` | |
| `level` | `Int @default(0)` | Hierarchy depth |
| `archivedAt` | `DateTime?` | Set on archive, cleared on restore |

### C.2 Hierarchy

Self-referencing via `parentId`. Queries in `lib/org/queries.ts` fetch all non-archived OrgUnits ordered by `level asc`, `sortOrder asc`, `name asc`. A `level` field tracks depth.

### C.3 Current Team–OrgUnit Link

`Team.orgUnitId` (nullable FK) → `OrgUnit`. One team can reference at most one OrgUnit. `getOrgUnitById()` in `lib/org/queries.ts` includes linked teams via this FK.

### C.4 Required Many-to-Many Design

**No join model currently exists.** The target design requires:

```
TeamSeasonOrgUnit (new join table)
  teamSeasonId → TeamSeason
  orgUnitId    → OrgUnit
  sortOrder    Int @default(0)
  createdAt    DateTime
```

Or equivalently, if the assignment is permanent to the team identity:

```
TeamOrgUnit (new join table)
  teamId    → Team
  orgUnitId → OrgUnit
  sortOrder Int @default(0)
  isPrimary Boolean @default(false)
  createdAt DateTime
  @@unique([teamId, orgUnitId])
```

The decision between team-level vs. season-level assignment depends on use case. A team that always belongs to "Junioren" would use team-level assignment. A team that shifts categories between seasons would use season-level assignment. The recommendation (Section J) addresses this.

### C.5 Mandatory Validation

Currently `orgUnitId` is fully optional. The POST endpoint at `app/api/teams/route.ts` accepts `null` silently. The form shows it as an optional field.

Target: at least one OrgUnit required. API must return HTTP 400 if no OrgUnit is provided.

### C.6 Archive Behaviour

`OrgUnit.status = ARCHIVED` with `archivedAt` set. A restore endpoint exists (`app/api/org-units/[id]/restore/route.ts`). Archived OrgUnits are already excluded from the default `getOrgUnits()` query (`status: { not: "ARCHIVED" }`).

**Important:** The query in `NewTeamPage` (`app/(admin)/dashboard/teams/new/page.tsx`) calls `getOrgUnits(tenant?.id)` which excludes archived units — this is correct for new assignments. But when a historical assignment was made to a now-archived OrgUnit, the archived unit's name should still be readable for display purposes.

### C.7 Types Suitable for Team Assignment

`OrgUnitType.TEAM` is the most semantically appropriate type for football team groupings. However, FC Allschwil likely uses `DEPARTMENT` or `DIVISION` for their "Aktive", "Frauen", etc. groupings. The system should not hardcode a type filter — instead, a configurable `teamEligible` flag or a flexible UI filter is recommended.

### C.8 Website Grouping Impact

When OrgUnit drives public grouping:
- The public teams API currently returns `category` (the enum) as the grouping signal.
- Target: return `orgUnit` or `orgUnits` with `id`, `name`, `key` as grouping signals.
- The public website frontend reads these to group team cards.
- `OrgUnit.name` becomes the public group label (e.g. "Frauen", "Junioren").
- `OrgUnit.sortOrder` determines public group ordering.

---

## D. SFV Mapping

### D.1 Current Structure: `TeamExternalMapping`

| Field | Type | Ownership |
|---|---|---|
| `id` | `String @id` | |
| `tenantId` | `String` | **Required, fully enforced** |
| `teamId` | `String` | FK → `Team` (permanent identity, NOT `TeamSeason`) |
| `provider` | `String` | e.g. `"SFV"` |
| `externalTeamId` | `Int` | SFV team identifier |
| `externalSeasonId` | `Int` | SFV season identifier |
| `providerTeamName` | `String?` | SFV-owned, updated each sync |
| `providerLeagueId` | `Int?` | SFV-owned |
| `providerLeagueName` | `String?` | SFV-owned |
| `providerOrganisationId` | `Int?` | SFV-owned |
| `providerIsActive` | `Boolean @default(true)` | Provider status |
| `lastSyncedAt` | `DateTime` | Required, set each sync |

Unique constraint: `@@unique([tenantId, provider, externalTeamId, externalSeasonId])` — prevents duplicate mappings for the same external team within the same tenant, provider, and season.

### D.2 Season Compatibility Assessment

**The mapping is linked to permanent `Team`, not `TeamSeason`.** This has important implications:

- A Team may accumulate multiple `TeamExternalMapping` rows — one per season (differentiated by `externalSeasonId`).
- There is no foreign key relationship between `TeamExternalMapping` and `TeamSeason`.
- When querying "what SFV mapping does this season's team have?", the application must join `Team → TeamExternalMapping` filtering by `externalSeasonId` matched to the known SFV season identifier.
- The SFV sync process (`lib/integrations/sfv/sync/team-persistence.ts`) uses `externalSeasonId` from `TenantSfvConfig.defaultSeasonId` — there is no programmatic link to a `TeamSeason.seasonId`.

**Risk:** A stale mapping from a previous SFV season remains associated with the same `Team`. If `externalSeasonId` is not checked against the current operational season, the wrong season's match data may be loaded.

### D.3 Duplicate Protection

`@@unique([tenantId, provider, externalTeamId, externalSeasonId])` prevents the same SFV team/season pair from being mapped twice within a tenant. This is correct.

The Matchcenter team mapping UI (`app/api/matchcenter/team-mappings/route.ts`, `lib/matchcenter/team-mapping-service.ts`) also enforces that only one canonical `Team` is linked per external mapping.

### D.4 Target Model Recommendation

The smallest safe evolution adds an optional FK from `TeamExternalMapping` to `TeamSeason`:

```
TeamExternalMapping
  + teamSeasonId String? (nullable FK → TeamSeason, onDelete: SetNull)
```

This allows the mapping to optionally reference the canonical operational season record without breaking existing rows (all existing rows would have `teamSeasonId = null`). A backfill script can populate `teamSeasonId` by matching `TeamExternalMapping.externalSeasonId` to the correct `TeamSeason.seasonId`.

### D.5 Unmapped Workflow

No current "unmapped SFV teams" queue UI exists in the admin dashboard. The Matchcenter section (`app/(admin)/dashboard/matchcenter/`) provides team mapping UI for matches, but not a proactive "all SFV teams for this season — which are mapped?" dashboard.

---

## E. Matches and Tournaments

### E.1 Current Linking

`Event` (type `MATCH` or `TOURNAMENT`) holds:
- `teamId` — FK to `Team` (the tenant's own team)
- `seasonId` — FK to `Season`
- `opponentName` — free-text fallback
- `homeAway` — "home"/"away" string
- `resultLabel` — final result as string (e.g. "3:1")
- `intermediateResultLabel` — live/half-time result
- `competitionLabel` — free-text competition name

`MatchExternalMapping` links an `Event` to SFV match data:
- `eventId` — FK to `Event` (`@unique` — one mapping per event)
- `homeTeamId` / `awayTeamId` — nullable FKs to canonical `Team` records
- `providerHomeTeamId` / `providerAwayTeamId` — SFV team IDs (always stored)
- `externalSeasonId` — SFV season at time of sync
- `scoreHome` / `scoreAway` — provider-owned scores
- `providerMatchState`, `providerMatchStateName` — raw SFV match state

### E.2 Own-Team Resolution

During schedule sync (`lib/integrations/sfv/sync/schedule-mapper.ts`, `schedule-persistence.ts`):
1. Both `teamAId` (home) and `teamBId` (away) from SFV are checked against `TeamExternalMapping`.
2. The side that belongs to the tenant is set as `Event.teamId` and populates `homeTeamId` or `awayTeamId` on the mapping.
3. Opponent teams are represented as `Opponent` records (separate model, not `Team`).

### E.3 Unresolved Events

Events imported by SFV sync but where neither team resolves to a tenant-owned team are created without `Event.teamId`. These events exist in the database but are effectively orphaned from the team management perspective. No dedicated "unresolved events" queue is available in the current UI.

### E.4 Manual Overrides

The `Event` model's locally-managed fields (`pitchCode`, `homeDressingRoomCode`, `awayDressingRoomCode`, `websiteVisible`, `infoboardVisible`, `wochenplanVisible`, etc.) are explicitly protected from SFV sync overwrites per `lib/integrations/sfv/sync/schedule-persistence.ts` architecture invariants. Provider sync only updates SFV-owned fields on `MatchExternalMapping`.

### E.5 Season Safeguards

- `Event.seasonId` is set at creation from the SFV `externalSeasonId` resolved to a canonical `Season`.
- `MatchExternalMapping.externalSeasonId` preserves the original SFV season identifier.
- Currently no DB constraint prevents an event from being moved to a different season after creation.

### E.6 Tournaments

`Event` with `type = TOURNAMENT` represents tournaments. No separate `Tournament` model exists. Tournament events share the same structure as match events. There are no "tournament group results" or "bracket results" — only individual match-level `resultLabel`.

---

## F. Match Results

### F.1 Current Fields

Results are stored on `Event`:
- `resultLabel String?` — final result string (e.g. "3:1", "2:2 n.V.") — provider-owned for SFV events
- `intermediateResultLabel String?` — live or half-time score — set by match-detail sync (Slice 3C)
- `status EventStatus` — `DRAFT`, `SCHEDULED`, `LIVE`, `COMPLETED`, `CANCELLED`, `POSTPONED`, `ARCHIVED`

On `MatchExternalMapping`:
- `scoreHome Int?` — numeric home score — provider-owned
- `scoreAway Int?` — numeric away score — provider-owned
- `providerMatchState Int?` — raw SFV match state integer
- `providerMatchStateName String?` — human-readable state from SFV

### F.2 Provider vs. Manual Ownership

Per `lib/integrations/sfv/sync/schedule-persistence.ts` architecture comment:

> SFV-owned (updated every sync): everything on MatchExternalMapping.
> Locally managed (on Event, never overwritten): pitchCode, dressingRooms, visibility flags, reviewStage, sortOrder, description, internal assignment fields.

`Event.resultLabel` is set from provider data during sync (mapped via `buildResultLabel()` in `lib/integrations/sfv/sync/schedule-mapper.ts`) but it is on `Event` which is locally managed. **This is a subtle conflict**: `resultLabel` is listed as locally managed in the code comment, but it is being written by the sync. Manual overrides to `resultLabel` would be overwritten by the next sync.

### F.3 Publication

`Event.websiteVisible` and `Event.infoboardVisible` control public display. Set at sync time, may be manually overridden.

### F.4 Historical Preservation

`Event` records are never deleted by the sync (architecture invariant in `schedule-persistence.ts`). Status transitions (SCHEDULED → LIVE → COMPLETED) are tracked on `Event.status`. `lastSyncedAt` records the sync timestamp.

---

## G. Rankings and Standings

### G.1 Current Models and APIs

**No `Ranking` or `Standing` database model exists in the Prisma schema.**

Rankings are fetched live from the SFV API:
- `lib/integrations/sfv/client.ts` exposes `fetchClubRanking()` which calls `GET /api/club/ranking`.
- Returns `ClubRankingEntry[]` with: `leagueId`, `leagueNumber`, `leagueName`, `divisionId`, `divisionName`, `groupId`, `groupName`, `teamName`, `clubNumber`, `position`, `matches`, `wins`, `draws`, `losses`, `penaltyPoints`, `goalsFor`, `goalsAgainst`, `points`, `teamId`.
- `lib/integrations/sfv/admin-diagnostics-service.ts` uses this for diagnostics.

**Rankings are NOT persisted to the database.** They are fetched on-demand from the SFV API.

### G.2 Competition Linkage

- `Event.competitionLabel` — free-text competition name on individual match events.
- No structured competition model exists.
- The `TeamSeason` model has no `competition` field.
- Rankings are linked by `SFV TeamId + SeasonId`, not by canonical `Team` or `TeamSeason`.

### G.3 Season Linkage

Rankings are fetched using `SeasonId` (SFV integer) and `ClubId` (SFV integer) from `TenantSfvConfig`. There is no mapping between `Season.id` (canonical) and the SFV `SeasonId` integer, except through `TeamExternalMapping.externalSeasonId`.

### G.4 Provider vs. Manual Support

Manual teams have no ranking path. Rankings are available only for SFV-mapped teams. The SFV diagnostics page includes ranking counts but no persistent storage.

### G.5 Target Contract

A future `TeamSeasonCompetition` model is needed to:
- Link `TeamSeason` to a `competition` context (league/group)
- Persist `Ranking` rows from provider
- Support manual ranking input for non-SFV teams
- Preserve historical standings across seasons

No such model is planned or partially implemented today.

---

## H. Premium Team Registration UX

### H.1 Current State

The current flow (`components/admin/teams/TeamCreateForm.tsx`) is a **single-page flat form** with these fields in one pass:

1. Season selector (dropdown, loads from API, defaults to active season)
2. Category (dropdown — `TeamCategory` enum)
3. Team name (text)
4. Slug (auto-generated, editable)
5. Geschlechtergruppe (optional text)
6. Teamstufe (optional text)
7. Sortierung (number)
8. Organisationseinheit (optional dropdown — single unit)

No SFV connection step. No publishing step. No review step. No multi-OrgUnit support. `buildTeamSeasonDisplayName()` hardcodes "FC Allschwil" as the display name prefix.

### H.2 Target: Multi-Step Premium Flow

**Step 1 — Season (mandatory)**
- Display: active season pre-selected with clear label "(aktuell)"
- Show season status: active, future, historical, archived
- Prevent proceeding without a valid season
- Explain context: "Teams werden pro Saison registriert"
- Required validation: block submit if no season selected

**Step 2 — Organisationseinheiten (mandatory, multi-select)**
- Source: `OrgUnit` records from tenant, excluding archived
- Minimum 1 required
- Multiple selections supported
- Show hierarchy (parent labels) for disambiguation
- Search/filter for large club structures
- Clear selected state display
- Keyboard navigable, accessible

**Step 3 — Team Identity**

Required fields:
- Official name (`Team.name`)
- Display name (`TeamSeason.displayName`) — no more FC Allschwil hardcode; derive from tenant name
- Short name (`TeamSeason.shortName`) — optional
- Slug (`Team.slug`) — auto-generated from name, editable, tenant-scoped uniqueness

Optional fields:
- Gender group (`Team.genderGroup`) — free-text
- Age group / level (`Team.ageGroup`) — free-text
- Sort order (`Team.sortOrder`)

Fields to remove/defer:
- `TeamCategory` enum — deprecated in favour of OrgUnit-based grouping; keep for backward compat during transition only

Derived fields (not user-entered):
- `tenantId` — from session
- `seasonId` — from Step 1

**Step 4 — SFV Connection (optional)**
- Three options: Link now / Create as manual team / Link later
- If "Link now": show SFV team selector scoped to current SFV season
- Show: provider name, league, SFV team ID, mapping status (already mapped / unmapped)
- Prevent duplicate mappings
- Do not auto-map by name

**Step 5 — Publishing (defaults)**
- `TeamSeason.websiteVisible` (default: true)
- `TeamSeason.infoboardVisible` (default: true)
- `TeamSeason.squadWebsiteVisible` (default: true)
- `TeamSeason.trainerTeamWebsiteVisible` (default: true)

**Step 6 — Review and Create**
- Summary: name, season, Organisationseinheiten, SFV status, publishing status
- Back navigation without data loss
- Single submit button
- Clear error feedback

### H.3 Stepper vs. Dialog vs. Full-Page

Given the existing design system patterns (`FormPagePattern`, `DetailPagePattern`), a **full-page multi-step flow** (not a dialog) is most appropriate. The step count (6) and required field density make a compact dialog inappropriate. A stepper component with step indicators and back/next navigation within the full-page pattern fits the existing SportClubEvo design language.

### H.4 Empty States

- No active season: show blocking message with link to Seasons admin.
- No OrgUnits for tenant: show blocking message with link to Organisation Builder.
- No SFV config: show "SFV integration not configured" with skip option.

### H.5 Accessibility

- Keyboard navigation through all form steps.
- ARIA labels on all controls.
- Screen reader announcements on step change.
- Error messages linked to their form fields via `aria-describedby`.

### H.6 Responsive Behaviour

Full-page form: single-column on mobile, two-column grid on tablet/desktop where appropriate. Consistent with existing `FormSection` component patterns.

---

## I. Teams Overview Target

### I.1 Season Context

The current overview (`app/(admin)/dashboard/teams/page.tsx`) already shows:
- Season context selector (via `SeasonContextSelector`)
- Category summary stats (via `TeamsCategorySummary`)
- Teams grid filtered by season (via `getTeamsListData(selectedSeasonKey)`)

**What is missing:**
- Team count per season
- OrgUnit-based grouping (only `TeamCategory` enum used today)
- SFV mapping status per row
- Player count per team
- Trainer count per team
- Setup warnings (no OrgUnit, no SFV mapping)
- Next match preview

### I.2 Grouping by OrgUnit

**Recommendation: Show once with multiple OrgUnit labels (not duplicated).**

Rationale: A team assigned to multiple OrgUnits (e.g. FF-17 assigned to both "Frauen" and "Junioren") appearing in two groups creates confusion about counts and makes the total count meaningless. Showing once with multi-valued labels is cleaner and honest.

Implementation: Show a primary OrgUnit (determined by `sortOrder` or first assigned) as the group header, with remaining OrgUnit chips inline on the team card.

For filtering: provide a multi-select OrgUnit filter that shows the team when any of its assigned OrgUnits matches the filter.

### I.3 Team Card Content (Recommended)

- Team display name
- Season key/name badge
- OrgUnit chip(s)
- SFV mapping status badge (mapped / unmapped / stale)
- Competition label (if known)
- Player count
- Trainer count
- Website visible badge
- Infoboard visible badge
- Setup warning indicators

### I.4 Setup Warnings

A team should show a warning badge when:
- No OrgUnit assigned
- No SFV mapping and SFV integration is active for tenant
- No players assigned for current season
- `TeamSeason.status = INACTIVE` during the active season

---

## J. Data Model Recommendation

All proposed changes are minimal and non-destructive. No model deletions.

### J.1 `Team.slug` — Change to Tenant-Scoped Uniqueness

| Property | Detail |
|---|---|
| Current | `@unique` globally |
| Target | `@@unique([tenantId, slug])` with `tenantId` required |
| Reason | Enables two tenants to have "aktive-1" without conflict. Website resolves by tenantId + slug already. |
| Migration impact | Remove `@unique` from `slug`; add `@@unique([tenantId, slug])`; requires `tenantId` to be NOT NULL first |
| Backfill | `tenantId` backfill (migration `20260626000000_team_tenant_isolation`) must complete before slug uniqueness change |
| Rollback risk | **Medium** — slug uniqueness change requires coordinated migration |

### J.2 `Team.category` — Deprecate as Primary Grouping

| Property | Detail |
|---|---|
| Current | `TeamCategory` enum required |
| Target | Nullable or `CUSTOM` default; primary grouping comes from OrgUnit |
| Reason | Eliminates hardcoded FC Allschwil categories from schema |
| Migration | `ALTER COLUMN category DROP NOT NULL` or add `CUSTOM` default |
| Rollback risk | Low — additive change |

### J.3 Many-to-Many `TeamSeason` ↔ `OrgUnit` Assignment

| Property | Detail |
|---|---|
| Model | New `TeamSeasonOrgUnit` join table |
| Fields | `id`, `teamSeasonId FK→TeamSeason`, `orgUnitId FK→OrgUnit`, `sortOrder Int @default(0)`, `isPrimary Boolean @default(false)`, `createdAt` |
| Unique | `@@unique([teamSeasonId, orgUnitId])` |
| Reason | Supports multiple OrgUnits per seasonal team; season-level assignment allows changes between seasons |
| Migration impact | New table only — non-destructive |
| Backfill | Backfill existing `Team.orgUnitId` rows into `TeamSeasonOrgUnit` for each existing `TeamSeason` |
| Mandatory validation | API must reject POST/PATCH with zero OrgUnit assignments |
| Archive | Assignments to archived OrgUnits preserved but excluded from new assignment UI |
| Tenant isolation | `orgUnitId` → `OrgUnit.tenantId` enforced at application layer |
| Alternative | Keep `Team.orgUnitId` as the single "primary" assignment and add a `TeamOrgUnit` join for additional assignments — reduces migration risk but adds two paths |

**Recommendation:** Season-level assignment via `TeamSeasonOrgUnit` is more semantically correct. Keep `Team.orgUnitId` temporarily as the legacy single-FK for backward compat with existing queries, but treat `TeamSeasonOrgUnit` as canonical going forward.

### J.4 `TeamExternalMapping.teamSeasonId` — Add Optional FK to TeamSeason

| Property | Detail |
|---|---|
| Field | `teamSeasonId String?` |
| FK | `→ TeamSeason` on `SetNull` |
| Reason | Links SFV mapping to the canonical operational season record |
| Migration | `ALTER TABLE TeamExternalMapping ADD COLUMN teamSeasonId TEXT REFERENCES "TeamSeason"(id) ON DELETE SET NULL` |
| Backfill | Match `TeamExternalMapping.externalSeasonId` against `TenantSfvConfig.defaultSeasonId` to find the correct `TeamSeason` |
| Unique | Optionally `@@unique([teamId, teamSeasonId, provider])` to prevent duplicate season mappings |
| Rollback risk | Low — additive nullable FK |

### J.5 `Team.websiteVisible` / `Team.infoboardVisible` — Move to `TeamSeason`

| Property | Detail |
|---|---|
| Current | On `Team` |
| Target | Also on `TeamSeason` (already exists). `Team` fields become the permanent default |
| Reason | Season-specific visibility is the correct ownership |
| Migration | No schema change needed — `TeamSeason.websiteVisible` already exists. Update public query to use `TeamSeason.websiteVisible` as the authoritative gate. |
| API impact | Public teams feed already uses `TeamSeason.websiteVisible` for squad/trainer visibility. Extend to top-level team visibility. |
| Rollback risk | Low |

### J.6 `Season.tenantId` — Future Tenant Scoping

| Property | Detail |
|---|---|
| Current | Season is global |
| Target | Add `tenantId` FK to scope seasons per tenant |
| Reason | Multi-tenant isolation. Two tenants may have different season start dates. |
| Migration impact | **High** — all season-referencing queries must be updated |
| Complexity | XL |
| Recommendation | Defer to TEAM-CORE-02 or a dedicated SEASON-01 slice. Not a blocker for TEAM-CORE-02. |

### J.7 `Person.tenantId` — Critical Missing Tenant Isolation

| Property | Detail |
|---|---|
| Current | `Person` has no `tenantId` |
| Concern | Any API listing `Person` records can expose cross-tenant person data |
| Indirect scoping | `PlayerSquadMember → TeamSeason → Team → Team.tenantId` provides indirect scoping |
| Direct risk | Person search endpoints (e.g. `app/(admin)/dashboard/persons/`) may not enforce tenant isolation |
| Migration | Add `tenantId String?` with backfill, then enforce NOT NULL |
| Priority | **Critical** — PERSON-01 must precede any feature that adds new Person search surfaces |

### J.8 `buildTeamSeasonDisplayName` Hardcode

| Property | Detail |
|---|---|
| Location | `lib/teams/team-season-rules.ts` line 19 |
| Issue | Hardcodes `"FC Allschwil "` prefix — tenant-specific logic in shared code |
| Fix | Accept tenant name as parameter, or derive from `Tenant.name` |
| Impact | `app/api/teams/route.ts` calls this — needs tenant name passed in |
| Risk | Low — simple function change with parameter addition |

### J.9 `TeamSeason.competition` — Add Structured Competition Field

| Property | Detail |
|---|---|
| Field | `competition String?` on `TeamSeason` |
| Reason | Store the competition name (league/group) on the seasonal team record |
| Alternative | Derive from `MatchExternalMapping.providerLeagueName` (fragile) |
| Better | New `TeamSeasonCompetition` model (see Section G.5) for full standings support |
| Priority | Medium — needed for TEAM-RANKING-01 |

---

## K. Person and Membership Findings

### K.1 Person Model — Critical Tenant Isolation Gap

`Person` has **no `tenantId`**. Fields:

| Field | Type |
|---|---|
| `id` | `String @id` |
| `firstName`, `lastName` | `String` |
| `displayName`, `email`, `phone` | `String?` |
| `dateOfBirth` | `DateTime?` |
| `notes` | `String?` |
| `isActive` | `Boolean @default(true)` |
| `isPlayer` | `Boolean @default(false)` |
| `isTrainer` | `Boolean @default(false)` |

**Missing fields (compared to product requirements):**
- No `gender` field
- No `photoUrl` field
- No `tenantId`

### K.2 Indirect Scoping Path

`PlayerSquadMember.personId → Person`
`PlayerSquadMember.teamSeasonId → TeamSeason.teamId → Team.tenantId`

This indirect path provides some protection, but:
1. A direct `Person` list endpoint (e.g. `GET /api/people`) can return all persons across all tenants unless explicitly filtered by the query.
2. The person search used when adding a player must be tenant-scoped — if it is not, it will show persons from other tenants.

### K.3 PlayerSquadMember

| Field | Notes |
|---|---|
| `teamSeasonId` | Seasonal scoping — correct |
| `personId` | FK to Person (no tenantId on Person) |
| `status` | `PlayerSquadStatus`: `ACTIVE`, `INACTIVE`, `INJURED`, `ABSENT`, `ARCHIVED` |
| `shirtNumber` | Optional |
| `positionLabel` | Free-text |
| `isCaptain`, `isViceCaptain` | Boolean flags |
| `isWebsiteVisible` | Individual visibility gate |
| `sortOrder` | Display ordering |
| `remarks` | Internal notes |

Unique: `@@unique([teamSeasonId, personId])` — a person cannot be in the same team-season twice.

### K.4 TrainerTeamMember

| Field | Notes |
|---|---|
| `teamSeasonId` | Seasonal scoping — correct |
| `personId` | FK to Person |
| `status` | `TrainerTeamStatus`: `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `roleLabel` | `String?` — **free-text trainer role** — no enum constraint |
| `isWebsiteVisible` | |
| `sortOrder` | |
| `remarks` | |

**No trainer role enum.** `roleLabel` is free text (e.g. "Cheftrainer", "Co-Trainer"). This is flexible but reduces type safety and makes role-based queries impossible without string matching.

### K.5 Privacy Risks from Person Tenant Isolation Gap

The public team detail endpoint (`lib/website/public-teams-feed.ts`) is safe: it explicitly excludes `personId`, `email`, `phone`, `dateOfBirth`, `remarks` from the response. However:

1. Admin endpoints that expose full `Person` objects may return cross-tenant data.
2. Person search used in roster management must be tenant-scoped.
3. GDPR/privacy: person records from Club A should never be visible to users of Club B.

### K.6 Reusability Across Seasons

`Person` is not recreated per season — correct. `PlayerSquadMember` and `TrainerTeamMember` link a `Person` to a `TeamSeason`. A new season requires new `PlayerSquadMember` rows, but the same `Person` records are reused.

---

## L. Training Contract

### L.1 Current Event Model for Trainings

`Event` with `type = TRAINING`:
- `teamId` — links to `Team`
- `seasonId` — season context
- `startAt`, `endAt` — session time
- `location` — free-text venue
- `pitchCode` — pitch allocation code (resolved to name via `FacilityResource`)
- `homeDressingRoomCode`, `awayDressingRoomCode` — dressing room codes
- `websiteVisible`, `trainingsplanVisible`, `wochenplanVisible` — publication flags
- `title`, `description` — session description
- `status` — EventStatus (SCHEDULED, CANCELLED, etc.)
- `source` — EventSource (MANUAL, CSV_EXCEL_IMPORT, etc.)

The public team detail API (`lib/website/public-teams-feed.ts`) fetches upcoming training events for the next 28 days, resolving `pitchCode` to a human-readable `pitchName`.

### L.2 Read-Only Team Contract

The Team page consumes training data in read-only mode from `Event`. Training creation/editing lives in the Planner module. The team page should only display:
- Upcoming sessions (next 7–28 days)
- Regular weekday/time pattern (derived from recurring events if available)
- Venue/pitch name
- Cancellation status

### L.3 Missing Recurring Schedule Model

Individual `Event` records cannot express a "recurring schedule" without database inspection. There is no `RecurringSchedule` model. The Planner module generates individual `Event` rows. To derive the training schedule (e.g. "Tuesday and Thursday 18:00–20:00"), the client must analyze a set of individual Event records and identify patterns.

This is a known limitation. A future `TrainingSchedule` model (with weekday, time, facility, validity dates) would enable direct schedule display without event pattern analysis.

---

## M. Website and Infoboard Impact

### M.1 Organisationseinheit Grouping

The public teams endpoint (`GET /api/public/[tenant]/website/teams`) currently returns:
```json
{
  "id": "...",
  "name": "...",
  "slug": "...",
  "category": "AKTIVE",
  "genderGroup": null,
  "ageGroup": null,
  "displayName": "...",
  "shortName": null,
  "season": { "key": "...", "name": "..." }
}
```

`category` is the current grouping key. The website frontend groups by `category`.

**Target contract:**
```json
{
  "id": "...",
  "name": "...",
  "slug": "...",
  "orgUnits": [{ "id": "...", "key": "...", "name": "Frauen", "sortOrder": 2 }],
  "displayName": "...",
  "shortName": null,
  "season": { "key": "...", "name": "..." }
}
```

`category` kept for backward compatibility. `orgUnits` added as the new canonical grouping field.

### M.2 Stable Slugs Across Season Rollover

`Team.slug` is the stable public URL key. Since `Team` is the permanent identity and `slug` lives on `Team`, the slug is season-stable by design. After a season rollover:
- The same `slug` resolves to the same `Team`.
- The public API fetches the `TeamSeason` for the active season automatically.
- No slug migration required on season rollover.

**Risk:** Slug is currently globally unique (not tenant-scoped). Two tenants cannot share a slug. See J.1.

### M.3 Active Seasonal Team Resolution

The public API resolves the active TeamSeason by:
1. `seasonKey` query param (if provided)
2. Fallback: `Season.isActive = true`

This is correct. The permanent `Team` identity is anchored by slug. The active operational data comes from `TeamSeason`.

### M.4 Publication Ownership

| Field | Current Owner | Target Owner |
|---|---|---|
| Top-level website visibility | `Team.websiteVisible` | `TeamSeason.websiteVisible` |
| Top-level infoboard visibility | `Team.infoboardVisible` | `TeamSeason.infoboardVisible` |
| Squad website visibility | `TeamSeason.squadWebsiteVisible` | `TeamSeason.squadWebsiteVisible` (correct) |
| Trainer website visibility | `TeamSeason.trainerTeamWebsiteVisible` | `TeamSeason.trainerTeamWebsiteVisible` (correct) |

### M.5 Matches and Results on Public API

`GET /api/public/[tenant]/website/matches` — filters by `teamSlug`, resolves team by slug, returns `Event` records with `resultLabel` and `intermediateResultLabel`.

Infoboard-specific: `Event.infoboardVisible = true` gates infoboard match display. Home matches for infoboard are identified by `Event.homeAway = "home"`.

### M.6 Historical Teams

A team with `Team.isActive = false` is excluded from the public teams list. Historical team pages (if preserved as static pages or archived routes) would return 404 unless a separate "show archived" mode is implemented. No such mode exists currently.

---

## N. Existing Data Inventory and Rebuild Plan

*Note: No live database access was available during this analysis. The rebuild plan is based on the schema, codebase, and product context. No records have been deleted, archived, remapped, or modified.*

### N.1 Dependency Map

Before any rebuild, the following dependency map must be produced from live data:

| Entity | Dependencies |
|---|---|
| `Team` | `TeamSeason[]`, `Event[]` (training/match/tournament), `TeamExternalMapping[]`, `MatchExternalMapping.homeTeamId/awayTeamId` |
| `TeamSeason` | `PlayerSquadMember[]`, `TrainerTeamMember[]` |
| `Person` | `PlayerSquadMember[]`, `TrainerTeamMember[]`, `OrgUnitMembership[]`, `NewsArticle.authorPersonId`, `WebsitePage.authorPersonId` |
| `Team.slug` | Public website URLs, website navigation links, infoboard references |
| `TeamExternalMapping` | Drives match sync via `homeTeamId`/`awayTeamId` resolution in schedule sync |
| `MatchExternalMapping.homeTeamId/awayTeamId` | If rebuilt teams get new IDs, these FK references break |

### N.2 Record Classification

| Category | Records |
|---|---|
| **Production — must preserve** | All `TeamSeason` with `PlayerSquadMember` or `TrainerTeamMember` records; all `Event.teamId` references for completed matches; all `TeamExternalMapping` rows with `lastSyncedAt` in current season |
| **Production — may remap** | `MatchExternalMapping.homeTeamId` / `awayTeamId` — remappable to new `Team.id` if Teams are rebuilt |
| **Historical — must archive** | `TeamSeason` records for prior seasons with empty rosters |
| **Test or validation data** | `TeamSeason` records created with no events, no squad members, no SFV mapping, created during development |
| **Orphaned** | `Event` records with `teamId` pointing to deleted or inactive teams |
| **Duplicate** | `TeamExternalMapping` rows where the same SFV `externalTeamId + externalSeasonId` appears twice (should not exist given the unique constraint, but worth verifying) |
| **Safe deletion candidates** | Development/test Teams with no `TeamSeason`, no `Event`, no `TeamExternalMapping` |
| **Uncertain** | Any `Team` without a `tenantId` — must be manually confirmed as FC Allschwil or garbage |

### N.3 Recommended Strategy: Hybrid (B + C + D)

**B. Create clean seasonal teams and remap dependencies** — for teams where a fresh start is desired  
**C. Archive old records after replacement** — never hard-delete production records  
**D. Delete test data only** — with explicit approval per record

**Execution sequence (do not execute in this task):**

1. Export: dump all `Team`, `TeamSeason`, `TeamExternalMapping`, `MatchExternalMapping`, `PlayerSquadMember`, `TrainerTeamMember` to a versioned JSON export.
2. Build mapping table: `old_team_id → new_team_id` for all production teams.
3. Create replacement teams (if chosen) with correct OrgUnit assignments, season context, and `tenantId`.
4. Validate SFV mappings: confirm `externalTeamId + externalSeasonId` resolves correctly to new teams.
5. Remap `MatchExternalMapping.homeTeamId / awayTeamId` to new team IDs.
6. Remap `Event.teamId` references.
7. Validate results: check match counts, player counts, trainer counts match expectations.
8. Validate website: confirm all team slugs resolve correctly.
9. Archive old teams: set `Team.isActive = false` on replaced teams.
10. Rollback plan: restore from JSON export or database snapshot.

### N.4 Validation Gates (before deletion)

- Export completed and verified
- Mapping table completed
- Replacement teams visible in UI
- SFV sync completed against new teams
- Match counts match prior season
- Player roster migrated or manually assigned
- Website team pages resolve correctly
- Infoboard team references correct
- Rollback tested against backup

---

## O. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `Person` has no `tenantId` — cross-tenant person data leakage | **Critical** | PERSON-01 must precede any new person-surfacing features. Audit all `Person` list/search endpoints before TEAM-ROSTER-01. |
| `TeamExternalMapping` linked to `Team` not `TeamSeason` — wrong season's SFV data resolves | **High** | Add `teamSeasonId` FK (TEAM-CORE-02). Validate `externalSeasonId` against active season before all sync operations. |
| `Team.slug` globally unique — prevents multi-tenant slug reuse | **High** | Change to `@@unique([tenantId, slug])` in TEAM-CORE-02. Requires `tenantId` NOT NULL on all Team records first. |
| `buildTeamSeasonDisplayName` hardcodes "FC Allschwil" | **High** | Simple fix in TEAM-CORE-02. Breaks display name for any non-FC-Allschwil tenant. |
| Season is not tenant-scoped — seasons shared globally | **Medium** | Defer to SEASON-01. Document current limitation. FC Allschwil is the only tenant — risk is theoretical now. |
| `Team.orgUnitId` single FK — no multi-OrgUnit support | **Medium** | Add `TeamSeasonOrgUnit` join table in TEAM-CORE-02. Backfill existing single assignments. |
| `TeamCategory` enum hardcoded to FC Allschwil groupings | **Medium** | Deprecate as primary grouping in favour of OrgUnit in TEAM-CORE-02. Keep enum for backward compat during transition. |
| No ranking persistence — rankings lost on SFV API unavailability | **Medium** | Add `TeamSeasonRanking` model in TEAM-RANKING-01. Implement stale-while-revalidate pattern. |
| `Event.resultLabel` overwritten by sync — manual overrides lost | **Medium** | Define clear field ownership in TEAM-RESULTS-01. Add `manualResultLabel` or `resultOverride` flag. |
| `Team.websiteVisible` on permanent identity — can't control per season | **Medium** | Move to `TeamSeason.websiteVisible` as canonical (already exists) in TEAM-CORE-02. |
| No unresolved SFV matches/teams queue | **Low** | Build in TEAM-SFV-01 and TEAM-MATCH-LINK-01. Not a data risk, only an operational UX gap. |
| Training data is individual Events — no recurring schedule model | **Low** | Document limitation. Implement `TrainingSchedule` model in TEAM-TRAINING-01. |
| `Season.isActive` flag — no DB uniqueness constraint for single active season | **Low** | Add application-level guard in season activation endpoint. |

---

## P. Implementation Roadmap

### TEAM-CORE-02 — Seasonal Team and Organisationseinheit Data Foundation

| | |
|---|---|
| **Objective** | Make season mandatory; add many-to-many OrgUnit assignment; fix slug uniqueness; fix displayName hardcode; link TeamExternalMapping to TeamSeason |
| **Dependencies** | None — must be first |
| **Schema** | New `TeamSeasonOrgUnit` join table; `TeamExternalMapping.teamSeasonId nullable FK`; `Team.slug` → `@@unique([tenantId, slug])`; backfill `Team.tenantId` NOT NULL; `TeamCategory` nullable |
| **Migration** | 3–4 migrations; backfill scripts for `Team.tenantId`, `TeamSeasonOrgUnit` from existing `Team.orgUnitId`, `TeamExternalMapping.teamSeasonId` |
| **API** | `POST /api/teams` — require `orgUnitIds[]`; update validation; update `buildTeamSeasonDisplayName` to use tenant name; `PATCH /api/teams/[id]` — support multi-OrgUnit |
| **UI** | Minimal: add OrgUnit multi-select to existing form (not yet the full multi-step UX) |
| **Tests** | Unit tests for `buildTeamSeasonDisplayName`; API validation tests; backfill script tests |
| **Data migration** | Backfill all three fields above |
| **Rollback** | All changes additive; revert migrations in reverse order |
| **Risk** | Medium — slug uniqueness change requires coordinated migration |
| **Complexity** | **L** |

### TEAM-CREATE-01 — Premium Team Registration Flow

| | |
|---|---|
| **Objective** | Replace single-page form with 6-step premium flow |
| **Dependencies** | TEAM-CORE-02 (multi-OrgUnit assignment, mandatory season) |
| **Schema** | None |
| **Migration** | None |
| **API** | No new APIs needed — uses existing `POST /api/teams` |
| **UI** | New `TeamCreateStepper` component replacing `TeamCreateForm`; step state management; validation per step |
| **Tests** | Component tests for each step; integration test for full creation flow |
| **Data migration** | None |
| **Rollback** | Replace new component with old form |
| **Risk** | Low |
| **Complexity** | **M** |

### TEAM-SFV-01 — Seasonal SFV Team Mapping

| | |
|---|---|
| **Objective** | Build SFV mapping UI for seasonal teams; unmapped SFV teams queue; duplicate protection |
| **Dependencies** | TEAM-CORE-02 (`TeamExternalMapping.teamSeasonId`) |
| **Schema** | `TeamExternalMapping.teamSeasonId NOT NULL` upgrade (after backfill) |
| **Migration** | Set `teamSeasonId NOT NULL` after backfill validates |
| **API** | New `GET /api/teams/sfv-unmapped?seasonId=` endpoint; update team-mappings route to use TeamSeason |
| **UI** | SFV mapping panel in Team detail page; unmapped queue in integrations dashboard |
| **Tests** | Mapping service tests; duplicate prevention tests |
| **Data migration** | Backfill `teamSeasonId` values |
| **Rollback** | Revert `NOT NULL` constraint |
| **Risk** | Medium |
| **Complexity** | **M** |

### TEAM-MATCH-LINK-01 — Match and Tournament Resolution

| | |
|---|---|
| **Objective** | Mapping queue for unresolved events; preserve manual overrides; season safeguards |
| **Dependencies** | TEAM-SFV-01 |
| **Schema** | Possibly `MatchExternalMapping.teamSeasonId FK` |
| **Migration** | Additive FK if added |
| **API** | `GET /api/matchcenter/unresolved` queue endpoint |
| **UI** | Unresolved matches queue in Matchcenter admin |
| **Tests** | Resolution logic tests; season boundary tests |
| **Rollback** | Remove queue endpoint |
| **Risk** | Low |
| **Complexity** | **M** |

### TEAM-RESULTS-01 — Seasonal Results Contract

| | |
|---|---|
| **Objective** | Define field ownership between SFV and manual; add `manualResultLabel` if needed |
| **Dependencies** | TEAM-MATCH-LINK-01 |
| **Schema** | Possibly `Event.manualResultLabel String?`; `Event.resultSource String?` |
| **Migration** | Additive fields only |
| **API** | Update `PATCH /api/events/[id]` to respect ownership rules |
| **Tests** | Conflict resolution tests |
| **Rollback** | Remove new fields |
| **Risk** | Low |
| **Complexity** | **S** |

### TEAM-RANKING-01 — Seasonal Competition and Standings

| | |
|---|---|
| **Objective** | Persist rankings; add competition context to TeamSeason |
| **Dependencies** | TEAM-SFV-01 |
| **Schema** | `TeamSeason.competition String?`; new `TeamSeasonRanking` model |
| **Migration** | New table; backfill competition from match `competitionLabel` |
| **API** | `GET /api/teams/[id]/ranking?seasonId=`; `GET /api/public/[tenant]/website/teams/[slug]/ranking` |
| **Tests** | Ranking fetch tests; stale data tests |
| **Rollback** | Drop `TeamSeasonRanking` table; remove `competition` field |
| **Risk** | Low |
| **Complexity** | **M** |

### PERSON-01 — Tenant-Scoped Persons Foundation

| | |
|---|---|
| **Objective** | Add `Person.tenantId`; add `Person.gender`, `Person.photoUrl`; audit all person endpoints |
| **Dependencies** | None — but must precede TEAM-ROSTER-01 |
| **Schema** | `Person.tenantId String?`; `Person.gender String?`; `Person.photoUrl String?` |
| **Migration** | Add columns; backfill `tenantId` from `PlayerSquadMember → TeamSeason → Team.tenantId` (heuristic) |
| **API** | All person search endpoints must add `WHERE Person.tenantId = session.tenantId` |
| **Tests** | Cross-tenant isolation tests |
| **Rollback** | Remove columns; restore unscoped queries |
| **Risk** | **Critical risk if not done** — Medium complexity |
| **Complexity** | **L** |

### TEAM-ROSTER-01 — Seasonal Players, Trainers and Staff

| | |
|---|---|
| **Objective** | Roster management with roles; trainer role standardisation |
| **Dependencies** | PERSON-01 |
| **Schema** | Possibly `TrainerTeamMember.role TrainerRole enum?` |
| **Migration** | Add enum type and column if role enum added |
| **API** | Squad and trainer CRUD already exists; add roster copy between seasons |
| **UI** | Improved roster management UI with inline person search (tenant-scoped) |
| **Tests** | Roster assignment tests; role tests |
| **Rollback** | Remove enum |
| **Risk** | Low post-PERSON-01 |
| **Complexity** | **M** |

### TEAM-TRAINING-01 — Read-only Training Summary

| | |
|---|---|
| **Objective** | Consume Planner training events on Team page |
| **Dependencies** | None |
| **Schema** | None |
| **Migration** | None |
| **API** | Already: `getPublicTeamDetail()` fetches training events. Add admin team training summary. |
| **UI** | Training schedule panel on team detail page |
| **Tests** | Training query tests |
| **Rollback** | Remove panel |
| **Risk** | Low |
| **Complexity** | **S** |

### TEAM-WEB-01 — Website Grouping and Publishing

| | |
|---|---|
| **Objective** | OrgUnit-driven public grouping; stable slugs; section visibility |
| **Dependencies** | TEAM-CORE-02 (multi-OrgUnit assignment) |
| **Schema** | None beyond TEAM-CORE-02 |
| **Migration** | None |
| **API** | Update `getPublicTeams()` to include `orgUnits[]`; update response shape |
| **UI** | Frontend website grouping change (outside this app scope) |
| **Tests** | Public API contract tests |
| **Rollback** | Revert API response shape change |
| **Risk** | Medium — public API contract change |
| **Complexity** | **M** |

### TEAM-INFOBOARD-01 — Seasonal Team Infoboard Contract

| | |
|---|---|
| **Objective** | Correct home match/tournament resolution; seasonal team linking |
| **Dependencies** | TEAM-MATCH-LINK-01 |
| **Schema** | None |
| **Migration** | None |
| **API** | Verify infoboard match filtering uses correct seasonal team |
| **UI** | Infoboard team visibility toggle on TeamSeason |
| **Tests** | Infoboard match filter tests |
| **Rollback** | Revert filter changes |
| **Risk** | Low |
| **Complexity** | **S** |

### TEAM-DATA-01 — Controlled FC Allschwil Team Rebuild

| | |
|---|---|
| **Objective** | Export → mapping table → rebuild teams → remap dependencies → validate → archive → delete approved test data |
| **Dependencies** | All prior slices complete and validated |
| **Schema** | None |
| **Migration** | None |
| **API** | None |
| **UI** | Admin data rebuild workflow |
| **Tests** | Pre- and post-rebuild record counts must match |
| **Data migration** | Export, remap, relink — see Section N |
| **Rollback** | Restore from snapshot before any rebuild step |
| **Risk** | **High** — irreversible if not done in correct order with snapshot |
| **Complexity** | **XL** |

---

## Q. Recommended Next Slice

### Recommendation: TEAM-CORE-02 — Seasonal Team and Organisationseinheit Data Foundation

**Prompt title:** `TEAM-CORE-02 — Seasonal Team and Organisationseinheit Data Foundation`

**Why it must come next:**

1. **It unblocks everything else.** Every subsequent slice depends on: (a) OrgUnit assignment being mandatory and multi-valued, (b) `Team.slug` being tenant-scoped, (c) `TeamExternalMapping` being linked to `TeamSeason`. Without TEAM-CORE-02, no other slice can proceed on correct foundations.

2. **It fixes the most immediately user-visible gap.** The FC Allschwil public Teams page groups teams by "Aktive", "Frauen", etc. These groupings currently come from a hardcoded `TeamCategory` enum. After TEAM-CORE-02, they come from the Organisation Builder — which is the product-correct, maintainable path.

3. **It is non-destructive.** All changes are additive or constraint changes. No records are deleted. No data is lost. The existing `Team.orgUnitId` single FK remains until the full migration is validated.

4. **It corrects the `buildTeamSeasonDisplayName` hardcode** before more teams are created with "FC Allschwil" baked into their display names.

5. **It closes the `teamSeasonId` gap on `TeamExternalMapping`** before the next SFV sync season begins, preventing the accumulation of un-linked mapping rows.

6. **It does not require PERSON-01 to be complete first.** Person tenant isolation is critical but does not block the data model foundation for teams. PERSON-01 should follow immediately after TEAM-CORE-02 (before TEAM-ROSTER-01).

7. **The existing `cursor/people-teams-ux-reset-c9f0-v2` branch** (visible in `git branch -a`) suggests prior UX work. TEAM-CORE-02 should be checked against that branch to avoid redundant effort and ensure the data model changes are compatible.

**Smallest safe scope for TEAM-CORE-02:**

1. Make `Team.tenantId` NOT NULL (migration prerequisite — already partially done)
2. Change `Team.slug` to `@@unique([tenantId, slug])`
3. Create `TeamSeasonOrgUnit` join table with required-at-least-one validation
4. Add `TeamExternalMapping.teamSeasonId nullable FK`
5. Fix `buildTeamSeasonDisplayName` to accept tenant name parameter
6. Update `POST /api/teams` and `PATCH /api/teams/[id]` to enforce multi-OrgUnit with mandatory minimum
7. Backfill existing `Team.orgUnitId` into `TeamSeasonOrgUnit` for all existing TeamSeasons

No UI redesign required. No creation flow redesign required. No website changes required. These are purely data model and API correctness changes that unblock all subsequent product work.

---

*End of TEAM-CORE-01 Analysis Report*
*No code, schema, migration, API, service, or data changes were made in this task.*
*Analysis branch: `feature/team-core-01-seasonal-registration-inventory`*
