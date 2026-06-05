# Migration Safety Report — Website Management Foundation

> Branch: `cursor/website-management-foundation-69d7`
> Migration: `20260605140000_website_management_foundation`
> Date: 2026-06-05
> Target environments: Stage, Local dev

---

## Summary

**Risk Level: LOW — Fully additive migration, transaction-safe.**

No ALTER TYPE ADD VALUE, no DROP, no renames, no data transforms.

---

## Migration Content

### New ENUMs (CREATE TYPE)

| Enum | Values |
|------|--------|
| `WebsitePublishStatus` | DRAFT, IN_REVIEW, APPROVED, PUBLISHED, UNPUBLISHED |
| `WebsiteSectionType` | TEAMS, EVENTS, WEEKPLAN, SPONSORS, NEWS, CONTENT |

Both are new types — no ALTER TYPE operations involved.

### New Columns on `Tenant` (ALTER TABLE ADD COLUMN)

| Column | Type | Default | Nullable |
|--------|------|---------|----------|
| `websiteDomain` | TEXT | — | YES |
| `websiteEnabled` | BOOLEAN | `false` | NO |
| `approvedDataOnly` | BOOLEAN | `true` | NO |

- `websiteDomain`: nullable; existing rows will have NULL — safe fallback in all callers.
- `websiteEnabled`: NOT NULL with `DEFAULT false` — existing tenants start with website disabled, which is the correct safe default.
- `approvedDataOnly`: NOT NULL with `DEFAULT true` — existing tenants start with safe content filtering enabled.

### New Tables

| Table | Tenant-scoped | Primary Key | Unique constraint |
|-------|--------------|-------------|-------------------|
| `WebsiteSection` | YES (`tenantId` FK) | `id` (CUID) | `(tenantId, sectionType)` |
| `PublishedSnapshot` | YES (`tenantId` FK) | `id` (CUID) | — |

Both tables are created empty. No data backfill required.

---

## Transaction Safety

| Operation | Transaction-safe? | Notes |
|-----------|------------------|-------|
| `CREATE TYPE WebsitePublishStatus` | ✅ YES | New type |
| `CREATE TYPE WebsiteSectionType` | ✅ YES | New type |
| `ALTER TABLE Tenant ADD COLUMN` | ✅ YES | Add columns with defaults |
| `CREATE TABLE WebsiteSection` | ✅ YES | New table |
| `CREATE TABLE PublishedSnapshot` | ✅ YES | New table |

**This migration is entirely transaction-safe.** Prisma will wrap it in a single transaction.
No manual psql commands required.

---

## Rollback Plan

If rollback is required (e.g. deploy fails after migration):

```sql
-- Drop new tables first (FK-dependent order)
DROP TABLE IF EXISTS "PublishedSnapshot";
DROP TABLE IF EXISTS "WebsiteSection";

-- Drop new columns from Tenant
ALTER TABLE "Tenant"
  DROP COLUMN IF EXISTS "websiteDomain",
  DROP COLUMN IF EXISTS "websiteEnabled",
  DROP COLUMN IF EXISTS "approvedDataOnly";

-- Drop new enums
DROP TYPE IF EXISTS "WebsiteSectionType";
DROP TYPE IF EXISTS "WebsitePublishStatus";
```

Then mark migration as rolled back in `_prisma_migrations`:
```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '20260605140000_website_management_foundation';
```

---

## Deploy Command

```bash
DATABASE_URL="<your-stage-db-url>" npx prisma migrate deploy --config prisma.config.ts
```

---

## Applied On

- ✅ STAGE database (`neondb` @ gwc.azure.neon.tech) — applied 2026-06-05 via `prisma migrate deploy`
