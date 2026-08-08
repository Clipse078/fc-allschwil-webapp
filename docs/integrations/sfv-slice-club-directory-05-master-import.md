# SFV / ClubCorner Integration — CLUB-DIRECTORY-05: Full SFV Club Master Import

> **Document type:** Integration specification and runbook
> **Status:** Implemented and unit-tested. Not yet run against STAGE (see
> "Delivery status" below). **Superseded in part by CLUB-DIRECTORY-05-C1**
> (see addendum at the end of this document) — the manual admin trigger
> described in STEP 4 below has been removed; the import now runs
> automatically once per day via cron.
> **Last updated:** 2026-08-08
> **Maintained by:** SportClubEvo engineering team

---

## Goal

Expand the Club Directory beyond clubs discovered only through FC
Allschwil's already-synced matches/teams, by pre-populating it from the
broadest authoritative club source the SFV ClubCorner API actually exposes —
proven first, implemented second, per the task's explicit ordering.

---

## STEP 1 — SFV capability discovery (proven, not assumed)

The full existing SFV client surface (`lib/integrations/sfv/client.ts`,
confirmed against the official SFV Swagger/OpenAPI v26.6.15.2 specification)
was inspected against every capability the task named:

| Capability requested | Available? | Evidence |
|---|---|---|
| All clubs (national club master list) | **No** | No such endpoint exists anywhere in the client or the confirmed OpenAPI spec. |
| Clubs by association/region | **No** | No association/region-scoped club endpoint exists. |
| Club search | **No** | No search endpoint exists. |
| Clubs by competition/league | **Partial** | `GET /api/club/ranking` accepts optional `LeagueId`/`DivisionId`/`GroupeId` filters, but `ClubId` + `SeasonId` are **always required** — every call is scoped to the *calling* club's own participation, never an arbitrary league browsed independently of a club. |
| All teams with club references | **Partial** | `GET /api/team/list` only ever returns the **configured club's own teams** (`TeamDetail.clubNumber` always equals the caller's own `clubId`) — never other clubs' teams. |
| Ranking/standings traversal | **Yes (bounded)** | `GET /api/club/ranking`, called with `SeasonId`+`ClubId` and no League/Division/Group filter, returns the **full standings for every league/group the calling club's own teams currently compete in** — own teams *and* every opponent sharing those groups, each row carrying a stable `clubNumber` (`ClubRankingEntry.clubNumber`) and `teamName`. This is the single broadest club-enumeration signal SFV exposes to this integration. Already implemented and tested (`client.ts#fetchClubRanking`, `__tests__/club-ranking.test.ts`) and already used for club identity by CLUB-DIRECTORY-02C (`lib/integrations/sfv/sync/club-identity.ts`). |
| Season-wide competition traversal | **No** | `GET /api/competition*` (`competition-sync.ts`) enumerates the tenant's **own** competitions/rounds only, never other clubs. |
| Any other exhaustive/near-exhaustive source | **No** | No further endpoint exists in the confirmed OpenAPI spec or this codebase's already-implemented client surface. |

**Conclusion (proven, not guessed): the SFV ClubCorner API, as available to
this integration's credentials, is entirely club-scoped** — every business
endpoint requires the caller's own `clubId` and returns data relative to
that club's own participation. There is no "browse the national club
register" capability at any level.

### Answering the required report points

1. **Available endpoint(s):** `GET /api/club/ranking` (primary — used by this
   slice) and `GET /api/team/list` (secondary — own-club team names, best
   effort). Both already implemented, already tested, already used by
   CLUB-DIRECTORY-02C for the identical purpose (club identity resolution).
2. **Pagination/filtering:** No pagination — a single call per run returns
   the complete standings for every league/group the tenant's own teams
   currently compete in. Optional filters (`LeagueId`, `DivisionId`,
   `GroupeId`, `OrganisationId`) narrow further but are never required and
   are not used here (the unfiltered call is strictly broader).
3. **`providerClubId` availability:** Yes — `ClubRankingEntry.clubNumber` /
   `TeamDetail.clubNumber`, a stable provider-assigned integer. This is
   exactly the field `ExternalClubProviderMapping.providerClubId` has been
   reserved for since CLUB-DIRECTORY-01.
4. **Club name:** Not exposed at club level by this source — only a team's
   display name (`ClubRankingEntry.teamName`, e.g. "FC Therwil 1"). Used as
   a provisional label only, exactly like CLUB-DIRECTORY-02C's existing
   narrow-fallback naming convention.
5. **Logo:** Not present in ranking/team-list rows. `GET
   /api/team/picture/{teamId}` exists but requires a specific `teamId` per
   call — deliberately **not** called during master import (see "Why no
   logo enrichment during import" below); it is reused unchanged by the
   ordinary schedule-sync enrichment path once a team is actually
   discovered.
6. **Website/location/address/contact:** Not present in any endpoint this
   integration has access to.
7. **Coverage:** Regional/competition-scoped for the tenant's **current
   default season** — every club with a team in a league/group the tenant's
   own teams currently compete in, whether or not a match against that
   opponent has actually been scheduled/synced yet. **Not** a national SFV
   club master list. See "Coverage" below for the precise boundary.
8. **Estimated call volume:** Exactly **two** SFV calls per import run
   (`fetchClubRanking` + `fetchTeamList`), independent of how many candidate
   clubs are discovered — never one call per club.
9. **Credential access:** The existing SFV credentials already used by
   every other sync surface are sufficient — no new scope, no new
   credential, no new endpoint was required.

---

## STEP 2 — Chosen import strategy

```
SFV GET /api/club/ranking (+ /api/team/list, best-effort)
  → ClubRankingEntry.clubNumber / TeamDetail.clubNumber   (providerClubId)
  → ExternalClubProviderMapping  (upserted, race-safe)
  → canonical ExternalClub       (created once, never duplicated)
```

Rules enforced (all reused from CLUB-DIRECTORY-01/02/02C, none reinvented):

- `providerClubId` is the **only** identity signal — never a name.
- Resolve-or-create is **idempotent**: rerunning against unchanged SFV data
  creates zero new clubs.
- **Never** creates a duplicate canonical club for the same
  tenant/provider/`providerClubId` — enforced by the real
  `@@unique([tenantId, provider, providerClubId])` constraint plus a
  race-safe `create()` (mirrors the existing team-identity race guard from
  CLUB-DIRECTORY-02C).
- Provider metadata (`providerClubName`, `providerLogoUrl`,
  `providerWebsite`, `lastSyncedAt`) refreshes on every run via the
  already-existing, already-tested `linkExternalClubProvider`
  (`mutation-service.ts`) — the **same** function CLUB-DIRECTORY-01 uses for
  every other provider club link, unmodified.
- Tenant-managed canonical fields (`name`, `shortName`, `alternativeName`,
  `website`, `location`, `notes`, and `logoUrl` once set) are **never**
  overwritten — enforced by the same, unmodified
  `buildExternalClubTenantFieldUpdate`.
- Archived/manually-created clubs are never resurrected or merged by name —
  this slice never inspects names for identity, only `providerClubId`, and
  never touches `archivedAt`.
- Tenant isolation: every lookup and write is scoped to `tenantId`.

### Coverage — precise and honestly limited

The SFV API does **not** expose the complete national club universe. This
slice implements the broadest reliable provider-supported coverage and
reports the limitation explicitly, exactly as instructed:

- **Included:** every club with a team currently listed in a league/group
  the tenant's own teams compete in, for the tenant's configured default
  season — including clubs the tenant has **not yet actually played** this
  season (the standings table lists every participant regardless of
  fixtures played).
- **Not included:** a club encountered only in a cup/friendly match outside
  every league group the tenant's own teams currently rank in, a club in a
  completely different league, or any club from a season other than the
  configured default season. This mirrors, and does not widen, the
  already-documented CLUB-DIRECTORY-02C coverage limitation (see
  `sfv-slice-club-directory-02c-canonical-consolidation.md`, "Coverage
  limitation") — this slice pre-populates what **is** already reliably
  knowable from that same source, instead of waiting for a match to be
  synced first.

---

## STEP 3 — Implementation

Extends existing SFV sync/discovery services; no parallel framework.

| File | Change |
|---|---|
| `lib/club-directory/discovery-service.ts` | New `discoverExternalClubFromProvider()` — the club-only sibling of the existing `discoverExternalTeamFromProvider()`. Same identity rule, same race-safety (`createClubShellOnly()`), same idempotency, same ownership guarantees via the existing `linkExternalClubProvider()`. **Never** creates an `ExternalTeam`. |
| `lib/integrations/sfv/sync/club-identity.ts` | New `buildClubMasterCandidates()` — wraps the existing, already-tested `buildProviderClubIdIndex()` (same identity resolution, same conflict guard) to derive the distinct list of opponent clubs for a run, excluding the tenant's own club, with a deterministic provisional display name. |
| `lib/integrations/sfv/sync/club-master-import.ts` | New. `runSfvClubMasterImport()` — the orchestrator: fetches ranking (+ team list, best-effort), builds candidates, resolves-or-creates each club independently (partial-failure-safe), marks the run successful in `TenantSfvConfig.lastClubMasterImportAt` only when no candidate failed. |
| `lib/integrations/sfv/sync/schedule-logging.ts` | Added `logClubMasterImportStarted/Completed/Failed()` — same structured, sanitized logging discipline as every other sync surface. |
| `lib/integrations/sfv/tenant-config-repository.ts` / `tenant-config-types.ts` | Added `lastClubMasterImportAt` (read + `markClubMasterImportSuccessful()`), mirroring the existing `lastTeamSyncAt` / `lastScheduleSyncAt` / `lastMatchDetailSyncAt` / `lastCompetitionSyncAt` pattern exactly. |
| `prisma/schema.prisma` + migration `20260808120000_club_directory_05_master_import_sync_marker` | One new nullable `DateTime` column on the already-existing `TenantSfvConfig` table. **No other schema change** — `ExternalClub` / `ExternalClubProviderMapping` are reused exactly as CLUB-DIRECTORY-01 defined them. |
| `app/api/admin/integrations/sfv/clubs/master-import/route.ts` | New. `POST` endpoint, `TENANTS_MANAGE`-gated, tenantId from session only — same contract shape as every other SFV sync route. |
| `components/admin/integrations/SfvTenantConfigPanel.tsx` | Added one concise action card ("SFV-Vereinsverzeichnis synchronisieren") to the existing SFV admin surface — no new module/dashboard. |

### Why no `ExternalTeam` is created

The ranking/team-list source proves **club** identity, never team-level
detail (no roster call is made for opponent clubs). Creating placeholder
teams "just to have something under the club" would misrepresent provider
data that was never actually fetched. A master-imported club may have zero
teams until one is later discovered through the ordinary
schedule/ranking-driven opponent-discovery path — at which point it attaches
to this **same** canonical club (see "Convergence" test coverage below).

### Why no logo enrichment during import

`GET /api/team/picture/{teamId}` requires a specific `teamId` and is already
the enrichment mechanism used by ordinary opponent discovery once a team is
actually linked. Calling it speculatively for every master-imported club
(which has no linked team yet) would multiply SFV calls by the candidate
count for no proven benefit, and would violate "bounded/paginated calls" /
"smallest safe import strategy". Logos populate exactly as before, once a
team of that club is discovered normally.

---

## STEP 4 — Admin UX

Added to the existing SFV admin surface
(`app/(admin)/dashboard/admin/integrations/sfv/page.tsx` →
`SfvTenantConfigPanel.tsx`) — no new module/dashboard:

- One button: **"Vereinsverzeichnis synchronisieren"**.
- Result summary: ranking rows fetched, candidate clubs found, created,
  updated (already known), failed, duration.
- Fixed coverage/source description string, always shown, so the admin
  never has to infer coverage from raw counts.
- Error details when any candidate failed to persist.
- "Letzte Vereinsverzeichnis-Synchronisierung" timestamp row in the existing
  connection-status card, mirroring every other sync surface's "last run"
  display.

---

## STEP 5 — Tests

All commands run against a real, disposable local PostgreSQL 16 instance
(never STAGE, never any remote database) plus mocked-provider unit tests.

```
npx vitest run                                  # 4701 passed, 32 skipped
npx tsc --noEmit                                # clean (pre-existing,
                                                 # unrelated failures only)
npm run lint                                    # clean (pre-existing,
                                                 # unrelated warnings/errors only)
```

| Requirement | Test(s) |
|---|---|
| First import creates missing provider-backed clubs | `club-master-import.test.ts` "creates a canonical club for every distinct opponent clubNumber…"; `discovery-service.test.ts` "creates a canonical ExternalClub WITHOUT any ExternalTeam…" |
| Rerun is idempotent | `club-master-import.test.ts` "idempotent rerun"; `discovery-service.test.ts` "does not create a second club…" |
| Existing provider-linked clubs are reused | `discovery-service.test.ts` "attaches to an already-manually-created ExternalClub once linked…" |
| No duplicates for same providerClubId | `discovery-service.test.ts` providerClubId race describe block (concurrency) |
| Tenant-managed canonical names are preserved | `discovery-service.test.ts` "refreshes provider-owned mapping fields but never overwrites the tenant-managed canonical name" |
| Provider metadata can refresh safely | Same test — `providerClubName` on the mapping updates; canonical `name` does not |
| Manual clubs are not merged by name | `discovery-service.test.ts` "attaches to an already-manually-created ExternalClub once **linked**…" (never by name — only by explicit provider link) |
| Tenant isolation holds | `discovery-service.test.ts` "the same providerClubId under two different tenants never cross-merges" |
| Partial provider failures do not corrupt existing data | `club-master-import.test.ts` "counts a per-candidate persistence failure without aborting the remaining candidates"; "a ranking-fetch failure aborts the whole run before any candidate is processed" |
| Existing CLUB-DIRECTORY-02C/03/04 behavior remains intact | Full suite green (4701 tests, no regressions); convergence tests below prove the two discovery paths (master import vs. opponent discovery) never diverge |
| Convergence (new, explicitly required by this task) | `discovery-service.test.ts` "a team discovered later under the SAME providerClubId attaches to the master-imported club" and its inverse |
| Bounded call volume | `club-master-import.test.ts` "makes exactly two SFV calls regardless of how many candidate clubs are discovered" |

---

## Anti-drift

This slice deliberately did **not**:

- redesign the Club Directory or its UI beyond one new action card;
- revisit or re-run CLUB-DIRECTORY-02C consolidation;
- change manual merge/team-move behavior (`mutation-service.ts` untouched
  beyond the pre-existing `linkExternalClubProvider`, called exactly as
  CLUB-DIRECTORY-01 designed it to be called);
- change canonical tenant-managed naming ownership;
- overwrite tenant-managed club fields from SFV;
- create another cleanup/ops framework or standalone script — the import
  runs through the normal admin action + API route, like every other sync;
- scrape FVNWS/SFV websites — only already-implemented, already-tested JSON
  endpoints are used;
- invent clubs — every candidate is backed by a real `clubNumber` observed
  in a live SFV response this run;
- create speculative schema — one nullable timestamp column, mirroring four
  already-existing ones;
- mutate STAGE manually — all development and testing used a disposable
  local PostgreSQL instance;
- import teams — `ExternalTeam` creation was proven unnecessary for club
  discovery via this source (see "Why no `ExternalTeam` is created" above).

---

## Delivery status

Branch: `cursor/club-directory-05-full-sfv-club-master-import-3636`, created
from latest `STAGE`. **Not merged**, per instructions. The import has not
been run against STAGE — it requires live SFV credentials and STAGE write
access, neither of which is available or appropriate in this sandboxed
environment. All logic is unit-tested against synthetic SFV responses and a
real, disposable local PostgreSQL instance.

**READY FOR REVIEW**

---

## Addendum — CLUB-DIRECTORY-05-C1: manual trigger removed, daily cron added

**Product decision:** tenant admins must not trigger the SFV club master
import manually. It now runs automatically, once per day, using the exact
same operational pattern already established for the SFV match/schedule
sync cron (`app/api/cron/sfv-sync/route.ts`).

Changes on top of CLUB-DIRECTORY-05 (smallest safe change — the import
service itself, `runSfvClubMasterImport()`, is untouched):

| File | Change |
|---|---|
| `components/admin/integrations/SfvTenantConfigPanel.tsx` | Removed the "SFV-Vereinsverzeichnis synchronisieren" action card, its button, its client-side fetch handler, and its result-summary sub-component. The read-only "Letzte Vereinsverzeichnis-Synchronisierung" timestamp row (sourced from `TenantSfvConfig.lastClubMasterImportAt`) is kept in the connection-status card for observability. |
| `lib/integrations/sfv/sync/auto-club-master-import.ts` | New. `runAutomaticSfvClubMasterImport()` — iterates every tenant returned by the existing `listEnabledSfvConfigTenantIds()` (the same tenant-discovery query the match-sync cron orchestrator uses) and calls the unchanged `runSfvClubMasterImport(tenantId)` once per tenant, sequentially, isolating per-tenant failures exactly like `auto-sync.ts#runAutomaticSfvScheduleSync`. |
| `app/api/cron/sfv-club-master-import/route.ts` | New. `GET` route, `Authorization: Bearer ${CRON_SECRET}`-gated (identical fail-closed pattern to `app/api/cron/sfv-sync/route.ts`), delegates to `runAutomaticSfvClubMasterImport()`. |
| `vercel.json` | Added a second daily cron entry — `/api/cron/sfv-club-master-import` at `0 4 * * *` UTC, independent of the existing `/api/cron/sfv-sync` entry (`0 1 * * *`) so neither cron's schedule, success, or failure has any bearing on the other. |
| `app/api/admin/integrations/sfv/clubs/master-import/route.ts` | Left in place, unchanged and still gated by the platform-only `TENANTS_MANAGE` permission (never grantable to a tenant `Club Admin` role — see `prisma/seed.ts`), as a lower-level operational escape hatch. It is no longer linked from any admin page. |

**Not coupled to the match/schedule sync run:** the club master import cron
is a fully separate route, orchestrator, and schedule entry — it does not
call, and is not called by, `runAutomaticSfvScheduleSync()` or
`/api/cron/sfv-sync`. Either can run, succeed, or fail independently.

**No new scheduling framework:** reuses the existing Vercel Cron +
`CRON_SECRET` + `vercel.json` mechanism verbatim.

**Verification:**

- Club Admin cannot trigger the import manually: the manual trigger no
  longer exists in the admin UI, and the underlying route it used to call
  remains gated by `tenants.manage`, a `PermissionScope.PLATFORM`,
  `grantableByAdmin: false` permission that a tenant-scoped `Club Admin`
  role can never hold (`prisma/seed.ts`) — see
  `components/admin/integrations/__tests__/SfvTenantConfigPanel.test.tsx`
  "CLUB-DIRECTORY-05-C1 club master import — manual trigger removed".
- Cron route is `CRON_SECRET`-protected (fail-closed when unset): see
  `app/api/cron/sfv-club-master-import/__tests__/route.test.ts`.
- One run per scheduled invocation, per tenant: `runSfvClubMasterImport` is
  called exactly once per enabled tenant per orchestrator invocation — see
  `lib/integrations/sfv/sync/__tests__/auto-club-master-import.test.ts`.
- Rerun idempotency and tenant isolation are unchanged, inherited directly
  from the untouched `runSfvClubMasterImport()` / `discoverExternalClubFromProvider()`
  (see CLUB-DIRECTORY-05 test coverage above — still green, unmodified).
- Failures are logged and isolated per tenant, never corrupting another
  tenant's data or aborting the run for other tenants — same pattern as
  `runAutomaticSfvScheduleSync`.
- Existing match sync behavior (`/api/cron/sfv-sync`, `auto-sync.ts`,
  `schedule.ts`) is entirely untouched — full pre-existing test suite for
  those files is unmodified and still green.

**READY FOR REVIEW**
