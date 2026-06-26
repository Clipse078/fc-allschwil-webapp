# CMS Navigation Management — SportClubEvo WebApp

> **Slice**: CMS V2 Slice 7 — Navigation Management Foundation
> **Status**: Foundation
> **Route**: `/dashboard/website/navigation`
> **Permission**: `website.manage`

---

## Table of Contents

1. [Overview](#overview)
2. [Navigation Model](#navigation-model)
3. [Areas](#areas)
4. [Link Types](#link-types)
5. [Targets](#targets)
6. [Visibility](#visibility)
7. [Hierarchy Rules](#hierarchy-rules)
8. [Admin API](#admin-api)
9. [Public API](#public-api)
10. [Default Navigation Bootstrap](#default-navigation-bootstrap)
11. [Tenant Isolation](#tenant-isolation)
12. [Permission Audit](#permission-audit)
13. [Privacy Audit](#privacy-audit)
14. [Deferred Work](#deferred-work)

---

## Overview

Navigation Management allows tenants to manage website navigation structure from the WebApp CMS. Tenants can:

- Manage header and footer navigation menus
- Add internal links (relative paths), external links (URLs), and custom links
- Create multi-level menu hierarchy (up to 2 levels deep: parent + child)
- Control visibility per item
- Reorder items within their area/parent group
- Bootstrap default navigation from a curated starting point
- Expose navigation via the public website API

---

## Navigation Model

```
WebsiteNavItem {
  id              String    — CUID
  tenantId        String    — Tenant scoping (required, never exposed publicly)
  parentId        String?   — Nullable self-FK for hierarchy (SetNull on parent delete)
  area            String    — "HEADER" | "FOOTER" | "UTILITY"
  label           String    — Display label (max 120 chars)
  linkType        String    — "INTERNAL" | "EXTERNAL" | "CUSTOM"
  href            String?   — URL or path (null allowed for CUSTOM parent-only items)
  target          String    — "SELF" | "BLANK" (default: SELF)
  sortOrder       Int       — Ascending display order within parent/area
  isVisible       Boolean   — Primary visibility gate (default: true)
  visibilityMode  String    — "ALWAYS" | "AUTHENTICATED" | "ANONYMOUS" (default: ALWAYS)
  createdAt       DateTime
  updatedAt       DateTime
}
```

**Relations:**
- `tenant` → `Tenant` (cascade delete)
- `parent` → `WebsiteNavItem` (self-reference, SetNull on delete)
- `children` → `WebsiteNavItem[]`

---

## Areas

| Value | Label | Use |
|-------|-------|-----|
| `HEADER` | Header-Navigation | Primary website navigation bar |
| `FOOTER` | Footer-Navigation | Footer links |
| `UTILITY` | Utility-Navigation | Secondary utility bar (optional) |

---

## Link Types

| Value | Label | Constraint |
|-------|-------|-----------|
| `INTERNAL` | Interner Link | Must start with `/` |
| `EXTERNAL` | Externer Link | Must start with `https://` or `http://` |
| `CUSTOM` | Eigener Link | Any string; may be null for parent-only items |

---

## Targets

| Value | HTML equivalent | Label |
|-------|----------------|-------|
| `SELF` | `_self` | Gleicher Tab (default) |
| `BLANK` | `_blank` | Neuer Tab |

---

## Visibility

| Field | Gate | Behaviour |
|-------|------|-----------|
| `isVisible` | Primary | `false` → hidden from public API |
| `visibilityMode` | Foundation | `ALWAYS`, `AUTHENTICATED`, `ANONYMOUS` — currently public API uses isVisible only |

**Note**: `visibilityMode` is stored for future use. The current public API only filters by `isVisible=true`. Full visibility personalisation (e.g. authenticated-only links) is deferred.

---

## Hierarchy Rules

- Maximum depth: **2 levels** (root + one child level).
- A child item's `parentId` must reference a top-level item (parentId = null) in the **same area**.
- Circular parent references are rejected at the API layer.
- Deleting a parent with children is **blocked** — children must be removed or reassigned first (or parent's `onDelete: SetNull` applies at DB level if hard-deleted by admin directly).
- When a parent is soft-deleted via the admin API, the operation is blocked if children exist.
- When `parentId` references a deleted item, Prisma `SetNull` automatically promotes children to top-level within their area.

---

## Admin API

All admin endpoints require `website.manage` permission.
`tenantId` is always taken from the authenticated session — never from the request body.

### GET /api/website-navigation

Returns all navigation items grouped by area with hierarchy.

**Response:**
```json
{
  "areas": {
    "HEADER": [ /* NavItemTree[] */ ],
    "FOOTER": [ /* NavItemTree[] */ ],
    "UTILITY": [ /* NavItemTree[] */ ]
  },
  "meta": { "total": 10 }
}
```

Each `NavItemTree` item has:
```json
{
  "id": "...",
  "tenantId": "...",
  "parentId": null,
  "area": "HEADER",
  "label": "News",
  "linkType": "INTERNAL",
  "href": "/news",
  "target": "SELF",
  "sortOrder": 1,
  "isVisible": true,
  "visibilityMode": "ALWAYS",
  "createdAt": "...",
  "updatedAt": "...",
  "children": [ /* nested NavItemTree[] */ ]
}
```

### POST /api/website-navigation

Creates a new navigation item.

**Body:**
```json
{
  "label": "News",
  "area": "HEADER",
  "linkType": "INTERNAL",
  "href": "/news",
  "target": "SELF",
  "isVisible": true,
  "visibilityMode": "ALWAYS",
  "parentId": null
}
```

**Response:** `201 { item: NavItemAdminRow }`

**Bootstrap:** `POST /api/website-navigation?bootstrap=1`
Creates default navigation entries if no items exist yet. Returns `409` if items already exist.

### PATCH /api/website-navigation/[id]

Updates a navigation item. All fields are optional.

**Body:** Same fields as POST, all optional.

**Response:** `200 { item: NavItemAdminRow }`

**Error codes:**
- `NOT_FOUND` → 404
- `VALIDATION` → 400
- `INVALID_AREA` / `INVALID_LINK_TYPE` / `INVALID_TARGET` / `INVALID_VISIBILITY_MODE` → 400
- `PARENT_NOT_FOUND` → 404
- `PARENT_WRONG_AREA` → 400
- `CIRCULAR_PARENT` → 422
- `MAX_DEPTH` → 422

### PATCH /api/website-navigation/[id]/move

Moves an item up or down within its parent/area group.

**Body:** `{ "direction": "up" | "down" }`

**Response:** `200 { items: NavItemAdminRow[], meta: { total } }`

Returns 404 if the item is already at the boundary or not found.

### PATCH /api/website-navigation/[id]/toggle

Toggles `isVisible` for an item.

**Response:** `200 { item: NavItemAdminRow }`

### DELETE /api/website-navigation/[id]

Deletes an item. Blocked if the item has children.

**Response:** `200 { deleted: true }`

**Error codes:**
- `NOT_FOUND` → 404
- `HAS_CHILDREN` → 409

---

## Public API

### GET /api/public/[tenant]/website/navigation

Returns the visible navigation tree for the tenant.

**Authentication:** None (public endpoint)

**Tenant resolution:** URL path segment (e.g., `/api/public/fc-allschwil/website/navigation`)

**Filtering:** `isVisible = true` only

**Order:** area (asc), parentId (nulls first), sortOrder (asc)

**Response:**
```json
{
  "version": "1",
  "tenant": {
    "key": "fc-allschwil",
    "name": "FC Allschwil"
  },
  "generatedAt": "2026-06-26T18:00:00.000Z",
  "data": {
    "areas": {
      "header": [
        {
          "id": "...",
          "parentId": null,
          "area": "HEADER",
          "label": "Startseite",
          "linkType": "INTERNAL",
          "href": "/",
          "target": "SELF",
          "sortOrder": 0,
          "children": []
        }
      ],
      "footer": [ /* ... */ ],
      "utility": []
    }
  },
  "meta": { "total": 8 }
}
```

**Error responses:**
- `404` → Tenant not found
- `403` → Website integration disabled for this tenant

**Privacy contract:**
- `tenantId` is **never** exposed
- `createdAt` / `updatedAt` are **never** exposed
- `visibilityMode` is **never** exposed (admin-only field)
- Only `isVisible=true` items appear
- Response shape is consistent with all other `/api/public/[tenant]/website/*` endpoints

---

## Default Navigation Bootstrap

When a tenant has no navigation items, they can load a default set via:

```
POST /api/website-navigation?bootstrap=1
```

Or via the admin UI "Standard-Navigation laden" button.

**Default header items:**
- Startseite → `/`
- News → `/news`
- Teams → `/teams`
- Spielplan → `/spielplan`
- Wochenplan → `/wochenplan`
- Verein → `/verein`

**Default footer items:**
- Startseite → `/`
- News → `/news`
- Datenschutz → `/datenschutz`
- Impressum → `/impressum`

All defaults use `linkType: INTERNAL`, `target: SELF`, `isVisible: true`, `visibilityMode: ALWAYS`.

---

## Tenant Isolation

- Every query filters by `tenantId` from the authenticated session.
- Parent validation checks `parentId` belongs to same `tenantId`.
- Cross-tenant parent references are rejected with `PARENT_NOT_FOUND`.
- Public API uses `tenant` path segment resolved via `resolveTenantFromParams()`.
- `tenantId` is never accepted from request bodies.
- `tenantId` is never exposed in public API responses.

---

## Permission Audit

| Endpoint | Required permission |
|----------|-------------------|
| `GET /api/website-navigation` | `website.manage` |
| `POST /api/website-navigation` | `website.manage` |
| `PATCH /api/website-navigation/[id]` | `website.manage` |
| `PATCH /api/website-navigation/[id]/move` | `website.manage` |
| `PATCH /api/website-navigation/[id]/toggle` | `website.manage` |
| `DELETE /api/website-navigation/[id]` | `website.manage` |
| `/dashboard/website/navigation` (page) | `website.manage` |
| `GET /api/public/[tenant]/website/navigation` | None (public) |

---

## Privacy Audit

Fields **never** exposed on public API:
- `tenantId`
- `createdAt`
- `updatedAt`
- `visibilityMode`

Fields exposed on public API (intentional, not private):
- `id` — stable opaque ID for keying
- `parentId` — enables client-side hierarchy reconstruction
- `area` — enables client to place items in correct menu slot
- `label`, `linkType`, `href`, `target`, `sortOrder` — display/navigation fields

---

## Deferred Work

| Feature | Notes |
|---------|-------|
| Drag-and-drop reordering | No `dndkit` dependency added; use up/down buttons for now |
| Visual menu builder | Deferred; foundation-level list UI only |
| Mega menu editor | Deferred |
| Full `ROLE_BASED` visibility | `requiredPermission` field deferred; `visibilityMode` stored but not enforced publicly |
| `pageId` FK to WebsitePage | Deferred; `href` accepts `/slug` paths manually |
| Public personalisation (auth-aware nav) | Deferred |
| SEO management | Out of scope for this slice |
| Redirect management | Out of scope for this slice |
