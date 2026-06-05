# Public Website Feed Contract — v1

> **Audience**: FC Allschwil website team, external integrators.
> **Base URL**: Configured per environment via `NEXT_PUBLIC_API_BASE_URL`.
>   - STAGE: `https://stage-webapp.fcallschwil.ch`
>   - PROD:  `https://webapp.fcallschwil.ch`
>
> **Authentication**: None. All endpoints are public and read-only.
> **HTTP method**: GET only. Any other method returns `405 Method Not Allowed`.
> **Content-Type**: `application/json`.

---

## Table of Contents

1. [Overview](#overview)
2. [Tenant Resolution](#tenant-resolution)
3. [Response Envelope](#response-envelope)
4. [Error Responses](#error-responses)
5. [Endpoints](#endpoints)
   - [GET /api/public/v1/website/news](#get-apipublicv1websitenews)
   - [GET /api/public/v1/website/news/{slug}](#get-apipublicv1websitenewsslug)
6. [Type Reference](#type-reference)
7. [Integration Notes](#integration-notes)

---

## Overview

The `/api/public/v1/website/*` namespace exposes WebApp data for consumption by the
FC Allschwil website (separate Vercel project). The website is a **read-only** consumer;
the WebApp is the **single source of truth**.

Versioning is part of the path (`/v1/`). When a breaking change is required a new
version path (`/v2/`) will be introduced alongside the old one before the old one
is removed.

---

## Tenant Resolution

The API resolves which tenant to serve using the following priority order:

1. **`X-Tenant-Slug` request header** (explicit override, multi-tenant ready).
2. **Default tenant fallback** — `fc-allschwil` (current single-tenant setup).

The website STAGE environment must send:

```
X-Tenant-Slug: fc-allschwil
```

This header is optional today (the default fallback produces the same result) but
**must** be included to remain correct when multi-tenant support is introduced.

---

## Response Envelope

All successful responses share the same wrapper shape:

```json
{
  "version": "1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-08T14:30:00.000Z",
  "data": { ... },
  "meta": { ... }
}
```

| Field         | Type   | Description                                               |
|---------------|--------|-----------------------------------------------------------|
| `version`     | string | API contract version. Currently `"1"`.                    |
| `tenant.key`  | string | Tenant slug, URL-safe.                                    |
| `tenant.name` | string | Human-readable club name.                                 |
| `generatedAt` | string | ISO 8601 UTC timestamp of response generation.            |
| `data`        | object | Endpoint-specific payload (see individual endpoint docs). |
| `meta`        | object | Endpoint-specific metadata (counts, applied limits).      |

---

## Error Responses

### 404 — Tenant not found

```json
{ "error": "Tenant not found." }
```

### 403 — Website integration disabled

```json
{ "error": "Website integration is not enabled for this tenant." }
```

### 404 — Article not found / not published

```json
{ "error": "News article not found." }
```

### 405 — Method not allowed

Returned by the framework for non-GET requests. No JSON body guaranteed.

### 500 — Server error

```json
{ "error": "Technischer Fehler: <message>" }
```

---

## Endpoints

### GET /api/public/v1/website/news

Returns a paginated list of **published** news articles. The article body/content
is **intentionally excluded** from list responses for bandwidth and security.

#### Query parameters

| Parameter | Type   | Default | Description                                       |
|-----------|--------|---------|---------------------------------------------------|
| `limit`   | number | `20`    | Maximum number of articles returned (1–100).      |

#### Example request

```
GET /api/public/v1/website/news?limit=10
X-Tenant-Slug: fc-allschwil
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-08T14:30:00.000Z",
  "data": {
    "articles": [
      {
        "id": "clx1abc123",
        "slug": "saisonstart-2026",
        "title": "Saisonstart 2026 — Willkommen zurück!",
        "excerpt": "Nach der Sommerpause startet die neue Saison mit einem Heimspiel.",
        "imageUrl": "https://example.com/images/saisonstart-2026.jpg",
        "publishedAt": "2026-06-01T10:00:00.000Z"
      },
      {
        "id": "clx1def456",
        "slug": "neuer-trainer-vorstellung",
        "title": "Neuer Trainer vorgestellt",
        "excerpt": null,
        "imageUrl": null,
        "publishedAt": "2026-05-28T08:00:00.000Z"
      }
    ]
  },
  "meta": {
    "total": 2,
    "limit": 10
  }
}
```

#### Data shape — `data.articles[]`

| Field         | Type            | Description                               |
|---------------|-----------------|-------------------------------------------|
| `id`          | string          | Unique article identifier (cuid).         |
| `slug`        | string          | URL-safe identifier, unique per tenant.   |
| `title`       | string          | Article headline.                         |
| `excerpt`     | string \| null  | Short summary. Null when not provided.    |
| `imageUrl`    | string \| null  | Hero image URL. Null when not set.        |
| `publishedAt` | string (ISO 8601) | Publication timestamp (UTC).            |

**Note**: `content`/body is absent from list items by design.

---

### GET /api/public/v1/website/news/{slug}

Returns a single **published** news article including the full content/body.

#### Path parameters

| Parameter | Description                                |
|-----------|--------------------------------------------|
| `slug`    | URL-safe article identifier (e.g. `saisonstart-2026`). |

#### Example request

```
GET /api/public/v1/website/news/saisonstart-2026
X-Tenant-Slug: fc-allschwil
```

#### Example response (200)

```json
{
  "version": "1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-08T14:30:00.000Z",
  "data": {
    "article": {
      "id": "clx1abc123",
      "slug": "saisonstart-2026",
      "title": "Saisonstart 2026 — Willkommen zurück!",
      "excerpt": "Nach der Sommerpause startet die neue Saison mit einem Heimspiel.",
      "content": "## Saisonstart 2026\n\nDie neue Saison beginnt am Samstag, 13. Juni 2026 mit einem Heimspiel gegen den FC Beispiel. Alle Fans sind herzlich eingeladen!\n\n### Programm\n\n- 14:00 Uhr: Einlass\n- 15:00 Uhr: Anpfiff\n- 17:00 Uhr: After-Match-Reception im Clubhaus",
      "imageUrl": "https://example.com/images/saisonstart-2026.jpg",
      "publishedAt": "2026-06-01T10:00:00.000Z"
    }
  },
  "meta": {}
}
```

#### Data shape — `data.article`

| Field         | Type             | Description                                |
|---------------|------------------|--------------------------------------------|
| `id`          | string           | Unique article identifier (cuid).          |
| `slug`        | string           | URL-safe identifier, unique per tenant.    |
| `title`       | string           | Article headline.                          |
| `excerpt`     | string \| null   | Short summary. Null when not provided.     |
| `content`     | string           | Full article body (Markdown or plain text).|
| `imageUrl`    | string \| null   | Hero image URL. Null when not set.         |
| `publishedAt` | string (ISO 8601)| Publication timestamp (UTC).               |

#### Error cases

| Scenario                         | HTTP Status | Response body                          |
|----------------------------------|-------------|----------------------------------------|
| Slug not found                   | 404         | `{ "error": "News article not found." }` |
| Article exists but is DRAFT      | 404         | `{ "error": "News article not found." }` |
| Article exists but is ARCHIVED   | 404         | `{ "error": "News article not found." }` |
| Tenant not found                 | 404         | `{ "error": "Tenant not found." }`     |
| Website integration disabled     | 403         | `{ "error": "Website integration is not enabled for this tenant." }` |

---

## Type Reference

### `WebsiteResponseEnvelope<T>`

```typescript
type WebsiteResponseEnvelope<T> = {
  version: string;
  tenant: { key: string; name: string };
  generatedAt: string;   // ISO 8601 UTC
  data: T;
  meta: Record<string, unknown>;
};
```

### `PublicNewsArticleListItem`

```typescript
type PublicNewsArticleListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date;     // serialized as ISO 8601 string in JSON responses
};
```

### `PublicNewsArticleDetail`

```typescript
type PublicNewsArticleDetail = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  publishedAt: Date;     // serialized as ISO 8601 string in JSON responses
};
```

---

## Integration Notes

### FCA Website implementation checklist

- [ ] Send `X-Tenant-Slug: fc-allschwil` header on every request.
- [ ] Handle `404` on the detail endpoint — redirect to news list or show "not found" page.
- [ ] Handle `403` — display a maintenance or "not available" message.
- [ ] Do NOT cache 404 responses (draft articles may be published later).
- [ ] The `content` field contains Markdown. Use a Markdown renderer on the website.
- [ ] `publishedAt` is always a valid ISO 8601 UTC string for PUBLISHED articles.
- [ ] `excerpt` and `imageUrl` may be null — implement graceful fallbacks.
- [ ] Do not expose internal field `tenantId`, `status`, `createdAt`, or `updatedAt` (they are never sent by this API).

### Slug format

Article slugs are alphanumeric with hyphens, e.g. `saisonstart-2026`. They are
unique per tenant. Slugs may be used directly in website URLs:

```
https://www.fcallschwil.ch/news/saisonstart-2026
```

The website renders the slug route by calling:

```
GET /api/public/v1/website/news/saisonstart-2026
```

### Polling / caching

| Endpoint          | Recommended cache TTL  |
|-------------------|------------------------|
| List (`/news`)    | 60 seconds             |
| Detail (`/news/*`)| 60 seconds             |

These endpoints are not real-time. A 60-second stale window is acceptable for
news content. Avoid aggressive polling (< 30 seconds) to stay within API rate
limits.

### Environment parity

| Environment | API Base URL                        | Website URL                    |
|-------------|-------------------------------------|--------------------------------|
| STAGE       | `https://stage-webapp.fcallschwil.ch` | `https://stage.fcallschwil.ch` |
| PROD        | `https://webapp.fcallschwil.ch`     | `https://www.fcallschwil.ch`   |

Never mix environments. The STAGE website must only call the STAGE WebApp.
