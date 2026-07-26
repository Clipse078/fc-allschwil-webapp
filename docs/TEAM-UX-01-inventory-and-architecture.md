# TEAM-UX-01 — Teams & Persons Module Inventory and Premium Information Architecture

**Project:** SportClubEvo Webapp  
**Tenant:** FC Allschwil  
**Branch:** `cursor/team-ux-01-inventory-and-architecture-7599`  
**Status:** Design-only — no implementation, no schema changes, no migrations  
**Date:** 2026-07-26

---

## A. Repository State

| Item | Value |
|---|---|
| Remote origin | `https://github.com/Clipse078/sportclubevo-webapp` |
| Base branch | `STAGE` |
| HEAD | `e5ebb03 Merge PUB-02 canonical match publication` |
| Feature branch | `cursor/team-ux-01-inventory-and-architecture-7599` |
| Working tree | Clean — no uncommitted changes |
| Active Git operations | None |
| Local STAGE | In sync with `origin/STAGE` at `e5ebb03` |

Branch created from `STAGE`. No merge. No deployment. Documentation only.

---

## B. Current Module Inventory

### B.1 Teams

#### Routes and Pages

| Path | Type | Description |
|---|---|---|
| `/dashboard/teams` | Page (RSC) | Teams overview, season-filtered, category-grouped |
| `/dashboard/teams/new` | Page (RSC) | Team creation form |
| `/dashboard/teams/[teamId]` | Page (RSC) | Team detail — settings, seasons, roster, trainers |
| `/api/teams` | API route | `GET` list all teams; `POST` create team |
| `/api/teams/[teamId]` | API route | `GET` single team; `PATCH` update team |
| `/api/teams/[teamId]/team-seasons` | API route | `GET` list team seasons; `POST` create team season |
| `/api/teams/[teamId]/team-seasons/[teamSeasonId]` | API route | `PATCH` update team season |
| `/api/teams/[teamId]/team-seasons/[teamSeasonId]/squad-members` | API route | `GET` list squad; `POST` assign player |
| `/api/teams/[teamId]/team-seasons/[teamSeasonId]/squad-members/[squadMemberId]` | API route | `PATCH` update; `DELETE` remove player |
| `/api/teams/[teamId]/team-seasons/[teamSeasonId]/trainer-members` | API route | `GET` list trainers; `POST` assign trainer |
| `/api/teams/[teamId]/team-seasons/[teamSeasonId]/trainer-members/[trainerMemberId]` | API route | `PATCH` update; `DELETE` remove trainer |
| `/api/team-seasons/[teamSeasonId]` | API route | Standalone `PATCH` for team season (used by the season edit form) |
| `/api/public/[tenant]/website/teams` | Public API | Website team list |
| `/api/public/[tenant]/website/teams/[slug]` | Public API | Website team detail |
| `/api/admin/integrations/sfv/teams/sync` | Admin API | Trigger SFV team sync |

#### UI Components

| Component | Description |
|---|---|
| `TeamsOverviewGrid` | Category-grouped list of team cards with visibility indicators |
| `TeamsCategorySummary` | Compact summary bar showing count per category |
| `TeamDetailCard` | Client orchestrator that holds team state and delegates to sub-cards |
| `TeamSettingsCard` | Edit team master data (name, slug, category, org unit, visibility) |
| `TeamSeasonCreateCard` | Form to register a team for a new season |
| `TeamSeasonListCard` | Expandable list of all team seasons |
| `TeamRosterOverviewCard` | Read-only roster overview across all team seasons |
| `TeamSquadManagementCard` | Add/edit/remove players for a specific team season |
| `TeamTrainerManagementCard` | Add/edit/remove trainers for a specific team season |
| `TeamsTable` | Alternative table-style teams list (not used in current pages) |
| `TeamSeasonEditForm` | Client-side form for editing a team season's settings |

#### Library

| File | Description |
|---|---|
| `lib/teams/queries.ts` | `getAvailableTeamSeasons`, `getTeamsListData`, `getTeamDetailData` |
| `lib/teams/team-squad-queries.ts` | `getTeamSeasonSquadData`, `getTeamSquadOverviewData` |
| `lib/teams/team-season-rules.ts` | Name normalization, slug generation, display name helpers |
| `lib/teams/jahrgang-rules.ts` | Birth-year validation for junior categories per season |
| `lib/website/public-teams-feed.ts` | `getPublicTeams`, `getPublicTeamDetail` — privacy-safe public feed |

### B.2 Persons

#### Routes and Pages

| Path | Type | Description |
|---|---|---|
| `/dashboard/persons` | Page (RSC) | Full person list with search |
| `/dashboard/persons/new` | Page (RSC) | Create new person |
| `/dashboard/persons/[id]` | Page (RSC) | Person detail view |
| `/dashboard/persons/[id]/edit` | Page (RSC) | Person edit form |
| `/api/people` | API route | `GET` list; `POST` create |
| `/api/people/[id]` | API route | `GET` single; `PATCH` update |
| `/api/people/search` | API route | Search persons (used by `PeoplePicker`) |

#### UI Components

| Component | Description |
|---|---|
| `PersonForm` | Create/edit form for person master data |
| `PersonSearchableList` | Client-side searchable person list |
| `PersonsList` | Base person list component |
| `PeoplePicker` (shared) | Modal picker used when assigning persons to team seasons |

#### Library

| File | Description |
|---|---|
| `lib/people/queries.ts` | `getPersons`, `getPersonById` |

### B.3 Players (standalone)

- `/dashboard/players` page exists but renders an **empty array**. No real data is wired. Status: placeholder skeleton only.

### B.4 Trainers (standalone)

- `/dashboard/trainers` page exists but renders an **empty array**. No real data is wired. Status: placeholder skeleton only.

### B.5 Training / Planner

- Training is managed under `/dashboard/planner` (Trainingplanner).
- Training events are stored as `Event` records with `type = TRAINING`, associated to a `Team` via `Event.teamId` and to a `Season` via `Event.seasonId`.
- The public teams feed (`getPublicTeamDetail`) already queries training events for the next 28 days and returns them in the public team detail response.
- No structured recurring-training model exists. Training is stored as individual `Event` rows. There is no `TrainingSchedule`, `RecurringTraining`, or `TrainingSlot` model.
- `Event` fields relevant to training: `startAt`, `endAt`, `location`, `pitchCode`, `homeDressingRoomCode`, `awayDressingRoomCode`, `websiteVisible`, `trainingsplanVisible`, `teamPageVisible`.

### B.6 Facilities

- Modelled as `Facility` and `FacilityResource` (tenant-scoped).
- `FacilityResourceType`: `FULL_PITCH`, `HALF_PITCH`, `DRESSING_ROOM`, `OTHER`.
- Events reference resources via `pitchCode`, `homeDressingRoomCode`, `awayDressingRoomCode` (string codes, not FK).
- Display helpers in `lib/facilities/display-helpers.ts` resolve codes to names.
- The public training feed resolves `pitchCode` → human name via `FacilityResource`; raw codes are never exposed publicly.

### B.7 Matchcenter Integration

- Matches are `Event` records (`type = MATCH`) with a `MatchExternalMapping` row linking to the SFV/ClubCorner provider.
- `MatchExternalMapping` holds `homeTeamId` / `awayTeamId` as nullable FKs to the canonical `Team` model.
- `TeamExternalMapping` maps a canonical `Team` to an external SFV team identity per season.
- No FK from `TeamExternalMapping` or `MatchExternalMapping` to `TeamSeason`. The linkage is: `Team` ↔ SFV external team, per season via `externalSeasonId`.

### B.8 Website Publishing

- `Team.websiteVisible` (Boolean, default `true`) — gates the whole team from the public website.
- `TeamSeason.websiteVisible` (Boolean, default `true`) — season-level gate.
- `TeamSeason.squadWebsiteVisible` (Boolean, default `true`) — gates squad list per season.
- `TeamSeason.trainerTeamWebsiteVisible` (Boolean, default `true`) — gates trainer list per season.
- `PlayerSquadMember.isWebsiteVisible` (Boolean, default `true`) — gates individual player.
- `TrainerTeamMember.isWebsiteVisible` (Boolean, default `true`) — gates individual trainer.
- Public API enforces all three layers: team visibility → season visibility → member visibility.

### B.9 Infoboard Publishing

- `Team.infoboardVisible` (Boolean, default `true`) — team-level gate.
- `TeamSeason.infoboardVisible` (Boolean, default `true`) — season-level gate.
- No member-level infoboard visibility flag currently exists.

### B.10 Permissions

| Key | Description |
|---|---|
| `teams.view` | Read teams and team seasons |
| `teams.manage` | Create, update, delete teams and team seasons; manage squad and trainers |
| `people.view` | Read persons |
| `people.manage` | Create and update persons |

### B.11 Tests

- No unit or integration tests exist for the Teams UI pages or for `lib/teams/`.
- SFV sync tests exist for `team-mapper`, `sync-teams`, `team-list`, `team-picture` in `lib/integrations/sfv/__tests__/`.
- Matchcenter team-mapping service has tests in `lib/matchcenter/__tests__/`.
- Jahrgang rules have no dedicated tests.

### B.12 Translations

- Only one i18n messages file exists: `messages/de.json`. It contains only a `Workspace` namespace. Teams, Persons, and Season modules are not translated via `next-intl` or equivalent — labels are currently hardcoded German strings in component files.

---

## C. Current Data Model

### C.1 Model Map

```
Tenant
├── Team (1:N)
│   ├── TeamSeason (1:N) — seasonal participation record
│   │   ├── PlayerSquadMember (1:N) → Person
│   │   └── TrainerTeamMember (1:N) → Person
│   ├── Event (1:N via teamId) — matches and training events
│   ├── EventImportRun (1:N)
│   ├── TeamExternalMapping (1:N) — SFV / provider identities
│   ├── MatchExternalMapping (via homeTeamId / awayTeamId)
│   └── OrgUnit (N:1 via orgUnitId)
│
├── Person (1:N, tenant-global)
│   ├── PlayerSquadMember (1:N) → TeamSeason
│   ├── TrainerTeamMember (1:N) → TeamSeason
│   └── OrgUnitMembership (1:N)
│
└── Season (1:N, global — not tenant-scoped)
    ├── TeamSeason (1:N via seasonId)
    ├── Event (1:N via seasonId)
    └── OrgUnitMembership (1:N via seasonId)
```

### C.2 Model Details

#### `Season`

| Field | Type | Notes |
|---|---|---|
| `id` | String | CUID primary key |
| `key` | String | Unique short identifier (e.g. `"2025-26"`) |
| `name` | String | Display name (e.g. `"Saison 2025/2026"`) |
| `startDate` | DateTime | Season start |
| `endDate` | DateTime | Season end |
| `isActive` | Boolean | At most one active season at a time |

**Ownership:** Global (not tenant-scoped). All tenants share the same Season table.  
**Permanent vs seasonal:** Permanent identity record.  
**Archive behaviour:** No `status` or `archivedAt` field — seasons are never explicitly archived; they become historical when `isActive` becomes false.  
**Deletion:** No cascade prevention — deletion would cascade to TeamSeason, Event, OrgUnitMembership.

#### `Team`

| Field | Type | Notes |
|---|---|---|
| `id` | String | CUID primary key |
| `name` | String | Internal canonical name |
| `slug` | String | Globally unique URL slug |
| `category` | TeamCategory | `KINDERFUSSBALL / JUNIOREN / AKTIVE / FRAUEN / SENIOREN / TRAININGSGRUPPE` |
| `genderGroup` | String? | Optional (e.g. `"Männer"`, `"Frauen"`) |
| `ageGroup` | String? | Optional short label (e.g. `"E"`, `"B"`) |
| `sortOrder` | Int | Display ordering |
| `isActive` | Boolean | Not seasonal — active at the Team level |
| `websiteVisible` | Boolean | **Permanent** — owned by the Team, not the TeamSeason |
| `infoboardVisible` | Boolean | **Permanent** — owned by the Team, not the TeamSeason |
| `tenantId` | String? | Nullable FK (backfill migration applied) |
| `orgUnitId` | String? | Optional link to OrgUnit |

**Ownership:** Tenant-scoped (via `tenantId`).  
**Permanent vs seasonal:** Permanent identity/lineage object.  
**Archive behaviour:** `isActive = false` is the soft-archive mechanism. No `archivedAt`.  
**Deletion:** No protected deletion logic — only cascades.  
**External mappings:** `TeamExternalMapping` links this to SFV provider per `externalSeasonId`.  
**Unique constraints:** `slug` globally unique (not tenant-scoped — potential multi-tenant issue).

#### `TeamSeason`

| Field | Type | Notes |
|---|---|---|
| `id` | String | CUID primary key |
| `teamId` | String | FK to Team |
| `seasonId` | String | FK to Season |
| `displayName` | String | Season-specific display name |
| `shortName` | String? | Short form (e.g. `"E4"`) |
| `status` | TeamSeasonStatus | `ACTIVE / INACTIVE / ARCHIVED` |
| `websiteVisible` | Boolean | Season-level website gate |
| `infoboardVisible` | Boolean | Season-level infoboard gate |
| `squadWebsiteVisible` | Boolean | Gates public display of squad list |
| `trainerTeamWebsiteVisible` | Boolean | Gates public display of trainer list |

**Ownership:** Belongs to the `(Team, Season)` pair. Not tenant-scoped directly (inherits via Team).  
**Permanent vs seasonal:** Seasonal — this is the operational entity.  
**Archive behaviour:** `status = ARCHIVED`.  
**Deletion:** Cascades from Team and Season. `PlayerSquadMember` and `TrainerTeamMember` cascade on delete.  
**Unique constraints:** `@@unique([teamId, seasonId])` — one registration per team per season.

#### `Person`

| Field | Type | Notes |
|---|---|---|
| `id` | String | CUID primary key |
| `firstName` | String | Required |
| `lastName` | String | Required |
| `displayName` | String? | Optional override |
| `email` | String? | |
| `phone` | String? | |
| `dateOfBirth` | DateTime? | Used for jahrgang validation |
| `notes` | String? | |
| `isActive` | Boolean | Soft status |
| `isPlayer` | Boolean | Flat flag — not seasonal |
| `isTrainer` | Boolean | Flat flag — not seasonal |

**Ownership:** Not tenant-scoped (no `tenantId` on `Person`). This is a significant issue — persons are globally shared across tenants.  
**Permanent vs seasonal:** Permanent reusable identity, consistent with the intended model.  
**Roles:** `isPlayer` / `isTrainer` are boolean flags on the Person record, not derived from assignments. They must be manually maintained.  
**Photo:** No photo field on `Person`. No `photoUrl` or `mediaAssetId`.  
**Gender:** No gender field on `Person`.  
**Multiple assignments:** Supported via `PlayerSquadMember` and `TrainerTeamMember` (multiple team seasons).  
**Multiple seasons:** Supported — a Person can be assigned to many TeamSeasons.  
**Archive:** `isActive = false`. No `archivedAt`.

#### `PlayerSquadMember`

| Field | Type | Notes |
|---|---|---|
| `teamSeasonId` | String | FK to TeamSeason |
| `personId` | String | FK to Person |
| `status` | PlayerSquadStatus | `ACTIVE / INACTIVE / INJURED / ABSENT / ARCHIVED` |
| `shirtNumber` | Int? | |
| `positionLabel` | String? | Free-text label |
| `isCaptain` | Boolean | |
| `isViceCaptain` | Boolean | |
| `isWebsiteVisible` | Boolean | |
| `sortOrder` | Int | |
| `remarks` | String? | |

**Roles supported:** Captain, Vice Captain — no goalkeeper, no role enum. Role is a free-text `positionLabel`.

#### `TrainerTeamMember`

| Field | Type | Notes |
|---|---|---|
| `teamSeasonId` | String | FK to TeamSeason |
| `personId` | String | FK to Person |
| `status` | TrainerTeamStatus | `ACTIVE / INACTIVE / ARCHIVED` |
| `roleLabel` | String? | Free-text (e.g. `"Cheftrainer"`, `"Assistenztrainer"`) |
| `isWebsiteVisible` | Boolean | |
| `sortOrder` | Int | |
| `remarks` | String? | |

**Roles supported:** Free-text `roleLabel` only. No enum for `HEAD_COACH`, `ASSISTANT_COACH`, etc.

---

## D. UX Findings

### D.1 Critical

**D.1.1 Teams Overview — No squad or trainer count on cards.**  
Team cards on the overview grid show `Team name`, `Season`, visibility badges, and status. They do not show player count, trainer count, or any operational readiness indicators. An admin cannot scan the overview to identify which teams are fully configured.

**D.1.2 Team Detail — Represents a permanent Team, not a seasonal team.**  
The Team Detail page (`/dashboard/teams/[teamId]`) shows the permanent `Team` object (name, slug, category, org unit, global visibility). The TeamSeason entries are shown as a subordinate list ("Saisoneinträge") in the sidebar. The primary entity presented to the user is the permanent Team, not the current season's operational record. This contradicts the season-first philosophy.

**D.1.3 Season selection is absent from Team Detail.**  
There is no season selector on the Team Detail page. The user sees all team seasons in a list but cannot switch context to "view this team as it exists in season 2026/2027". Players and trainers are loaded per TeamSeason but the context is not clearly communicated.

**D.1.4 Website and Infoboard visibility are split across Team and TeamSeason without clear UX separation.**  
`Team.websiteVisible` and `Team.infoboardVisible` are permanent flags that apply across all seasons. `TeamSeason.websiteVisible` and `TeamSeason.infoboardVisible` are season-specific. There is no UX distinction made between these two layers. An admin editing visibility on the Season form does not see that a permanent team-level flag might override or interact with the season flag.

**D.1.5 Person model is not tenant-scoped.**  
The `Person` model has no `tenantId`. Persons are shared globally across all tenants. This is a tenant isolation risk in a multi-tenant system. The People list (`getPersons`) does not filter by tenant.

**D.1.6 No photo support on Person.**  
`Person` has no photo field. The public team detail API returns `photo: null` for all squad members and trainers. Photo upload is deferred but the model must be prepared.

**D.1.7 Training is not represented on the Team module.**  
There is no training summary visible on the Team Detail or Teams Overview. The only training data available comes from individual `Event` records. The admin must navigate to the Planner module to see training times.

**D.1.8 Competition / Liga information is missing from Team.**  
Teams have no competition or league field. Competition label exists only on `Event` records as `competitionLabel` (a string copied from the SFV provider). There is no way to display "which league does Erste Mannschaft play in?" on the Team page without querying recent events.

**D.1.9 Players and Trainers standalone pages are empty stubs.**  
`/dashboard/players` and `/dashboard/trainers` render empty arrays with no real data. These pages exist in the navigation but provide no value.

**D.1.10 Season is globally shared — not tenant-scoped.**  
The `Season` model has no `tenantId`. All tenants share the same seasons. This works for Swiss football (shared national calendar) but creates coupling. If a tenant operates on a different season cycle it cannot register its own seasons.

### D.2 Important

**D.2.1 No empty states for squad and trainer management.**  
When a team season has no players or trainers the management card does not provide a clear call-to-action hierarchy. The picker appears but there is no explanatory empty state.

**D.2.2 isPlayer / isTrainer are manual Boolean flags on Person, not derived from assignments.**  
These flags must be manually set by the admin. They are not automatically set when a person is assigned as a player or trainer to a team season. A player who is removed from all team seasons remains flagged `isPlayer = true` unless manually cleared.

**D.2.3 No role enum for trainer assignments.**  
`TrainerTeamMember.roleLabel` is a free-text string. There is no enum for `HEAD_COACH`, `ASSISTANT_COACH`, `GOALKEEPER_COACH`, `TEAM_MANAGER`, `STAFF`. This prevents reliable filtering, sorting, or website rendering by role.

**D.2.4 No Captain / role equivalents for trainers.**  
`PlayerSquadMember` has `isCaptain` and `isViceCaptain` boolean flags. `TrainerTeamMember` has no equivalent primary-flag. There is no way to identify the primary trainer (head coach) at the model level.

**D.2.5 No competition field on TeamSeason.**  
Competition/league information is not stored on the seasonal team. It exists only as a transient string copied from SFV event imports. A club using manual event entry has no competition information at all.

**D.2.6 No slug scoping per tenant.**  
`Team.slug` is globally unique (`@unique`). In a multi-tenant system, `slug = "erste-mannschaft"` can only exist once across all tenants. The public website API serves teams by `tenantId + slug` (correctly), but the DB constraint does not reflect tenant scope.

**D.2.7 Visibility settings are not confirmed/communicated to the user before publish.**  
The Team Detail form allows toggling website/infoboard visibility but there is no confirmation or preview of what gets published. An admin can accidentally hide a team without understanding the consequence.

**D.2.8 Season selector on Teams Overview degrades gracefully but has no empty state for "no teams in this season."**  
When a season has no registered teams a minimal empty state appears, but it does not guide the admin toward registering teams for that season.

**D.2.9 No copy-from-previous-season workflow.**  
When creating a team for a new season, the admin must add every player and trainer manually. There is no "copy squad from last season" or "copy trainers from last season" feature.

**D.2.10 Infoboard visibility is not surfaced in the public infoboard feed.**  
The `TeamSeason.infoboardVisible` and `Team.infoboardVisible` flags exist on the model but the current infoboard feed (`lib/publishing/infoboard/`) does not query team visibility when building screens. Training events visible on the infoboard are controlled by `Event.infoboardVisible`, not by team-level flags.

### D.3 Optional

**D.3.1 Team cards on overview could benefit from a category colour strip.**  
Currently a category dot and text label are shown. A left-border colour strip or category header background would aid spatial scanning.

**D.3.2 Season pill on team cards is small and not visually dominant.**  
The season name appears as a small pill next to the team name. Given the season-first philosophy, the season context deserves more visual weight.

**D.3.3 No quick-action from team card (add player, edit settings).**  
Team cards navigate to the detail page. There is no hover-revealed quick-action for common operations.

**D.3.4 PersonDetail shows roles as static true/false rows rather than live assignments.**  
The person detail page shows `Spieler: Ja / Nein` and `Trainer: Ja / Nein` based on flat boolean flags. It does not show which teams the person is currently assigned to.

**D.3.5 No gender field on Person.**  
The Person model has no gender field. Useful for category filtering and public-facing display.

---

## E. Target Information Architecture

### E.1 Teams Overview

```
Header
  ├── "Teams"  eyebrow label
  └── [+ Neues Team]  action button

Season Selector
  └── Dropdown: 2026/2027 ▾  (active season highlighted)

Operational Summary Bar
  ├── Total: 14 teams  ·  12 active  ·  2 archived
  ├── Category chips: Aktive (2) · Frauen (1) · Junioren (8) · ...
  └── Warnings badge: 3 teams missing trainers

Search + Filters
  ├── Search: [     name / short name     ]
  ├── Filter: Category ▾  |  Status ▾  |  Website ▾  |  Infoboard ▾
  └── Sort: sortOrder (default)

Team Grid (grouped by category)
  Category: Aktive
  ┌─────────────────────────────────────────────────────────────┐
  │  ● Erste Mannschaft               2026/2027  4. Liga        │
  │    👤 18 Spieler · 2 Trainer · Di+Do 20:00                 │
  │    🌐 Website: ✓  📺 Board: ✓  ⚠ Kein Wochentrainer       │
  └─────────────────────────────────────────────────────────────┘

  Category: Junioren
  ┌─────────────────────────────────────────────────────────────┐
  │  ● Junioren A                     2026/2027  Gruppe B       │
  │    👤 22 Spieler · 3 Trainer · Mo+Mi 18:30                 │
  │    🌐 Website: ✓  📺 Board: ✓                               │
  ├─────────────────────────────────────────────────────────────┤
  │  ● Junioren B1                    2026/2027  Gruppe A       │
  │    👤 16 Spieler · 2 Trainer · Di+Fr 17:30                 │
  │    🌐 Website: ✗  📺 Board: ✗  ⚠ Kein Kader               │
  └─────────────────────────────────────────────────────────────┘
```

**Every team card shows:**
- Team display name (from TeamSeason.displayName) + season badge
- Competition label (future: from TeamSeason.competition)
- Player count + trainer count
- Training summary (next upcoming weekday + time)
- Website visibility badge
- Infoboard visibility badge
- Warning indicators: missing trainers, no squad, missing competition

### E.2 Team Detail — Tab Structure

The Team Detail should be restructured around the **Seasonal Team** as the primary entity. The permanent `Team` is demoted to a secondary "identity" concern.

```
Header
  ├── Erste Mannschaft  (TeamSeason.displayName)
  ├── Season: 2026/2027 ▾  (season switcher — changing season reloads the whole detail)
  └── [Einstellungen]  [Archivieren]

Tab bar
  ├── Übersicht
  ├── Teamdaten
  ├── Kader & Stab
  ├── Training
  ├── Website & Infoboard
  └── Aktivität
```

**No separate "Seasons" tab** — the season selector in the header replaces it. Historical seasons are accessible by switching the season dropdown.

#### E.2.1 Übersicht (Overview)

Answers at a glance:

| Question | Source |
|---|---|
| Which season? | Season selector (header) |
| Which competition? | `TeamSeason.competition` (future field) |
| How many players? | Count of active `PlayerSquadMember` |
| Who coaches? | First 2–3 `TrainerTeamMember` with `roleLabel = HEAD_COACH` |
| When do they train? | Next 2 upcoming training sessions |
| Website visible? | `Team.websiteVisible AND TeamSeason.websiteVisible` |
| Infoboard visible? | `Team.infoboardVisible AND TeamSeason.infoboardVisible` |
| Missing setup? | Warning cards: no trainers, no squad, no training events |

Layout:
```
[Operational Status Card]
  Competition:   4. Liga
  Spieler:       18 aktive  ·  2 inaktiv
  Trainer:       Hanspeter Müller (Cheftrainer) · Sara Meier (Assistenz)
  Training:      Dienstag 20:00 Sportanlage Allschwil · Donnerstag 20:00
  Website:       Sichtbar ✓   Infoboard: Sichtbar ✓
  Nächstes Spiel: Sa 02.08.2026 15:00 vs. FC Basel 4 (Auswärts)

[Warning Strip]
  ⚠ Kein Goalkeeper-Coach erfasst
  ⚠ 3 Spieler ohne Geburtsdatum

[Quick Actions]
  + Spieler hinzufügen   + Trainer hinzufügen   Zum Trainingplanner
```

#### E.2.2 Teamdaten (Team Data)

Only permanent or season-owned fields. No roster. No training.

**Permanent Team fields** (identity, slug, category — rarely changed):
- Name (canonical), Slug, Category, Gender group, Age group, Sort order, OrgUnit link

**Seasonal fields** (TeamSeason — change every season):
- Display name, Short name, Status (ACTIVE / INACTIVE / ARCHIVED), Competition label (future field)

This tab is the only place where the permanent Team master is edited. It should be clearly labelled:  
> "Stammdaten des Teams (saisonübergreifend). Änderungen wirken sich auf alle Saisonen aus."

#### E.2.3 Kader & Stab (Squad & Staff)

Three sub-sections:

**Spieler (Players)**
```
[Player count badge]
[Jahrgang filter]
[+  Spieler hinzufügen]

List:
  #7  Max Müller          Jg. 2006  ●AKTIV  👑 Kapitän  🌐
  #4  Jana Schmid         Jg. 2007  ●AKTIV              🌐
  #11 Peter Keller        Jg. 2007  ⚠ VERLETZT
  [Archiviert einblenden (2)]

Empty state:
  👤 Noch keine Spieler in dieser Saison erfasst.
  [Spieler hinzufügen]  [Person erstellen]
```

**Trainer & Stab (Coaches & Staff)**
```
[+  Trainer hinzufügen]

List (grouped by role):
  Cheftrainer
    Hanspeter Müller   ●AKTIV  🌐
  Assistenztrainer
    Sara Meier         ●AKTIV  🌐
  Goalietrainer
    (leer)
    + Goalietrainer hinzufügen

Empty state:
  👤 Noch kein Trainerstab erfasst.
  [Trainer hinzufügen]  [Person erstellen]
```

**Funktionäre / Staff** (future — Team Manager, Doctor, etc.)

#### E.2.4 Training (Read-only)

```
[Info banner]
  ℹ️  Trainingszeiten werden im Trainingplanner verwaltet.
  [Zum Trainingplanner →]

[Training summary — read-only]
  Wochentag     Zeit           Anlage                Feld      Garderoben
  Dienstag      20:00–21:30   Sportanlage Allschwil  Feld 1    A / B
  Donnerstag    20:00–21:30   Sportanlage Allschwil  Feld 1    A / B

[Next 4 weeks of training events]
  Di 29.07.2026  20:00–21:30  Sportanlage Allschwil
  Do 31.07.2026  20:00–21:30  Sportanlage Allschwil
  ...

[Historical note for archived seasons]
  ⚠ Diese Saison ist archiviert. Trainingszeiten werden nicht mehr angezeigt.
```

No editing. No form inputs. Read-only operational summary of training events from the Trainingplanner.

#### E.2.5 Website & Infoboard

```
[Website visibility]
  Team sichtbar:        ● Ja    (Team.websiteVisible)
  Saison sichtbar:      ● Ja    (TeamSeason.websiteVisible)
  Kader sichtbar:       ● Ja    (TeamSeason.squadWebsiteVisible)
  Trainerstab sichtbar: ● Ja    (TeamSeason.trainerTeamWebsiteVisible)

  [Future section controls — deferred]
  Teamfoto:      ○ vorbereitet
  Trainingszeiten: ○ vorbereitet
  Resultate:     ○ vorbereitet

  Website-URL:
    https://www.fcallschwil.ch/teams/erste-mannschaft
    [URL öffnen]  [Slug bearbeiten]

[Infoboard visibility]
  Team sichtbar:   ● Ja    (Team.infoboardVisible)
  Saison sichtbar: ● Ja    (TeamSeason.infoboardVisible)
```

**Ownership note:** `Team.websiteVisible` and `Team.infoboardVisible` are permanent and affect all seasons. The admin should see a clear label: *"Permanente Einstellung — wirkt auf alle Saisonen"*. `TeamSeason.*Visible` flags are seasonal.

#### E.2.6 Aktivität (Activity)

Audit log for this team:
- Season registrations
- Player assignments / removals
- Trainer assignments / removals
- Settings changes
- Publication status changes

Currently only `TimelinePlaceholder` exists — this is a deferred feature.

### E.3 Persons Module

#### Person List

```
Header
  ├── "Personen"
  └── [+ Neue Person]

Search:  [    name / email / phone    ]
Filter:  Status ▾  |  Rolle ▾  (Spieler / Trainer / Mitglied)

Person rows:
  [Avatar]  Max Müller                 Spieler  Trainer  ●Aktiv
  [Avatar]  Sara Meier          s.meier@...      Trainer  ●Aktiv
  [Avatar]  Peter Keller  (kein Geburtsdatum ⚠)  Spieler  ●Aktiv
```

#### Person Detail Tabs

```
Stammdaten       — name, contact, birth date, gender, photo
Zuweisungen      — list of all TeamSeason assignments (player / trainer roles, per season)
Aktivität        — audit log
```

#### Person Create (modal or inline)

From the Squad management card, users need to be able to create a new Person inline without navigating away:

```
[Modal: Neue Person erstellen]
  Vorname *
  Nachname *
  Geburtsdatum (für Jahrgang-Prüfung)
  E-Mail
  Rolle: ○ Spieler  ○ Trainer  ○ Beide
  [Erstellen und zuweisen]
```

Duplicate detection on `(firstName, lastName, dateOfBirth)` should warn before creating.

---

## F. Target Data Model

### F.1 Current Model Assessment

The existing `Team → TeamSeason → PlayerSquadMember / TrainerTeamMember` structure **already implements the seasonal team concept correctly** at the data layer. The `TeamSeason` is the operational entity. The `Team` is the lineage/identity anchor.

The primary model gaps are:

| Gap | Current State | Recommended Addition |
|---|---|---|
| Person has no tenant scope | No `tenantId` on `Person` | Add `Person.tenantId` (nullable backfill, required going forward) |
| Person has no photo | No photo field | Add `Person.photoUrl String?` or `Person.photoMediaAssetId String?` |
| Person has no gender | No gender field | Add `Person.gender String?` (or enum) |
| TrainerTeamMember has free-text role | `roleLabel String?` | Add `TrainerTeamMember.roleCode String?` (enum-backed) |
| TeamSeason has no competition | No competition field | Add `TeamSeason.competition String?` |
| Team slug is not tenant-scoped | `slug @unique` (global) | Change to `@@unique([tenantId, slug])` (migration required) |
| Season is not tenant-scoped | No `tenantId` on `Season` | Leave as-is for now (shared national calendar is intentional) |
| No "copy from previous season" | No copy mechanism | Service-level, no schema change needed |
| `isPlayer` / `isTrainer` not derived | Manual flags on Person | Keep as explicit flags, but derive them in queries; decouple from assignments in a later slice |

### F.2 Recommended Smallest Safe Evolution

The following model additions are recommended. They are **additive** (nullable fields), require only safe migrations, and do not break any existing query.

#### F.2.1 `Person` additions

```prisma
model Person {
  // ... existing fields ...
  tenantId         String?             // tenant isolation (backfill + require going forward)
  gender           String?             // "MALE" | "FEMALE" | "OTHER" | null
  photoUrl         String?             // CDN URL for profile photo (direct upload path)
  // Alternative: photoMediaAssetId String? → MediaAsset (FK, nullable)
}
```

**Migration impact:** Additive nullable columns. No query breakage. Existing `getPersons()` continues without change. Tenant isolation enforcement must be added to all `Person` queries in a follow-up (PERSON-01 slice).

#### F.2.2 `TrainerTeamMember` addition

```prisma
enum TrainerRole {
  HEAD_COACH
  ASSISTANT_COACH
  GOALKEEPER_COACH
  TEAM_MANAGER
  ANALYST
  PHYSIO
  STAFF
}

model TrainerTeamMember {
  // ... existing fields ...
  roleCode         TrainerRole?        // Structured role (nullable for backward compat)
  // roleLabel String? remains for custom overrides / legacy data
}
```

**Migration impact:** New enum + nullable column. No existing trainer records break. `roleLabel` is preserved for free-text overrides or legacy display.

#### F.2.3 `TeamSeason` addition

```prisma
model TeamSeason {
  // ... existing fields ...
  competition      String?             // e.g. "4. Liga Gruppe A" (manual or from SFV sync)
  heroPhotoUrl     String?             // Team photo for this season
}
```

**Migration impact:** Additive nullable columns. No breakage.

#### F.2.4 `Team.slug` scoping

Currently `slug String @unique` (global).  
Target: `slug String` + `@@unique([tenantId, slug])`.

**Migration impact:** Requires a migration that:  
1. Drops the global `@unique` constraint on `slug`.  
2. Adds `@@unique([tenantId, slug])`.  
3. Requires `tenantId` to be non-null on all `Team` records before migration (backfill migration `20260626000000_team_tenant_isolation` must be verified as complete).

**Website impact:** The public API already resolves teams by `tenantId + slug` — no change to public API behaviour.  
**Matchcenter impact:** `TeamExternalMapping` links by `teamId` — not affected.

### F.3 Model Ownership Summary

| Model | Owner | Permanent / Seasonal | Tenant-Scoped | Archive Behaviour |
|---|---|---|---|---|
| `Season` | Platform | Permanent | No (shared) | `isActive = false` |
| `Team` | Organisation | Permanent lineage | Yes (`tenantId`) | `isActive = false` |
| `TeamSeason` | Teams module | Seasonal operational entity | Inherited via Team | `status = ARCHIVED` |
| `PlayerSquadMember` | Teams module | Seasonal | Inherited via TeamSeason | `status = ARCHIVED` |
| `TrainerTeamMember` | Teams module | Seasonal | Inherited via TeamSeason | `status = ARCHIVED` |
| `Person` | Persons module | Permanent | No (must add) | `isActive = false` |
| `TeamExternalMapping` | SFV Integration | Seasonal (per `externalSeasonId`) | Yes (`tenantId`) | Provider `isActive` flag |
| `MatchExternalMapping` | SFV Integration | Seasonal | Yes (`tenantId`) | Cascade from Event |

---

## G. Permissions & Services

### G.1 Existing Permissions

| Key | Module | Covers |
|---|---|---|
| `teams.view` | TEAMS | Read teams, team seasons, squad, trainers |
| `teams.manage` | TEAMS | Full write access to all team entities |
| `people.view` | PEOPLE | Read persons |
| `people.manage` | PEOPLE | Write persons; also allows creating persons from team context |

### G.2 Recommended New Permissions

The current model collapses all team operations into two permissions. A premium operational platform needs finer capabilities:

| Recommended Key | Module | Rationale |
|---|---|---|
| `teams.view` | TEAMS | Keep existing — read |
| `teams.create` | TEAMS | Create new permanent Team + initial TeamSeason |
| `teams.edit` | TEAMS | Edit permanent Team settings (slug, category, orgUnit) |
| `teams.archive` | TEAMS | Set `isActive = false` on Team; set `status = ARCHIVED` on TeamSeason |
| `teams.manage` | TEAMS | Superset — keep for backward compat (maps to all above) |
| `roster.manage` | TEAMS | Assign/remove PlayerSquadMember and TrainerTeamMember |
| `publishing.manage` | TEAMS | Toggle website / infoboard visibility flags on Team and TeamSeason |
| `persons.view` | PEOPLE | Keep as `people.view` — read |
| `persons.create` | PEOPLE | Create Person records |
| `persons.edit` | PEOPLE | Edit Person master data |

**Convention:** Follow existing `module.action` pattern (lowercase). Reuse `PermissionModule.TEAMS` and `PermissionModule.PEOPLE` enum values. New keys should be seeded and assigned to appropriate roles in `prisma/seed.ts`.

### G.3 Recommended Service Boundaries

#### Teams Service

| Function | Input | Output | Permission | Notes |
|---|---|---|---|---|
| `listTeams(tenantId, seasonKey?)` | Tenant + optional season | TeamCard[] with counts | `teams.view` | Replaces `getTeamsListData` — add player/trainer count |
| `getTeam(tenantId, teamId, seasonKey?)` | Tenant + team ID + season | TeamDetail | `teams.view` | Returns Team + resolved TeamSeason |
| `createTeam(tenantId, payload)` | New team data | Team + TeamSeason | `teams.create` | Creates Team + initial TeamSeason in one transaction |
| `updateTeam(tenantId, teamId, payload)` | Team fields | Team | `teams.edit` | Only permanent fields |
| `updateTeamSeason(tenantId, teamSeasonId, payload)` | TeamSeason fields | TeamSeason | `teams.edit` | Season-scoped fields |
| `archiveTeam(tenantId, teamId)` | Team ID | void | `teams.archive` | Sets `isActive = false` |
| `archiveTeamSeason(tenantId, teamSeasonId)` | TeamSeason ID | void | `teams.archive` | Sets `status = ARCHIVED` |
| `copyTeamSeason(tenantId, teamId, fromSeasonId, toSeasonId, options)` | Copy options | TeamSeason | `teams.create` | Copies players, trainers, settings — deferred to TEAM-ROSTER-01 |

#### Roster Service

| Function | Input | Output | Permission |
|---|---|---|---|
| `listSquadMembers(teamSeasonId)` | TeamSeason ID | SquadMember[] | `teams.view` |
| `assignPlayer(teamSeasonId, personId, payload)` | Assignment data | PlayerSquadMember | `roster.manage` |
| `updatePlayer(squadMemberId, payload)` | Update fields | PlayerSquadMember | `roster.manage` |
| `removePlayer(squadMemberId)` | Member ID | void | `roster.manage` |
| `listTrainerMembers(teamSeasonId)` | TeamSeason ID | TrainerMember[] | `teams.view` |
| `assignTrainer(teamSeasonId, personId, payload)` | Assignment data | TrainerTeamMember | `roster.manage` |
| `updateTrainer(trainerMemberId, payload)` | Update fields | TrainerTeamMember | `roster.manage` |
| `removeTrainer(trainerMemberId)` | Member ID | void | `roster.manage` |

#### Persons Service

| Function | Input | Output | Permission |
|---|---|---|---|
| `listPersons(tenantId, filters?)` | Tenant + filters | Person[] | `persons.view` |
| `getPerson(personId)` | Person ID | PersonDetail | `persons.view` |
| `createPerson(tenantId, payload)` | Person data | Person | `persons.create` |
| `updatePerson(personId, payload)` | Person fields | Person | `persons.edit` |
| `searchPersons(tenantId, query)` | Tenant + query | PersonSearchResult[] | `persons.view` |

#### Training Summary Service (read-only, Trainingplanner contract)

| Function | Input | Output | Permission |
|---|---|---|---|
| `getTeamTrainingSummary(tenantId, teamId, seasonId)` | Team + Season | TeamTrainingSummaryItem[] | `teams.view` |

---

## H. Trainingplanner Contract

### H.1 Target DTO

```typescript
interface TeamTrainingSummaryItem {
  /** "Montag" | "Dienstag" | ... (de-CH locale weekday) */
  weekday: string;
  /** ISO 8601 timestamp of training start */
  startTime: string;
  /** ISO 8601 timestamp of training end, or null if open-ended */
  endTime: string | null;
  /** Human-readable facility name resolved from FacilityResource */
  facilityName: string | null;
  /** Human-readable pitch/field name resolved from FacilityResource */
  pitchName: string | null;
  /** Human-readable dressing room name (home side) */
  homeDressingRoomName: string | null;
  /** Event status */
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  /** Whether to show this event on the public website */
  websiteVisible: boolean;
}
```

### H.2 Current Capability Assessment

The public teams feed (`getPublicTeamDetail`) already queries training events and returns a partial version of this DTO. The current public DTO includes `weekday`, `startTime`, `endTime`, `location`, `pitchName`.

**Missing from current implementation:**
- `facilityName` — facility name (distinct from pitch/field name)
- `homeDressingRoomName` — dressing room name (code resolution exists in `lib/facilities/display-helpers.ts` but is not applied to the training summary)
- `validFrom` / `validUntil` — not applicable to the current event-based model (there are no recurring training schedules with validity periods; each training is a standalone event)
- `status` — training event status is available (`Event.status`) but not included in the current public feed

**Missing relationships for a structured recurring training model:**
- No `RecurringTraining` or `TrainingSlot` model exists. Each training instance is a standalone `Event`. The current model cannot express "every Tuesday 20:00–21:30 from August to November" as a single record — it can only express individual event instances.
- The Trainingplanner module is the intended owner of recurring schedules. This contract should be expanded when the Trainingplanner delivers a recurring schedule model.

**What the admin Team Training tab can provide today:**
- A list of upcoming training `Event` records for the team (next 28 days is the current window used publicly; the admin view should extend this to the full remaining season)
- Pitch name resolution via `FacilityResource`
- Dressing room name resolution via `lib/facilities/display-helpers.ts` (already available)
- Event status

**What it cannot provide today:**
- Recurring schedule summary (e.g. "Dienstag und Donnerstag 20:00")
- Validity periods

**Recommendation:** For TEAM-TRAINING-01, derive a weekly-pattern summary by grouping upcoming training events by weekday and time. Display this as a summary table. Label it clearly as derived from individual event records, not from a canonical recurring schedule.

---

## I. Website Migration Path

### I.1 Current State

- Public API: `GET /api/public/[tenant]/website/teams` and `GET /api/public/[tenant]/website/teams/[slug]`
- Teams are resolved by `tenantId` (DB-level isolation) and `slug` (URL-safe identifier)
- `Team.slug` is currently globally unique — should become tenant-scoped (see F.2.4)
- The public API already serves: team name, display name, category, squad, trainers, training sessions

### I.2 Stable URL Strategy

The website should maintain stable editorial slugs across seasons. The mapping is:

```
Website URL:  /teams/erste-mannschaft
              ↕
Team.slug:    "erste-mannschaft"  (permanent, stable across seasons)
              ↕
TeamSeason:   Erste Mannschaft 2026/2027  (resolved per active season)
```

This already works correctly in the current implementation. The public `getPublicTeamDetail` resolves the team by slug and then finds the active (or season-key-specified) `TeamSeason`.

### I.3 Migration Path Toward Enhanced Website Display

| Feature | Current State | Target | Dependency |
|---|---|---|---|
| Team photo | `null` (no photoUrl on Team/TeamSeason) | `TeamSeason.heroPhotoUrl` | TEAM-WEB-01 |
| Training times | Individual event list (next 28 days) | Summary from Trainingplanner recurring schedule | Trainingplanner contract |
| Competition / league | Not available | `TeamSeason.competition` | TEAM-UX-02 schema |
| Trainer photos | `null` (no photoUrl on Person) | `Person.photoUrl` | PERSON-01 |
| Player photos | `null` | `Person.photoUrl` | PERSON-01 |
| Standings | Not implemented | Future — provider feed or manual entry | Future slice |
| Results | Served via match events | Available | No change needed |
| Section visibility | 4 boolean flags on TeamSeason | Extended section-level visibility controls | TEAM-WEB-01 |

### I.4 Historic Season Handling

Historic seasonal teams should remain internal unless explicitly published:
- `TeamSeason.websiteVisible = false` should be the default when archiving a season
- The public API already respects `TeamSeason.websiteVisible` — no change needed
- The public API resolves team detail via the **active** season by default, preventing historic data from appearing without explicit `seasonKey` parameter

### I.5 Persistent Website Mapping

Currently there is no `WebsiteTeamMapping` or similar model. The slug on `Team` serves as the persistent identity. To support editorial overrides (display name, description, hero image per season independent of the operational `TeamSeason`):

**Future model (TEAM-WEB-01):**
```prisma
model TeamWebsiteMapping {
  id               String   @id @default(cuid())
  tenantId         String
  teamId           String   // FK to Team (permanent)
  slug             String   // editorial URL slug (stable, independent of Team.slug)
  displayName      String?  // website-specific display name override
  description      String?  // editorial team description
  heroPhotoUrl     String?  // team photo URL
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([tenantId, slug])
}
```

This is deferred. For now, `Team.slug` serves as the persistent URL mapping.

---

## J. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Person model not tenant-scoped** | High | Add `Person.tenantId` in PERSON-01. Backfill with the single active tenant key for existing records. Add tenant filter to all `Person` queries. |
| **Duplicate persons across seasons** | High | Add duplicate detection on `(firstName, lastName, dateOfBirth, tenantId)` during Person create. Surface warning before confirming creation. |
| **Duplicate teams across seasons** | Medium | `@@unique([teamId, seasonId])` on `TeamSeason` already prevents double registration per season. No additional risk. |
| **Season confusion — Team vs TeamSeason** | High | Redesign Team Detail to make TeamSeason the primary entity (TEAM-DETAIL-01). Add season selector to header. |
| **Orphaned assignments** | Medium | `PlayerSquadMember` and `TrainerTeamMember` have `Restrict` on `Person` FK — person cannot be deleted while assigned. This is safe. |
| **Archived teams appearing on website** | Medium | `Team.isActive = false` and `TeamSeason.status = ARCHIVED` both gate public visibility. Verify the public API enforces both checks. Currently only `Team.isActive = true` is checked — add `TeamSeason.status = ACTIVE` gate to `getPublicTeams`. |
| **Historical loss on team rename** | Low | `TeamSeason.displayName` preserves the historical display name even if `Team.name` changes. Season-specific names are safe. |
| **Privacy — person data** | High | `Person` has no tenant scope. In a multi-tenant system a query without `tenantId` filter leaks cross-tenant data. Resolve in PERSON-01. |
| **Visibility conflicts — Team vs TeamSeason flags** | Medium | Document the precedence rule: `Team.websiteVisible AND TeamSeason.websiteVisible` — both must be true. Add explicit UI label on the Website tab. |
| **SFV mapping points to Team not TeamSeason** | Low | `TeamExternalMapping` links SFV team identity to `Team` (not `TeamSeason`). The mapping uses `externalSeasonId` to distinguish seasons. This is compatible with the seasonal model but requires that the Team identity persists across seasons — which is the current design intention. |
| **Slug uniqueness conflict in multi-tenant** | Medium | `Team.slug` is globally unique. If two tenants both have a team named "Erste Mannschaft" with slug "erste-mannschaft" this fails. Resolve by making slug tenant-scoped (F.2.4). |
| **Training data loss on season archive** | Low | Historic training events are preserved as `Event` records. `Event.teamId` + `Event.seasonId` provide season-scoped retrieval. No data loss on TeamSeason archival. |

---

## K. Implementation Roadmap

### TEAM-UX-02 — Premium Teams Overview

**Objective:** Replace the current flat team list with an operational overview that surfaces player counts, trainer counts, training summary, and warnings per team card.

| Area | Detail |
|---|---|
| Affected files | `lib/teams/queries.ts`, `components/admin/teams/TeamsOverviewGrid.tsx`, `app/(admin)/dashboard/teams/page.tsx` |
| Schema impact | None — query extension only |
| Migrations | None |
| APIs | Extend `getTeamsListData` to include `playerCount`, `trainerCount`, `nextTrainingAt` |
| UI | Redesign `TeamsOverviewGrid` team cards; add warning indicators |
| Tests | Add unit tests for `getTeamsListData` with new fields |
| Dependencies | None |
| Risks | Performance: count queries per team may be slow — use subquery aggregation |
| Complexity | **M** |

### PERSON-01 — Persons Foundation

**Objective:** Add tenant isolation, photo support, gender, and derived-role display to the Persons module.

| Area | Detail |
|---|---|
| Affected files | `prisma/schema.prisma`, `lib/people/queries.ts`, `app/api/people/route.ts`, `app/api/people/[id]/route.ts`, `components/admin/persons/PersonForm.tsx`, `components/admin/persons/PersonSearchableList.tsx` |
| Schema impact | Add `Person.tenantId String?`, `Person.gender String?`, `Person.photoUrl String?` |
| Migrations | `YYYYMMDD_person_tenant_isolation_and_photo` — additive nullable columns + backfill `tenantId` for existing persons |
| APIs | Add `tenantId` filter to all person queries; add `photoUrl` and `gender` to GET/POST/PATCH |
| UI | Add photo upload, gender select to PersonForm; show current team assignments on PersonDetail |
| Tests | Verify tenant isolation: person query returns only current tenant's persons |
| Dependencies | MediaAsset model (for photo storage) or direct URL upload |
| Risks | Backfill: must assign all existing persons to a single tenant (fc-allschwil) without data loss |
| Complexity | **M** |

### TEAM-ROSTER-01 — Seasonal Team Memberships

**Objective:** Introduce structured trainer roles (TrainerRole enum), display roles as grouped sections on the Kader & Stab tab, and add copy-from-previous-season workflow.

| Area | Detail |
|---|---|
| Affected files | `prisma/schema.prisma`, `lib/teams/team-squad-queries.ts`, `app/api/teams/[teamId]/team-seasons/[teamSeasonId]/trainer-members/route.ts`, `components/admin/teams/TeamTrainerManagementCard.tsx` |
| Schema impact | Add `TrainerRole` enum; add `TrainerTeamMember.roleCode TrainerRole?`; add `TeamSeason.competition String?` |
| Migrations | `YYYYMMDD_trainer_role_enum` — new enum + nullable `roleCode`; `YYYYMMDD_team_season_competition` — nullable `competition` string |
| APIs | Update trainer assignment to accept `roleCode`; add `copyTeamSeason` endpoint |
| UI | Group trainers by roleCode on Kader & Stab tab; add role selector to trainer assignment form |
| Tests | Verify role grouping; verify copy-from-previous-season preserves data correctly |
| Dependencies | PERSON-01 (person tenant scoping) |
| Risks | Legacy `roleLabel` data must coexist with new `roleCode` — display `roleLabel` as override when set |
| Complexity | **M** |

### TEAM-DETAIL-01 — Premium Team Detail

**Objective:** Redesign the Team Detail page to make `TeamSeason` the primary entity, add season selector to the header, implement the tabbed layout (Übersicht / Teamdaten / Kader & Stab / Training / Website & Infoboard / Aktivität), and surface operational status at a glance.

| Area | Detail |
|---|---|
| Affected files | `app/(admin)/dashboard/teams/[teamId]/page.tsx`, `components/admin/teams/TeamDetailCard.tsx`, all sub-cards |
| Schema impact | None — presentation change only |
| Migrations | None |
| APIs | Extend `getTeamDetailData` to resolve active TeamSeason and counts |
| UI | Full redesign of Team Detail page; implement tab bar; season selector in header |
| Tests | Manual testing of season switching; verify empty states |
| Dependencies | TEAM-UX-02 (for card design patterns), TEAM-ROSTER-01 (for role grouping) |
| Risks | Significant UI change — regression risk on existing workflows; must preserve all current edit capabilities |
| Complexity | **XL** |

### TEAM-TRAINING-01 — Read-only Training Summary

**Objective:** Add the Training tab to Team Detail with a read-only operational summary of upcoming training events. Surface pitch name, dressing room, and status. Link to Trainingplanner.

| Area | Detail |
|---|---|
| Affected files | New `components/admin/teams/TeamTrainingTab.tsx`; `lib/teams/queries.ts` (add training query); `app/(admin)/dashboard/teams/[teamId]/page.tsx` |
| Schema impact | None |
| Migrations | None |
| APIs | Add `getTeamTrainingSummary(tenantId, teamId, seasonId)` query function |
| UI | Read-only training table; weekday-grouped summary; "Open Trainingplanner" CTA; "archived season" notice |
| Tests | Verify training events are not shown for archived TeamSeasons |
| Dependencies | TEAM-DETAIL-01 (tab structure); Trainingplanner (future recurring schedule integration) |
| Risks | Current event-based model has no recurring schedule — summary may appear sparse for teams with few upcoming events |
| Complexity | **S** |

### TEAM-WEB-01 — Persistent Website Mapping

**Objective:** Add `TeamSeason.heroPhotoUrl`, decouple website display name from operational `TeamSeason.displayName`, add season-specific website description, and document the path toward section-level visibility controls.

| Area | Detail |
|---|---|
| Affected files | `prisma/schema.prisma`; `lib/website/public-teams-feed.ts`; `app/api/public/[tenant]/website/teams/[slug]/route.ts`; `components/admin/teams/TeamWebsiteTab.tsx` (new) |
| Schema impact | Add `TeamSeason.heroPhotoUrl String?`; optionally add `TeamSeason.websiteDisplayName String?` and `TeamSeason.websiteDescription String?` |
| Migrations | `YYYYMMDD_team_season_website_fields` — additive nullable columns |
| APIs | Extend public `getPublicTeamDetail` to include `heroImage` URL and `description`; update Website & Infoboard tab UI |
| UI | Photo upload on Website tab; description editor; stable URL display; section visibility stubs |
| Tests | Verify `photoUrl` is resolved from `TeamSeason.heroPhotoUrl`; verify stable slug routing |
| Dependencies | TEAM-DETAIL-01; MediaAsset (for photo storage) |
| Risks | URL stability — must not break existing website integrations; verify `tenantId + slug` resolution remains unchanged |
| Complexity | **M** |

---

## L. Recommended Next Slice

### Recommended: TEAM-UX-02 — Premium Teams Overview

**Why now:**  
This is the highest-impact, lowest-risk improvement. It is a pure presentation layer change. No schema changes. No migrations. No API contract changes.

It delivers immediate visible improvement for FC Allschwil administrators by answering — on the overview page, without clicking into any team — the questions:

- Which teams are active in the current season?
- Which teams are missing trainers or players?
- Which teams are not published to the website?

It also establishes the visual component patterns (warning indicators, count badges, training summary inline) that all subsequent Team module slices will reuse.

**Scope (TEAM-UX-02):**

1. Extend `getTeamsListData` with:
   - `playerCount: number` (active PlayerSquadMember per resolved TeamSeason)
   - `trainerCount: number` (active TrainerTeamMember per resolved TeamSeason)
   - `nextTrainingAt: string | null` (next upcoming training event startAt)
   - `competition: string | null` (from future `TeamSeason.competition` — render null gracefully until field exists)

2. Redesign `TeamsOverviewGrid` team cards:
   - Show player count + trainer count inline
   - Show "Di · 20:00" style training summary
   - Show competition label when available
   - Add warning indicators: no squad, no trainers, no training

3. Add Operational Summary bar:
   - Total teams, active count, teams with warnings

4. Add search input with client-side filter by name.

**Subsequent slice after TEAM-UX-02:** PERSON-01 (tenant isolation is a security requirement that should not wait long).

---

*End of TEAM-UX-01 Report*  
*Branch: `cursor/team-ux-01-inventory-and-architecture-7599`*  
*No code changes. No schema changes. No migrations.*
