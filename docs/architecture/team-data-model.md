# Team Data Model Architecture

> **Status:** TEAM-CORE-02 — Seasonal OrgUnit and Mapping Foundation

## Canonical Structure

```
Season
└── TeamSeason                  ← seasonal operational entity
    ├── TeamSeasonOrgUnit[]     ← canonical grouping (many-to-many with OrgUnit)
    ├── PlayerSquadMember[]
    ├── TrainerTeamMember[]
    ├── TeamExternalMapping[]   ← seasonal provider link (via teamSeasonId)
    ├── websiteVisible          ← seasonal website publication flag
    └── infoboardVisible        ← seasonal infoboard publication flag

Team                            ← permanent technical identity
├── TeamSeason[]                ← seasonal records (one per active season)
├── slug                        ← tenant-scoped unique identifier
├── orgUnitId                   ← DEPRECATED legacy single OrgUnit link
├── websiteVisible              ← TRANSITIONAL fallback publication flag
└── infoboardVisible            ← TRANSITIONAL fallback publication flag
```

## Entity Roles

### Team — Permanent Technical Identity
- Long-lived entity representing a club team across all seasons.
- `Team.slug` is unique per tenant (not globally). Always scope slug lookups by `tenantId`.
- `Team.category` (TeamCategory) is a **legacy compatibility field**. New business logic must use `TeamSeasonOrgUnit`.
- `Team.orgUnitId` is a **deprecated transitional field**. Use `TeamSeasonOrgUnit` for new logic.
- `Team.websiteVisible` / `Team.infoboardVisible` are **transitional fallback fields**. Read `TeamSeason` values first via `getEffectiveTeamSeasonVisibility()`.

### TeamSeason — Seasonal Operational Entity
- Created once per Team per Season.
- Canonical record for all seasonal operations: roster, staff, training, matches, visibility.
- **Mandatory creation rules** (enforced by `createCanonicalTeamSeason()`):
  - `seasonId` is required.
  - At least one `orgUnitId` is required via `TeamSeasonOrgUnit`.

### TeamSeasonOrgUnit — Canonical Team Grouping (TEAM-CORE-02)
- Many-to-many join between `TeamSeason` and `OrgUnit`.
- Replaces the legacy `Team.orgUnitId` single link.
- One `TeamSeason` may belong to multiple `OrgUnit`s (e.g. Junioren + FVRZ sub-division).
- `isPrimary = true` marks the main grouping unit for display purposes.
- **New assignment rules** (enforced at service layer):
  - OrgUnit must belong to the same tenant.
  - OrgUnit must be `ACTIVE` (not `INACTIVE` or `ARCHIVED`).
- **Historical assignments** remain valid even if an OrgUnit is later archived.
- Delete behavior: `RESTRICT` on OrgUnit prevents silent deletion of linked OrgUnits. Archive instead of delete.

### TeamExternalMapping — External Provider Identity
- Links a `Team` (permanent) to a provider record (e.g. SFV).
- `TeamExternalMapping.teamSeasonId` (TEAM-CORE-02): preferred seasonal link.
  - Nullable during transition. Historical rows have `null`.
  - Consistency rules: `teamSeason.teamId` must equal `teamId`.
- `TeamExternalMapping.teamId`: retained for backward compatibility.

## Deprecated / Transitional Fields

| Field | Status | Replacement |
|---|---|---|
| `Team.orgUnitId` | Deprecated | `TeamSeasonOrgUnit` |
| `Team.category` (TeamCategory) | Deprecated | `TeamSeasonOrgUnit` (grouping via OrgUnit hierarchy) |
| `Team.websiteVisible` | Transitional fallback | `TeamSeason.websiteVisible` via `getEffectiveTeamSeasonVisibility()` |
| `Team.infoboardVisible` | Transitional fallback | `TeamSeason.infoboardVisible` via `getEffectiveTeamSeasonVisibility()` |

## Visibility Semantics

```ts
// ALWAYS use this helper — never scatter fallback logic in callers.
const { websiteVisible, infoboardVisible } = getEffectiveTeamSeasonVisibility(
  teamSeason,  // null if no active TeamSeason
  team,        // fallback source
);
```

Effective visibility rule:
- `effectiveWebsiteVisible = teamSeason?.websiteVisible ?? team.websiteVisible`
- `effectiveInfoboardVisible = teamSeason?.infoboardVisible ?? team.infoboardVisible`

## Slug Tenant Scoping

Team slugs are unique **per tenant** since TEAM-CORE-02. All slug lookups must include `tenantId`:

```ts
// ✅ Correct — tenant-scoped
await prisma.team.findUnique({
  where: { tenantId_slug: { tenantId, slug } },
});

// ❌ Wrong — globally unique (removed in TEAM-CORE-02)
await prisma.team.findUnique({ where: { slug } });
```

## Display Name Generation

`buildTeamSeasonDisplayName()` is **tenant-neutral** since TEAM-CORE-02. No club name prefix is applied by default.

```ts
// Tenant-neutral (no club prefix)
buildTeamSeasonDisplayName("E-Junioren 1")
// → "E-Junioren 1"

// Explicit club prefix (caller provides club name from tenant config)
buildTeamSeasonDisplayName("E-Junioren 1", tenant.name)
// → "FC Allschwil E-Junioren 1"
```

## Season Tenant Scoping Limitation

`Season` does not yet carry a `tenantId` (deferred to **SEASON-01**). Tenant enforcement for Season is achieved via:
- `Team.tenantId` (already set)
- `TeamSeason.teamId → Team.tenantId`
- Authorization context from the session

Cross-tenant Season access remains a known limitation until SEASON-01 is implemented.

## Canonical "Current TeamSeason" Resolution (TEAMCENTER-UX-01C)

`lib/teams/current-season.ts` is the single source of truth for "which
TeamSeason is the Team's current one". Before this slice, that question was
independently re-implemented (with different precedence/fallback rules) in
`getTeamsListData`, `getTeamDetailData`, `GET /api/teams`,
`findTeamSeasonsForTenant` (TrainingCenter's "Neue Trainingsserie" picker)
and `getOrgUnitById` — which is why the Teams UI could show one
canonical/current team-season while TrainingCenter exposed a stale/
different one for the very same Team.

```ts
// Prisma query-level scoping (list/picker queries):
const teams = await prisma.team.findMany({
  ...
  select: {
    teamSeasons: { where: currentTeamSeasonWhere(explicitSeasonKey), take: 1 },
  },
});

// In-memory pick from an already-fetched list (detail pages):
const currentTeamSeason = pickCurrentTeamSeason(team.teamSeasons, explicitSeasonKey);
```

Rule: an explicit season key always wins; otherwise `Season.isActive` is
canonical. There is deliberately **no** further fallback (e.g. "the most
recently started season") — a Team with no TeamSeason in the canonical
season has no current season, and every surface must render that as "none"
rather than silently substituting a stale one.

Any new read path that needs "the Team's current TeamSeason" — across
TeamCenter, TrainingCenter, MatchCenter, TournamentCenter, Dayplanner,
Weekplanner or Infoboard — must use this module instead of re-deriving the
rule locally.

## Planned Follow-up Slices

- **TEAM-CREATE-01**: Premium seasonal team registration flow using `createCanonicalTeamSeason()`.
- **SEASON-01**: Season tenant-scoping (`Season.tenantId`).
- **TEAM-WEB-01**: Website grouping migration from TeamCategory to OrgUnit.
- **TEAM-CORE-03**: Remove deprecated `Team.orgUnitId` and `TeamCategory` after full migration.
