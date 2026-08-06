# SFV / FVNW Tournament Ingestion — Investigation & Implementation (SFV-TOURNAMENT-01)

> **Document type:** Investigation report and implementation record
> **Status:** Investigation complete — no reliable structured provider source exists
> **Recommendation:** **BLOCKED — PROVIDER SOURCE REQUIRED** (see below)
> **Last updated:** 2026-08-06
> **Verification case:** FC Allschwil E3, tournaments on 23.08.2026, 06.09.2026, 13.09.2026

---

## 1. Objective

Find and implement the canonical import of SFV/FVNW tournaments so planned
tournaments appear in the SportClubEvo WebApp, the public tournament API, the
FC Allschwil website, and Infoboard eligibility — without scraping HTML when a
stable structured endpoint exists, and without duplicating or corrupting any
existing data.

---

## 2. Root cause

**There is no structured SFV/FVNW resource for planned tournaments, and the
only human-facing source explicitly forbids automated access.** Tournaments
have therefore never been importable through the existing SFV sync
architecture — not because of a bug, but because there is nothing structured
to fetch.

### 2.1 The official SFV Club API Interface has no tournament endpoint

The live OpenAPI specification was fetched directly from both SFV hosts on
2026-08-06:

| Property | Value |
|---|---|
| Swagger UI | `https://stg-club-api-services.football.ch/swagger` |
| OpenAPI JSON | `https://stg-club-api-services.football.ch/swagger/v1/swagger.json` |
| OpenAPI version | 3.0.4 |
| API title / version | SFV Club API Interface v26.6.15.2 |

The specification declares **exactly 14 endpoints**:

```
POST /api/token
GET  /api/club/{clubId}/players
GET  /api/club/{clubId}/officials
GET  /api/club/{clubId}/coaches
GET  /api/club/{clubId}/referees
GET  /api/club/schedule
GET  /api/club/ranking
GET  /api/common/ids
GET  /api/match/{matchId}
GET  /api/match/{matchId}/players
GET  /api/match/{matchId}/events
GET  /api/match/{matchId}/bench
GET  /api/match/{matchId}/referees
GET  /api/team/picture/{teamId}
GET  /api/team/list
```

None of these return a **tournament** resource — an entity with participating
teams, organiser, venue, category, and start/end time, distinct from a
two-team match. `GET /api/club/schedule` (the endpoint the existing schedule
sync already uses, `lib/integrations/sfv/sync/schedule.ts`) always returns the
`Schedule` schema: a two-team fixture (`teamAId`/`teamNameA` vs.
`teamBId`/`teamNameB`, `scoreTeamA`/`scoreTeamB`). Its `CupId` query filter
selects cup **matches** — still two-team fixtures, not multi-team tournament
containers. `matchType`/`matchTypeName` are undocumented free-form fields with
no published enum; every production and test fixture observed in this
codebase only ever contains `"Meisterschaft"` (league match).

Cross-checking a public web search independently confirms this: the SFV/ASF
does not expose tournament registration/planning data through a public
developer API. Tournament registration ("Turniere") is a ClubCorner web/app
workflow for club officials (`docs.clubcorner.ch/sfv-asf-clubservices/tornei`),
not a machine-readable feed.

### 2.2 The only human-facing source blocks automated access

The public FVNWS match-center website
(`https://matchcenter.fvnws.ch/default.aspx?a=vs&lng=1&oid=8&v=483`) renders a
distinct "Turnier" block per tournament (title, category, competition label,
organiser, location) in the same page as the match schedule. This is exactly
the page the existing `scripts/fvnws-export-fca-schedule.ps1` helper script
parses via HTML regex — a manual, one-off export tool, never wired into the
automated sync pipeline.

Live verification on 2026-08-06 (`curl` with a browser User-Agent) returned
**HTTP 403** with an explicit, multi-language notice:

```
Guten Tag,
Ein maschineller Zugriff ist nicht erlaubt und wurde unterbunden:
- Falls Sie ein SFV Verein sind und auf die Spielbetriebsdaten zugreifen
  möchten, melden Sie sich unter support@football.ch
...
Block Bot Score 1 (fvnws.ch)
```

Translation: *"Machine access is not permitted and has been blocked ... If you
are an SFA club and would like to access the match operations data, please
contact support@football.ch."*

This is not merely "no stable structured endpoint" — it is an **active,
provider-enforced block** on the only available tournament data source. Per
the task's own directive ("do not scrape HTML when a stable structured
endpoint exists; if no reliable structured source exists, stop and report the
safest alternative"), this investigation stops here and does not implement a
scraper.

### 2.3 Why the current sync excludes tournaments

`syncSfvSchedule()` (`lib/integrations/sfv/sync/schedule.ts`) fetches
`GET /api/club/schedule` and unconditionally creates `Event.type = "MATCH"`
for every row (`buildNewEventFields()` in `sync/schedule-mapper.ts` hardcodes
`type: "MATCH"`). There is no filtering logic excluding tournaments — there
was simply never any tournament-shaped data in the provider response to
include.

### 2.4 Existing Team provider mappings are not sufficient (and cannot be, today)

`TeamExternalMapping` maps a numeric SFV `teamId` to a canonical `Team` for
match participants. This mechanism *would* be reusable for tournament
participants **if** the provider ever exposed a tournament payload containing
SFV team IDs — but no such payload exists. There is nothing to map against
today.

### 2.5 The canonical Tournament model already exists — as `Event`

There is no separate `Tournament` table. `EventType.TOURNAMENT` is a value of
the shared canonical `Event` model (`prisma/schema.prisma`), alongside
`MATCH`, `TRAINING`, `OTHER`, `VACATION_PERIOD`. It already carries every
field the task requires: `organizerName`, `competitionLabel`, `location`,
`startAt`/`endAt`, `teamId` (single participating team — FC Allschwil enters a
tournament with one of its own teams; the provider never exposes opposing
teams for a tournament, so no multi-team relation exists or is needed today),
plus the full visibility flag set
(`websiteVisible`, `infoboardVisible`, `homepageVisible`, `wochenplanVisible`,
`teamPageVisible`) and review workflow
(`reviewStage`, `reviewRequestedAt`, ...). Manual creation
(`components/admin/events/TournamentEventCreateForm.tsx` →
`POST /api/events`, `source: "MANUAL"`) is fully wired and already the only
working path for tournaments.

---

## 3. Provider source verdict

| Question | Answer |
|---|---|
| Structured SFV/FVNW tournament endpoint? | **No** — confirmed against the live v26.6.15.2 OpenAPI spec on both SFV hosts. |
| Does `/api/club/schedule` expose tournaments separately from matches? | **No** — it only returns two-team `Schedule` rows; there is no tournament shape. |
| Tournament IDs / teams / organiser / venue / category / times represented anywhere structured? | **No.** Only rendered as unstructured HTML text on the FVNWS match-center page. |
| Reliable alternative structured source (e.g. broader football.ch API)? | **No** — public documentation and independent web research confirm SFV/ASF does not publish a tournament API; ClubCorner tournament registration is a manual web/app workflow. |
| Can the FVNWS HTML page be scraped instead? | **No** — the provider actively blocks automated access to that page (HTTP 403, explicit anti-bot notice) and directs clubs to `support@football.ch` for authorized access. |

**Conclusion: no reliable structured source exists.** Per this task's own
stop condition, the safest alternative is documented and implemented below —
no scraper was built.

---

## 4. Safest alternative (implemented)

1. **Keep manual tournament creation as the supported path.** It is already
   fully wired: `TournamentEventCreateForm` → `POST /api/events`
   (`type: "TOURNAMENT"`, `source: "MANUAL"`) → review workflow → the
   *existing, unmodified* publication chain (public tournaments API,
   Wochenplan, team pages, Infoboard).
2. **Add an authorized, tenant-scoped "Jetzt synchronisieren" diagnostic**
   using the exact same sync architecture as every other SFV sync (schedule,
   teams, competitions, match-detail), so administrators get a clear,
   actionable explanation instead of silence, and so the future high-frequency
   scheduler (5-minute / 30-minute / nightly) already has one idempotent entry
   point to call. It performs **no network request and no database write** —
   see `lib/integrations/sfv/sync/tournament-sync.ts` for the full rationale
   inline. When SFV/football.ch ships a real endpoint or grants explicit
   authorized access to the FVNWS data, only the body of `syncSfvTournaments()`
   needs to change to a real fetch + upsert (mirroring
   `sync/schedule.ts`'s upsert-by-provider-id pattern); the result type, API
   route, and admin UI wiring do not need to change.
3. **Recommend contacting SFV support** (`support@football.ch`, per the
   provider's own block message) to request either a structured tournament
   endpoint or explicit written authorization for automated FVNWS access. This
   is surfaced directly in the admin UI's recommendation text.

No scraping was implemented. No fabricated or estimated tournament data was
created. No STAGE database was touched — all verification below used a local
disposable PostgreSQL database.

---

## 5. Implementation

### 5.1 Files changed

| File | Change |
|---|---|
| `lib/integrations/sfv/sync/tournament-types.ts` | New. `SfvTournamentSyncResult` type — mirrors `SfvScheduleSyncResult`/`SfvCompetitionSyncResult` shape plus `blocked`, `warnings`, `recommendedAction`. |
| `lib/integrations/sfv/sync/tournament-sync.ts` | New. `syncSfvTournaments(tenantId)` — tenant-scoped, idempotent, diagnostic-only (no HTTP request, no DB write). Full investigation summary inline. |
| `app/api/admin/integrations/sfv/tournaments/sync/route.ts` | New. `POST` endpoint, `TENANTS_MANAGE`-gated, identical contract to `/schedule/sync`, `/teams/sync`, `/competitions/sync`. |
| `components/admin/integrations/SfvTenantConfigPanel.tsx` | Added a "Turniere synchronisieren" section (button + diagnostic result renderer) to the existing SFV integration admin page, following the same pattern as Spielplan/Teams/Matchdetails synchronisation. |
| `lib/integrations/sfv/sync/__tests__/tournament-sync.test.ts` | New. Unit tests: tenant resolution/errors, tenant isolation, diagnostic shape, idempotency, no-network/no-DB-access guarantees. |
| `app/api/admin/integrations/sfv/tournaments/sync/__tests__/route.test.ts` | New. Route auth/permission/error-mapping/response-shape tests. |
| `components/admin/integrations/__tests__/SfvTenantConfigPanel.test.tsx` | Extended with a "Tournament sync (diagnostic-only)" describe block covering the new button/result UI, including repeated-click idempotency. |
| `lib/events/__tests__/sfv-tournament-01-e3-publication.test.ts` | New. Publication-chain tests for the three FC Allschwil E3 verification dates (tenant isolation, eligibility, visibility gating, manual-source preservation, unmapped-team handling, idempotency). |
| `docs/integrations/sfv-tournament-01-investigation.md` | This document. |

No changes were made to: the `Event`/`Tournament` data model (already
sufficient), the public API contract (`docs/public-website-api.md`), the
publication policy (`lib/publishing/policy/publication-policy.ts` already
supports `TOURNAMENT`), the website, the Infoboard UI, `Trainingsplaner`,
Roles & Permissions, or any existing match synchronization behaviour.

### 5.2 Import architecture (prepared, not activated)

```
                       ┌─────────────────────────────────────────┐
                       │   SFV Club API (OpenAPI v26.6.15.2)      │
                       │   14 endpoints — NO tournament resource  │
                       └───────────────────┬───────────────────────┘
                                            │  (no structured data available)
                                            ▼
     ┌──────────────────────────────────────────────────────────────────┐
     │ syncSfvTournaments(tenantId)                                     │
     │  lib/integrations/sfv/sync/tournament-sync.ts                    │
     │  - requireEnabledSfvConfigForTenant(tenantId)  (trusted session) │
     │  - NO fetch(), NO prisma write                                   │
     │  - returns SfvTournamentSyncResult { blocked: true, warnings }   │
     └───────────────────────────┬────────────────────────────────────┘
                                  │
          POST /api/admin/integrations/sfv/tournaments/sync
                    (TENANTS_MANAGE, same as every other SFV sync)
                                  │
                    "Turniere synchronisieren" panel
              (SfvTenantConfigPanel.tsx — "Jetzt synchronisieren")
```

When a real provider source becomes available, the same call sites
(admin route, admin UI, and — later — the 5-minute/30-minute/nightly
scheduler) call the *same* `syncSfvTournaments()` function; only its
implementation changes from "diagnostic" to "fetch + upsert by stable
provider identifier", following the identical pattern already proven by
`sync/schedule.ts` (idempotent upsert, `TeamExternalMapping` participant
resolution, unresolved-team warnings, provider-failure-without-data-loss via
try/catch around the fetch only).

### 5.3 Currently-working path (unchanged, verified)

```
Admin (TournamentEventCreateForm, EVENTS_MANAGE)
   → POST /api/events { type: "TOURNAMENT", source: "MANUAL" }
   → Event (canonical Tournament record)
   → lib/events/public-event-feed.ts (getPublicEvents, tenant + type scoped)
   → GET /api/public/[tenant]/website/tournaments
   → FC Allschwil website (read-only consumer)
   → lib/publishing/policy/publication-policy.ts (INFOBOARD_SCREEN_1/2, WEBSITE_TOURNAMENTS)
   → Infoboard (read-only consumer, never calls SFV directly)
```

---

## 6. Imported E3 examples

No automated import occurred (none is possible — see §2–3). To verify the
*existing* publication chain works correctly for the FC Allschwil E3
verification case, three tournaments were created via the same manual path a
club administrator would use, against a **local disposable PostgreSQL
database** (never STAGE):

| Date | Title | Team | Organiser | Source |
|---|---|---|---|---|
| 2026-08-23 | E3 Turnier 2026-08-23 | E3 | FC Allschwil | MANUAL |
| 2026-09-06 | E3 Turnier 2026-09-06 | E3 | FC Allschwil | MANUAL |
| 2026-09-13 | E3 Turnier 2026-09-13 | E3 | FC Allschwil | MANUAL |

All three were created, read back through the real (unmocked) canonical
query layer, served through the real public API, and cleaned up afterward —
see §7 for verbatim results.

---

## 7. Publication results

### 7.1 Live local verification (real Prisma + real Postgres, not mocked)

```
=== 1. Canonical Event rows (tenant-scoped, type=TOURNAMENT) ===
  2026-08-23  E3 Turnier 2026-08-23  team=E3  source=MANUAL
  2026-09-06  E3 Turnier 2026-09-06  team=E3  source=MANUAL
  2026-09-13  E3 Turnier 2026-09-13  team=E3  source=MANUAL

=== 2. Public website tournaments feed shape (toPublicWebsiteEvent) ===
  2026-08-23 -> {"type":"TOURNAMENT","organizerName":"FC Allschwil","team":"e3-verify","location":"Sportanlage Im Brüel"}
  2026-09-06 -> {"type":"TOURNAMENT","organizerName":"FC Allschwil","team":"e3-verify","location":"Sportanlage Im Brüel"}
  2026-09-13 -> {"type":"TOURNAMENT","organizerName":"FC Allschwil","team":"e3-verify","location":"Sportanlage Im Brüel"}

=== 3. Publication eligibility (WEBSITE_TOURNAMENTS / INFOBOARD_SCREEN_1) ===
  2026-08-23 -> WEBSITE_TOURNAMENTS=ELIGIBLE INFOBOARD_SCREEN_1=ELIGIBLE
  2026-09-06 -> WEBSITE_TOURNAMENTS=ELIGIBLE INFOBOARD_SCREEN_1=ELIGIBLE
  2026-09-13 -> WEBSITE_TOURNAMENTS=ELIGIBLE INFOBOARD_SCREEN_1=ELIGIBLE
```

### 7.2 Real HTTP round-trip against `GET /api/public/[tenant]/website/tournaments`

```bash
curl "http://localhost:3100/api/public/fc-allschwil-e3-verify/website/tournaments"
```

Returned all three tournaments with `meta.total: 3`, correct
`organizerName`, `location`, `team.slug`, and `season` — confirming
`canonical Tournament → public tournament API` end-to-end. The aggregate
`GET /api/public/[tenant]/website/events` feed and the
`GET /api/public/[tenant]/website/weekplan` feed (Wochenplan) were also
verified to include the same records, confirming the website consumes only
canonical SportClubEvo data.

### 7.3 Admin UI — "Jetzt synchronisieren" (Turniere)

Verified via a real browser session (logged in as `admin@fcallschwil.ch`) on
`/dashboard/admin/integrations/sfv`:

- Status badge: **"Keine Anbieterquelle verfügbar"**
- Diagnostic code: **`PROVIDER_SOURCE_UNAVAILABLE`**
- Counts: fetched 0, created 0, updated 0, unchanged 0, failed 0
- Recommendation shown verbatim: *"Turniere weiterhin manuell über 'Events →
  Turniere → Turnier erstellen' erfassen ... Für eine automatisierte
  Anbindung ist eine schriftliche Freigabe bzw. ein strukturierter Endpunkt
  von football.ch (support@football.ch) erforderlich."*

See screenshots attached to the pull request.

### 7.4 Infoboard eligibility

`lib/publishing/policy/publication-policy.ts` was **not modified** — it
already includes `TOURNAMENT` in `INFOBOARD_TYPES` and implements
`WEBSITE_TOURNAMENTS`. All three E3 dates evaluate to `ELIGIBLE` for
`INFOBOARD_SCREEN_1` and `INFOBOARD_SCREEN_2` when `infoboardVisible = true`
(automated test coverage in
`lib/events/__tests__/sfv-tournament-01-e3-publication.test.ts`). The
Infoboard consumes only the canonical `Event` table via
`lib/events/public-event-feed.ts` / `getInfoboardFeed()` — it never calls SFV
directly, and this investigation did not change that.

---

## 8. Anti-drift confirmation

Not touched: Training Planner / `Trainingsplaner` (name unchanged), Week/Day
Planner, Infoboard UI components, website design/CMS, News/media, Roles &
Permissions, or existing match synchronization logic
(`sync/schedule.ts`, `sync/schedule-mapper.ts`, `sync/schedule-persistence.ts`
are unmodified — confirmed via `git diff`).

---

## 9. Recommendation

## **BLOCKED — PROVIDER SOURCE REQUIRED**

No reliable structured SFV/FVNW source for planned tournaments exists today.
Automated ingestion cannot be safely implemented without either:

1. SFV/football.ch publishing a structured tournament endpoint in the Club
   API Interface, or
2. SFV/football.ch granting explicit, written authorization (and an
   allowlisted access path) for automated retrieval of FVNWS tournament data.

Both require contacting `support@football.ch` (per the provider's own block
message). Until then, the manual tournament creation path — already fully
wired to the website, Wochenplan, team pages, and Infoboard — remains the
safe, compliant, and recommended way to publish FC Allschwil's tournaments,
including the E3 verification examples on 23.08.2026, 06.09.2026, and
13.09.2026.

The diagnostic-only sync surface implemented in this PR ensures that the
moment a structured source or authorization exists, the same idempotent
service, API route, and admin UI can be extended to perform a real import —
and the later 5-minute/30-minute/nightly scheduler cadence has exactly one
call site to wire up.
