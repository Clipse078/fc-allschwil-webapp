# CMS V2 — Page Builder Foundation (Slice 8)

> Introduced in CMS V2 Slice 8. Builds on top of Slices 1–7.

## Overview

Slice 8 introduces the **Website Pages V2 / Page Builder Foundation**: the architecture and first
usable foundation that allows tenant admins to compose full website pages from reusable CMS blocks.

This is a **foundation slice only**. It establishes the data model, APIs, and admin UI skeleton.
A full visual page builder, drag-and-drop editor, and section-level workflow are explicitly deferred
to future slices.

---

## Architecture

### Relationship to Homepage Builder

| Area | Homepage Builder (Slices 2–6) | Page Builder (Slice 8) |
|------|-------------------------------|------------------------|
| Model | `HomepageSection` (tenant-scoped) | `WebsitePageSection` (page-scoped) |
| Scope | Global homepage (one per tenant) | Any `WebsitePage` (one builder per page) |
| Block registry | `lib/homepage/block-registry.ts` | **Same registry** (shared, no duplication) |
| Config schemas | `lib/homepage/config-schemas.ts` | **Same schemas** (shared, no duplication) |
| Publishing workflow | Full (publishStatus, scheduledPublishAt, approvalStatus) | Slice 8: inherits page status (deferred) |

The block registry (`lib/homepage/block-registry.ts`) is the **single source of truth** for all CMS
block types in both the homepage builder and the page builder.

---

## Data Model

### `WebsitePageSection`

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `id` | `String` @id | cuid() | Primary key |
| `tenantId` | `String` | (required) | Tenant FK (cascade delete) |
| `pageId` | `String` | (required) | Page FK (cascade delete) |
| `type` | `String` | (required) | Block type key (from block registry) |
| `label` | `String` | (required) | Admin display label (editable) |
| `sortOrder` | `Int` | 0 | Display order (ascending) |
| `isEnabled` | `Boolean` | true | Public API visibility gate |
| `config` | `Json` | {} | Type-specific configuration (JSON) |
| `createdAt` | `DateTime` | now() | — |
| `updatedAt` | `DateTime` | @updatedAt | — |

**Indexes:** `[tenantId]`, `[tenantId, pageId]`, `[tenantId, pageId, sortOrder]`, `[tenantId, pageId, isEnabled]`

### Publishing Strategy (Slice 8 — foundation)

Section visibility on the public API requires **both**:
1. `isEnabled = true` (section gate)
2. Parent `WebsitePage.status = "PUBLISHED"` AND `publishedAt <= now()` (page gate)

Sections do **not** carry their own `publishStatus` in this slice. Full section-level
publish/approval workflow (mirrors `HomepageSection`) is deferred to a future slice.

This strategy is intentional and documented:
- Simple and safe for a foundation slice
- No duplication of the complex approval system
- Clear upgrade path when section-level workflow is needed

---

## Block Registry Reuse

The existing block registry (`lib/homepage/block-registry.ts`) is used without modification.

In Slice 8, the registry comment was updated to reflect its role as the **shared CMS block
registry** — used by both `HomepageSection` and `WebsitePageSection`.

**No parallel registry was created.** There is no duplication of:
- Block display names or descriptions
- Default configs
- Config schemas
- Public projections
- Icons

---

## Admin UI

### Route: `/dashboard/website/pages/[id]/builder`

Foundation-safe admin Page Builder:
- Lists all sections for the selected page
- Shows section type (from block registry), label, enabled/disabled status, sortOrder
- Create a new section from existing block types (all non–coming-next types)
- Edit section label and config (inline key-value form per config keys)
- Enable/disable toggle
- Move up/down (sortOrder swap)
- Delete section (with confirmation)
- Link back to existing page edit screen

### Pages List: `/dashboard/website/pages`

A **Builder** action (Blocks icon) is shown for each page, linking to
`/dashboard/website/pages/[id]/builder`.

Existing edit, publish, and delete actions are unchanged.

---

## Admin API

All routes require `WEBSITE_MANAGE` permission. `tenantId` is always from the authenticated
session — never from the request body. Page ownership is verified by `tenantId + pageId`.

### `GET /api/website-pages/[id]/sections`

List all sections for a page.

**Response:**
```json
{
  "sections": [
    {
      "id": "clxxx",
      "tenantId": "...",
      "pageId": "...",
      "type": "hero",
      "label": "Hero-Bereich",
      "sortOrder": 0,
      "isEnabled": true,
      "config": { "title": "Willkommen" },
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "meta": { "total": 1 }
}
```

### `POST /api/website-pages/[id]/sections`

Create a new section.

**Body:**
```json
{
  "type": "hero",
  "label": "Mein Hero",
  "config": { "title": "Willkommen" }
}
```

- `type` required; must be a registered block type
- `label` optional (defaults to block display name)
- `config` optional (defaults to block's defaultConfig)
- Config validated via shared `validateSectionConfig()`

**Response:** `201 { section }`

### `PATCH /api/website-pages/[id]/sections/[sectionId]`

Update label and/or config.

**Body:**
```json
{
  "label": "Neues Label",
  "config": { "title": "Neuer Titel" }
}
```

**Response:** `200 { section }`

### `PATCH /api/website-pages/[id]/sections/[sectionId]/move`

Move section up or down.

**Body:**
```json
{ "direction": "up" }
```

**Response:** `200 { sections }` — full updated section list.

### `PATCH /api/website-pages/[id]/sections/[sectionId]/toggle`

Toggle `isEnabled`.

**Response:** `200 { section }`

### `DELETE /api/website-pages/[id]/sections/[sectionId]`

Delete a section.

**Response:** `204 No Content`

---

## Public Layout API

### `GET /api/public/[tenant]/website/pages/[slug]/layout`

Returns the block-based layout of a published page for unauthenticated public consumers.

**Important:** This endpoint is **additive** and does **not** replace the existing
`GET /api/public/v1/website/pages/[slug]` endpoint. Both coexist:
- `v1/website/pages/[slug]` — returns raw Markdown body (unchanged, backward compatible)
- `[tenant]/website/pages/[slug]/layout` — returns block-based layout (new in Slice 8)

**Tenant resolution:** from URL path (`[tenant]` segment)

**Public visibility rules:**
- Page must be `status=PUBLISHED` AND `publishedAt <= now()`
- Only sections with `isEnabled=true` are returned

**Privacy guarantees:**
- No `tenantId` exposed
- No `createdAt` / `updatedAt`
- No approval metadata
- No draft/private fields
- Section config projected through block registry's `projectPublicConfig()`

**Response (standard v2 envelope):**
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
        "config": { "title": "Willkommen beim FC Allschwil" },
        "block": { "category": "Header", "datadriven": false }
      }
    ]
  },
  "meta": { "sectionCount": 1 }
}
```

**Error responses:**
- `404` — unknown tenant
- `403` — website not enabled for tenant
- `404` — page not found or not published

---

## Tenant Isolation Audit

| Layer | Isolation method |
|-------|-----------------|
| Admin API | `tenantId` from `access.session.user.tenantId` only |
| Page ownership | `getPageForTenant(tenantId, pageId)` verifies ownership |
| Section ownership | All queries filter by `{ tenantId, pageId }` |
| Public API | Tenant from URL path via `resolveTenantFromParams()` |
| Public page lookup | `where: { tenantId, slug }` (tenant-scoped) |

---

## Permissions Audit

| Endpoint | Permission required |
|----------|-------------------|
| `GET /api/website-pages/[id]/sections` | `WEBSITE_MANAGE` |
| `POST /api/website-pages/[id]/sections` | `WEBSITE_MANAGE` |
| `PATCH /api/website-pages/[id]/sections/[sectionId]` | `WEBSITE_MANAGE` |
| `PATCH .../move` | `WEBSITE_MANAGE` |
| `PATCH .../toggle` | `WEBSITE_MANAGE` |
| `DELETE /api/website-pages/[id]/sections/[sectionId]` | `WEBSITE_MANAGE` |
| `GET /api/public/[tenant]/website/pages/[slug]/layout` | None (public) |
| `/dashboard/website/pages/[id]/builder` | `WEBSITE_MANAGE` |

---

## Deferred Future Work

The following is intentionally out of scope for Slice 8:

1. **Section-level publishing workflow** — `publishStatus`, `scheduledPublishAt` per section
2. **Section-level approval workflow** — `approvalStatus`, `reviewerUserId`, etc.
3. **Visual drag-and-drop** — reorder sections by dragging
4. **Live visual preview** — preview the page as rendered on the public website
5. **Rich text editor** — for `customContentPlaceholder` block type
6. **Template marketplace** — page templates and starter layouts
7. **Page section version history** — track config changes per section
8. **Section-level scheduling** — schedule individual sections to appear/disappear

---

## Backwards Compatibility

All existing routes and APIs remain unchanged:

- `/dashboard/website`, `/dashboard/website/pages`, `/dashboard/website/homepage`, etc.
- `GET /api/public/v1/website/pages/[slug]` — returns Markdown body (unchanged)
- `GET /api/public/[tenant]/website/homepage` — unchanged
- `GET /api/public/[tenant]/website/navigation` — unchanged
- All `HomepageSection` admin APIs — unchanged
- All `WebsiteNavItem` admin APIs — unchanged
- All `WebsitePage` admin APIs — unchanged

The `WebsitePage` model is extended with a `sections` relation only (no field changes).
