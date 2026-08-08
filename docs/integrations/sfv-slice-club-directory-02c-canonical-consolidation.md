# SFV / ClubCorner Integration — CLUB-DIRECTORY-02C: Canonical Club Consolidation & Logo Completeness

> **Document type:** Integration specification and runbook
> **Status:** Implemented — forward-looking club-identity consolidation is
> wired into ordinary schedule sync; the backfill/consolidation service for
> pre-existing STAGE duplicates is implemented, tested (unit + real-Postgres
> integration), and exposed via a standalone operator-run script. The script
> has **not** been executed against STAGE (see "Delivery status" below).
> **Last updated:** 2026-08-08
> **Maintained by:** SportClubEvo engineering team

---

## Goal

CLUB-DIRECTORY-01/02/02B established a canonical `ExternalClub` /
`ExternalTeam` directory and SFV logo enrichment, but a structural defect
remained: every SFV opponent **team** discovered via schedule sync got its
own dedicated `ExternalClub` — one club per team, not one club per
real-world club. This slice (CLUB-DIRECTORY-02C):

1. establishes a stable **provider club identity** (not a name heuristic),
2. wires it into the forward-looking discovery path so future syncs never
   create a new pseudo-club for a team of an already-known club,
3. provides an idempotent, tenant-safe **backfill/consolidation** mechanism
   for clubs already split by the pre-existing limitation,
4. widens logo enrichment to try every linked team ID under a club, not
   just the one currently being discovered, and
5. makes "still no crest after enrichment" diagnosable.

The existing Club Directory UI (`/dashboard/vereine`,
`components/admin/club-directory/ClubDirectorySearchableList.tsx`) already
renders "N Teams" per club card and a team list on the club detail page —
**no UI changes were needed**; the defect was entirely in the data layer.

---

## IMPORTANT FIRST STEP — provider club identity investigation

Before writing any code, the existing SFV integration surface
(`lib/integrations/sfv/`) was inspected for a stable, provider-assigned club
identifier, per the task's explicit priority order.

| Source | Field | Coverage | Already implemented? |
|---|---|---|---|
| `GET /api/team/list` (`fetchTeamList`) | `TeamDetail.clubNumber` | The tenant's **own** club's teams only. | Yes — already called every schedule sync run (`clubTeamList` in `schedule.ts`) for participant classification; `clubNumber` was fetched but never used. |
| `GET /api/club/ranking` (`fetchClubRanking`) | `ClubRankingEntry.clubNumber` | **Every** team appearing in the tenant's current league/group standings — own teams **and opponents alike**. This is the crucial discovery: a league ranking table inherently lists every club competing in that group. | Yes — already implemented and tested (`lib/integrations/sfv/client.ts#fetchClubRanking`, `__tests__/club-ranking.test.ts`) and already composed one layer up for opponent-picture resolution (`lib/integrations/sfv/opponent-identity.ts`, `lib/integrations/sfv/club-data-service.ts`) — but **never wired into the Club Directory's own `providerClubId` field** before this slice. |
| `GET /api/club/schedule` (`fetchClubSchedule`) | — | No club-level identifier for either schedule side; only `teamAId`/`teamBId`/`teamNameA`/`teamNameB`. | This is exactly why CLUB-DIRECTORY-02 originally fell back to "one club per opponent team" — documented in `discovery-service.ts`'s original module doc. |

**Conclusion: a stable SFV club ID (`clubNumber`) is available and already
exposed by two already-implemented, already-tested endpoints.** This is
*exactly* the field `ExternalClubProviderMapping.providerClubId` /
`ExternalTeamProviderMapping.providerClubId` reserved for since
CLUB-DIRECTORY-01 ("Provider-assigned numeric club identifier (SFV:
`TeamDetail.clubNumber`)") — no schema change, no new field, no guessed
identity from team names. The task therefore proceeds under **READY FOR
INDEPENDENT VERIFICATION**, not BLOCKED.

### Chosen identity strategy (priority order, as required)

1. **Stable SFV club ID** — `clubNumber`, resolved from `TeamDetail`
   (own teams) and `ClubRankingEntry` (own teams + opponents). This is the
   ONLY signal ever used to decide "do these two teams belong to the same
   club" (`lib/integrations/sfv/sync/club-identity.ts`).
2. Not needed — priority #1 is available.
3. **Narrow, explicitly documented fallback**: when `clubNumber` cannot be
   resolved for a specific team this run (e.g. a cup/friendly opponent
   outside every league group the tenant's own teams currently rank in —
   see "Coverage limitation" below), that ONE team is discovered with its
   own dedicated `ExternalClub`, exactly as before this slice. This is
   never a silent guess — it is the same, already-reviewed
   CLUB-DIRECTORY-02 fallback, now triggered strictly less often, and the
   backfill/consolidation mechanism reconciles it retroactively once
   coverage improves.

Suffixes ("B1", "C2", "D7 gelb", "rot", "weiss", "schwarz", …) are **never**
inspected or stripped anywhere in this slice — see the "never strips
team-name suffixes" test in `discovery-service.test.ts`. Two teams named
identically but reporting **different** `clubNumber`s (e.g. two different
"AC Rossoneri" clubs) are proven to stay distinct; two teams with wildly
different names but the **same** `clubNumber` are proven to consolidate.

### Coverage limitation (documented, not silently guessed)

`fetchClubRanking({ SeasonId, ClubId })` (no League/Division/Group filter)
returns the standings for every league/group the tenant's **own** teams
currently compete in — which includes every opponent **currently sharing
one of those groups**, but not an opponent encountered only in a cup match,
a friendly, or a league/group this particular fetch does not cover. For
such a team, `buildProviderClubIdIndex()` correctly returns no entry — not a
guess — and discovery falls back to the narrow per-team-club behaviour for
that one team, self-healing on a later sync (or via the backfill script)
once ranking coverage includes it.

### Conflict guard

If the same SFV `teamId` is ever seen with two **different** `clubNumber`s
within one run (own-team `TeamDetail` disagreeing with a ranking row, or two
ranking rows disagreeing with each other), that `teamId` is excluded from
the identity index entirely — never guessed — and a structured
`sfv_club_identity_conflict` warning is logged
(`schedule-logging.ts#logClubIdentityConflict`) so a genuine provider
inconsistency is diagnosable rather than silently swallowed. See
`club-identity.test.ts`'s "conflict guard" tests.

---

## Canonical model — before / after

**Before this slice** (the reported defect):

```
ExternalClub "FC Therwil 1"        ExternalClub "FC Therwil B1"        ExternalClub "FC Therwil D7 gelb"
  logoUrl: <maybe>                   logoUrl: null                       logoUrl: null
  ExternalTeam "FC Therwil 1"        ExternalTeam "FC Therwil B1"        ExternalTeam "FC Therwil D7 gelb"
```

Three pseudo-clubs for one real club — exactly the "multiple FC Therwil /
FC Aesch / AC Rossoneri-style entries" symptom described in the task.

**After this slice** (new discoveries, and after backfill for existing ones):

```
ExternalClub "FC Therwil"
  logoUrl: <canonical crest, adopted/enriched once>
  ExternalTeams:
    FC Therwil 1
    FC Therwil B1
    FC Therwil D7 gelb
    ...
```

One canonical club, many teams — exactly the CANONICAL MODEL the task
specifies. `/dashboard/vereine` already renders this correctly (see "UX
changes" below) once the underlying data is consolidated.

---

## Forward-looking fix — discovery-service.ts

`discoverExternalTeamFromProvider()` (`lib/club-directory/discovery-service.ts`)
now resolves-or-creates the canonical `ExternalClub` by `providerClubId`
whenever it is supplied:

```
resolveOrCreateTeamShell(providerClubId)
  ├─ providerClubId known?
  │    ├─ ExternalClubProviderMapping already exists for this clubNumber?
  │    │     └─ YES → attach the new ExternalTeam there. No new club.
  │    └─ NO  → createClubAndTeamShell(): create ONE new ExternalClub +
  │              ExternalClubProviderMapping + ExternalTeam +
  │              ExternalTeamProviderMapping, atomically, race-safely.
  └─ providerClubId unavailable → narrow fallback: dedicated new
       ExternalClub for this team alone (pre-CLUB-DIRECTORY-02C behaviour).
```

### Concurrency (two independent race guards)

CLUB-DIRECTORY-02 already guarded the **team**-identity race (two
overlapping discovery calls for the same brand-new `providerTeamId`) via a
plain `create()` against the real `@@unique([tenantId, provider,
providerTeamId, providerSeasonId])` constraint, rolling back the whole
transaction on conflict and adopting the winner.

CLUB-DIRECTORY-02C adds an **independent** second guard one level up: when a
brand-new `providerClubId` is claimed by creating a new `ExternalClub` +
`ExternalClubProviderMapping`, that mapping create is likewise a plain
`create()` guarded by the real `@@unique([tenantId, provider,
providerClubId])` constraint (new: `ExternalClubProviderMapping.create()`
added to `ClubDirectoryMutationDatabase`,
`prisma-mutation-adapter.ts`). Two overlapping discovery calls for two
**different** brand-new teams that happen to share the same brand-new
`clubNumber` can therefore never both commit their own `ExternalClub` — the
loser rolls back (nothing was committed yet), re-reads the winning
`ExternalClubProviderMapping`, and attaches its own new `ExternalTeam`
under the **winner's** club instead of creating a duplicate.

Proven against real Postgres in
`discovery-service-club-identity.integration.test.ts`:
- test 2 — ten genuinely concurrent calls for two teams sharing one
  brand-new `clubNumber` → exactly one club;
- test 3 — eight repeated trials, each racing **two fully independent**
  `PrismaClient`/`Pool` instances (simulating two overlapping processes) →
  exactly one club every trial.

---

## Pre-existing duplicates — backfill/consolidation mechanism

`lib/club-directory/consolidation-service.ts` is a pure, provider-agnostic
service (its own narrow `ClubConsolidationDatabase` interface + Prisma
adapter, `prisma-consolidation-adapter.ts`) that reconciles ALREADY-SPLIT
`ExternalClub` rows for a caller-supplied `providerTeamId -> providerClubId`
map (the exact same signal the forward fix uses).

For each distinct `providerClubId` in the map:

1. Loads every `ExternalTeamProviderMapping` (tenant + provider scoped)
   whose `providerTeamId` resolves to that `providerClubId`.
2. If those teams already share ONE `ExternalClub` → no-op (idempotent
   rerun), aside from confirming the `ExternalClubProviderMapping` link.
3. If they currently span **more than one** `ExternalClub` → merges them,
   atomically, per group:
   - **Canonical selection**: prefers an already-established
     `ExternalClubProviderMapping` for this `providerClubId` (stable across
     reruns); otherwise a non-archived club over an archived one; otherwise
     the earliest-created club (ties broken by id) — mirrors
     `scripts/team-sfv-mapping-01-fca-reconciliation.ts`'s survivor
     convention.
   - **Every** `ExternalTeam` currently on a losing club is re-parented
     (`externalClubId` updated) onto the canonical club — **never lost,
     never deleted**.
   - **Logo adoption**: the canonical club's own logo, if any (tenant-
     managed or previously provider-filled), is **never** touched. Only
     when the canonical club has none does the first non-null `logoUrl`
     among the losing clubs get adopted.
   - Every losing `ExternalClub` is **archived** (`archivedAt` set) — never
     deleted, per the codebase's existing soft-delete convention.
   - The `ExternalClubProviderMapping` for this `providerClubId` is
     upserted to point at the canonical club.
4. A team whose `providerTeamId` is **not** a key of the caller's map is
   left completely untouched — uncertain records are never guessed at or
   force-merged.

### Why Match references and provider mappings survive automatically

`MatchExternalMapping.homeExternalTeamId` / `awayExternalTeamId` reference
`ExternalTeam.id` directly (`prisma/schema.prisma`) — a value this service
**never** changes (only `ExternalTeam.externalClubId` changes).
`ExternalTeamProviderMapping` rows are likewise never touched. Consolidation
is therefore invisible to every existing Match reference; Matchcenter's
query-service (`lib/matchcenter/query-service.ts`, **unmodified** by this
slice) automatically starts reading the canonical club's crest on its very
next read. Proven end-to-end against real Postgres in
`consolidation-service.integration.test.ts` (test 3): a real `Event` +
`MatchExternalMapping` is created referencing a to-be-merged team;
`getMatchcenterMatchDetail()` (the real, unmodified production function) is
called before and after consolidation — before, it resolves the pre-merge
club's (null) crest; after, it resolves the canonical club's crest, through
the identical production code path.

### Wiring

- **Opportunistic, per-sync** (`lib/integrations/sfv/sync/club-consolidation.ts#runSfvClubConsolidationForCurrentSync`):
  wired into `schedule.ts`, reusing the SAME ranking/team-list data already
  fetched for identity resolution this run — **zero extra SFV calls**. Runs
  *before* external-opponent discovery each sync, so a just-merged canonical
  club is what discovery sees this run. Best-effort (never blocks sync);
  bounded to whatever teamIds this run's data covers, so STAGE
  opportunistically self-heals further over time as ranking coverage
  naturally shifts (season progress, new league groups).
- **Explicit, full backfill** (`scripts/club-directory-02c-sfv-consolidation.ts`):
  a standalone, operator-run script (`--inventory` / `--dry-run` /
  `--execute --confirm CONSOLIDATE-CLUB-DIRECTORY [--tenant <key>]`)
  following the exact safety conventions already established by
  `scripts/team-sfv-mapping-01-fca-reconciliation.ts` /
  `scripts/stage-cleanup-01-fca-canonical-data.ts`: refuses `--execute`
  against a production-looking `DATABASE_URL`, writes a pre-change JSON
  backup of every affected `ExternalClub`/`ExternalTeam` row to `.tmp/`
  before executing, and re-checks every previously-duplicate group as a
  postcondition after executing. `--dry-run` reuses the exact same
  `chooseCanonicalClubId()` / `chooseLogoDonor()` pure decision functions
  the real `--execute` path uses (exported from `consolidation-service.ts`)
  — the preview can never drift from what execution will actually do.

---

## Logo completeness

Priority order exactly as specified:

1. **Tenant-managed/uploaded logo always wins** — unchanged, enforced by the
   pre-existing, unmodified `buildExternalClubTenantFieldUpdate()` /
   `mergeProviderLogoUrl()` (CLUB-DIRECTORY-01/02B). Also re-proven at the
   consolidation layer: a tenant logo on the canonical club is never
   replaced by a losing club's logo during a merge (`consolidation-service`
   tests + integration test 6).
2. **Adopt an existing valid provider crest from consolidated records** —
   new in this slice, at the consolidation layer (see "Logo adoption"
   above; integration test 7).
3. **Try SFV `GET /api/team/picture/{teamId}` using linked provider teams,
   trying additional linked team IDs until one succeeds** — new in this
   slice, at the *discovery-time* enrichment layer
   (`lib/integrations/sfv/sync/team-logo.ts#resolveClubLogoFromCandidateTeamIds`):
   when the currently-discovered team's own picture fetch fails/404s, and
   its resolved club already has OTHER linked provider team IDs, those are
   tried next, in order, stopping at the first success (capped at 8
   candidates, defensive bound — see `external-team-discovery.ts`). "A
   failure for one team ID must NOT mean the club remains logo-less if
   another linked team can provide the crest" is proven directly in
   `team-logo.test.ts` ("first candidate fails, sibling succeeds").
4. **Persist once at ExternalClub level and stop** — unchanged
   (`ExternalClub.logoUrl`, the same single field CLUB-DIRECTORY-01
   reserved). Once any candidate succeeds, no further SFV calls are made
   for that discovery event.

### Diagnostics

"Missing provider logos after attempted enrichment must be diagnosable
rather than silently treated as normal": when a club's `providerClubId` is
known and **every** currently-linked provider team ID still yields no
crest, a structured `sfv_club_logo_enrichment_exhausted` warning is emitted
(`schedule-logging.ts#logClubLogoEnrichmentExhausted`) with the club
identity and the full list of attempted team IDs. The pre-existing,
unlogged "brand-new opponent, no club identity resolved yet" case (every
sync naturally passes through this before enrichment can even run) is
deliberately left unlogged to avoid noise — only a KNOWN club exhausting
every KNOWN candidate is treated as diagnosable.

---

## Premium directory UX

No UI code was changed. `/dashboard/vereine`
(`components/admin/club-directory/ClubDirectorySearchableList.tsx`) already
renders `{club.teamCount} Team{s}` per club card
(`ExternalClubSummaryDto.teamCount`, derived from `_count.externalTeams` —
CLUB-DIRECTORY-01), and the club detail page
(`app/(admin)/dashboard/vereine/[clubId]/page.tsx`) already lists every
`ExternalTeam` under that club. The defect was entirely that too many
`ExternalClub` rows existed for one real club, not that the UI failed to
group them — fixing the data layer alone produces exactly the requested
"FC Therwil / 6 Teams / [crest]" card, with the detail page already opening
to the individual `ExternalTeams`.

---

## Ownership

Provider sync never overwrites tenant-managed fields (`name`, `shortName`,
`alternativeName`, `logoUrl` once set, `website`, `location`, `notes`) —
unchanged, pre-existing CLUB-DIRECTORY-01 guarantee, re-verified at every
new touch point added in this slice (discovery's new club-creation path
still delegates exclusively to the same unmodified `linkExternalTeamProvider`/
`buildExternalClubTenantFieldUpdate`; consolidation never writes `name`,
`shortName`, `alternativeName`, `website`, `location`, or `notes` on any
club — only `externalClubId` on teams, `logoUrl` on a still-empty canonical
club, and `archivedAt` on losing clubs).

---

## Anti-drift

This slice deliberately did **not**:

- redesign Matchcenter or the Club Directory UI (both already correct once
  data is consolidated — see "Premium directory UX" above);
- implement TournamentCenter or TrainingCenter;
- change unrelated permissions or schema beyond the one new
  `ExternalClubProviderMapping.create()` interface method (no new Prisma
  migration — the `providerClubId`/`ExternalClubProviderMapping` fields and
  table already existed since CLUB-DIRECTORY-01);
- build generic fuzzy/name-based matching — identity is exclusively the
  provider-assigned `clubNumber`, proven by the "never strips team-name
  suffixes" and "keeps similarly-named-but-different clubs distinct" tests;
- scrape SFV HTML — only the already-implemented, already-tested
  `fetchTeamList()`/`fetchClubRanking()` JSON endpoints are used;
- perform unsafe global name-based merging — consolidation only ever
  merges teams the caller supplies strong, provider-verified identity
  evidence for, and never deletes anything;
- manually curate FC Allschwil-specific opponent mappings in production
  code — `club-identity.ts`, `consolidation-service.ts`, and
  `discovery-service.ts` are fully provider- and tenant-agnostic; the
  backfill script takes `--tenant <key>` as a parameter, never a hard-coded
  value.

---

## Files changed

| File | Change |
|---|---|
| `lib/integrations/sfv/sync/club-identity.ts` | New. `buildProviderClubIdIndex()` / `resolveProviderClubId()` — pure `teamId -> clubNumber` index from `TeamDetail[]` + `ClubRankingEntry[]`. |
| `lib/club-directory/discovery-service.ts` | Rewritten club-resolution path: `resolveOrCreateTeamShell()`, `createTeamShellUnderClub()`, `createClubAndTeamShell()`, `ClubIdentityRaceLostError` — consolidates onto one canonical club per `providerClubId`, race-safely. |
| `lib/club-directory/mutation-service.ts` | Added `ExternalClubProviderMapping.create()` to `ClubDirectoryMutationDatabase` (race-claim, mirrors the existing team-level one). |
| `lib/club-directory/prisma-mutation-adapter.ts` | Implements the new `create()`, translating a real Postgres unique-constraint violation (P2002) into `ClubDirectoryUniqueConstraintError`. |
| `lib/club-directory/query-service.ts` / `types.ts` | New `findExternalClubByProviderClubId()` — resolves a club + its linked provider team IDs by `providerClubId`, for logo-completeness candidate gathering. |
| `lib/club-directory/consolidation-service.ts` | New. Pure backfill/consolidation service — merges pre-existing duplicate `ExternalClub` rows, never loses a team, never deletes a club, tenant-scoped, idempotent. Exports `chooseCanonicalClubId()` / `chooseLogoDonor()` for the script's dry-run preview. |
| `lib/club-directory/prisma-consolidation-adapter.ts` | New. Prisma wiring for the consolidation service, with real transactional atomicity. |
| `lib/integrations/sfv/sync/team-logo.ts` | Added `resolveClubLogoFromCandidateTeamIds()` — tries multiple linked team IDs in order, stops at first success. |
| `lib/integrations/sfv/sync/external-team-discovery.ts` | Wires the club-identity index + multi-candidate logo resolution + `providerClubId` into `discoverExternalTeamFromProvider()`; emits the exhausted-enrichment diagnostic. |
| `lib/integrations/sfv/sync/club-consolidation.ts` | New. SFV-specific orchestration: builds the identity map from live SFV data, invokes the pure consolidation service (per-sync opportunistic path + full-tenant path for the script). |
| `lib/integrations/sfv/sync/schedule.ts` | Fetches ranking (best-effort), builds the identity index, wires it into the opponent resolver, runs opportunistic consolidation before discovery. |
| `lib/integrations/sfv/sync/schedule-logging.ts` | Added `logClubLogoEnrichmentExhausted()` / `logClubIdentityConflict()` diagnostics. |
| `scripts/club-directory-02c-sfv-consolidation.ts` | New. Standalone `--inventory`/`--dry-run`/`--execute` backfill script for pre-existing STAGE duplicates. |
| `package.json` | Added `club-directory-02c:inventory` / `club-directory-02c:dry-run` npm scripts. |
| Tests (unit) | `club-identity.test.ts`, `consolidation-service.test.ts`, `club-consolidation.test.ts`, `club-directory-02c-sfv-consolidation.test.ts`, updated `discovery-service.test.ts` / `mutation-service.test.ts` / `external-team-discovery*.test.ts` / `query-service.test.ts` / `sync-schedule.test.ts` / `team-logo.test.ts`. |
| Tests (real-Postgres integration) | `consolidation-service.integration.test.ts` (7 tests, incl. the end-to-end Matchcenter proof), `discovery-service-club-identity.integration.test.ts` (5 tests, incl. two genuine-concurrency proofs). |
| `docs/integrations/sfv-slice-club-directory-02c-canonical-consolidation.md` | This document. |

No changes to: Matchcenter code, Club Directory UI components, TournamentCenter, TrainingCenter, permissions, or any Prisma migration (the schema already had every field this slice needed).

---

## Tests / results

All commands run against a real, disposable local PostgreSQL 16 instance
(never STAGE, never any remote database).

```
npx vitest run                                  # 4494 passed, 8 skipped (excluding real-Postgres suites that need env vars)
CLUB_DIRECTORY_02C_TEST_DATABASE_URL=... npx vitest run \
  lib/club-directory/__tests__/consolidation-service.integration.test.ts \
  lib/club-directory/__tests__/discovery-service-club-identity.integration.test.ts
                                                 # 12 passed (real Postgres)
```

Every requirement in the task's TESTS section has direct, named test
coverage:

| Requirement | Test(s) |
|---|---|
| Multiple SFV teams resolve to one canonical club when identity proves it | `discovery-service.test.ts` "consolidates two brand-new teams…", `discovery-service-club-identity.integration.test.ts` #1 |
| Distinct clubs remain distinct | `discovery-service.test.ts` "keeps two teams with DIFFERENT providerClubId…", `club-identity.test.ts` "does not consolidate two genuinely different clubs…" |
| Existing duplicate records consolidate safely | `consolidation-service.test.ts` "merges N pre-existing…", `consolidation-service.integration.test.ts` #1 |
| Teams/provider mappings/references survive | `consolidation-service.test.ts` "preserves teams and mappings", `consolidation-service.integration.test.ts` #3 |
| Tenant isolation | `discovery-service.test.ts`, `consolidation-service.test.ts`/`.integration.test.ts` #4, `discovery-service-club-identity.integration.test.ts` #5 |
| Idempotent rerun | `discovery-service.test.ts` "re-syncing… is fully idempotent", `consolidation-service.test.ts`/`.integration.test.ts` #5 |
| Tenant-managed logo survives | `consolidation-service.test.ts`/`.integration.test.ts` #6 |
| Existing provider logo adopted where appropriate | `consolidation-service.test.ts`/`.integration.test.ts` #7 |
| Missing logo tries another linked team ID | `team-logo.test.ts` "falls through to a later candidate…" |
| Successful logo stored once at club level | `team-logo.test.ts` "returns the first successful crest and never tries a second candidate" |
| Provider failure non-blocking and diagnosable | `external-team-discovery-logo-enrichment.test.ts`, `schedule-logging.ts#logClubLogoEnrichmentExhausted` |
| Directory displays one club with multiple teams | Unchanged UI, already proven by CLUB-DIRECTORY-01's existing `query-service.test.ts` (`teamCount`) — no regression, no new UI test needed. |
| Matchcenter still resolves canonical club logos | `consolidation-service.integration.test.ts` #3 (real `getMatchcenterMatchDetail()` call, before/after consolidation) |
| No regressions | Full suite (4494 tests) green. |

---

## Risks / uncertain cases

- **The backfill script has not been run against STAGE.** It requires live
  SFV credentials (to resolve `clubNumber` for existing teams) and write
  access to the STAGE database — neither is available in this sandboxed
  environment, and per the task's delivery instructions this branch is not
  to be merged. The script is fully implemented, unit-tested (pure
  classification/plan logic), and its underlying mutation logic is
  integration-tested against real Postgres — but the *actual STAGE
  execution* is a deliberately separate, human-supervised next step (run
  `--inventory` first, review, then `--dry-run`, then `--execute
  --confirm CONSOLIDATE-CLUB-DIRECTORY`).
- **Ranking coverage is incomplete by nature.** A team encountered only in a
  cup/friendly match outside every league group the tenant's own teams
  currently rank in will not get a `clubNumber` this run (documented, not a
  bug) — it falls back to its own dedicated club until a future sync's
  ranking data happens to cover it, or until an admin manually re-parents it
  once corrected. This is the one legitimately "uncertain case" the task
  anticipated ("only if unavailable, a narrowly-designed and explicitly
  documented fallback").
- **Own-team `clubNumber` vs. ranking `clubNumber` conflicts are excluded,
  not resolved.** If SFV itself ever reports inconsistent `clubNumber`s for
  the same `teamId` across `TeamDetail` and `ClubRankingEntry` (not observed
  in any test fixture — a defensive guard, not an expected real case), that
  `teamId` is left out of consolidation for that run and logged
  (`sfv_club_identity_conflict`) rather than guessed at.
- **Canonical club naming after a brand-new multi-team club is first
  discovered.** The very first team ever seen for a never-before-known
  `clubNumber` still names the new `ExternalClub` after that ONE team's
  display name (a provisional name — tenant admins can rename any time,
  permanently, since that edit is tenant-managed and never overwritten by a
  later sync). This does not affect identity/consolidation, only the
  cosmetic initial label.
- **Full backfill scope.** The script resolves `clubNumber` from the
  tenant's *current default* season/club-id configuration
  (`TenantSfvConfig`). A team belonging only to a past season not covered
  by the current season's ranking fetch may not be reconciled in one script
  run. Re-running the script periodically (or extending it to iterate past
  seasons, a straightforward follow-up not implemented here to keep this
  slice's blast radius contained) will continue to close this gap over
  time, exactly like the opportunistic per-sync path already does.

---

## Delivery status

Branch: `cursor/club-directory-02c-canonical-consolidation-b3c4`, created
from latest `STAGE`. **Not merged**, per instructions.

**READY FOR INDEPENDENT VERIFICATION**
