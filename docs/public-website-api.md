# Public Website API — FC Allschwil Website ↔ WebApp Integration

> **Audience**: FC Allschwil website team, external integrators.
> **Base URL**: Configured per environment via `NEXT_PUBLIC_API_BASE_URL`.
>   - STAGE: `https://stage-webapp.fcallschwil.ch`
>   - PROD:  `https://webapp.fcallschwil.ch`
>
> **Authentication**: None. All `/api/public/*` endpoints are public and read-only.
> **HTTP method**: GET only. Any other method returns `405 Method Not Allowed`.
> **Content-Type**: `application/json`.

---

## Table of Contents

1. [Architecture Principle](#architecture-principle)
2. [URL Namespaces](#url-namespaces)
3. [Tenant Resolution](#tenant-resolution)
4. [Response Envelope](#response-envelope)
5. [Error Responses](#error-responses)
6. [Publish Rules](#publish-rules)
7. [Privacy and Exclusions](#privacy-and-exclusions)
8. [Endpoints (v2 — path-based tenant)](#endpoints-v2--path-based-tenant)
   - [GET /api/public/[tenant]/website/news](#get-apipublictenantwebsitenews)
   - [GET /api/public/[tenant]/website/events](#get-apipublictenantwebsiteevents) ⚠️ compatibility aggregate
   - [GET /api/public/[tenant]/website/club-events](#get-apipublictenantwebsiteclub-events) ✅ canonical
   - [GET /api/public/[tenant]/website/matches](#get-apipublictenantwebsitematches) ✅ canonical
   - [GET /api/public/[tenant]/website/tournaments](#get-apipublictenantwebsitetournaments) ✅ canonical
   - [GET /api/public/[tenant]/website/trainings](#get-apipublictenantwebsitetrainings) ✅ canonical
   - [GET /api/public/[tenant]/website/teams](#get-apipublictenantwebsiteteams)
   - [GET /api/public/[tenant]/website/teams/[slug]](#get-apipublictenantwebsiteteamsslug)
   - [GET /api/public/[tenant]/website/weekplan](#get-apipublictenantwebsiteweekplan) ✅ canonical
   - [GET /api/public/[tenant]/website/homepage](#get-apipublictenantwebsitehomepage)
   - [GET /api/public/[tenant]/website/navigation](#get-apipublictenantwebsitenavigation)
9. [Endpoints (v1 — header-based tenant, legacy)](#endpoints-v1--header-based-tenant-legacy)
10. [Type Reference](#type-reference)
11. [Design System — Visual Token Architecture (CMS V4.1)](#design-system--visual-token-architecture-cms-v41)
12. [Duplication Audit](#duplication-audit)
13. [Tenant Isolation Audit](#tenant-isolation-audit)
14. [Integration Checklist for Website Team](#integration-checklist-for-website-team)
15. [Recommended Next Slice](#recommended-next-slice)

---

## Architecture Principle

**The WebApp is the single source of truth.** The website is a read-only consumer.

```
FC Allschwil Website (Next.js, separate Vercel project)
    │
    │  HTTP GET /api/public/[tenant]/website/*
    │  (read-only, no auth, published content only)
    ▼
SportClubEvo WebApp (Next.js, this repository)
    │
    │  Prisma ORM
    ▼
PostgreSQL Database (tenant-scoped tables)
```

- No data is duplicated between the WebApp and the website.
- The website must never replicate WebApp DB tables or seed data locally.
- All content managed in the WebApp admin is the authoritative version.

---

## URL Namespaces

| Namespace | Path pattern | Tenant resolution | Notes |
|-----------|-------------|-------------------|-------|
| **v2** (current) | `/api/public/[tenant]/website/*` | Path segment | New; preferred |
| v1 (legacy) | `/api/public/v1/website/*` | `X-Tenant-Slug` header | Maintained for backward compat |
| Internal legacy | `/api/public/events`, `/api/public/wochenplan`, `/api/public/infoboard` | `getDefaultTenant()` | Not tenant-safe for multi-tenant; do not use for new integrations |

Use the **v2** namespace for all new website integrations.

---

## Tenant Resolution

**v2 endpoints**: Tenant is resolved from the URL path segment. Example:

```
GET /api/public/fc-allschwil/website/news
```

`fc-allschwil` is the tenant slug. An `ACTIVE` tenant with `key = "fc-allschwil"` must exist in the database. Returns `404` otherwise.

The tenant slug is stable and does not change. For FC Allschwil STAGE and PROD environments, always use `fc-allschwil`.

**v1 endpoints** (legacy): Tenant resolved from `X-Tenant-Slug` request header, falling back to `fc-allschwil`.

---

## Response Envelope

All v2 endpoint responses share the same wrapper:

```json
{
  "version": "1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": { ... },
  "meta": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | API contract version, currently `"1"`. |
| `tenant.key` | string | Tenant slug, URL-safe. |
| `tenant.name` | string | Human-readable club name. |
| `generatedAt` | string (ISO 8601) | UTC timestamp of response generation. |
| `data` | object | Endpoint-specific payload. |
| `meta` | object | Endpoint-specific metadata (counts, filters). |

---

## Error Responses

| Scenario | HTTP | Body |
|----------|------|------|
| Tenant slug not found or inactive | 404 | `{ "error": "Tenant not found." }` |
| Website integration disabled | 403 | `{ "error": "Website integration is not enabled for this tenant." }` |
| Resource not found | 404 | `{ "error": "<resource> not found." }` |
| Server error | 500 | `{ "error": "Technischer Fehler: <detail>" }` |

---

## Publish Rules

| Resource | Published when | Excluded |
|----------|---------------|---------|
| News article | `status = PUBLISHED` AND `publishedAt ≤ now` | DRAFT, IN_REVIEW, SCHEDULED (future), ARCHIVED |
| Website page | `status = PUBLISHED` AND `publishedAt ≤ now` | DRAFT, IN_REVIEW, SCHEDULED (future), ARCHIVED |
| Event | `status IN (SCHEDULED, LIVE, COMPLETED, POSTPONED)` AND `websiteVisible = true` | DRAFT, CANCELLED, ARCHIVED |
| Match event | Same as Event PLUS `type = MATCH` | Non-MATCH event types |
| Team | `isActive = true` AND `websiteVisible = true` | Inactive teams, teams with `websiteVisible = false` |
| Weekplan day | Events with `wochenplanVisible = true` AND `websiteVisible = true` | Non-wochenplan events |

---

## Privacy and Exclusions

The following fields are **never** exposed on any public endpoint:

- `tenantId` — internal FK
- `status`, `reviewNotes`, `reviewStage` — editorial workflow fields
- `createdAt`, `updatedAt` — internal timestamps
- `passwordHash`, `email`, `phone`, `dateOfBirth` — personal data
- `pitchCode`, `homeDressingRoomCode`, `awayDressingRoomCode` — raw internal allocation codes
- `infoboardVisible`, `trainingsplanVisible`, `homepageVisible`, `wochenplanVisible`, `teamPageVisible`, `websiteVisible` — internal display flags
- `source`, `externalSource`, `externalSourceId`, `importBatchKey` — import metadata
- `remarks`, `sortOrder` — internal admin fields
- `orgUnitId`, `isActive`, `createdByUserId`, `reviewedByUserId`, `approvedByUserId` — internal relations and workflow actors

---

## Endpoints (v2 — path-based tenant)

### GET /api/public/[tenant]/website/news

Returns a paginated list of published news articles. Article body/content is intentionally excluded from list responses for bandwidth efficiency — use the v1 slug endpoint for full content.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | `20` | Max articles (1–100). |

#### Example request

```
GET /api/public/fc-allschwil/website/news?limit=5
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "articles": [
      {
        "id": "clx1abc123",
        "slug": "saisonstart-2026",
        "title": "Saisonstart 2026 — Willkommen zurück!",
        "excerpt": "Nach der Sommerpause startet die neue Saison mit einem Heimspiel.",
        "imageUrl": "https://example.com/images/saisonstart.jpg",
        "publishedAt": "2026-06-01T10:00:00.000Z",
        "heroMedia": {
          "id": "clx1media1",
          "url": "https://example.com/hero.jpg",
          "altText": "Saisonstart Foto",
          "filename": "saisonstart.jpg"
        }
      }
    ]
  },
  "meta": { "total": 1, "limit": 5 }
}
```

#### Data shape — `data.articles[]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique article identifier (cuid). |
| `slug` | string | URL-safe identifier, unique per tenant. |
| `title` | string | Article headline. |
| `excerpt` | string \| null | Short summary. |
| `imageUrl` | string \| null | Legacy hero image URL. Prefer `heroMedia.url` when set. |
| `publishedAt` | string (ISO 8601) | Publication timestamp (UTC). |
| `heroMedia` | object \| null | Hero image asset details. |
| `heroMedia.id` | string | Media asset ID. |
| `heroMedia.url` | string | CDN URL. |
| `heroMedia.altText` | string \| null | Alt text for accessibility. |
| `heroMedia.filename` | string | Original filename. |

---

### GET /api/public/[tenant]/website/events

> ⚠️ **Compatibility / aggregate feed.** This endpoint returns all visible event types together. New consumers should prefer the domain-specific feeds below (`/club-events`, `/matches`, `/tournaments`, `/trainings`). This endpoint will remain available for backward compatibility until a formal migration window is opened.

Returns all website-visible events for the tenant. Use the `surface` parameter to request a specific placement context.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `surface` | string | `"all"` | `all` \| `homepage` \| `wochenplan` \| `trainingsplan` \| `team-page` \| `infoboard` |
| `seasonKey` | string | — | Filter by season key, e.g. `"2025-26"`. |
| `teamSlug` | string | — | Filter by team slug, e.g. `"1-mannschaft"`. |
| `dateFrom` | string | — | ISO date lower bound for `startAt` (inclusive). |
| `dateTo` | string | — | ISO date upper bound for `startAt` (inclusive). |
| `limit` | number | `100` | Max events (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/events?surface=homepage&limit=10
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "events": [
      {
        "id": "clevt001",
        "title": "FCA vs. FC Zürich",
        "type": "MATCH",
        "status": "SCHEDULED",
        "startAt": "2026-08-15T15:00:00.000Z",
        "endAt": null,
        "location": "Sportanlage Mühlmatt",
        "description": null,
        "opponentName": "FC Zürich",
        "organizerName": null,
        "competitionLabel": "Promotion League",
        "homeAway": "HOME",
        "resultLabel": null,
        "meetingTime": "2026-08-15T14:30:00.000Z",
        "team": {
          "id": "clteam1",
          "name": "1. Mannschaft",
          "slug": "1-mannschaft",
          "category": "AKTIVE",
          "genderGroup": null,
          "ageGroup": null
        },
        "season": { "key": "2025-26", "name": "Saison 2025/26" }
      }
    ]
  },
  "meta": {
    "total": 1,
    "surface": "homepage",
    "filters": {
      "seasonKey": null,
      "teamSlug": null,
      "dateFrom": null,
      "dateTo": null,
      "limit": 10
    }
  }
}
```

#### Data shape — `data.events[]`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Event ID. |
| `title` | string | Event title. |
| `type` | string | `MATCH` \| `TOURNAMENT` \| `TRAINING` \| `OTHER` \| `VACATION_PERIOD` |
| `status` | string | `SCHEDULED` \| `LIVE` \| `COMPLETED` \| `POSTPONED` |
| `startAt` | string (ISO 8601) | Event start UTC. |
| `endAt` | string \| null | Event end UTC. |
| `location` | string \| null | Venue or location string. |
| `description` | string \| null | Optional description. |
| `opponentName` | string \| null | Opponent for MATCH events. |
| `organizerName` | string \| null | Organizer for TOURNAMENT events. |
| `competitionLabel` | string \| null | Competition name. |
| `homeAway` | string \| null | `HOME` \| `AWAY` \| `NEUTRAL` |
| `resultLabel` | string \| null | Score string, e.g. `"2:1"`. Null until entered. |
| `meetingTime` | string \| null | Meeting/warm-up time. |
| `team.id` | string | Team identifier. |
| `team.name` | string | Team name. |
| `team.slug` | string | URL-safe team slug. |
| `team.category` | string | `AKTIVE` \| `JUNIOREN` \| `FRAUEN` etc. |
| `team.genderGroup` | string \| null | Gender group label. |
| `team.ageGroup` | string \| null | Age group label. |
| `season.key` | string | Season key, e.g. `"2025-26"`. |
| `season.name` | string | Season display name. |

---

### GET /api/public/[tenant]/website/matches

Identical to `/events` but pre-filtered to `type = MATCH` events. Use this endpoint for the Spielplan (match schedule) page.

#### Query parameters

Same as `/events` except `surface` is not available (always uses `websiteVisible = true`).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Filter by season key. |
| `teamSlug` | string | — | Filter by team slug. |
| `dateFrom` | string | — | ISO date lower bound for `startAt`. |
| `dateTo` | string | — | ISO date upper bound for `startAt`. |
| `limit` | number | `100` | Max matches (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/matches?seasonKey=2025-26&teamSlug=1-mannschaft
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "matches": [ ... ]
  },
  "meta": {
    "total": 12,
    "filters": { "seasonKey": "2025-26", "teamSlug": "1-mannschaft", "dateFrom": null, "dateTo": null, "limit": null }
  }
}
```

Response items use the same shape as `data.events[]` above.

---

### GET /api/public/[tenant]/website/club-events

Returns general club-event records only (`EventType.OTHER`). These are general club activities that are **not** matches, tournaments, or trainings. Examples: Generalversammlung, Sponsorenlauf, Public Viewing, Vereinsanlass, Helfereinsatz, Informationsabend.

The event-type filter is applied at the **database level** — only `EventType.OTHER` events are retrieved.

#### Query parameters

Same as `/matches`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Filter by season key. |
| `teamSlug` | string | — | Filter by team slug. |
| `dateFrom` | string | — | ISO date lower bound for `startAt`. |
| `dateTo` | string | — | ISO date upper bound for `startAt`. |
| `limit` | number | `100` | Max club events (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/club-events?dateFrom=2026-07-01&dateTo=2026-12-31
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-07-26T08:00:00.000Z",
  "data": {
    "clubEvents": [
      {
        "id": "clevt-001",
        "title": "Generalversammlung 2026",
        "type": "OTHER",
        "status": "SCHEDULED",
        "startAt": "2026-11-12T19:00:00.000Z",
        "endAt": null,
        "location": "Clubhaus Mühlmatt",
        "description": "Ordentliche Generalversammlung des FC Allschwil.",
        "opponentName": null,
        "organizerName": "FC Allschwil",
        "competitionLabel": null,
        "homeAway": null,
        "resultLabel": null,
        "meetingTime": null,
        "team": null,
        "season": { "key": "2025-26", "name": "Saison 2025/26" }
      }
    ]
  },
  "meta": {
    "total": 1,
    "filters": { "seasonKey": null, "teamSlug": null, "dateFrom": "2026-07-01", "dateTo": "2026-12-31", "limit": null }
  }
}
```

Response items use the same shape as `data.events[]`.

**EventType mapping**: Club events are stored as `EventType.OTHER`. `MATCH`, `TOURNAMENT`, `TRAINING`, and `VACATION_PERIOD` events are excluded.

---

### GET /api/public/[tenant]/website/tournaments

Returns only `EventType.TOURNAMENT` events. The event-type filter is applied at the **database level**.

Intended use: `/turnierplan` page migration for the FC Allschwil website.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Filter by season key. |
| `teamSlug` | string | — | Filter by team slug. |
| `dateFrom` | string | — | ISO date lower bound for `startAt`. |
| `dateTo` | string | — | ISO date upper bound for `startAt`. |
| `limit` | number | `100` | Max tournaments (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/tournaments?seasonKey=2025-26
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-07-26T08:00:00.000Z",
  "data": {
    "tournaments": [
      {
        "id": "clevt-002",
        "title": "Jugend-Hallenturnier 2026",
        "type": "TOURNAMENT",
        "status": "SCHEDULED",
        "startAt": "2026-12-28T09:00:00.000Z",
        "endAt": "2026-12-28T17:00:00.000Z",
        "location": "Sporthalle Allschwil",
        "description": null,
        "opponentName": null,
        "organizerName": "FC Allschwil",
        "competitionLabel": null,
        "homeAway": null,
        "resultLabel": null,
        "meetingTime": null,
        "team": null,
        "season": { "key": "2025-26", "name": "Saison 2025/26" }
      }
    ]
  },
  "meta": {
    "total": 1,
    "filters": { "seasonKey": "2025-26", "teamSlug": null, "dateFrom": null, "dateTo": null, "limit": null }
  }
}
```

Response items use the same shape as `data.events[]`.

---

### GET /api/public/[tenant]/website/trainings

Returns individual `EventType.TRAINING` records. The event-type filter is applied at the **database level**. Only trainings with both `websiteVisible = true` and `trainingsplanVisible = true` are included (`surface: "trainingsplan"`).

> **Note**: This is the individual training event feed. It does **not** replace `/weekplan`, which is a composed weekly schedule that aggregates trainings, matches, and tournaments according to `wochenplanVisible` publication rules.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Filter by season key. |
| `teamSlug` | string | — | Filter by team slug. |
| `dateFrom` | string | — | ISO date lower bound for `startAt`. |
| `dateTo` | string | — | ISO date upper bound for `startAt`. |
| `limit` | number | `100` | Max trainings (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/trainings?teamSlug=1-mannschaft&dateFrom=2026-08-01
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-07-26T08:00:00.000Z",
  "data": {
    "trainings": [
      {
        "id": "clevt-003",
        "title": "Training 1. Mannschaft",
        "type": "TRAINING",
        "status": "SCHEDULED",
        "startAt": "2026-08-05T18:30:00.000Z",
        "endAt": "2026-08-05T20:00:00.000Z",
        "location": "Sportanlage Mühlmatt",
        "description": null,
        "opponentName": null,
        "organizerName": null,
        "competitionLabel": null,
        "homeAway": null,
        "resultLabel": null,
        "meetingTime": null,
        "team": {
          "id": "clteam1",
          "name": "1. Mannschaft",
          "slug": "1-mannschaft",
          "category": "AKTIVE",
          "genderGroup": null,
          "ageGroup": null
        },
        "season": { "key": "2025-26", "name": "Saison 2025/26" }
      }
    ]
  },
  "meta": {
    "total": 1,
    "filters": { "seasonKey": null, "teamSlug": "1-mannschaft", "dateFrom": "2026-08-01", "dateTo": null, "limit": null }
  }
}
```

Response items use the same shape as `data.events[]`.

---

### GET /api/public/[tenant]/website/teams

Returns active, website-visible teams for the tenant. DB-level tenant isolation is
enforced via `Team.tenantId` (migration `20260626000000_team_tenant_isolation`).

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Resolve display names from this season. Default: active season. |

#### Example request

```
GET /api/public/fc-allschwil/website/teams
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "teams": [
      {
        "id": "clteam1",
        "name": "1. Mannschaft",
        "slug": "1-mannschaft",
        "category": "AKTIVE",
        "genderGroup": null,
        "ageGroup": null,
        "displayName": "1. Mannschaft 2025/26",
        "shortName": "1M",
        "season": { "key": "2025-26", "name": "Saison 2025/26" }
      }
    ]
  },
  "meta": { "total": 1, "seasonKey": null }
}
```

#### Data shape — `data.teams[]` (post-migration)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Team ID. |
| `name` | string | Base team name. |
| `slug` | string | URL-safe team slug. |
| `category` | string | `AKTIVE` \| `JUNIOREN` \| `FRAUEN` \| `KINDERFUSSBALL` \| `SENIOREN` \| `TRAININGSGRUPPE` |
| `genderGroup` | string \| null | Gender group label. |
| `ageGroup` | string \| null | Age group label (e.g. `"U16"`). |
| `displayName` | string | Season display name from TeamSeason, or `name` as fallback. |
| `shortName` | string \| null | Short label, e.g. `"1M"`. |
| `season` | object \| null | Active season info, null if no matching TeamSeason. |
| `season.key` | string | Season key. |
| `season.name` | string | Season display name. |

---

### GET /api/public/[tenant]/website/teams/[slug]

Returns the full public team detail for a single team, including squad, trainer staff, and upcoming training sessions. The `slug` is the URL-safe team identifier (e.g. `e4`, `1-mannschaft`).

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `seasonKey` | string | — | Resolve squad/trainers from this season (e.g. `"2025-26"`). Default: active season. |

#### Example request

```
GET /api/public/fc-allschwil/website/teams/e4
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "team": {
      "name": "E4",
      "displayName": "E4 2025/26",
      "slug": "e4",
      "category": "JUNIOREN",
      "ageGroup": "E",
      "genderGroup": null,
      "shortName": "E4",
      "season": { "key": "2025-26", "name": "Saison 2025/26" },
      "description": null,
      "heroImage": null,
      "squad": [
        {
          "firstName": "Max",
          "lastName": "Müller",
          "shirtNumber": 10,
          "positionLabel": "Mittelfeld",
          "captain": true,
          "viceCaptain": false,
          "photo": null
        }
      ],
      "trainers": [
        {
          "firstName": "Hans",
          "lastName": "Trainer",
          "roleLabel": "Haupttrainer",
          "photo": null
        }
      ],
      "training": [
        {
          "weekday": "Dienstag",
          "startTime": "2026-07-01T17:15:00.000Z",
          "endTime": "2026-07-01T18:45:00.000Z",
          "location": "Kunstrasen 2",
          "pitchName": "Kunstrasen 2"
        }
      ]
    }
  },
  "meta": { "seasonKey": null }
}
```

#### Error responses

| Scenario | HTTP | Body |
|----------|------|------|
| Tenant not found or inactive | 404 | `{ "error": "Tenant not found." }` |
| Website integration disabled | 403 | `{ "error": "Website integration is not enabled for this tenant." }` |
| Team slug not found, inactive, or not website-visible | 404 | `{ "error": "Team not found." }` |

#### Data shape — `data.team`

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Base team name. |
| `displayName` | string | Season display name from TeamSeason, or `name` as fallback. |
| `slug` | string | URL-safe team slug. |
| `category` | string | `AKTIVE` \| `JUNIOREN` \| `FRAUEN` \| `KINDERFUSSBALL` \| `SENIOREN` \| `TRAININGSGRUPPE` |
| `ageGroup` | string \| null | Age group label (e.g. `"E"`, `"U16"`). |
| `genderGroup` | string \| null | Gender group label. |
| `shortName` | string \| null | Short label, e.g. `"E4"`. |
| `season` | object \| null | Active season info. null when no matching TeamSeason. |
| `season.key` | string | Season key. |
| `season.name` | string | Season display name. |
| `description` | null | Reserved. Will carry Markdown description when schema adds `Team.description`. |
| `heroImage` | null | Reserved. Will carry hero image URL when schema adds `Team.heroMediaId`. |

#### Data shape — `data.team.squad[]`

Privacy: `personId`, `dateOfBirth`, `email`, `phone`, `address`, `remarks`, `sortOrder` are **never** returned. Squad is empty when `TeamSeason.squadWebsiteVisible = false`.

| Field | Type | Description |
|-------|------|-------------|
| `firstName` | string | |
| `lastName` | string | |
| `shirtNumber` | number \| null | |
| `positionLabel` | string \| null | |
| `captain` | boolean | |
| `viceCaptain` | boolean | |
| `photo` | null | Reserved. Always null until `Person.photoUrl` is added to schema. |

#### Data shape — `data.team.trainers[]`

Privacy: `personId`, `email`, `phone`, `remarks`, `sortOrder` are **never** returned. Trainer list is empty when `TeamSeason.trainerTeamWebsiteVisible = false`.

| Field | Type | Description |
|-------|------|-------------|
| `firstName` | string | |
| `lastName` | string | |
| `roleLabel` | string \| null | |
| `photo` | null | Reserved. Always null until `Person.photoUrl` is added to schema. |

#### Data shape — `data.team.training[]`

Upcoming TRAINING events for this team (next 28 days, `websiteVisible = true`), ordered by `startTime`. `pitchCode` (internal allocation code) is **never** returned — it is resolved to `pitchName` via `FacilityResource`.

| Field | Type | Description |
|-------|------|-------------|
| `weekday` | string | Day name in German, e.g. `"Dienstag"`. |
| `startTime` | string (ISO 8601) | Training start UTC. |
| `endTime` | string \| null | Training end UTC. |
| `location` | string \| null | Venue or location string. |
| `pitchName` | string \| null | Human-readable pitch name from facility registry. null when unresolvable. |

---

### GET /api/public/[tenant]/website/weekplan

Returns the Wochenplan (week plan) grouped by calendar day. Optionally includes the active publication state for a specific week.

**Date grouping timezone**: All `date` keys and `weekdayLabel` values use **Europe/Zurich** local calendar dates, regardless of server timezone. Events occurring near UTC midnight are correctly assigned to the Swiss local date (e.g. 22:15 UTC in summer CEST = 00:15 next day in Zurich → grouped under the next day's date key). `calendarWeek` is computed from the Zurich local date.

#### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `weekId` | string | — | ISO week ID, e.g. `"2026-W26"`. Required to get publication state. |
| `seasonKey` | string | — | Filter by season key. |
| `teamSlug` | string | — | Filter by team slug. |
| `dateFrom` | string | — | ISO date lower bound for `startAt`. |
| `dateTo` | string | — | ISO date upper bound for `startAt`. |
| `limit` | number | `100` | Max events (1–250). |

#### Example request

```
GET /api/public/fc-allschwil/website/weekplan?weekId=2026-W26
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T14:30:00.000Z",
  "data": {
    "publication": {
      "weekId": "2026-W26",
      "variantLabel": "Standard-Wochenplan",
      "variantBadge": "KW 26 | Standard-Wochenplan aktiv",
      "isPublished": true,
      "publishedAt": "2026-06-25T10:00:00.000Z"
    },
    "days": [
      {
        "date": "2026-06-22",
        "calendarWeek": 26,
        "weekdayLabel": "Montag",
        "events": [
          {
            "id": "clevt001",
            "title": "U14 Training",
            "type": "TRAINING",
            "status": "SCHEDULED",
            "startAt": "2026-06-22T17:15:00.000Z",
            "endAt": "2026-06-22T18:45:00.000Z",
            "location": "Kunstrasen 2",
            "description": null,
            "opponentName": null,
            "organizerName": null,
            "competitionLabel": null,
            "homeAway": null,
            "resultLabel": null,
            "meetingTime": null,
            "team": {
              "id": "clteam2",
              "name": "U14",
              "slug": "u14",
              "category": "JUNIOREN",
              "genderGroup": null,
              "ageGroup": "U14"
            },
            "season": { "key": "2025-26", "name": "Saison 2025/26" }
          }
        ]
      }
    ]
  },
  "meta": {
    "countDays": 5,
    "countEvents": 18,
    "filters": {
      "weekId": "2026-W26",
      "seasonKey": null,
      "teamSlug": null,
      "dateFrom": null,
      "dateTo": null,
      "limit": null
    }
  }
}
```

> **Empty response guarantee**: When no events exist, `data.days` is always `[]` and
> `data.publication` is `null`. The envelope and `meta` fields are always present.

---

## Endpoints (v1 — header-based tenant, legacy)

These endpoints remain active for backward compatibility. Do **not** use them for new integrations.

| Endpoint | Notes |
|----------|-------|
| `GET /api/public/v1/website/news` | Same as v2 news, tenant via `X-Tenant-Slug` header |
| `GET /api/public/v1/website/news/[slug]` | News detail with full content |
| `GET /api/public/v1/website/pages/[slug]` | Static page detail |

---

## Type Reference

### `WebsiteResponseEnvelope<T>`

```typescript
type WebsiteResponseEnvelope<T> = {
  version: string;
  tenant: { key: string; name: string };
  generatedAt: string; // ISO 8601 UTC
  data: T;
  meta: Record<string, unknown>;
};
```

### `PublicWebsiteEventItem`

```typescript
type PublicWebsiteEventItem = {
  id: string;
  title: string;
  type: string;       // MATCH | TOURNAMENT | TRAINING | OTHER | VACATION_PERIOD
  status: string;     // SCHEDULED | LIVE | COMPLETED | POSTPONED
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  description: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  meetingTime: Date | null;
  team: { id: string; name: string; slug: string; category: string; genderGroup: string | null; ageGroup: string | null } | null;
  season: { key: string; name: string };
};
```

### `PublicTeamListItem`

```typescript
type PublicTeamListItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  displayName: string;
  shortName: string | null;
  season: { key: string; name: string } | null;
};
```

### `PublicWochenplanDay`

```typescript
type PublicWochenplanDay = {
  date: string;          // "YYYY-MM-DD"
  calendarWeek: number;
  weekdayLabel: string;  // e.g. "Montag" (locale: de-CH)
  events: PublicWebsiteEventItem[];
};
```

### `PublicWochenplanPublication`

```typescript
type PublicWochenplanPublication = {
  weekId: string;        // e.g. "2026-W26"
  variantLabel: string;  // e.g. "Schlechtwetter-Wochenplan"
  variantBadge: string;  // e.g. "KW 26 | Schlechtwetter-Wochenplan aktiv"
  isPublished: boolean;
  publishedAt: Date | null;
};
```

---

## Duplication Audit

| Concern | Single source | Consumers |
|---------|--------------|-----------|
| News query logic | `lib/news/public-news-feed.ts` | v1 news route, v2 `[tenant]/website/news` route |
| Event query + filtering | `lib/events/public-event-feed.ts` | All event/match/weekplan routes |
| Event → website mapper | `lib/website/public-events-mapper.ts` | events route, matches route, weekplan route |
| Team list query | `lib/website/public-teams-feed.ts` (`getPublicTeams`) | teams list route |
| Team detail query | `lib/website/public-teams-feed.ts` (`getPublicTeamDetail`) | team detail route |
| Envelope builder | `lib/website/response-helpers.ts` (`buildWebsiteEnvelope`) | All v2 routes |
| Tenant resolution (path) | `lib/website/response-helpers.ts` (`resolveTenantFromParams`) | All v2 routes |
| Tenant resolution (header) | `lib/website/response-helpers.ts` (`resolveTenantFromRequest`) | All v1 routes |
| Website-enabled guard | `lib/website/response-helpers.ts` (`assertWebsiteEnabled`) | All v1 and v2 routes |
| Wochenplan publication query | `lib/wochenplan/publication-queries.ts` | admin publish API, weekplan route |
| Published-only filtering (news) | `lib/news/public-news-feed.ts` (`publishedWhere`) | news list + detail |
| Published-only filtering (pages) | `lib/pages/public-pages-feed.ts` (`publishedWhere`) | pages detail |

**Zero duplication of business logic. Zero duplication of query layer.**

---

## Tenant Isolation Audit

| Endpoint | Tenant check | DB isolation | Status |
|----------|-------------|--------------|--------|
| `[tenant]/website/news` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` in all Prisma WHERE clauses | ✅ Safe |
| `[tenant]/website/events` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` passed to `getPublicEvents()` | ✅ Safe (aggregate/compatibility) |
| `[tenant]/website/club-events` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` + `type:{in:["OTHER"]}` in DB | ✅ Safe |
| `[tenant]/website/matches` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` + `type:{in:["MATCH"]}` in DB | ✅ Safe |
| `[tenant]/website/tournaments` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` + `type:{in:["TOURNAMENT"]}` in DB | ✅ Safe |
| `[tenant]/website/trainings` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` + `type:{in:["TRAINING"]}` + trainingsplanVisible in DB | ✅ Safe |
| `[tenant]/website/teams` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` passed to `getPublicTeams()` | ✅ Safe |
| `[tenant]/website/teams/[slug]` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` in Team, Event, FacilityResource WHERE clauses | ✅ Safe |
| `[tenant]/website/weekplan` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` passed to `getGroupedWochenplan()` + `getWochenplanPublication()` | ✅ Safe |
| `v1/website/news` | `resolveTenantFromRequest` + `assertWebsiteEnabled` | `tenantId` in DB where clauses | ✅ Safe |
| `v1/website/news/[slug]` | `resolveTenantFromRequest` + `assertWebsiteEnabled` | `tenantId` in DB where clauses | ✅ Safe |
| `v1/website/pages/[slug]` | `resolveTenantFromRequest` + `assertWebsiteEnabled` | `tenantId` in DB where clauses | ✅ Safe |

---

## Team Tenant Isolation

`Team.tenantId` was added in migration `20260626000000_team_tenant_isolation`.
The `/teams` endpoint now returns DB-scoped results.

### Resolved gap

Prior to this migration, no reliable indirect isolation path existed for teams:

| Indirect path | Problem (historical) |
|--------------|---------------------|
| `Team.orgUnitId → OrgUnit.tenantId` | `orgUnitId` is nullable — teams created without OrgUnit assignment would be silently excluded |
| `Team → Event.tenantId` | `Event.tenantId` is nullable (legacy events = null); new teams without events would be excluded |
| `TeamSeason → Season` | `Season` has no `tenantId` — dead end |

The `/teams` endpoint previously returned `{ "teams": [] }` as a safe fallback.
That restriction is now lifted.

### Migration applied (20260626000000_team_tenant_isolation)

```sql
ALTER TABLE "Team" ADD COLUMN "tenantId" TEXT;

-- Backfill step 1: inherit from OrgUnit where orgUnitId is set
UPDATE "Team" t
SET "tenantId" = (
  SELECT ou."tenantId" FROM "OrgUnit" ou
  WHERE ou."id" = t."orgUnitId" AND ou."tenantId" IS NOT NULL
)
WHERE t."orgUnitId" IS NOT NULL AND t."tenantId" IS NULL;

-- Backfill step 2: assign remaining null teams to the fc-allschwil tenant
UPDATE "Team"
SET "tenantId" = (
  SELECT "id" FROM "Tenant" WHERE "key" = 'fc-allschwil' AND "status" = 'ACTIVE'
)
WHERE "tenantId" IS NULL
  AND EXISTS (SELECT 1 FROM "Tenant" WHERE "key" = 'fc-allschwil' AND "status" = 'ACTIVE');

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");
```

**Audit query** (run after deploy to confirm zero unresolved teams):

```sql
SELECT id, name FROM "Team" WHERE "tenantId" IS NULL;
```

### Prisma schema changes (additive, non-breaking)

```prisma
// model Team — added:
tenantId String?
tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull, onUpdate: Cascade)
@@index([tenantId])

// model Tenant — added:
teams Team[]
```

### Properties of this migration

- **Additive**: adds a nullable column — no existing data is changed or deleted
- **Non-destructive**: `SET NULL` on tenant delete — no cascading deletes
- **Backfill-safe**: two-step UPDATE scoped to `WHERE tenantId IS NULL`; OrgUnit path preferred, fc-allschwil fallback for remainder
- **Standard pattern**: identical to Event.tenantId, OrgUnit.tenantId, TargetGroup.tenantId
- **Zero breaking changes**: all existing API routes and admin queries unaffected

---

## Integration Checklist for Website Team

### Per-request requirements

- Use the v2 path-based URL with the tenant slug: `/api/public/fc-allschwil/website/*`
- Send GET requests only (all other methods return 405)
- No authentication header needed

### Error handling

- `404` on tenant: show maintenance page, alert ops
- `403` website disabled: show "coming soon" or maintenance page
- `404` on resource (article/page not found): redirect to list or show 404 page
- `500`: display error, retry once, then show fallback content
- Do NOT cache 404 responses — content may be published later

### Content rendering

- `publishedAt` is always ISO 8601 UTC for published content
- `content` / `body` fields contain Markdown — use a Markdown renderer
- `null` fields must be handled gracefully (nullable excerpts, images, etc.)
- `data.events` / `data.matches` / `data.teams` are always `[]` when empty (never absent)

### Caching recommendations

| Endpoint | Recommended TTL | Notes |
|----------|----------------|-------|
| `/news` list | 60 seconds | |
| `/events` | 60 seconds | |
| `/matches` | 60 seconds | |
| `/teams` | 60 seconds | |
| `/weekplan` | 60 seconds | |

---

## Recommended Next Slice

### Slice 2: Team Detail + Squad API — ✅ COMPLETED

**Endpoint**: `GET /api/public/[tenant]/website/teams/[slug]`

Implemented in this slice. See [GET /api/public/[tenant]/website/teams/[slug]](#get-apipublictenantwebsiteteamsslug) above.

**Files created/modified**:
- `app/api/public/[tenant]/website/teams/[slug]/route.ts` — new route handler
- `lib/website/public-teams-feed.ts` — added `getPublicTeamDetail()` and `GetPublicTeamDetailInput`
- `lib/website/types.ts` — added `PublicSquadMember`, `PublicTrainerMember`, `PublicTeamTrainingSession`, `PublicTeamDetail`, `TeamDetailData`

**Privacy invariants upheld**:
- `personId`, `dateOfBirth`, `email`, `phone`, `remarks` never selected
- `pitchCode` resolved to `pitchName` internally; raw code never returned
- Squad/trainer lists gated by `TeamSeason.squadWebsiteVisible` / `trainerTeamWebsiteVisible`

**Schema note**: No schema changes. `description` and `heroImage` fields are reserved as `null` in the DTO pending future `Team.description` / `Team.heroMediaId` additions.

### Slice 3: Potential Next Steps

- Add `Team.description` and `Team.heroMediaId` to schema → populate `description` and `heroImage` in the team detail DTO
- Add `Person.photoUrl` to schema → populate `photo` for squad members and trainers
- Team contact section (requires a `TeamContact` model with `isPublic` flag)

---

## Homepage Builder API (CMS V2 Slice 2)

### GET /api/public/[tenant]/website/homepage

Returns the ordered list of enabled homepage sections for the tenant.

**URL**: `GET /api/public/{tenant}/website/homepage`

**Example**: `GET /api/public/fc-allschwil/website/homepage`

**Authentication**: None (public, read-only).

**Error responses**:
- `404` — tenant not found or not ACTIVE
- `403` — `websiteEnabled = false` for this tenant

**Response envelope**: Standard `WebsiteResponseEnvelope<HomepageData>`.

**Response example** (updated in CMS V2 Slice 3 — `block` field added, backwards-compatible):

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T12:00:00.000Z",
  "data": {
    "sections": [
      {
        "id": "clxxx...",
        "type": "hero",
        "label": "Hero-Bereich",
        "sortOrder": 0,
        "config": {},
        "block": { "category": "Header", "datadriven": false }
      },
      {
        "id": "clyyy...",
        "type": "newsTeaser",
        "label": "News-Teaser",
        "sortOrder": 10,
        "config": { "itemCount": 3 },
        "block": { "category": "Content", "datadriven": true }
      },
      {
        "id": "clzzz...",
        "type": "eventsTeaser",
        "label": "Veranstaltungs-Teaser",
        "sortOrder": 20,
        "config": { "itemCount": 5, "surface": "homepage" },
        "block": { "category": "Data-driven", "datadriven": true }
      }
    ]
  },
  "meta": {
    "total": 3
  }
}
```

**Field reference**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable section ID (CUID) |
| `type` | string | Section type key (see registry below) |
| `label` | string | Admin-configured display label |
| `sortOrder` | integer | Display order (ascending, 0-based) |
| `config` | object | Type-specific configuration (public-safe projection). May include `_layout` (see below). |
| `block` | object \| null | Block library metadata (added in Slice 3 — see below) |

**`block` field** (added in CMS V2 Slice 3, backwards-compatible):

| Field | Type | Description |
|-------|------|-------------|
| `block.category` | string | Block category: `"Header"` \| `"Content"` \| `"Data-driven"` \| `"Club"` \| `"Sponsors"` \| `"Conversion"` \| `"Utility"` |
| `block.datadriven` | boolean | `true` if block auto-fetches from a data source; `false` if manually configured |

`block` is `null` for unregistered type keys (safe fallback). Existing consumers that don't use `block` can safely ignore the field.

---

### Flexible Layout System — `config._layout` (added in CMS V2 Flexible Layout slice)

Every section may include a `config._layout` field of type `SectionLayout`. This field is **optional** — sections without it should render with defaults (see `DEFAULT_SECTION_LAYOUT` in the integration contract).

`_layout` drives all cross-cutting layout concerns so the public website never needs block-specific layout logic:

| `_layout` key | Type | Default | Description |
|---------------|------|---------|-------------|
| `width` | `"narrow"` \| `"normal"` \| `"wide"` \| `"full"` | `"normal"` | Container max-width |
| `spacingTop` | `"none"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | `"md"` | Vertical padding above section |
| `spacingBottom` | `"none"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | `"md"` | Vertical padding below section |
| `paddingX` | `"none"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` | `"md"` | Horizontal padding inside container |
| `theme` | `"light"` \| `"soft"` \| `"dark"` \| `"club"` | `"light"` | Colour scheme / tenant branding |
| `hAlign` | `"left"` \| `"center"` \| `"right"` | `"left"` | Horizontal text alignment |
| `vAlign` | `"top"` \| `"center"` \| `"bottom"` \| `"stretch"` | `"top"` | Vertical column alignment |
| `columns` | `"single"` \| `"50/50"` \| `"33/66"` \| `"66/33"` \| `"25/75"` \| `"75/25"` | `"50/50"` | Column grid preset |
| `background` | object | `{ type: "none" }` | Background layer (see below) |
| `responsive` | object | `{ stackOnMobile: true }` | Responsive stacking rules |

**`background` variants:**

| `background.type` | Additional fields | Description |
|-------------------|------------------|-------------|
| `"none"` | — | Transparent / inherits page background |
| `"solid"` | `color: string` | Flat CSS colour (hex, rgb, etc.) |
| `"gradient"` | `gradientPreset: string` | One of: `club-warm`, `club-cool`, `dark-slate`, `soft-sand`, `evening-sky` |
| `"image"` | `mediaAssetId: string`, `overlay: "none" \| "light" \| "dark"` | DAM image — resolve URL via `GET /api/public/[tenant]/website/media/[id]` |

**`responsive` fields:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `stackOnMobile` | boolean | `true` | Stack columns vertically on small screens |
| `reverseStackOnMobile` | boolean | `false` | Reverse column order when stacked |
| `hideImageOnMobile` | boolean | `false` | Hide media column on mobile |
| `equalHeights` | boolean | `false` | Force equal-height columns |

**Rendering contract for the public website:**

```typescript
import type { WebsitePublicSection } from "@/lib/website/integration-contract";
import { resolveLayout, THEME_TOKENS, SPACING_TOP_MAP, SPACING_BOTTOM_MAP, WIDTH_MAP } from "@/lib/website/integration-contract";

function renderSection(section: WebsitePublicSection) {
  const layout = resolveLayout(section.config._layout);
  // layout is now fully populated with defaults for any absent fields.
  // Use layout.theme, layout.width, layout.spacingTop, layout.background, etc.
}
```

**Reference implementation:** `components/website/SectionShell.tsx` in the WebApp repository.
Copy or adapt it for the public website to apply `_layout` to the outer `<section>` wrapper.

**Backward compatibility (splitContentCards only):**
Pre-migration `splitContentCards` sections store layout under `config.style` and `config.background`.
When `config._layout` is absent, fall back to those legacy fields. See `resolveBlockLayout()` in
`components/website/blocks/SplitContentCardsRenderer.tsx`.

**Privacy invariants**:
- `tenantId` never exposed
- `createdAt` / `updatedAt` never exposed
- `isEnabled` never exposed (only enabled sections are returned)
- `block` field contains only public-safe metadata (category, datadriven) — no admin labels, internal status, or admin-only fields
- Section config is projected through the block registry's public-safe projection before serialisation

---

### Design System — Visual Token Architecture (CMS V4.1)

The Design System is the **single source of visual truth** for all CMS renderers. Every renderer resolves typography, buttons, cards, colours, shadows, radius and spacing through `resolveDesignSystem()` — never via hardcoded Tailwind class strings.

#### Token resolution order

```
Local _layout override  (section-level — managed by resolveLayout())
          ↓
Tenant Design System    (future: per-tenant DB customisation)
          ↓
DEFAULT_DESIGN_SYSTEM   (lib/cms/design-system.ts)
          ↓
Framework fallback      (Tailwind utility defaults)
```

#### Token categories

| Category | Token keys | File |
|----------|-----------|------|
| Typography | `h1`, `h2`, `h3`, `body`, `small`, `quote` | `lib/cms/design-system.ts` |
| Buttons | `primary`, `secondary`, `outline`, `ghost`, `rounded`, `square` | `lib/cms/design-system.ts` |
| Cards | `default`, `soft`, `elevated`, `bordered`, `sponsor`, `highlight` | `lib/cms/design-system.ts` |
| Colors | `primary`, `secondary`, `accent`, `success`, `warning`, `danger`, `neutral` | `lib/cms/design-system.ts` |
| Spacing | `xs`, `s`, `m`, `l`, `xl`, `xxl` | `lib/cms/design-system.ts` |
| Shadows | `none`, `small`, `medium`, `large` | `lib/cms/design-system.ts` |
| Radius | `small`, `medium`, `large`, `extraLarge` | `lib/cms/design-system.ts` |
| Section widths | `narrow`, `normal`, `wide`, `full` | `lib/cms/design-system.ts` |

#### Renderer responsibilities

```
Renderer
    │
    ├── SectionShell           outer section shell (width, spacing, background, theme)
    │
    └── resolveDesignSystem()  visual token resolution (typography, buttons, cards, ...)
```

Renderers **must not** hardcode Tailwind classes for typography sizes, card styles, shadows, radius, or button variants. All visual decisions originate from the Design System.

#### Usage in renderers

```typescript
import { resolveDesignSystem } from "@/lib/cms/token-resolver";
// or from the integration contract:
import { resolveDesignSystem } from "@/lib/website/integration-contract";

const ds = resolveDesignSystem();

// Typography
<h2 className={`${ds.typography.h2} ${themeTokens.text}`}>{headline}</h2>
<p className={`${ds.typography.body} ${themeTokens.subtext}`}>{body}</p>

// Buttons
<a href={url} className={`${ds.buttons.primary} ${ds.buttons.rounded}`}>
  {label}
</a>
<a href={url} className={`${ds.buttons.outline} ${ds.buttons.rounded}`}>
  {secondaryLabel}
</a>

// Cards
<div className={ds.cards.default.container}>
  <h4 className={ds.cards.default.title}>{title}</h4>
  <p className={ds.cards.default.body}>{body}</p>
</div>

// Spacing and layout
<div className={`flex flex-col ${ds.spacing.m}`}>{/* children */}</div>

// Shadows and radius
<div className={`${ds.radius.large} ${ds.shadows.medium}`}>{/* content */}</div>
```

#### Reference renderers (CMS V4.1)

All renderers live in `components/website/blocks/` and consume the Design System:

| File | Block | Notes |
|------|-------|-------|
| `HeroRenderer.tsx` | `hero` | Full-width banner; typography + button tokens |
| `CallToActionRenderer.tsx` | `callToAction` | CTA banner; primary + outline button tokens |
| `SplitContentCardsRenderer.tsx` | `splitContentCards` | Two-column content; h2 + card tokens |
| `NewsTeaserRenderer.tsx` | `newsTeaser` | Data-driven; card tokens for article cards |
| `TeamsTeaserRenderer.tsx` | `teamsTeaser` | Data-driven; soft card tokens for team grid |
| `SponsorsTeaserRenderer.tsx` | `sponsorsTeaser` | Foundation-ready; sponsor card tokens |

#### Backward compatibility

`DEFAULT_DESIGN_SYSTEM` is used when no tenant override exists — all existing websites render identically.
No visual regressions. No breaking changes to existing `_layout` or `SectionLayout` APIs.

#### No duplication rules

- Typography, spacing, width, colour, button, card, shadow and radius maps exist **once** in `lib/cms/design-system.ts`.
- The integration contract re-exports everything — the public website imports from one place only.
- `layout-types.ts` retains ownership of `SectionLayout`, `resolveLayout()`, `THEME_TOKENS` and the layout token maps. These are not duplicated in `design-system.ts`.

---

### Section Type Registry (CMS V2 Slice 3 — updated)

| Type key | Label | Category | Status | Data-driven | Default config |
|----------|-------|----------|--------|-------------|----------------|
| `hero` | Hero-Bereich | Header | available | No | `{}` |
| `newsTeaser` | News-Teaser | Content | available | Yes | `{ "itemCount": 3 }` |
| `eventsTeaser` | Veranstaltungs-Teaser | Data-driven | available | Yes | `{ "itemCount": 5, "surface": "homepage" }` |
| `teamsTeaser` | Teams-Übersicht | Club | available | Yes | `{ "itemCount": 6 }` |
| `weekplanTeaser` | Wochenplan-Teaser | Data-driven | available | Yes | `{}` |
| `callToAction` | Call-to-Action | Conversion | available | No | `{}` |
| `sponsorsTeaser` | Sponsoren | Sponsors | **foundation-ready** | Yes | `{}` |
| `customContentPlaceholder` | Benutzerdefinierter Inhalt | Utility | **coming-next** | No | `{}` |

**Status definitions** (Slice 3 — extended):
- `available` — type has a live data source in the WebApp API
- `foundation-ready` — type is registered and API-ready; backing DB model not yet built (Sponsor model TBD)
- `coming-next` — planned for the next roadmap slice

---

### Config field reference by type

#### `hero`
| Key | Type | Description |
|-----|------|-------------|
| `title` | string? | Main hero headline |
| `subtitle` | string? | Supporting subtitle |
| `ctaLabel` | string? | CTA button label |
| `ctaUrl` | string? | CTA button URL |

#### `newsTeaser`
| Key | Type | Description |
|-----|------|-------------|
| `itemCount` | number? | Articles to display (1–10, default 3) |
| `heading` | string? | Section heading override |

#### `eventsTeaser`
| Key | Type | Description |
|-----|------|-------------|
| `itemCount` | number? | Events to display (1–20, default 5) |
| `surface` | `"homepage"` \| `"all"` | Event surface filter (default `"homepage"`) |
| `heading` | string? | Section heading override |

#### `teamsTeaser`
| Key | Type | Description |
|-----|------|-------------|
| `itemCount` | number? | Teams to display (1–20, default 6) |
| `seasonKey` | string? | Season key override (default active season) |
| `heading` | string? | Section heading override |

#### `weekplanTeaser`
| Key | Type | Description |
|-----|------|-------------|
| `heading` | string? | Section heading override |

#### `callToAction`
| Key | Type | Description |
|-----|------|-------------|
| `title` | string? | CTA headline |
| `body` | string? | CTA body text |
| `primaryLabel` | string? | Primary button label |
| `primaryUrl` | string? | Primary button URL |
| `secondaryLabel` | string? | Secondary button label |
| `secondaryUrl` | string? | Secondary button URL |

---

### Implemented in CMS V2 Slice 4

- Inline config editor per section type in the admin Homepage Builder
  (`PATCH /api/homepage-sections/[id]/config`)
- Section label editing
- Config validation per block type (Zod strict schemas, `.strict()` mode)
- See `docs/cms-block-library.md` for the full admin API and field reference.

### Implemented in CMS V2 Slice 5

- Publishing workflow foundation: `publishStatus` (DRAFT | PUBLISHED), `publishedAt`, `unpublishedAt`, `lastPublishedAt`, `scheduledPublishAt`
- Public API now filters by `publishStatus = "PUBLISHED"` in addition to `isEnabled = true`
- Scheduled publishing: sections with `scheduledPublishAt <= now()` treated as published
- Admin publish/unpublish/schedule endpoints: `PATCH .../publish`, `.../unpublish`, `.../schedule`
- Admin preview endpoint: `GET /api/homepage-sections/preview` (requires `WEBSITE_MANAGE`)
- Backwards compatible: migration default `publishStatus = "PUBLISHED"` preserves existing visibility

### Implemented in CMS V2 Slice 6

- Editorial approval workflow: `approvalStatus` (NOT_REQUIRED | DRAFT | IN_REVIEW | APPROVED | CHANGES_REQUESTED)
- Reviewer assignment foundation: `reviewerUserId` nullable FK to User
- Approval audit trail via existing `AuditLog` model (moduleKey="homepage", actions: APPROVAL_REQUEST, APPROVE, REJECT)
- Publish/schedule gate: only `APPROVED` or `NOT_REQUIRED` sections may be published or scheduled
- Admin approval endpoints: `PATCH .../request-review`, `.../approve`, `.../reject`
- Admin review-queue endpoint: `GET /api/homepage-sections/review-queue`
- Review queue UI: `/dashboard/website/review`
- Backwards compatible: migration default `approvalStatus = "NOT_REQUIRED"` preserves all existing publishing behavior
- Approval metadata **never** exposed on public API (privacy guaranteed)

### Public API filtering (Slices 5–6 — current)

A section appears in `GET /api/public/[tenant]/website/homepage` if and only if:

```
isEnabled = true
AND (publishStatus = "PUBLISHED" OR scheduledPublishAt <= now())
```

**Note:** `approvalStatus` is NOT part of the public filter — publishing is the public gate. Approval is an editorial workflow gate on the admin side only.

**Fields never exposed in public API** (Slices 5–6 cumulative):
- `publishStatus`
- `publishedAt`, `unpublishedAt`, `lastPublishedAt`, `scheduledPublishAt`
- `approvalStatus`, `reviewerUserId`, `approvalNote`
- `reviewRequestedAt`, `reviewedAt`, `approvedAt`, `rejectedAt`
- `approvedByUserId`, `rejectedByUserId`

### Approval Status Values

| Status | Meaning | Publish/Schedule |
|--------|---------|-----------------|
| `NOT_REQUIRED` | Approval not needed (default for pre-Slice-6 rows) | ✅ Allowed |
| `DRAFT` | Editorial draft, not yet submitted | ❌ Blocked |
| `IN_REVIEW` | Awaiting reviewer decision | ❌ Blocked |
| `APPROVED` | Reviewer approved | ✅ Allowed |
| `CHANGES_REQUESTED` | Reviewer requested changes | ❌ Blocked |

### Deferred work (intentionally out of scope)

- Visual drag-and-drop builder
- Rich text for `callToAction.body` (plain text only)
- Sponsor model (backing the `sponsorsTeaser` type)
- Block-based rich content editor (backing the `customContentPlaceholder` type)
- Full four-eyes policy engine (self-approval prevention, role-based enforcement)
- Email/push notifications for review/approval events
- Full role-based reviewer assignment workflow
- Background scheduler worker for scheduled publishing
- Navigation management (implemented in CMS V2 Slice 7 — see below)
- Redirect management
- Block version history

---

## Navigation API (CMS V2 Slice 7)

### GET /api/public/[tenant]/website/navigation

Returns the visible navigation tree for the tenant, grouped by area.

**URL**: `GET /api/public/{tenant}/website/navigation`

**Example**: `GET /api/public/fc-allschwil/website/navigation`

**Authentication**: None (public, read-only).

**Error responses**:
- `404` — tenant not found or not ACTIVE
- `403` — `websiteEnabled = false` for this tenant

**Response envelope**: Standard `WebsiteResponseEnvelope<NavigationData>`.

**Response example**:

```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T20:00:00.000Z",
  "data": {
    "areas": {
      "header": [
        {
          "id": "clxxx...",
          "parentId": null,
          "area": "HEADER",
          "label": "Startseite",
          "linkType": "INTERNAL",
          "href": "/",
          "target": "SELF",
          "sortOrder": 0,
          "children": []
        },
        {
          "id": "clyyy...",
          "parentId": null,
          "area": "HEADER",
          "label": "Teams",
          "linkType": "INTERNAL",
          "href": "/teams",
          "target": "SELF",
          "sortOrder": 2,
          "children": [
            {
              "id": "clzzz...",
              "parentId": "clyyy...",
              "area": "HEADER",
              "label": "1. Mannschaft",
              "linkType": "INTERNAL",
              "href": "/teams/1-mannschaft",
              "target": "SELF",
              "sortOrder": 0,
              "children": []
            }
          ]
        }
      ],
      "footer": [
        {
          "id": "claaa...",
          "parentId": null,
          "area": "FOOTER",
          "label": "Impressum",
          "linkType": "INTERNAL",
          "href": "/impressum",
          "target": "SELF",
          "sortOrder": 3,
          "children": []
        }
      ],
      "utility": []
    }
  },
  "meta": { "total": 8 }
}
```

**Privacy invariants**:
- `tenantId` — **never** exposed
- `createdAt` / `updatedAt` — **never** exposed
- `visibilityMode` — **never** exposed (admin-only)
- Only `isVisible=true` items are returned
- `parentId` is intentionally included for client-side hierarchy reconstruction

**Filter rules**:
- `isVisible = true` only
- All areas (HEADER, FOOTER, UTILITY) always present in response (may be empty arrays)
- Items ordered by `sortOrder ASC` within each parent/area group

---

---

## GET /api/public/[tenant]/website/pages/[slug]/layout

> Added in CMS V2 Slice 8 (Page Builder Foundation).
> **Does not replace** `GET /api/public/v1/website/pages/[slug]` (Markdown body endpoint).
> Both endpoints coexist for backward compatibility.

Returns the block-based layout of a published page for a given tenant and slug.

**Tenant resolution:** Path segment `[tenant]` (same as all v2 endpoints).

**Public visibility rules:**
- Page must be `status=PUBLISHED` AND `publishedAt <= now()`
- Only sections with `isEnabled=true` are returned
- Section config is projected through the block registry's `projectPublicConfig()`

**Privacy invariants:**
- `tenantId` — **never** exposed
- `createdAt` / `updatedAt` — **never** exposed
- Approval metadata — **never** exposed
- Section `isEnabled` flag — **never** exposed
- Config is projected through the block registry's public-safe projection

**Response shape:**
```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-26T20:00:00.000Z",
  "data": {
    "page": {
      "id": "clxxx",
      "slug": "ueber-uns",
      "title": "Über uns",
      "seoTitle": "FC Allschwil — Über uns",
      "seoDescription": "Erfahre mehr über den FC Allschwil.",
      "publishedAt": "2026-06-25T10:00:00.000Z"
    },
    "sections": [
      {
        "id": "clyyy",
        "type": "hero",
        "label": "Hero-Bereich",
        "sortOrder": 0,
        "config": {
          "title": "Willkommen beim FC Allschwil",
          "_layout": {
            "width": "full",
            "spacingTop": "md",
            "spacingBottom": "md",
            "theme": "light",
            "hAlign": "left",
            "background": { "type": "none" }
          }
        },
        "block": { "category": "Header", "datadriven": false }
      },
      {
        "id": "clzzz",
        "type": "splitContentCards",
        "label": "Über uns — Inhalt",
        "sortOrder": 10,
        "config": {
          "eyebrow": "Über uns",
          "headline": "Der FC Allschwil",
          "cards": [],
          "layout": "TEXT_LEFT_CARDS_RIGHT",
          "_layout": {
            "width": "normal",
            "spacingTop": "lg",
            "spacingBottom": "lg",
            "theme": "soft",
            "hAlign": "left",
            "background": { "type": "gradient", "gradientPreset": "soft-sand" },
            "responsive": { "stackOnMobile": true, "reverseStackOnMobile": false }
          }
        },
        "block": { "category": "Content", "datadriven": false }
      }
    ]
  },
  "meta": { "sectionCount": 2 }
}
```

Section `config._layout` is the Flexible Layout System field. See the [Flexible Layout System](#flexible-layout-system----config_layout-added-in-cms-v2-flexible-layout-slice) section above for the full field reference and rendering contract.

**Error responses:**
- `404` — unknown tenant
- `403` — website not enabled for tenant
- `404` — page not found or not published

**Relation to existing page endpoint:**
```
GET /api/public/v1/website/pages/[slug]         → Markdown body (old, still works)
GET /api/public/[tenant]/website/pages/[slug]/layout → Block layout (new, Slice 8)
```

---

## Design System Endpoint (CMS V4)

### `GET /api/public/[tenant]/website/design-system`

Returns the fully-resolved tenant design system tokens.

**Purpose:**
- Provides the global visual design language (typography, colours, buttons, cards, spacing, shadows, radius, section widths, animations) for the tenant.
- Colour tokens `primary` and `secondary` are sourced from the existing branding system (`Tenant.primaryColor`/`secondaryColor`) — no duplication.
- All tokens are always fully resolved (platform defaults applied for any unconfigured values).
- Future templates consume this endpoint to inherit the club's visual identity automatically.

**Response envelope:**
```json
{
  "version": "1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-29T12:00:00.000Z",
  "data": {
    "designSystem": {
      "typography": {
        "h1": { "preset": "premium", "fontSize": "3rem", "lineHeight": "1.15", "fontWeight": "800", "letterSpacing": "-0.025em", "textTransform": "none" },
        "h2": { "fontSize": "2rem", "fontWeight": "700" },
        "h3": { "fontSize": "1.5rem", "fontWeight": "600" },
        "body": { "fontSize": "1rem", "lineHeight": "1.625" },
        "small": { "fontSize": "0.875rem" },
        "quote": { "fontSize": "1.25rem", "fontWeight": "500" }
      },
      "colors": {
        "primary": "#0b4aa2",
        "secondary": "#c7332c",
        "accent": "#e8eef8",
        "success": "#16a34a",
        "warning": "#d97706",
        "danger": "#dc2626",
        "neutral": "#6b7280"
      },
      "buttons": {
        "primary": { "background": "#0b4aa2", "color": "#ffffff", "borderRadius": "0.5rem", "paddingX": "1.25rem", "paddingY": "0.625rem" }
      },
      "cards": {
        "default": { "background": "#ffffff", "border": "1px solid #e5e7eb", "borderRadius": "0.75rem", "shadow": "0 1px 3px 0 rgb(0 0 0 / 0.1)", "padding": "1.5rem" }
      },
      "spacing": { "xs": "0.25rem", "sm": "0.5rem", "md": "1rem", "lg": "1.5rem", "xl": "2.5rem", "xxl": "4rem" },
      "shadows": { "none": "none", "sm": "...", "md": "...", "lg": "..." },
      "radius": { "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem", "xl": "1rem" },
      "sectionWidths": { "narrow": "56rem", "normal": "72rem", "wide": "80rem", "full": "none" },
      "animations": { "default": "none" }
    }
  },
  "meta": { "source": "stored" }
}
```

**Cache:** `public, s-maxage=120, stale-while-revalidate=600`

**Public website integration:**
1. Fetch at build time or layout level: `GET /api/public/fc-allschwil/website/design-system`
2. Apply `sectionWidths` tokens by passing `designSystem` to `SectionShell`.
3. Apply `typography` tokens to global CSS variables or heading components.
4. Apply `colors.primary`/`colors.secondary` for tenant branding.
5. Apply `buttons` and `cards` tokens to the corresponding components.

**Error responses:**
- `404` — unknown tenant
- `403` — website not enabled for tenant

**Admin UI:** `/dashboard/website/design-system`

---

## Merge Recommendation

### Status: READY TO MERGE — all blockers resolved

The `Team.tenantId` migration (`20260626000000_team_tenant_isolation`) is now applied.
All public website endpoints have full DB-level tenant isolation.

### Endpoint status

| Endpoint | Isolation | Publish filter | Merge-safe? |
|----------|-----------|---------------|-------------|
| `/news` | ✅ DB-scoped (`tenantId`) | ✅ `status=PUBLISHED`, `publishedAt≤now` | ✅ Yes |
| `/events` | ✅ DB-scoped (`tenantId`) | ✅ `status IN (SCHEDULED,LIVE,COMPLETED,POSTPONED)`, `websiteVisible` | ✅ Yes |
| `/matches` | ✅ DB-scoped (`tenantId`) | ✅ Same as events + `type=MATCH` | ✅ Yes |
| `/teams` | ✅ DB-scoped (`tenantId`) | ✅ `isActive=true`, `websiteVisible=true` | ✅ Yes |
| `/teams/[slug]` | ✅ DB-scoped (`tenantId` in Team, Event, FacilityResource) | ✅ `isActive=true`, `websiteVisible=true`, `TeamSeason.status=ACTIVE` | ✅ Yes |
| `/weekplan` | ✅ DB-scoped (`tenantId`) | ✅ `wochenplanVisible`, `websiteVisible` | ✅ Yes |
| `/homepage` | ✅ DB-scoped (`tenantId`) | ✅ `isEnabled=true`, `publishStatus=PUBLISHED` or `scheduledPublishAt<=now`, ordered by `sortOrder` | ✅ Yes |

### Deploy checklist (Slice 6 — updated)

1. Run `prisma migrate deploy` in STAGE (migrations `20260626120000_homepage_sections`, `20260626150000_homepage_section_publish_workflow`, `20260626200000_homepage_section_approval_workflow`)
2. Verify `GET /api/public/fc-allschwil/website/homepage` returns only enabled+published sections, no approval fields
3. Navigate to `/dashboard/website/homepage` and verify approval status badges are visible
4. Navigate to `/dashboard/website/review` and verify review queue renders
5. Test request-review → approve flow: section moves to IN_REVIEW, then APPROVED
6. Test that DRAFT sections cannot be published (returns 422)
4. Test publish/unpublish actions on a section
5. Verify unknown tenant returns 404
6. Verify disabled sections are excluded
7. Verify draft sections are excluded from public API
8. Deploy to PROD, repeat verification
