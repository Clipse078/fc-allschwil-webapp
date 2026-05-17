-- Tenant Core Phase 1 — idempotent migration
-- Safe to run against any DB state:
--   · Tenant table may already exist (from a prior db push)
--   · UserTenant may be absent
--   · tenantId columns on Season/Team/Event may or may not exist
-- All statements use IF NOT EXISTS or PL/pgSQL guards.

-- ── Tenant table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id"             TEXT         NOT NULL,
    "slug"           TEXT         NOT NULL,
    "name"           TEXT         NOT NULL,
    "displayName"    TEXT,
    "countryCode"    TEXT         DEFAULT 'CH',
    "sportType"      TEXT         DEFAULT 'football',
    "primaryColor"   TEXT,
    "secondaryColor" TEXT,
    "logoUrl"        TEXT,
    "isActive"       BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- ── UserTenant table ──────────────────────────────────────────────────────────
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

-- ── Nullable tenantId columns on Season, Team, Event ─────────────────────────
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Team"   ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Event"  ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ── Indexes — Tenant ──────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key"     ON "Tenant"("slug");
CREATE        INDEX IF NOT EXISTS "Tenant_isActive_idx" ON "Tenant"("isActive");
CREATE        INDEX IF NOT EXISTS "Tenant_slug_idx"     ON "Tenant"("slug");

-- ── Indexes — UserTenant ──────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "UserTenant_userId_tenantId_key" ON "UserTenant"("userId", "tenantId");
CREATE        INDEX IF NOT EXISTS "UserTenant_userId_idx"          ON "UserTenant"("userId");
CREATE        INDEX IF NOT EXISTS "UserTenant_tenantId_idx"        ON "UserTenant"("tenantId");
CREATE        INDEX IF NOT EXISTS "UserTenant_isDefault_idx"       ON "UserTenant"("isDefault");

-- ── Indexes — tenantId on existing tables ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Season_tenantId_idx" ON "Season"("tenantId");
CREATE INDEX IF NOT EXISTS "Team_tenantId_idx"   ON "Team"("tenantId");
CREATE INDEX IF NOT EXISTS "Event_tenantId_idx"  ON "Event"("tenantId");

-- ── Foreign keys — guarded with PL/pgSQL so re-runs are safe ─────────────────

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
EXCEPTION WHEN undefined_table THEN NULL;
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
EXCEPTION WHEN undefined_table THEN NULL;
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
EXCEPTION WHEN undefined_table THEN NULL;
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
EXCEPTION WHEN undefined_table THEN NULL;
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
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
