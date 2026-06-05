# Public Website Feed Contract v1

**Status**: Slice 1 — Foundation (sponsors and news return stable empty arrays)  
**Module**: `app/api/public/v1/website/`  
**Tenant-scoped**: Yes  
**Authentication**: None — public unauthenticated GET only

---

## Overview

This document defines the contract between the SportClubEvo WebApp and any external website consumer (e.g. the FC Allschwil website repo).

The `/api/public/v1/website` family of endpoints provides a stable, versioned, white-label-ready public data feed for tenant websites. The contract guarantees:

- A consistent response envelope (`version`, `tenant`, `generatedAt`, `data`, `meta`)
- Tenant isolation via domain or slug resolution
- `websiteEnabled` gating: no data served until a tenant opts in
- `approvedDataOnly` gating: only review-approved content is publicly visible
- No admin/internal fields in any response
- Stable empty arrays for feed types whose source models are not yet implemented

---

## Endpoint List

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/api/public/v1/website` | Live | Aggregate overview + feed discovery |
| `GET` | `/api/public/v1/website/sponsors` | Live (empty) | Sponsor list — awaiting Sponsor model |
| `GET` | `/api/public/v1/website/news` | Live (empty) | News articles — awaiting NewsArticle model |
| — | `/api/public/v1/website/teams` | Planned | Team roster — Slice 2+ |
| — | `/api/public/v1/website/events` | Existing | Use `/api/public/events` with `surface=homepage` |
| — | `/api/public/v1/website/weekplan` | Existing | Use `/api/public/wochenplan` |

All non-GET methods return `405 Method Not Allowed`.

---

## Tenant Resolution

Tenant is resolved from the request in this order:

1. **Host header** — matched against `Tenant.websiteDomain` (case-insensitive, port stripped).  
   Configure: set `Tenant.websiteDomain = "www.fc-allschwil.ch"` in the database.

2. **`?tenant=<key>` query param** — explicit slug override.  
   Example: `/api/public/v1/website?tenant=fc-allschwil`

When neither resolves a tenant: `404 TENANT_NOT_FOUND`.

---

## Gate Checks

### `websiteEnabled`

Every endpoint checks `Tenant.websiteEnabled` before serving data.

- `false` (default for new tenants) → `503 WEBSITE_DISABLED`
- `true` → proceed to data query

Set to `true` only once the tenant's website is ready for public consumption.

### `approvedDataOnly`

When `true` (default), only content that has passed the review workflow (`reviewStage = APPROVED` or `PUBLISHED`) is included.

When `false` (dev/staging), all published/scheduled content is eligible regardless of review stage.

---

## Response Envelope

Every response wraps its payload in a standard envelope:

```json
{
  "version": "v1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "data": { ... },
  "meta": {
    "count": 0,
    "cacheHint": "CDN: 60s, stale-while-revalidate: 5min",
    "todos": ["..."]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | `"v1"` | Contract version. Bump on breaking changes. |
| `tenant.key` | `string` | Tenant slug. Used for namespacing and cache keys. |
| `tenant.name` | `string` | Club / organisation display name. |
| `generatedAt` | ISO 8601 | Server-side generation timestamp. |
| `data` | `T` | Feed payload (see per-endpoint docs below). |
| `meta.count` | `number \| null` | Item count for array payloads; `null` for objects. |
| `meta.cacheHint` | `string` | Human-readable caching guidance. |
| `meta.todos` | `string[]?` | Present when feed type is not yet fully implemented. |

---

## Error Responses

All error responses use the `WebsiteFeedError` shape:

```json
{
  "error": "Human-readable description.",
  "code": "TENANT_NOT_FOUND"
}
```

| HTTP | `code` | Meaning |
|------|--------|---------|
| 404 | `TENANT_NOT_FOUND` | No active tenant matches the request. |
| 503 | `WEBSITE_DISABLED` | Tenant exists but `websiteEnabled = false`. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## Response Examples

### `GET /api/public/v1/website?tenant=fc-allschwil`

```json
{
  "version": "v1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "data": {
    "feeds": {
      "sponsors": { "available": false, "path": "/api/public/v1/website/sponsors" },
      "news":     { "available": false, "path": "/api/public/v1/website/news" },
      "teams":    { "available": false, "path": "/api/public/v1/website/teams" },
      "events":   { "available": true,  "path": "/api/public/events" },
      "weekplan": { "available": true,  "path": "/api/public/wochenplan" }
    }
  },
  "meta": {
    "count": null,
    "cacheHint": "CDN: 60s, stale-while-revalidate: 5min",
    "todos": [
      "TODO(website-feed/sponsors): available=true once Sponsor model is implemented",
      "TODO(website-feed/news): available=true once NewsArticle model is implemented",
      "TODO(website-feed/teams): available=true once team feed endpoint is implemented"
    ]
  }
}
```

### `GET /api/public/v1/website/sponsors?tenant=fc-allschwil`

```json
{
  "version": "v1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "data": [],
  "meta": {
    "count": 0,
    "cacheHint": "CDN: 60s, stale-while-revalidate: 5min",
    "todos": [
      "TODO(website-feed/sponsors): Sponsor model not yet implemented — returns stable empty array. Implement Sponsor model in prisma/schema.prisma and update lib/website/queries.ts → getPublicSponsors()."
    ]
  }
}
```

### `GET /api/public/v1/website/news?tenant=fc-allschwil`

```json
{
  "version": "v1",
  "tenant": { "key": "fc-allschwil", "name": "FC Allschwil" },
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "data": [],
  "meta": {
    "count": 0,
    "cacheHint": "CDN: 60s, stale-while-revalidate: 5min",
    "todos": [
      "TODO(website-feed/news): NewsArticle model not yet implemented — returns stable empty array. Implement NewsArticle model in prisma/schema.prisma and update lib/website/queries.ts → getPublicNews()."
    ]
  }
}
```

### `GET /api/public/v1/website?tenant=disabled-tenant` (websiteEnabled=false)

```json
{
  "error": "Website feed is not enabled for tenant 'disabled-tenant'.",
  "code": "WEBSITE_DISABLED"
}
```
HTTP 503, `Cache-Control: no-store`

---

## Planned Sponsor Wire Shape (Slice 2)

When the `Sponsor` Prisma model is implemented, `data` will be:

```json
[
  {
    "id": "clxxx",
    "name": "Hauptsponsor GmbH",
    "tier": "gold",
    "logoUrl": "https://cdn.example.com/sponsors/hauptsponsor.png",
    "websiteUrl": "https://hauptsponsor.ch",
    "sortOrder": 1
  }
]
```

Tiers: `gold` | `silver` | `partner` | `supporter`

---

## Planned News Wire Shape (Slice 2)

When the `NewsArticle` Prisma model is implemented, `data` will be:

```json
[
  {
    "id": "clxxx",
    "slug": "saisonstart-2026",
    "title": "Erfolgreicher Saisonstart",
    "summary": "Die 1. Mannschaft startet stark in die neue Saison.",
    "publishedAt": "2026-06-01T10:00:00.000Z",
    "imageUrl": "https://cdn.example.com/news/saisonstart.jpg",
    "category": "Vereinsnews"
  }
]
```

Query params: `?limit=20` (default 20, max 50)

---

## Caching Strategy

| Layer | TTL |
|-------|-----|
| CDN / proxy (`s-maxage`) | 60 seconds |
| Stale-while-revalidate | 5 minutes |
| Browser | Inherits CDN headers |
| Error responses | `no-store` (never cached) |

Website consumers should:
- Use `generatedAt` for staleness detection and display of "last updated" labels.
- Not cache error responses locally.
- Treat `meta.todos` as a stable contract: feeds with TODOs return `[]` and `count: 0`.

---

## Website Consumer Expectations

### Environment variables (FC Allschwil website repo)

```env
NEXT_PUBLIC_API_BASE_URL=https://webapp.fc-allschwil.ch
NEXT_PUBLIC_TENANT_KEY=fc-allschwil
```

### Fetching pattern

```ts
// Recommended: ISR with 60s revalidation to match CDN TTL
const res = await fetch(
  `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/public/v1/website/news?tenant=${process.env.NEXT_PUBLIC_TENANT_KEY}`,
  { next: { revalidate: 60 } }
);
const feed = await res.json();
// feed.data is the array, feed.meta.count is the length
```

### Fallback behaviour

When `meta.todos` is present on a feed, the website must render a graceful empty state, not an error. The data guarantee is:
- `data` is always an array (never null) for `/sponsors` and `/news`
- `data` is always an object (never null) for `/api/public/v1/website`
- `count` matches `data.length` for array payloads

### Host-header resolution (optional)

If the website is deployed at `www.fc-allschwil.ch` and the WebApp's `Tenant.websiteDomain` is set to `www.fc-allschwil.ch`, the website can omit `?tenant=` — the Host header will resolve the tenant automatically. The `?tenant=` param remains as a fallback.

---

## Validation

Run contract validation against a running dev server:

```bash
# Start dev server first:
npm run dev

# Then in a second terminal:
BASE_URL=http://localhost:3000 TENANT_KEY=fc-allschwil npx tsx scripts/validate-website-feed-v1.ts
```

---

## Migration Safety Report

Migration: `20260605120000_tenant_website_feed_config`

| Change | Type | Risk |
|--------|------|------|
| `ADD COLUMN websiteDomain TEXT` | Additive | None — nullable, existing rows = NULL |
| `ADD COLUMN websiteEnabled BOOLEAN DEFAULT false` | Additive | None — safe default (false = disabled) |
| `ADD COLUMN approvedDataOnly BOOLEAN DEFAULT true` | Additive | None — safe default (true = restrictive) |
| `CREATE UNIQUE INDEX Tenant_websiteDomain_key` | Additive | None — index on NULL-filled column |

**Zero-downtime safe**: all changes are additive column additions with default values.  
**No data loss**: no DROP, no ALTER TYPE, no NOT NULL without default.  
**Existing behaviour unchanged**: all existing API routes continue to function — they do not read the new columns.

---

## FC Allschwil Website Repo — Slice 2 Readiness Note

**The FC Allschwil website repo is NOT yet ready to consume real Sponsors or News data.**

What is ready:
- `/api/public/v1/website` — aggregate overview endpoint (live)
- `/api/public/v1/website/sponsors` — route exists, returns `[]` stably
- `/api/public/v1/website/news` — route exists, returns `[]` stably
- Shared response envelope shape is stable and will not change
- Existing `/api/public/events` and `/api/public/wochenplan` are fully functional

What blocks Slice 2:
1. **Sponsor model** not yet in `prisma/schema.prisma` — needs model + migration + admin CRUD
2. **NewsArticle model** not yet in `prisma/schema.prisma` — needs model + migration + admin CRUD
3. **`websiteEnabled = true`** must be set on the `fc-allschwil` tenant in the database
4. **`websiteDomain`** should be configured to `www.fc-allschwil.ch` for production host-based resolution

The website repo can safely implement the consumer integration now using the stable empty arrays, and the actual data will appear automatically once the models and data are in place.
