# SFV / ClubCorner Integration — CLUB-DIRECTORY-02B: Logo Discovery & Enrichment

> **Document type:** Integration specification and runbook
> **Status:** Implemented — automatic ExternalClub logo enrichment during SFV schedule sync
> **Last updated:** 2026-08-07
> **Maintained by:** SportClubEvo engineering team

---

## Goal

Automatically enrich canonical external clubs/teams (`ExternalClub` /
`ExternalTeam`, see CLUB-DIRECTORY-01/02) with SFV logo data where technically
available, so Matchcenter — and later TournamentCenter, Infoboard, and
Website — can reuse the canonical logo without any provider-specific logic
of their own.

---

## Investigation result — what SFV actually exposes

Before writing any code, the existing SFV integration surface
(`lib/integrations/sfv/`) was inspected for logo-bearing endpoints already
implemented and live-validated in prior slices.

| Question | Answer | Evidence |
|---|---|---|
| Club logo URL/image endpoint? | **No.** | No club-level picture endpoint exists in the SFV Club API Interface OpenAPI v26.6.15.2 surface implemented in `lib/integrations/sfv/client.ts`. |
| Team logo URL/image endpoint? | **Yes**, but not a URL. | `GET /api/team/picture/{teamId}` (`fetchTeamPicture()`, `lib/integrations/sfv/client.ts`). Returns a JSON-quoted **base64-encoded image body**, not a URL, behind an authenticated (`X-User-Token`) request. Documented "binary data encoded in base64"; production observation: decodes to GIF, content-type is `application/json` (not `image/*`), and no cache-control/etag/last-modified/content-length headers are returned at all. |
| Club profile/details endpoint containing a logo field? | **No.** | `TeamDetail` (own-team profile, `fetchTeamList()`), `ClubScheduleEntry` (`fetchClubSchedule()`), and `ClubRankingEntry` (`fetchClubRanking()`) carry no logo/picture field. |
| Any stable media/image identifier? | **No.** | `teamId` is the only identifier the endpoint accepts; it returns fresh bytes on every call, with no ETag or other cache-validation token to key a "stable identifier" off of. |

**Conclusion:** SFV's only logo-bearing surface is `GET
/api/team/picture/{teamId}`, already implemented and live-tested (see
`lib/integrations/sfv/client.ts#fetchTeamPicture`,
`lib/integrations/sfv/__tests__/team-picture.test.ts`). It returns the
**club's crest** keyed by an arbitrary team id belonging to that club — own
teams and opponent teams behave identically (see
`lib/club-directory/logo.ts` module doc, established in CLUB-DIRECTORY-01).
There is no separate club-level endpoint, and no stable, unauthenticated
image URL of any kind. This is a real, existing, already-integrated data
source — not a guess, and no HTML scraping was needed or used.

Because a reliable (if unconventional) SFV logo source exists, the task
proceeds under **READY FOR INDEPENDENT VERIFICATION**, not BLOCKED.

---

## Enrichment flow

Reuses the exact existing CLUB-DIRECTORY-01/02 architecture end to end — no
new fields, no new models, no new integration boundary:

```
Schedule sync (lib/integrations/sfv/sync/schedule.ts)
  └─ createExternalOpponentResolver(tenantId, syncedAt)   [external-team-discovery.ts]
       │  (one resolver per sync run, memoized per SFV teamId)
       │
       ├─ resolveOpponentLogoIfNeeded(tenantId, sfvTeamId)
       │    ├─ findExternalTeamByProviderIdentity(...)     [query-service.ts — READ ONLY]
       │    │     → is there already a canonical ExternalTeam for this
       │    │       (tenant, SFV, teamId)? Does its ExternalClub already
       │    │       have ANY logoUrl (tenant-managed or provider-filled)?
       │    │
       │    ├─ if YES (already enriched) → return null (NO SFV call at all)
       │    └─ if NO  (brand-new OR still empty)
       │          └─ resolveProviderLogoDataUri(sfvTeamId)  [team-logo.ts]
       │                └─ fetchTeamPicture(sfvTeamId)      [client.ts — the SFV call]
       │                     → base64 image body (or null / throws)
       │                └─ magic-byte sniff (file-type) + size guard
       │                └─ returns `data:<mime>;base64,<...>` or null
       │
       └─ discoverExternalTeamFromProvider(..., providerLogoUrl)  [discovery-service.ts]
            └─ linkExternalTeamProvider(...)                       [mutation-service.ts]
                 └─ buildExternalClubTenantFieldUpdate(...)         [provider-sync.ts]
                      → fills ExternalClub.logoUrl ONLY when it is
                        currently empty; NEVER overwrites an existing
                        (tenant-managed or previously-filled) value.
```

Every step below `resolveOpponentLogoIfNeeded` already existed and was
already fully tested from CLUB-DIRECTORY-01/02 (`lib/club-directory/logo.ts`,
`provider-sync.ts`, `mutation-service.ts`, `discovery-service.ts`) — it was
simply never fed real provider logo data. CLUB-DIRECTORY-02B's only new code
is the "should we fetch, and how do we turn the SFV response into a
persistable value" decision, in two small, focused modules:

- `lib/integrations/sfv/sync/team-logo.ts` — `resolveProviderLogoDataUri()`
- `lib/integrations/sfv/sync/external-team-discovery.ts` — the
  `resolveOpponentLogoIfNeeded()` pre-check, wired into the existing
  `createExternalOpponentResolver()`.

---

## Why a `data:` URI, not a new storage subsystem

There is no stable SFV logo URL to store verbatim (see investigation
result). Two options were considered:

1. **Reuse the existing tenant-upload pipeline** (`lib/assets/storage.ts`,
   Vercel Blob) — rejected. `ALLOWED_LOGO_UPLOAD_MIME_TYPES`
   (`lib/assets/validation.ts`) is a **deliberate** tenant-upload constraint
   that excludes GIF, while SFV crests decode to GIF in every production
   observation. Routing provider crests through that pipeline would require
   loosening a deliberate security/format constraint that exists for a
   different purpose (user-uploaded files), and would add a Vercel Blob
   network round-trip plus a `BLOB_READ_WRITE_TOKEN` dependency to the
   automated sync path for no benefit.
2. **Encode the already-fetched base64 bytes as a `data:` URI** and persist
   it directly in the existing `ExternalClub.logoUrl` /
   `ExternalTeamProviderMapping.providerLogoUrl` `TEXT` columns — chosen.
   This needs zero new database columns/models (satisfies "do not introduce
   duplicate logo fields/models"), zero new image download/caching/storage
   subsystem (satisfies the IMAGE STORAGE constraint — the base64 bytes SFV
   already returned in the sync call ARE the persisted value; nothing is
   ever re-fetched to render it), and renders correctly wherever
   `ExternalClub`/`ExternalTeam.logoUrl` is already rendered today
   (`components/admin/club-directory/ClubLogo.tsx` and
   `components/admin/matchcenter/MatchTeamLogo.tsx` both already do a plain
   `<img src={logoUrl}>` — no code changes needed there; see the added
   Matchcenter regression test proving a `data:` URI flows through
   unchanged).

Defensive guards added in `team-logo.ts` (not present in the original
`fetchTeamPicture()`, which is a thin, trusting HTTP client by design):

- magic-byte sniffing (`file-type`, already a project dependency) instead of
  trusting the documented-but-unverified "always a GIF" claim — a malformed
  payload is discarded, never turned into a broken `<img>`;
- a size cap reusing the existing `MAX_LOGO_FILE_SIZE_BYTES` constant
  (`lib/assets/validation.ts`) as a defensive bound against an
  oversized/corrupted provider payload.

---

## Ownership protection ("never overwrite a tenant-managed logo")

Enforced entirely by the pre-existing, unmodified
`buildExternalClubTenantFieldUpdate()` /
`mergeProviderLogoUrl()` (`lib/club-directory/provider-sync.ts` /
`logo.ts`, from CLUB-DIRECTORY-01): a provider-reported crest only ever
fills an **empty** `ExternalClub.logoUrl` slot. Once any value is present —
whether from a manual admin upload or from a previous SFV enrichment — it is
never replaced by a later sync, even if SFV reports a different crest for
that team. Proven against a real Postgres instance in
`logo-enrichment.integration.test.ts` (test #3).

---

## Caching / network behaviour

- **In-run memoization** (pre-existing, CLUB-DIRECTORY-02): one resolver per
  sync run, memoized per SFV `teamId`, so an opponent referenced by several
  schedule entries in the same run triggers at most one discovery/logo
  attempt.
- **Cross-run memoization (new, CLUB-DIRECTORY-02B):** before ever calling
  `fetchTeamPicture()`, `resolveOpponentLogoIfNeeded()` reads the current
  `ExternalClub.logoUrl` via `findExternalTeamByProviderIdentity()` (a plain
  tenant-scoped DB read). If a logo already exists, the SFV network call is
  skipped entirely — the durable `ExternalClub` row itself is the cache, no
  separate cache/store was introduced. Once a club's crest is filled, every
  later sync run for its opponent teams costs one extra read query and zero
  extra SFV calls. Proven against a real Postgres instance in
  `logo-enrichment.integration.test.ts` (test #4 — repeated syncs never
  call `fetchTeamPicture` again after the first successful enrichment).
- **Failure isolation:** `resolveProviderLogoDataUri()` never throws — every
  SFV client error (auth, timeout, 404/no-picture, network, malformed
  payload) resolves to `null`. A logo enrichment failure degrades to "no
  logo this round" and never blocks `discoverExternalTeamFromProvider()` /
  match persistence, exactly like every other best-effort step already in
  `schedule.ts` (stale-match reconciliation, external opponent discovery
  itself).

---

## Tenant isolation

`resolveOpponentLogoIfNeeded()`'s pre-check and every downstream write are
scoped by the caller's `tenantId`, exactly like every other Club Directory
operation (`discoverExternalTeamFromProvider`, `linkExternalTeamProvider`).
The same SFV `providerTeamId` under two different tenants resolves to two
independent `ExternalClub` rows, enriched (or not) independently — proven
against a real Postgres instance in `logo-enrichment.integration.test.ts`
(test #5).

---

## Scope discipline (anti-drift)

This slice deliberately touches only:

- `lib/integrations/sfv/sync/team-logo.ts` (new)
- `lib/integrations/sfv/sync/external-team-discovery.ts` (the pre-check +
  wiring, ~40 added lines)

It does **not**:

- redesign Club Directory UI or Matchcenter UI (both already render
  `ExternalClub`/`ExternalTeam.logoUrl` unchanged, per the investigation
  above);
- implement TournamentCenter or Training Planner;
- change permissions or unrelated schema (zero Prisma migrations in this
  slice);
- add a generic media platform, an image download/caching layer, or a new
  Vercel Blob integration;
- scrape SFV HTML (only the already-implemented, already-authenticated,
  already-live-tested `fetchTeamPicture()` JSON endpoint is used);
- touch the manual admin provider-link routes
  (`app/api/club-directory/{clubs,teams}/*/provider-link/route.ts`), which
  remain deliberately "no live SFV call" per their existing doc comments.

---

## Files changed

| File | Change |
|---|---|
| `lib/integrations/sfv/sync/team-logo.ts` | New. `resolveProviderLogoDataUri()` — fetches + converts an SFV team picture into a `data:` URI, or `null`, never throws. |
| `lib/integrations/sfv/sync/external-team-discovery.ts` | Added `resolveOpponentLogoIfNeeded()` and wired it into `createExternalOpponentResolver()`. |
| `lib/integrations/sfv/sync/__tests__/team-logo.test.ts` | New. Unit tests for the conversion/guard logic. |
| `lib/integrations/sfv/sync/__tests__/external-team-discovery-logo-enrichment.test.ts` | New. Fully-mocked wiring tests for the enrichment decision logic. |
| `lib/integrations/sfv/sync/__tests__/logo-enrichment.integration.test.ts` | New. Real-Postgres, gated integration tests (discovery, enrichment, tenant protection, idempotency, tenant isolation, failure isolation). |
| `lib/integrations/sfv/sync/__tests__/external-team-discovery.test.ts` | Updated one pre-existing assertion to include the new `providerLogoUrl` argument. |
| `lib/matchcenter/__tests__/query-service.test.ts` | Added one regression test proving a `data:` URI-enriched club crest flows through Matchcenter's existing logo resolution unchanged. |
| `docs/integrations/sfv-slice-club-directory-02b-logo-enrichment.md` | This document. |

No Prisma schema or migration changes. No changes to
`lib/club-directory/logo.ts`, `provider-sync.ts`, `mutation-service.ts`, or
`discovery-service.ts` — all pre-existing CLUB-DIRECTORY-01/02 logic is
reused verbatim.

---

## Risks / limitations

- **`data:` URI payload size in list responses.** `ExternalClub`/`ExternalTeam`
  list DTOs already include `logoUrl` for every row (pre-existing
  CLUB-DIRECTORY-01 behaviour). A base64-encoded crest adds a few KB per
  club to those JSON responses (SFV crests are small single-purpose badge
  images; capped defensively at `MAX_LOGO_FILE_SIZE_BYTES` = 2 MB decoded,
  same limit already used for tenant uploads). Acceptable for the current
  Club Directory list sizes; worth revisiting only if list pages grow to
  hundreds of provider-enriched clubs.
- **No re-enrichment once filled.** By design (avoids unnecessary SFV calls
  and matches the idempotency requirement): once `ExternalClub.logoUrl` is
  set, it is never re-fetched or refreshed automatically, even if the
  provider's crest changes later. A tenant admin can always clear/replace it
  manually (existing manual upload/edit flows), which then also blocks
  future auto-enrichment for that club (by design — tenant edits always
  win).
- **`ExternalTeamProviderMapping.providerLogoUrl` (informational
  provenance field) reverts to `null` on every sync after the first
  successful enrichment.** `linkExternalTeamProvider()` (pre-existing,
  unmodified) always writes exactly what it is passed for this
  provider-owned field; once `resolveOpponentLogoIfNeeded()` decides no
  fetch is needed (the enrichment target — `ExternalClub.logoUrl` — is
  already filled), it passes `providerLogoUrl: null`, which overwrites the
  mapping's own copy back to `null`. Verified directly against a real
  Postgres row (not merely asserted): the mapping's `providerLogoUrl` was
  `"data:image/gif;base64,AAA="` after the enriching sync and `null` after
  the very next sync, while `ExternalClub.logoUrl` stayed
  `"data:image/gif;base64,AAA="` throughout. This does not affect any
  resolution logic — only `ExternalClub`/`ExternalTeam.logoUrl` are read by
  `lib/club-directory/logo.ts` and Matchcenter — but it does mean the
  mapping's own "provider-reported crest at time of last sync" value is not
  a reliable audit trail once enrichment has already happened once. Fixing
  this cleanly would mean changing the shared, already-tested
  `buildExternalTeamMappingUpdate()` field-refresh contract that every other
  provider-owned mapping field also relies on (CLUB-DIRECTORY-01) — treated
  as out of scope for this slice rather than risking that shared contract
  for a display-only field.
