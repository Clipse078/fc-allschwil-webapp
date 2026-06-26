# CMS Block Library Architecture

## CMS V2 Slice 3 — Homepage Block Library Foundation

**Status**: Foundation implemented  
**Route**: `/dashboard/website/blocks`  
**Registry**: `lib/homepage/block-registry.ts`

---

## Overview

The Homepage Block Library Foundation introduces a canonical, reusable block architecture for homepage sections. All block type metadata (labels, descriptions, categories, statuses, default configs, and public config projection) are centralised in a single registry — `lib/homepage/block-registry.ts`. No duplication exists in any other module.

This slice establishes the architecture and admin overview without implementing the full visual block editor (deferred).

---

## Current State After Slice 3

| Layer | File | Responsibility |
|-------|------|----------------|
| **Block registry** | `lib/homepage/block-registry.ts` | Single source of truth for all block metadata |
| **Section types** | `lib/homepage/section-types.ts` | Thin adapter: DB type key constants + TS config shapes; derives arrays from registry |
| **Admin queries** | `lib/homepage/admin-queries.ts` | Tenant-scoped CRUD for HomepageSection rows |
| **Public feed** | `lib/homepage/public-homepage-feed.ts` | Enabled sections only; enriches with block metadata; projects config |
| **Admin API** | `/api/homepage-sections` | List, bootstrap, toggle, move |
| **Public API** | `/api/public/[tenant]/website/homepage` | Returns sections + block metadata |
| **Admin UI — builder** | `/dashboard/website/homepage` | Toggle / reorder sections |
| **Admin UI — library** | `/dashboard/website/blocks` | Read-only block library overview |
| **CMS hub** | `/dashboard/website` | Links to all CMS areas including blocks |
| **CMS routes** | `lib/cms/routes.ts` | Route constants (added `blocks`) |
| **CMS sections** | `lib/cms/sections.ts` | Feature map (blocks promoted to `foundation`) |
| **Nav** | `lib/nav/nav-config.ts` | Sidebar (added Homepage Builder + Block-Bibliothek entries) |

---

## Block Registry Design

### File: `lib/homepage/block-registry.ts`

The registry exports:

- `BLOCK_CATEGORIES` — ordered array of category labels
- `BlockCategory` — TypeScript union type
- `BLOCK_STATUSES` — ordered array of status values
- `BlockStatus` — TypeScript union type
- `PublicBlockMeta` — public-safe block metadata for the API (`category`, `datadriven`)
- `BlockDefinition` — full block definition type
- `BLOCK_REGISTRY` — array of all `BlockDefinition` objects (sorted by `defaultSortOrder`)
- `getBlockDefinition(type)` — lookup by type key
- `getPublicBlockMeta(type)` — returns `PublicBlockMeta | null`
- `projectBlockPublicConfig(type, config)` — applies public-safe config projection
- `getBlocksByCategory()` — returns `Map<BlockCategory, BlockDefinition[]>`

### Single source of truth rule

> **Never add block labels, descriptions, or default configs outside `lib/homepage/block-registry.ts`.**

- `lib/homepage/section-types.ts` derives `HOMEPAGE_SECTION_TYPES` and `DEFAULT_HOMEPAGE_SECTIONS` by iterating `BLOCK_REGISTRY`.
- `HomepageSectionList.tsx` calls `getHomepageSectionType()` from `section-types.ts`, which is backed by the registry.
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

For backwards compatibility with `HomepageSectionList.tsx`:

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

## Config Validation Strategy

**Current (Slice 3):** Config shapes are TypeScript interfaces in `lib/homepage/section-types.ts` (informational, no runtime enforcement). The `projectPublicConfig` function in each block definition is an identity pass-through (all current config is public-safe).

**Deferred:** Full Zod schema validation per block type (to be added in a future slice when the config editor UI is introduced).

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
- `block` field contains only `category` and `datadriven` — no admin labels, internal status, internal IDs, or admin-only metadata.
- Section `config` is routed through `projectBlockPublicConfig()` before serialisation, ensuring future types with admin-only config keys can filter them.
- `block` is `null` for unregistered type keys (safe fallback — no crash).

**Backwards compatibility:** `block` is a new field in Slice 3. Existing consumers that don't reference `block` will safely ignore it.

---

## Admin Block Library UI

**Route:** `/dashboard/website/blocks`  
**Permission:** `WEBSITE_MANAGE`  
**Type:** Server component (read-only, no client state)

The page renders all blocks from `BLOCK_REGISTRY` grouped by category. For each block:
- Display name and type key (monospace)
- Status badge (available / foundation-ready / coming-next)
- Category badge
- Data-driven / manually configured indicator
- Config keys as inline code badges
- Description

Navigation links to CMS overview and Homepage Builder.

---

## Navigation

Both `Homepage Builder` and `Block-Bibliothek` are now in the Website sidebar:

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
| Block labels in `section-types.ts` + `DEFAULT_HOMEPAGE_SECTIONS` | Derived from `BLOCK_REGISTRY.displayName` |
| Default configs in `HOMEPAGE_SECTION_TYPES` + `DEFAULT_HOMEPAGE_SECTIONS` | Derived from `BLOCK_REGISTRY.defaultConfig` |
| Implementation status | Derived from `BLOCK_REGISTRY.status` |
| Sort order + enabled flag in `DEFAULT_HOMEPAGE_SECTIONS` | Derived from `BLOCK_REGISTRY.defaultSortOrder` / `defaultEnabled` |

---

## Deferred Future Work

The following are intentionally out of scope for this foundation slice:

1. **Visual block editor** — drag-and-drop block composer with live preview
2. **Per-block config editor UI** — form per block type with field validation
3. **Zod config schemas** — runtime validation of block config objects
4. **Sponsor model** — DB model backing `sponsorsTeaser` (currently foundation-ready)
5. **Rich content editor** — backing `customContentPlaceholder` (currently coming-next)
6. **Block preview rendering** — live preview of block in admin UI
7. **Block version history** — track config changes over time
8. **Per-block scheduling** — show/hide blocks on a schedule
9. **Block preview / staging workflow** — preview blocks before publishing
10. **Additional block types** — social feed, gallery, contact form, map, etc.

---

## Recommended Next CMS Slice (Slice 4)

**Goal:** Block Config Editor — allow admins to edit block config (label, heading, itemCount, CTA fields) from the Homepage Builder.

**Scope:**
- `PATCH /api/homepage-sections/[id]/config` — update config + label for a section
- Per-type config form UI in `HomepageSectionList` (inline or slide-out panel)
- Zod validation per block type
- No visual drag-and-drop (deferred)
- No rich text editor (deferred)
