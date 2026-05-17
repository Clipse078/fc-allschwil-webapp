-- Tenant Core Phase 1 — fully idempotent against any DB state
--
-- Handles three scenarios safely:
--   A) Tenant table does not exist at all          → CREATE TABLE, then no-op ALTERs
--   B) Tenant table exists but missing columns     → CREATE TABLE is no-op, ALTERs add columns
--   C) Everything already exists (re-run)          → every statement is a no-op
--
-- No tables are dropped. No data is deleted. No DB reset.

-- ── 1. Tenant table (create if absent) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id"      TEXT NOT NULL,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- ── 2. Tenant columns — safe ADD COLUMN IF NOT EXISTS ────────────────────────
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "slug"           TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "name"           TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "displayName"    TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "countryCode"    TEXT DEFAULT 'CH';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sportType"      TEXT DEFAULT 'football';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "primaryColor"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "logoUrl"        TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "isActive"       BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── 3. Backfill nulls so unique index on slug can be created safely ───────────
UPDATE "Tenant" SET "slug" = 'fc-allschwil' WHERE "slug" IS NULL;
UPDATE "Tenant" SET "name" = 'FC Allschwil' WHERE "name" IS NULL;

-- ── 4. Tenant indexes ─────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key"     ON "Tenant"("slug");
CREATE        INDEX IF NOT EXISTS "Tenant_isActive_idx" ON "Tenant"("isActive");

-- ── 5. UserTenant table (create if absent) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "UserTenant" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "tenantId"  TEXT         NOT NULL,
    "roleLabel" TEXT,
    "isDefault" BOOLEAN      NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("id")
);

-- ── 6. UserTenant indexes ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "UserTenant_userId_tenantId_key" ON "UserTenant"("userId", "tenantId");
CREATE        INDEX IF NOT EXISTS "UserTenant_userId_idx"          ON "UserTenant"("userId");
CREATE        INDEX IF NOT EXISTS "UserTenant_tenantId_idx"        ON "UserTenant"("tenantId");
CREATE        INDEX IF NOT EXISTS "UserTenant_isDefault_idx"       ON "UserTenant"("isDefault");

-- ── 7. Nullable tenantId on Season, Team, Event ───────────────────────────────
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Team"   ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Event"  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ── 8. Indexes on tenantId columns ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Season_tenantId_idx" ON "Season"("tenantId");
CREATE INDEX IF NOT EXISTS "Team_tenantId_idx"   ON "Team"("tenantId");
CREATE INDEX IF NOT EXISTS "Event_tenantId_idx"  ON "Event"("tenantId");

-- ── 9. Foreign keys — PL/pgSQL guards (safe on re-run) ───────────────────────

-- UserTenant → User
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'UserTenant_userId_fkey'
       AND conrelid = '"UserTenant"'::regclass
  ) THEN
    ALTER TABLE "UserTenant"
      ADD CONSTRAINT "UserTenant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

-- UserTenant → Tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'UserTenant_tenantId_fkey'
       AND conrelid = '"UserTenant"'::regclass
  ) THEN
    ALTER TABLE "UserTenant"
      ADD CONSTRAINT "UserTenant_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

-- Season → Tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Season_tenantId_fkey'
       AND conrelid = '"Season"'::regclass
  ) THEN
    ALTER TABLE "Season"
      ADD CONSTRAINT "Season_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

-- Team → Tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Team_tenantId_fkey'
       AND conrelid = '"Team"'::regclass
  ) THEN
    ALTER TABLE "Team"
      ADD CONSTRAINT "Team_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;

-- Event → Tenant
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Event_tenantId_fkey'
       AND conrelid = '"Event"'::regclass
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_object THEN NULL;
END $$;
