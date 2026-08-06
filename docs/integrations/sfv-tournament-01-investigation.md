# SFV / FVNW Tournament Ingestion — Investigation (SFV-TOURNAMENT-01)

> **Document type:** Investigation report
> **Status:** Re-opened and re-verified against the **live** SFV Club API — confirmed absent
> **Recommendation:** **BLOCKED — SCHEDULE DOES NOT EXPOSE TOURNAMENTS**
> **Last updated:** 2026-08-06
> **Verification case:** FC Allschwil E3, tournaments on 23.08.2026, 06.09.2026, 13.09.2026

---

## 1. Objective

Determine whether SFV/FVNW tournaments (specifically the three known FC
Allschwil E3 tournament dates) are present inside the existing
`GET /api/club/schedule` response — as normal rows, or as distinguishable
tournament rows — rather than requiring a separate tournament endpoint. If
present and derivable, implement canonical tournament ingestion. If absent,
keep the feature blocked with exact evidence and remove any non-functional
sync UI.

This re-opens and supersedes the prior investigation in this PR, which
concluded from the OpenAPI specification alone (no live schedule query) that
no tournament endpoint exists. This revision **executes the real query**
against the live SFV Club API for Club 483 / Season 2027 and inspects the
raw response.

---

## 2. Live request executed

**Endpoint:** `GET /api/club/schedule` (SFV Club API Interface, OpenAPI
v26.6.15.2 `Schedule` resource — the same endpoint `lib/integrations/sfv/sync/schedule.ts`
already uses for match sync).

**Host:** `https://club-api-services.football.ch` (production). See
[§2.1](#21-operational-note-token-host-mismatch-in-this-environment) for a
methodology note on host selection.

**Request parameters (exact, as sent):**

```
GET /api/club/schedule?SeasonId=2027&ClubId=483&DateFrom=2026-07-01T00:00:00.000Z&DateUntil=2027-06-30T23:59:59.000Z
X-User-Token: <redacted>
User-Agent: fc-allschwil-webapp/0.1 (SFV-Integration)
Accept: application/json
```

The date window (2026-07-01 → 2027-06-30) spans the entire 2026/2027 season
and comfortably covers all three known E3 dates (23.08.2026, 06.09.2026,
13.09.2026) plus a wide margin on both sides, so no tournament-shaped row
for the season could be missed by an overly narrow window.

**Response:** HTTP 200, `239` `Schedule` rows for Club 483 / Season 2027.

### 2.1 Operational note: token host mismatch in this environment

This sandbox's `SFV_TOKEN_URL` environment variable pointed at the
**staging** host (`stg-club-api-services.football.ch`), which rejected the
configured `SFV_APPLICATION_KEY`/`SFV_APPLICATION_PASS` with a genuine
upstream `401 Unauthorized` (RFC 9110 problem-details body, real `traceId`
from `football.ch`, not a network/Cloudflare block). The same credentials
authenticated successfully (`HTTP 200`, opaque session token returned)
against the **production** host `club-api-services.football.ch`. All queries
in this document were executed against production with a live, freshly
issued token — no mocking, no cached/stale data. This is purely an
environment-configuration detail of this sandbox and does not change the
finding below; it is noted here for reproducibility.

---

## 3. Raw field inventory (per row)

Every row of the `Schedule` resource contains exactly these fields (verified
against the live response, matching the documented OpenAPI schema and the
existing `ClubScheduleEntry` type in `lib/integrations/sfv/client.ts`):

```
matchId, matchNumber, matchDate, groupId, cupId, groupName, roundNbr,
playgroundId, stadiumPlaygroundName, isUnkownPlayground,
leagueId, leagueNumber, leagueName, divisionId, divisionName,
organisationId, organisationName,
matchType, matchTypeName, matchState, matchStateName,
playDay, playDayName, seasonId, seasonName,
scoreTeamA, scoreTeamB, teamAId, teamNameA, teamBId, teamNameB
```

Every row is a **two-team fixture** (`teamAId`/`teamNameA` vs.
`teamBId`/`teamNameB`). There is no `organizerName`, no venue distinct from
`stadiumPlaygroundName` (a per-match pitch, not a tournament host), no
participant list beyond the two teams, and no `tournamentId` or equivalent
container identifier anywhere in the schema or the live payload.

### 3.1 Distinct `matchType` / `matchTypeName` values across all 239 rows

| `matchType` | `matchTypeName` | Row count |
|---|---|---|
| 1 | `Meisterschaft` (league match) | 212 |
| 2 | `Cup` | 3 |
| 3 | `Trainingsspiele` (friendly) | 23 |
| 9 | `Schweizer-Cup` | 1 |

**212 + 3 + 23 + 1 = 239 — accounts for every row.** No `matchType` value
corresponding to "Turnier"/"Tournament" exists anywhere in the live season
data for this club. `matchType` is a small, closed provider enum (four
distinct values observed across a full season) — not an open set that could
later include a tournament flag going undetected by chance.

---

## 4. Do the three known E3 dates appear at all?

Filtering the 239 rows to the three known dates:

| Date | Rows on that date | Any row for team "E3"? |
|---|---|---|
| 2026-08-23 | 6 | **No** |
| 2026-09-06 | 6 | **No** |
| 2026-09-13 | 6 | **No** |

All 18 rows across the three dates are ordinary `matchType=1`
(`Meisterschaft`) two-team fixtures for other FC Allschwil age groups —
D1/D2 (Junioren D), C1/C2 (Junioren C), B1/B2 (Junioren B), the first team
(3. Liga), and the women's team (Frauen 3. Liga). None reference an "E3"
team on either side. Sample (full JSON captured during this investigation,
one row per date):

```jsonc
// 2026-08-23T11:00:00 — Junioren D-9, NOT E3
{ "matchId": 4360846, "leagueName": "Junioren D-9", "teamNameA": "SC Binningen D9 c", "teamNameB": "FC Allschwil D2", "matchTypeName": "Meisterschaft", ... }

// 2026-09-06T09:30:00 — Junioren D-7, NOT E3
{ "matchId": 4360786, "leagueName": "Junioren D-7", "teamNameA": "FC Allschwil D2", "teamNameB": "FC Reinach D7 b", "matchTypeName": "Meisterschaft", ... }

// 2026-09-13T11:00:00 — Junioren D-9, NOT E3
{ "matchId": 4361793, "leagueName": "Junioren D-9", "teamNameA": "FC Telegraph BS schwarz", "teamNameB": "FC Allschwil D1", "matchTypeName": "Meisterschaft", ... }
```

**A whole-season, case-insensitive scan for `/e3/i` against every
`teamNameA`/`teamNameB` value in all 239 rows (not just the three known
dates) returns 0 matches.** There is no row, on any date in the 2026/2027
season, that mentions an "E3" team.

---

## 5. Does SFV even know about an "E3" team for this club?

To rule out a naming mismatch (e.g. the provider might call it something
other than "E3"), `GET /api/team/list?SeasonId=2027&ClubId=483` was also
queried live. It returned **18 teams**, none in the "E" (Junioren E,
youngest age category) bracket at all:

```
FC Allschwil          (3. Liga)                       — first team
FC Allschwil          (2. Liga interregional)
FC Allschwil          (Senioren 30+ Promotion)
FC Allschwil          (Senioren 40+ Meister)
FC Allschwil          (Senioren 50+/7)
FC Allschwil          (Frauen 3. Liga)
FC Allschwil          (Juniorinnen FF-14 (9v9))
FC Allschwil          (Juniorinnen FF-17 1. Stärkeklasse)
FC Allschwil B1       (Junioren B Promotion)
FC Allschwil B2       (Junioren B 1. Stärkeklasse)
FC Allschwil C1       (Youth League C)
FC Allschwil C2       (Junioren C 1. Stärkeklasse)
FC Allschwil D1       (Junioren D-7)
FC Allschwil D1       (Junioren D-9)
FC Allschwil D2       (Junioren D-7)
FC Allschwil D2       (Junioren D-9)
FC Allschwil D3       (Junioren D-9)
```

The most granular Junioren age bracket registered with SFV for this club and
season is **D** (Junioren D-7/D-9). There is no team, active or inactive,
registered as "E3" (or any E-series team) for Club 483 in Season 2027. This
is the expected pattern in Swiss youth football: **E-Junioren (the youngest
age bracket) typically play exclusively in informally organized "Turniere",
not in SFV/FVNW league competition**, so they are never assigned an SFV
`teamId` and consequently never appear in `GET /api/club/schedule` or
`GET /api/team/list` under any date, matchType, or team-name spelling.

---

## 6. Findings summary

| Question | Answer |
|---|---|
| Does `GET /api/club/schedule` return any row for the three known E3 dates that could represent a tournament? | **No — 0 of 18 rows on those dates reference an E3 team; all are ordinary two-team `Meisterschaft` fixtures for other teams.** |
| Does `GET /api/club/schedule` return an E3 row on *any* date in the season? | **No — 0 of 239 rows for the full 2026/2027 season mention an E3 team.** |
| Does the schedule response ever distinguish a tournament shape from a match (e.g. via `matchType`)? | **No — only 4 closed enum values exist across the whole season (`Meisterschaft`, `Cup`, `Trainingsspiele`, `Schweizer-Cup`); none represent a multi-team tournament container.** |
| Is "E3" registered as an SFV team at all for this club/season? | **No — `GET /api/team/list` returns 18 teams, none in the E bracket.** |
| Can multiple schedule rows be grouped into one canonical tournament via a stable provider field? | **N/A — there are no candidate rows to group.** Even hypothetically, the `Schedule` schema has no tournament-container identifier: `cupId` only tags individual two-team cup *matches* (not used for any of the 239 rows here), and `groupId`/`groupName` denote a league promotion group, not an event/tournament grouping. |
| Why is no stable derivation possible? | The provider's `Schedule` resource is fixed to a two-team-fixture shape (`teamAId`/`teamNameA` vs. `teamBId`/`teamNameB`, one `matchDate`, one `playgroundId`) with no organiser, no venue distinct from the per-fixture pitch, no participant list, and no tournament identifier of any kind. E-Junioren tournaments are never assigned an SFV team ID, so they cannot appear in this resource under any query shape, date range, or field combination. |

**Conclusion: schedule rows cannot represent tournaments — for the three
known E3 dates specifically, and for this club/season in general.** This
confirms and strengthens (with live data, not just static OpenAPI-spec
inspection) the same root cause identified in the original investigation:
there is no structured SFV/FVNW resource — schedule or otherwise — for
planned tournaments.

---

## 7. Prior findings (retained from the original investigation)

The original spec-level findings still stand and are corroborated by the
live query above:

- The full SFV Club API Interface (OpenAPI v26.6.15.2) declares exactly 14
  endpoints; none is a tournament resource distinct from a two-team match.
- The public FVNWS match-center website (the only human-facing tournament
  source) actively blocks automated access: live `curl` on 2026-08-06
  returned **HTTP 403** with an explicit anti-bot notice directing clubs to
  `support@football.ch` for authorized access. No scraper was built, per
  this task's own stop condition.
- The canonical `Tournament` concept already exists as `Event.type =
  "TOURNAMENT"` in `prisma/schema.prisma` (organiser, venue, competition
  label, start/end time, one participating team, full visibility flags) —
  no schema change is needed. Manual creation
  (`components/admin/events/TournamentEventCreateForm.tsx` → `POST
  /api/events`, `source: "MANUAL"`) is fully wired and remains the correct,
  safe path for tournaments, including the three E3 dates.

---

## 8. Changes made in this PR revision

Because the schedule endpoint does not expose tournaments (§6), automated
ingestion is not implemented. Per this task's explicit instruction to
**"remove any misleading non-functional sync UI before merge"**, the
following diagnostic-only surface added by the prior revision of this PR —
which performed no real check against live data and always returned a
static "blocked" result — has been **removed**:

| Removed | Reason |
|---|---|
| `lib/integrations/sfv/sync/tournament-sync.ts`, `tournament-types.ts` | Diagnostic-only service that never called the provider and always returned a hardcoded `blocked: true` result — misleading given this investigation's live-verified conclusion. |
| `app/api/admin/integrations/sfv/tournaments/sync/route.ts` (+ tests) | Route existed solely to expose the above no-op service. |
| The "Turniere synchronisieren" section and `handleTournamentSync`/`TournamentSyncResult` in `components/admin/integrations/SfvTenantConfigPanel.tsx` (+ related test additions) | A "Jetzt synchronisieren" button that performs no network request and no database write is a non-functional, misleading UI affordance for club administrators. |

**Retained** (still correct and non-misleading):

- `lib/events/__tests__/sfv-tournament-01-e3-publication.test.ts` — proves
  the *existing, unmodified* publication chain (canonical `Event` →
  `getPublicEvents` → `toPublicWebsiteEvent` → `evaluatePublication`)
  correctly publishes manually-created E3 tournaments for the three known
  dates to the website tournaments feed and Infoboard. This does not depend
  on the removed diagnostic sync code and remains valid evidence that the
  manual-creation path (the only currently working path) functions
  end-to-end for this exact verification case.
- Manual tournament creation (`TournamentEventCreateForm` → `POST
  /api/events`) — unmodified, unaffected by this investigation.

No changes were made to: the `Event`/`Tournament` data model, the public
API contract, the publication policy, the website, the Infoboard UI,
Trainingsplaner, Roles & Permissions, or any existing match synchronization
behaviour (`sync/schedule.ts`, `sync/schedule-mapper.ts`,
`sync/schedule-persistence.ts` are untouched).

---

## 9. Recommendation

## **BLOCKED — SCHEDULE DOES NOT EXPOSE TOURNAMENTS**

A live query of `GET /api/club/schedule` for Club 483 / Season 2027,
covering the three known FC Allschwil E3 dates (23.08.2026, 06.09.2026,
13.09.2026) plus the full season as a safety margin, returned 239 real
rows — zero of which reference an E3 team, on those dates or on any other
date in the season. `GET /api/team/list` for the same club/season confirms
SFV has no "E3" (or any E-bracket) team registered at all. The `Schedule`
resource's fixed two-team-fixture shape has no organiser, venue-beyond-pitch,
participant list, or tournament-container identifier that could support a
deterministic grouping key even if matching rows existed.

Automated tournament ingestion from `/api/club/schedule` is not possible.
Until SFV/football.ch either publishes a structured tournament resource or
grants explicit authorization for automated FVNWS access
(`support@football.ch`), the manual tournament creation path — already
fully wired to the website, Wochenplan, team pages, and Infoboard, and
verified end-to-end for the E3 verification case — remains the correct way
to publish FC Allschwil's tournaments.
