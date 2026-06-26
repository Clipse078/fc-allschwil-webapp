# CMS Block Library

## CMS V2 Slice 3 — Homepage Block Library Foundation
## CMS V2 Slice 4 — Block Config Editor
## CMS V2 Slice 5 — Publishing Workflow Foundation

**Registry**: `lib/homepage/block-registry.ts`  
**Config schemas**: `lib/homepage/config-schemas.ts`  
**Admin config endpoint**: `PATCH /api/homepage-sections/[id]/config`  
**Admin publish endpoint**: `PATCH /api/homepage-sections/[id]/publish`  
**Admin unpublish endpoint**: `PATCH /api/homepage-sections/[id]/unpublish`  
**Admin schedule endpoint**: `PATCH /api/homepage-sections/[id]/schedule`  
**Admin preview endpoint**: `GET /api/homepage-sections/preview`

---

## Table of Contents

1. [Architecture (Slices 3–5)](#architecture-slices-35)
2. [Block Registry Design](#block-registry-design)
3. [Block Categories](#block-categories)
4. [Block Status Values](#block-status-values)
5. [Block Definitions](#block-definitions)
6. [Config Field Reference](#config-field-reference)
   - [hero](#hero)
   - [newsTeaser](#newsteaser)
   - [eventsTeaser](#eventsteaser)
   - [teamsTeaser](#teamsteaser)
   - [weekplanTeaser](#weekplanteaser)
   - [callToAction](#calltoaction)
   - [sponsorsTeaser](#sponsorsteaser-foundation-ready)
   - [customContentPlaceholder](#customcontentplaceholder-coming-next)
7. [Admin API — Config Editor (Slice 4)](#admin-api--config-editor-slice-4)
8. [Admin API — Publishing Workflow (Slice 5)](#admin-api--publishing-workflow-slice-5)
9. [Validation Rules](#validation-rules)
10. [Config Validation Strategy](#config-validation-strategy)
11. [Public Serialisation Strategy](#public-serialisation-strategy)
12. [Publishing Workflow Model](#publishing-workflow-model)
13. [Preview Safety Model](#preview-safety-model)
14. [Admin Block Library UI (Slice 3)](#admin-block-library-ui-slice-3)
15. [Navigation](#navigation)
16. [Duplication Audit](#duplication-audit)
17. [Deferred Future Work](#deferred-future-work)

---

## Architecture (Slices 3–5)

| Layer | File | Responsibility |
|-------|------|----------------|
| **Block registry** | `lib/homepage/block-registry.ts` | Single source of truth for all block metadata, configKeys, public projection |
| **Config schemas** | `lib/homepage/config-schemas.ts` | Zod strict schemas per block type; `validateSectionConfig()` dispatch |
| **Section types** | `lib/homepage/section-types.ts` | Thin adapter: DB type key constants + TS config shapes; derives arrays from registry |
| **Admin queries** | `lib/homepage/admin-queries.ts` | Tenant-scoped CRUD; publish/unpublish/schedule functions (Slice 5) |
| **Public feed** | `lib/homepage/public-homepage-feed.ts` | Published+enabled sections only; enriches with block metadata; projects config |
| **Admin API — list/bootstrap** | `/api/homepage-sections` | GET list, POST bootstrap |
| **Admin API — toggle/move** | `/api/homepage-sections/[id]/toggle`, `.../move` | Toggle enabled, reorder |
| **Admin API — config editor** | `/api/homepage-sections/[id]/config` | PATCH label + config (Slice 4) |
| **Admin API — publish** | `/api/homepage-sections/[id]/publish` | PATCH publish section (Slice 5) |
| **Admin API — unpublish** | `/api/homepage-sections/[id]/unpublish` | PATCH unpublish section (Slice 5) |
| **Admin API — schedule** | `/api/homepage-sections/[id]/schedule` | PATCH schedule future publish (Slice 5) |
| **Admin API — preview** | `/api/homepage-sections/preview` | GET all sections including drafts (admin-only, Slice 5) |
| **Public API** | `/api/public/[tenant]/website/homepage` | Returns published+enabled sections + block metadata |
| **Admin UI — builder** | `/dashboard/website/homepage` | Toggle / reorder / config edit / publish / unpublish / schedule sections |
| **Admin UI — library** | `/dashboard/website/blocks` | Read-only block library overview |
| **CMS hub** | `/dashboard/website` | Links to all CMS areas |
| **Nav** | `lib/nav/nav-config.ts` | Sidebar entries |

---

## Block Registry Design

### File: `lib/homepage/block-registry.ts`

The registry is the **single source of truth**. It exports:

- `BLOCK_CATEGORIES` — ordered array of category labels
- `BlockCategory` — TypeScript union type
- `BLOCK_STATUSES` — ordered array of status values
- `BlockStatus` — TypeScript union type
- `PublicBlockMeta` — public-safe block metadata (`category`, `datadriven`)
- `BlockDefinition` — full block definition type (includes `configKeys`)
- `BLOCK_REGISTRY` — array of all `BlockDefinition` objects (sorted by `defaultSortOrder`)
- `getBlockDefinition(type)` — lookup by type key
- `getPublicBlockMeta(type)` — returns `PublicBlockMeta | null`
- `projectBlockPublicConfig(type, config)` — applies public-safe config projection
- `getBlocksByCategory()` — returns `Map<BlockCategory, BlockDefinition[]>`

### Single source of truth rule

> **Never add block labels, descriptions, configKeys, or default configs outside `lib/homepage/block-registry.ts`.**

- `lib/homepage/section-types.ts` derives `HOMEPAGE_SECTION_TYPES` and `DEFAULT_HOMEPAGE_SECTIONS` by iterating `BLOCK_REGISTRY`. It does **not** re-expose `configKeys`.
- `lib/homepage/config-schemas.ts` defines Zod schemas aligned with each block's `configKeys`. The `CONFIG_SCHEMAS` map keys must match `HomepageSectionTypeKey`.
- `HomepageSectionList.tsx` calls `getBlockDefinition(section.type)?.configKeys` directly from the registry for the config editor field rendering.
- The public API calls `getPublicBlockMeta()` and `projectBlockPublicConfig()` from the registry.

---

## Block Categories

| Category | Purpose |
|----------|---------|
| `Header` | Top-of-page blocks (hero) |
| `Content` | Editorial content blocks (news teaser) |
| `Data-driven` | Blocks that auto-fetch from data sources (events, weekplan) |
| `Club` | Club-specific data blocks (teams) |
| `Sponsors` | Sponsor showcase blocks |
| `Conversion` | CTA and engagement blocks |
| `Utility` | Placeholder and future blocks |

---

## Block Status Values

| Status | Meaning |
|--------|---------|
| `available` | Fully functional; live data source exists |
| `foundation-ready` | API scaffolding ready; backing model not yet built |
| `coming-next` | Planned for next roadmap slice |

### Mapping to `HomepageSectionTypeDefinition.implementation`

| Block status | `implementation` |
|--------------|-----------------|
| `available` | `"available"` |
| `foundation-ready` | `"placeholder"` |
| `coming-next` | `"placeholder"` |

---

## Block Definitions

| Type key | Category | Status | Data-driven | Config keys |
|----------|----------|--------|-------------|-------------|
| `hero` | Header | available | No | `title`, `subtitle`, `ctaLabel`, `ctaUrl` |
| `newsTeaser` | Content | available | Yes | `itemCount`, `heading` |
| `eventsTeaser` | Data-driven | available | Yes | `itemCount`, `surface`, `heading` |
| `teamsTeaser` | Club | available | Yes | `itemCount`, `seasonKey`, `heading` |
| `weekplanTeaser` | Data-driven | available | Yes | `heading` |
| `callToAction` | Conversion | available | No | `title`, `body`, `primaryLabel`, `primaryUrl`, `secondaryLabel`, `secondaryUrl` |
| `sponsorsTeaser` | Sponsors | foundation-ready | Yes | `heading` |
| `customContentPlaceholder` | Utility | coming-next | No | _(none)_ |

---

## Config Field Reference

All config fields are optional. The public website renderer must use sensible
defaults when a field is absent.

### `hero`

Full-width banner with headline, subtitle, and optional CTA button.

| Key | Type | Max | Description |
|-----|------|-----|-------------|
| `title` | `string?` | 200 | Main hero headline. Falls back to tenant name when absent. |
| `subtitle` | `string?` | 500 | Supporting subtitle text. |
| `ctaLabel` | `string?` | 100 | CTA button label. |
| `ctaUrl` | `string?` | 2000 | CTA button URL (absolute or site-relative). |

**Example**:
```json
{
  "title": "Willkommen beim FC Allschwil",
  "subtitle": "Leidenschaft für Fussball seit 1921.",
  "ctaLabel": "Jetzt Mitglied werden",
  "ctaUrl": "https://fcallschwil.ch/mitgliedschaft"
}
```

---

### `newsTeaser`

Grid of the latest published news articles.

| Key | Type | Range | Description |
|-----|------|-------|-------------|
| `itemCount` | `number?` | 1–10 | Articles to display. Default: `3`. |
| `heading` | `string?` | max 200 | Section heading override. |

**Example**:
```json
{ "itemCount": 4, "heading": "Aktuelles" }
```

---

### `eventsTeaser`

Upcoming events and matches with website visibility.

| Key | Type | Values / Range | Description |
|-----|------|----------------|-------------|
| `itemCount` | `number?` | 1–20 | Events to display. Default: `5`. |
| `surface` | `string?` | `"homepage"` \| `"all"` | Surface filter. Default: `"homepage"`. |
| `heading` | `string?` | max 200 | Section heading override. |

**Example**:
```json
{ "itemCount": 6, "surface": "all", "heading": "Spielplan" }
```

---

### `teamsTeaser`

Grid of active, website-visible teams.

| Key | Type | Range | Description |
|-----|------|-------|-------------|
| `itemCount` | `number?` | 1–20 | Teams to display. Default: `6`. |
| `seasonKey` | `string?` | max 100 | Season key override. Defaults to active season. |
| `heading` | `string?` | max 200 | Section heading override. |

**Example**:
```json
{ "itemCount": 8, "heading": "Unsere Mannschaften" }
```

---

### `weekplanTeaser`

Summary of the current week's training and match schedule.

| Key | Type | Max | Description |
|-----|------|-----|-------------|
| `heading` | `string?` | 200 | Section heading override. |

**Example**:
```json
{ "heading": "Diese Woche" }
```

---

### `callToAction`

Configurable CTA banner with headline, body text, and up to two buttons.

| Key | Type | Max | Description |
|-----|------|-----|-------------|
| `title` | `string?` | 200 | CTA headline. |
| `body` | `string?` | 2000 | CTA body text (no HTML). |
| `primaryLabel` | `string?` | 100 | Primary button label. |
| `primaryUrl` | `string?` | 2000 | Primary button URL. |
| `secondaryLabel` | `string?` | 100 | Optional secondary button label. |
| `secondaryUrl` | `string?` | 2000 | Optional secondary button URL. |

**Example**:
```json
{
  "title": "Werde Mitglied",
  "body": "Tritt dem FC Allschwil bei und sei dabei.",
  "primaryLabel": "Jetzt anmelden",
  "primaryUrl": "/anmeldung",
  "secondaryLabel": "Mehr erfahren",
  "secondaryUrl": "/verein"
}
```

---

### `sponsorsTeaser` (foundation-ready)

Sponsor showcase. **No Sponsor DB model exists yet.** Config is editable but
the section will not render meaningful content until the Sponsor model is
introduced in a future slice.

| Key | Type | Max | Description |
|-----|------|-----|-------------|
| `heading` | `string?` | 200 | Section heading override. |

---

### `customContentPlaceholder` (coming-next)

Reserved for future block-based rich content. **No config fields.** Any
submitted config will be rejected (`z.object({}).strict()` — all keys unknown).

---

## Admin API — Config Editor (Slice 4)

### `PATCH /api/homepage-sections/[id]/config`

Updates the **label** and/or **config** of a single homepage section.

**Authentication**: Session cookie (`WEBSITE_MANAGE` permission required).  
**Tenant isolation**: `tenantId` sourced from session — never from request body.

**Request body** (all fields optional; at least one required):

```json
{
  "label": "Updated Label",
  "config": { "itemCount": 5, "heading": "Aktuelles" }
}
```

**Response** (`200 OK`):

```json
{
  "section": {
    "id": "clxxx...",
    "tenantId": "...",
    "type": "newsTeaser",
    "label": "Updated Label",
    "sortOrder": 10,
    "isEnabled": true,
    "config": { "itemCount": 5, "heading": "Aktuelles" },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error responses**:

| Status | When |
|--------|------|
| `400` | Missing both `label` and `config`; non-object `config`; empty `label`; `label` > 200 chars |
| `401` | No session / no `tenantId` in session |
| `403` | Session missing `WEBSITE_MANAGE` permission |
| `404` | Section not found or belongs to different tenant |
| `422` | Config validation failed (unknown keys, wrong type, out-of-range value) |

**422 example** (unknown key):
```json
{ "error": "Ungültige Konfiguration.", "details": ["Unrecognized key: \"unknownField\""] }
```

**422 example** (out-of-range value):
```json
{ "error": "Ungültige Konfiguration.", "details": ["itemCount: Number must be less than or equal to 10"] }
```

---

## Validation Rules

All config updates are validated by `lib/homepage/config-schemas.ts` using Zod **strict mode**:

1. **Unknown keys are rejected** — any key not in the block's `configKeys` list → `422` with `"Unrecognized key"`.
2. **No type coercion** — `"itemCount": "3"` (string) fails; must be `"itemCount": 3` (number).
3. **Range enforcement** — number fields enforce documented min/max per type.
4. **Enum enforcement** — `surface` must be `"homepage"` or `"all"`.
5. **Empty strings are safe** — serialiser strips them; not stored in DB.
6. **Full-replace semantics** — `config` is replaced entirely (not merged). Omitting a key removes it.
7. **`customContentPlaceholder` config must be `{}`** — any key is rejected.

---

## Config Validation Strategy

**Slice 3 foundation:** Config shapes were TypeScript interfaces only (informational, no runtime enforcement).

**Slice 4 implementation:** Full Zod validation added in `lib/homepage/config-schemas.ts`:
- Per-type schemas (`heroConfigSchema`, `newsTeaserConfigSchema`, …)
- `CONFIG_SCHEMAS` map keyed by `HomepageSectionTypeKey`
- `validateSectionConfig(type, rawConfig)` dispatch helper
- All schemas use `.strict()` — unknown keys rejected with clear error messages
- `configKeys` in `block-registry.ts` are the authoritative list; schemas are aligned with them

---

## Public Serialisation Strategy

The public homepage API (`GET /api/public/[tenant]/website/homepage`) enriches each section item with public-safe block metadata:

```json
{
  "id": "...",
  "type": "hero",
  "label": "Hero-Bereich",
  "sortOrder": 0,
  "config": {},
  "block": { "category": "Header", "datadriven": false }
}
```

**Privacy guarantees:**
- `tenantId`, `createdAt`, `updatedAt`, `isEnabled` never exposed.
- `block` field contains only `category` and `datadriven` — no admin labels, internal status, or admin-only metadata.
- Section `config` is routed through `projectBlockPublicConfig()` before serialisation.
- `block` is `null` for unregistered type keys (safe fallback).

**Backwards compatibility:** `block` field added in Slice 3. Existing consumers that don't reference `block` safely ignore it.

---

## Admin Block Library UI (Slice 3)

**Route:** `/dashboard/website/blocks`  
**Permission:** `WEBSITE_MANAGE`  
**Type:** Server component (read-only, no client state)

Renders all blocks from `BLOCK_REGISTRY` grouped by category. For each block:
- Display name and type key (monospace)
- Status badge (available / foundation-ready / coming-next)
- Category badge
- Data-driven / manually configured indicator
- Config keys as inline code badges
- Description

Navigation links to CMS overview and Homepage Builder.

---

## Navigation

Both `Homepage Builder` and `Block-Bibliothek` are in the Website sidebar:

```
Website
  ├─ CMS Übersicht
  ├─ News
  ├─ Seiten
  ├─ Homepage Builder       ← added in Slice 2
  ├─ Block-Bibliothek       ← added in Slice 3
  ├─ Medien
  ├─ Veröffentlichungen
  └─ Einstellungen
```

---

## Duplication Audit

| Previously duplicated | Resolution |
|-----------------------|------------|
| Block labels in `section-types.ts` + `DEFAULT_HOMEPAGE_SECTIONS` | Derived from `BLOCK_REGISTRY.displayName` (Slice 3) |
| Default configs in `HOMEPAGE_SECTION_TYPES` + `DEFAULT_HOMEPAGE_SECTIONS` | Derived from `BLOCK_REGISTRY.defaultConfig` (Slice 3) |
| `configKeys` in `section-types.ts` (Slice 4 initial) | Removed; sourced from `BLOCK_REGISTRY.configKeys` only (Slice 4 rebase) |
| Implementation status | Derived from `BLOCK_REGISTRY.status` (Slice 3) |
| Sort order + enabled flag | Derived from `BLOCK_REGISTRY.defaultSortOrder` / `defaultEnabled` (Slice 3) |

---

## Admin API — Publishing Workflow (Slice 5)

### `PATCH /api/homepage-sections/[id]/publish`

Sets `publishStatus = "PUBLISHED"`, records `publishedAt` and `lastPublishedAt`, clears `scheduledPublishAt`.

**Authentication**: Session cookie (`WEBSITE_MANAGE` required).  
**Tenant isolation**: `tenantId` from session only.

### `PATCH /api/homepage-sections/[id]/unpublish`

Sets `publishStatus = "DRAFT"`, records `unpublishedAt`, retains `lastPublishedAt`, clears `scheduledPublishAt`.

### `PATCH /api/homepage-sections/[id]/schedule`

Sets `scheduledPublishAt` to a future date. Section remains `DRAFT` but the public API treats it as published once `scheduledPublishAt <= now()`.

**Request body**: `{ "scheduledPublishAt": "<ISO 8601 datetime>" }`  
**Constraint**: `scheduledPublishAt` must be in the future.

### `GET /api/homepage-sections/preview`

Returns ALL sections for the tenant regardless of `publishStatus` or `isEnabled`. Includes `isDraft`, `isDisabled`, and `scheduledPublishAt` fields.

**Authentication**: Session cookie (`WEBSITE_MANAGE` required). NOT publicly accessible.

---

## Publishing Workflow Model

### Status values

| `publishStatus` | Meaning |
|-----------------|---------|
| `DRAFT` | Section is not published; excluded from public API unless `scheduledPublishAt <= now()` |
| `PUBLISHED` | Section is published; visible in public API if also `isEnabled = true` |

### Public API visibility rule (gate combination)

A section appears in `GET /api/public/[tenant]/website/homepage` if and only if:

```
isEnabled = true
AND (publishStatus = "PUBLISHED" OR scheduledPublishAt <= now())
```

### Backwards compatibility

- Migration default: `publishStatus = "PUBLISHED"` — all pre-Slice-5 rows retain their current public visibility.
- No manual action required after migration.

### Audit fields

| Field | Written by | Purpose |
|-------|-----------|---------|
| `publishedAt` | Publish action | Most recent publish timestamp |
| `unpublishedAt` | Unpublish action | Most recent unpublish timestamp |
| `lastPublishedAt` | Publish action | Most recent publish (not cleared on unpublish) |
| `scheduledPublishAt` | Schedule action | Future publish date; cleared on publish/unpublish |

### Governance — coming next

Full review/approval workflow (four-eyes, assignment, `reviewStatus`) is deferred to a future CMS slice. The `publishStatus` field and admin actions form the foundation.

---

## Preview Safety Model

The admin preview endpoint (`GET /api/homepage-sections/preview`) is:

- **Not publicly accessible** — requires `WEBSITE_MANAGE` session permission.
- **Tenant-isolated** — `tenantId` sourced from session only.
- Returns draft sections with `isDraft: true` indicator so UI can visually mark them.

The **public homepage API** (`GET /api/public/[tenant]/website/homepage`) **never** returns:

- Sections with `publishStatus = "DRAFT"` (unless `scheduledPublishAt <= now()`)
- `publishStatus` field
- `publishedAt`, `unpublishedAt`, `lastPublishedAt`, `scheduledPublishAt` fields
- `isEnabled` field
- `tenantId`, `createdAt`, `updatedAt` fields

---

## Deferred Future Work

| Feature | Notes |
|---------|-------|
| Sponsor model | `sponsorsTeaser` foundation-ready; full impl needs `Sponsor` DB model |
| Rich text for `callToAction.body` | Plain text only; no HTML/Markdown |
| Block-based content | `customContentPlaceholder` coming-next; needs block model + visual editor |
| Review/approval workflow | Four-eyes approval, `reviewStatus` field, assignment workflow — Slice 6+ |
| Background scheduler worker | Pro-active `publishStatus` flip at `scheduledPublishAt`; currently handled at query time |
| Navigation management | Separate CMS feature |
| Redirect management | Separate CMS feature |
| Drag-and-drop reorder | Currently up/down buttons only |
| Block preview rendering | Live preview of block in admin UI |
| Block version history | Track config changes over time |
| Additional block types | Social feed, gallery, contact form, map, etc. |
