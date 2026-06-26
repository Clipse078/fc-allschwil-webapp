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
   - [GET /api/public/[tenant]/website/events](#get-apipublictenantwebsiteevents)
   - [GET /api/public/[tenant]/website/matches](#get-apipublictenantwebsitematches)
   - [GET /api/public/[tenant]/website/teams](#get-apipublictenantwebsiteteams)
   - [GET /api/public/[tenant]/website/teams/[slug]](#get-apipublictenantwebsiteteamsslug)
   - [GET /api/public/[tenant]/website/weekplan](#get-apipublictenantwebsiteweekplan)
9. [Endpoints (v1 — header-based tenant, legacy)](#endpoints-v1--header-based-tenant-legacy)
10. [Type Reference](#type-reference)
11. [Duplication Audit](#duplication-audit)
12. [Tenant Isolation Audit](#tenant-isolation-audit)
13. [Integration Checklist for Website Team](#integration-checklist-for-website-team)
14. [Recommended Next Slice](#recommended-next-slice)

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
| `[tenant]/website/events` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` passed to `getPublicEvents()` | ✅ Safe |
| `[tenant]/website/matches` | `resolveTenantFromParams` + `assertWebsiteEnabled` | `tenantId` passed to `getPublicEvents()` | ✅ Safe |
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

### Deploy checklist

1. Run `prisma migrate deploy` in STAGE (no new migrations for this slice)
2. Verify `GET /api/public/fc-allschwil/website/teams` returns real tenant-scoped teams
3. Verify `GET /api/public/fc-allschwil/website/teams/[slug]` returns team detail with squad and trainers
4. Verify unknown slug returns 404
5. Deploy to PROD, repeat verification
