# Website News CMS — MVP

## Overview

FC Allschwil news articles are now created, edited, and published entirely from the WebApp. The website's public news feed (`/api/public/v1/website/news` and `/api/public/v1/website/news/[slug]`) remains unchanged and continues to serve published articles to the public website.

---

## Architecture

### Data Model

**`NewsArticle`** (extended, backward-compatible)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | PK |
| `tenantId` | `String` | FK → Tenant |
| `slug` | `String` | Unique per tenant |
| `title` | `String` | Required |
| `excerpt` | `String?` | Shown on list pages |
| `content` | `String` | Markdown body |
| `imageUrl` | `String?` | Hero image CDN URL |
| `authorName` | `String?` | **New** — display name |
| `status` | `NewsArticleStatus` | See statuses below |
| `publishedAt` | `DateTime?` | Set on publish |
| `createdAt` / `updatedAt` | `DateTime` | Auto-managed |

**`NewsArticleStatus` enum** (extended, additive)

| Value | Description |
|-------|-------------|
| `DRAFT` | Not visible publicly |
| `IN_REVIEW` | Sent for review (four-eye flow) |
| `APPROVED` | Approved, ready to publish |
| `PUBLISHED` | Live on public website |
| `ARCHIVED` | Hidden, not editable via UI |

**`MediaAsset`** (new, reusable)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | PK |
| `tenantId` | `String` | FK → Tenant (cascades) |
| `type` | `MediaAssetType` | `IMAGE \| VIDEO \| EMBED` |
| `url` | `String` | Public CDN URL |
| `storageKey` | `String?` | Internal Vercel Blob key |
| `mimeType` | `String?` | e.g. `image/jpeg` |
| `fileName` | `String?` | Original filename |
| `altText` | `String?` | Accessibility / SEO |
| `caption` | `String?` | Optional caption |
| `size` | `Int?` | Bytes |
| `width` / `height` | `Int?` | Pixels (if available) |
| `createdAt` / `updatedAt` | `DateTime` | Auto-managed |

`MediaAsset` is intentionally **not news-only** — future modules (events, galleries, pages) can reference assets by URL or add FKs without changing this model.

---

## Permissions

| Key | Module | Purpose |
|-----|--------|---------|
| `news.manage` | `NEWS` | Create, edit, read, archive articles |
| `news.publish` | `NEWS` | **New** — publish / unpublish articles |
| `website.manage` | `WEBSITE` | Existing — general website management |

The `website_publisher` role includes all three.

---

## API Routes (Admin — Authenticated)

### News CRUD

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/news` | `news.manage` | List all articles (optional `?status=DRAFT\|PUBLISHED\|…`) |
| `POST` | `/api/news` | `news.manage` | Create draft |
| `GET` | `/api/news/[articleId]` | `news.manage` | Get article detail |
| `PATCH` | `/api/news/[articleId]` | `news.manage` | Update; publish requires `news.publish` |
| `DELETE` | `/api/news/[articleId]` | `news.manage` | Hard delete |

### Media Upload

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/media/upload` | `news.manage` | Upload image, returns `{ asset: { id, url, … } }` |

Upload body: `multipart/form-data` with field `file`.  
Allowed: JPEG, PNG, WebP, GIF · Max 8 MB.  
Validates MIME type + magic bytes (via `file-type`) before uploading to Vercel Blob.

---

## Dashboard Pages

| Route | Description |
|-------|-------------|
| `/dashboard/website/news` | Overview table with status filter tabs |
| `/dashboard/website/news/new` | Create article form |
| `/dashboard/website/news/[articleId]/edit` | Edit article form |

---

## Publishing Workflow

### MVP (current)

```
DRAFT → (edit) → DRAFT
DRAFT → (publish) → PUBLISHED   [requires news.publish]
PUBLISHED → (depublish) → DRAFT [requires news.publish]
any → (archive) → ARCHIVED      [requires news.manage]
```

Direct publish is allowed for `Club Admin` and `Website Publisher` roles (those with `news.publish`).

### Four-Eye Readiness (future)

Status values `IN_REVIEW` and `APPROVED` are already in the DB enum and visible in the API. A future review queue can route:

```
DRAFT → IN_REVIEW → APPROVED → PUBLISHED
```

without schema changes. Only the admin UI workflow and permission gates need to be added.

---

## Media Architecture

### Hero Image

The `imageUrl` field on `NewsArticle` stores the CDN URL of the hero image. On the edit page, the `ImageUploadField` component:

1. Client-side validates MIME type and file size.
2. POSTs to `/api/media/upload`.
3. Server validates magic bytes and uploads to Vercel Blob under `media/{tenantKey}/{name}-{timestamp}.{ext}`.
4. Creates a `MediaAsset` record.
5. Returns the public CDN URL, which is stored in `imageUrl`.

### Inline Images / Video in Content

Markdown content can reference images using standard Markdown syntax:

```markdown
![Alt text](https://cdn.example.com/image.jpg)
```

YouTube/Vimeo embeds must be referenced as links — **raw HTML is not rendered** (Markdown only). The website's rendering layer decides how to handle `![text](url)` for video URLs.

### Future: Media Library UI

`MediaAsset` records are created on every upload. A dedicated media library page (`/dashboard/website/media`) can list, search, and reuse assets — no schema changes required.

---

## Public Feed Compatibility

The existing public feed endpoints are fully backward-compatible:

- `GET /api/public/v1/website/news` — list items: no `content`, no `authorName`, no `status`. Only `id`, `slug`, `title`, `excerpt`, `imageUrl`, `publishedAt`.
- `GET /api/public/v1/website/news/[slug]` — detail: adds `content`. Still no `authorName` or internal fields.

Only `PUBLISHED` articles with non-null `publishedAt` are returned. `IN_REVIEW`, `APPROVED`, `DRAFT`, and `ARCHIVED` are never exposed publicly.

---

## Migration Safety Report

Migration `20260609000000_news_cms_media_assets`:

| Change | Safety |
|--------|--------|
| Add `IN_REVIEW` to `NewsArticleStatus` enum | ✅ Additive — `ALTER TYPE … ADD VALUE IF NOT EXISTS` |
| Add `APPROVED` to `NewsArticleStatus` enum | ✅ Additive — same |
| Add `authorName TEXT` to `NewsArticle` | ✅ Additive — nullable column, no default required |
| Create `MediaAssetType` enum | ✅ New type, no existing data affected |
| Create `MediaAsset` table | ✅ New table, no existing data affected |

No destructive changes. No data loss. Zero-downtime safe. All statements use `IF NOT EXISTS` guards.

---

## Remaining Future Work

| Feature | Effort |
|---------|--------|
| Review queue UI (`IN_REVIEW` / `APPROVED` flow) | Medium |
| Approval workflow + notifications | Medium |
| Rich-text editor (TipTap or similar) | Medium |
| Media library UI (`/dashboard/website/media`) | Small |
| Scheduled publishing (`publishAt` cron) | Medium |
| Multi-language news (`i18n`) | Large |
| SEO metadata fields (`metaTitle`, `metaDescription`) | Small |
| Article tagging / categories | Small |
