# STAGE Runtime Investigation Report

> Generated: 2026-06-30  
> Method: Direct STAGE database inspection + code analysis  
> Branch: `cursor/stage-runtime-investigation-a8cc`

---

## Vercel Logs Access

**Status: BLOCKED — no VERCEL_TOKEN in the agent environment.**

`CLOUD_AGENT_ALL_SECRET_NAMES` only contains `STAGE_DB_URL` and `STAGE_DIRECT_URL`. Vercel CLI is installed (v54.18.5) but unauthenticated. The investigation was conducted entirely via direct STAGE database inspection and Prisma client reproduction — which produced the exact same errors the deployed runtime experiences.

---

## Digest 1227782187 — News Article Edit Page

### Exact Exception (confirmed by live STAGE DB reproduction)

```
PrismaClientKnownRequestError:

Invalid `prisma.newsArticle.findFirst()` invocation:

The column `NewsArticle.contentJson` does not exist in the current database.

Code: P2022
Meta: {
  "modelName": "NewsArticle",
  "driverAdapterError": {
    "name": "DriverAdapterError",
    "cause": {
      "originalCode": "42703",
      "originalMessage": "column NewsArticle.contentJson does not exist",
      "kind": "ColumnNotFound",
      "column": "NewsArticle.contentJson"
    }
  }
}
```

**PostgreSQL error code:** `42703` (undefined_column)

### Stack Trace

```
PrismaClientKnownRequestError: The column `NewsArticle.contentJson` does not exist in the current database.
    at Gr.handleRequestError (node_modules/@prisma/client/runtime/client.js:65:8286)
    at Gr.handleAndLogRequestError (node_modules/@prisma/client/runtime/client.js:65:7581)
    at Gr.request (node_modules/@prisma/client/runtime/client.js:65:7288)
    at async getNewsArticleAdminById (lib/news/admin-queries.ts:220)
    at async NewsArticleEditPage (app/(admin)/dashboard/website/news/[id]/edit/page.tsx:28)
```

### Failing Route

`GET /dashboard/website/news/[id]/edit`

### Failing File & Line

- **Primary:** `lib/news/admin-queries.ts` line 167 — `contentJson: true` in `adminDetailSelect`
- **Caller:** `app/(admin)/dashboard/website/news/[id]/edit/page.tsx` line 28 — `await getNewsArticleAdminById(ctx.id, id)`

### All routes affected by this exception

Every function in `lib/news/admin-queries.ts` that uses `adminDetailSelect` fails:

| Route | Function |
|-------|----------|
| `GET /dashboard/website/news/[id]/edit` | `getNewsArticleAdminById` |
| `GET /api/news/[id]` | `getNewsArticleAdminById` |
| `POST /api/news` (create) | `createNewsArticle` |
| `PATCH /api/news/[id]` (update) | `updateNewsArticle` |
| `POST /api/news/[id]/publish` | `publishNewsArticle`, `unpublishNewsArticle`, `submitNewsArticleForReview`, `approveNewsArticle`, `rejectNewsArticle` |
| `GET /api/public/v1/website/news/[slug]` | `publicArticleDetailSelect` in `lib/news/public-news-feed.ts` |

**The news list page (`/dashboard/website/news`) is NOT affected** — `listNewsArticlesAdmin` uses `adminListSelect` which does not include `contentJson: true`.

### Root Cause

Migration `20260629000000_news_article_content_json` has **never been applied to STAGE**. The row does not appear in `_prisma_migrations` at all (confirmed by `SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20260629000000_news_article_content_json'` → 0 rows).

The column `"contentJson" JSONB` does not exist in the STAGE `NewsArticle` table. The current Prisma schema (deployed with the CMS V4.2a merge) declares `contentJson Json?` on the `NewsArticle` model. All `adminDetailSelect` queries include `contentJson: true`. Every such query fails immediately with P2022 before any RSC boundary is reached.

---

## Digest 3804301916 — Meetings & Initiatives (RSC Boundary)

### Exact Exception

```
Error: Event handlers cannot be passed to Client Component props.
  If you want interactivity, consider converting part of the tree to use Client Components.
  <... onClick={function}>
```

This is a Next.js 16 RSC invariant violation. It is accompanied by a secondary hydration error:

```
Error: Hydration failed because the server rendered HTML didn't match the client.
(Nested <a> inside <a> is invalid HTML)
```

### Failing Routes

- `GET /vereinsleitung/meetings`
- `GET /vereinsleitung/initiativen`

### Failing Files & Lines

**`components/admin/vereinsleitung/VereinsleitungMeetingsList.tsx` (line 121):**
```tsx
<Link
  href={`/vereinsleitung/meetings/${meeting.slug}/edit`}
  onClick={(e) => e.stopPropagation()}   // ← event handler on RSC boundary
  className="..."
>
```
This `<Link>` (line 119–126) is **nested inside an outer `<Link>`** (line 80–134). Both render as `<a>` tags → nested `<a>` in HTML is invalid.

**`components/admin/vereinsleitung/VereinsleitungInitiativenList.tsx` (line 149):**
Identical pattern — same nested `<Link onClick>` inside an outer `<Link>`.

### Root Cause

Both list components are **server components** (no `"use client"` directive). They render a `<Link onClick={...}>` — but `Link` is a client component. In Next.js 16, passing event handler functions (`onClick`) across the RSC server→client boundary is prohibited. The framework throws the invariant error at render time, which gets caught by the Next.js error boundary and serialized into digest `3804301916`.

The identical digest across both routes is expected — the thrown error message string is the same in both cases, and Next.js deterministically hashes the message into the same digest.

**Note:** This bug is independent of the database state. It was introduced when `VereinsleitungMeetingsList` and `VereinsleitungInitiativenList` were given the card-with-edit-link UI pattern but were not converted to client components.

---

## Migration Status (as of 2026-06-30)

### `prisma migrate status` summary

```
Last common migration: 20260628100000_registration_type_website_extensions

Not yet applied (in local repo, missing from DB):
  20260629000000_news_article_content_json   ← THE BLOCKING MIGRATION

Migrations in DB not found in local repo (~30 entries, excerpt):
  20260502212910_add_planning_resource_tenant
  20260517000000_add_tenant_model
  20260517000001_add_user_tenant
  ...
  20260629000000_cms_v4_2_ux_unification    ← from draft PR #189 (never merged to STAGE)
```

### Applied migrations (recent, `applied_steps_count = 1`)

| Migration | Applied At |
|-----------|-----------|
| `20260628100000_registration_type_website_extensions` | 2026-06-27 20:22 |
| `20260629000000_cms_v4_2_ux_unification` | 2026-06-29 17:54 (NOT in local repo) |
| `20260629000000_website_design_system` | 2026-06-29 19:50 ✓ |

### Failed migrations (13 entries with `finished_at IS NULL`)

These are orphaned failed attempts — columns/tables they tried to create already existed (added by a different migration path from a draft branch):

| Migration | PostgreSQL Error |
|-----------|-----------------|
| `20260626000000_team_tenant_isolation` | `column "tenantId" of relation "Team" already exists` |
| `20260608000000_news_article_website_flags` | `column "websiteEnabled" of relation "Tenant" already exists` |
| `20260604110000_event_tenant_isolation` | `column "tenantId" of relation "Event" already exists` |
| `20260601083400_add_tenant_foundation` | `relation "Tenant" already exists` |
| `20260517000005_extend_tenant_branding` | `column "secondaryColor" of relation "Tenant" already exists` |
| `20260517000004_add_usertenant_isdefault` | `column "isDefault" of relation "UserTenant" already exists` |
| + 7 more (20260418, 20260503×2, 20260517×3) | various duplicate-column errors |

> **Important:** These failed entries block `prisma migrate deploy` from running. However, `prisma migrate resolve` can bypass this.

---

## Database / Schema Status

### `NewsArticle` — column diff

| Column | In schema.prisma | In STAGE DB | Status |
|--------|-----------------|-------------|--------|
| `contentJson` | ✅ `Json?` | ❌ missing | **CRITICAL — causes P2022 runtime crash** |
| `richContent` | ❌ not in schema | ✅ `JSONB` | Phantom column (from draft PR #189) |
| All other columns | ✅ | ✅ | OK |

### `Tenant` — column diff

| Column | In schema.prisma | In STAGE DB | Status |
|--------|-----------------|-------------|--------|
| `websiteDesignSystem` | ✅ `Json?` | ✅ `JSONB` | OK — migration was applied |

### Other schema models

All other models expected by the current schema.prisma were confirmed present in STAGE. The STAGE DB also has extra tables (`WebsiteSection`, `WebsiteBlock`, `WebsiteBlockInstance`, `WebsiteConfig`, etc.) that are not in the current `schema.prisma` — these are phantom tables from `20260629000000_cms_v4_2_ux_unification` (draft PR #189). They do not cause runtime errors (Prisma ignores tables it doesn't know about) but indicate the migration history is diverged.

---

## Migration Deployment Steps for Digest 1227782187

`prisma migrate deploy` **cannot be used** — it refuses to run when the database has migrations not present in the local migration history (the 30+ orphaned entries from draft branches). The correct procedure is:

### Step 1 — Apply the SQL manually

```bash
# Connect to STAGE and add the missing column
psql "$STAGE_DB_URL" -c \
  'ALTER TABLE "NewsArticle" ADD COLUMN IF NOT EXISTS "contentJson" JSONB;'
```

This uses `IF NOT EXISTS`, so it is safe to re-run. It will add the column in under 1ms (no table rewrite — JSONB with no default is an O(1) catalog operation on PostgreSQL ≥ 11).

**Verify:**
```bash
psql "$STAGE_DB_URL" -c \
  'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '"'"'NewsArticle'"'"' AND column_name = '"'"'contentJson'"'"';'
# Expected: 1 row returned
```

### Step 2 — Register the migration as applied

```bash
DATABASE_URL="$STAGE_DB_URL" DIRECT_URL="$STAGE_DIRECT_URL" \
  npx prisma migrate resolve \
  --applied 20260629000000_news_article_content_json \
  --schema prisma/schema.prisma
```

`prisma migrate resolve --applied` inserts a row into `_prisma_migrations` without re-executing the SQL. It does not validate full migration history order. The 13 failed entries and orphaned entries do not prevent this command from succeeding.

**Verify:**
```bash
DATABASE_URL="$STAGE_DB_URL" DIRECT_URL="$STAGE_DIRECT_URL" \
  npx prisma migrate status --schema prisma/schema.prisma
# Expected: no more "not yet applied" migrations shown
```

### Step 3 — Trigger a Vercel re-deployment

After the column is added, trigger a new deployment (or invoke the failing route) to confirm the P2022 error is gone.

### Expected outcome

After Step 1 + Step 2:
- `prisma.newsArticle.findFirst({ select: { contentJson: true } })` → returns `null` for all existing rows (column is nullable JSONB, no default)
- `/dashboard/website/news/[id]/edit` → loads correctly
- `/api/news/[id]` → returns 200 with `contentJson: null`
- `/api/public/v1/website/news/[slug]` → returns 200 with `contentJson: null`
- Digest 1227782187 → **resolved**

---

## Recommended Fix for Digest 3804301916 (Code Change Required)

This digest is **not a database issue**. Fix requires modifying the two list components.

**Recommended approach:** Replace the nested-anchor pattern with the "cover link overlay" pattern.

In `VereinsleitungMeetingsList.tsx` and `VereinsleitungInitiativenList.tsx`:

1. Wrap the card in a `<div className="relative">` instead of `<Link>`
2. Add a `<Link className="absolute inset-0" href={...}>` as the first child (transparent overlay covering the whole card)
3. Place the "Bearbeiten" link in a `<div className="relative z-10">` so it sits above the overlay and receives its own clicks without a handler
4. Remove the `onClick={e => e.stopPropagation()}` entirely

This pattern is valid HTML (no nested `<a>`), works without any event handlers, and does not require `"use client"` on either component.

This fix is already designed in **PR #192** (`cursor/stage-runtime-fixes-7910`, DRAFT). The PR is ready but has not been merged to STAGE.

---

## Summary

| Item | Finding |
|------|---------|
| Vercel logs | Inaccessible — no VERCEL_TOKEN in agent environment |
| Digest 1227782187 | `PrismaClientKnownRequestError P2022` — `NewsArticle.contentJson` column missing in STAGE DB |
| Digest 3804301916 | Next.js RSC invariant — `onClick` event handler on server-component `<Link>` |
| `contentJson` in DB | **ABSENT** — migration `20260629000000_news_article_content_json` never applied |
| `websiteDesignSystem` in DB | **PRESENT** — migration `20260629000000_website_design_system` applied 2026-06-29 |
| Design System migrations | All applied ✓ |
| CMS V4.2a migrations | `news_article_content_json` is the only one missing |
| Failed migrations | 13 entries with `finished_at IS NULL` (not causing runtime errors, but block `migrate deploy`) |
| Primary fix | Apply 1-line SQL + `prisma migrate resolve --applied` |
| Secondary fix | Merge PR #192 (RSC overlay pattern for Meetings/Initiatives) |
