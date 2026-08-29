-- WOCHENPLAN-2.0-01B: Tenant Multi-Plan Foundation
--
-- Introduces WochenplanPlan and WochenplanPlanAllocation as the tenant-level
-- parent concept for named weekly plans. Existing Event allocation fields
-- remain the canonical source for the default plan; alternative plans store
-- sparse per-event overrides only.
--
-- Changes:
--   1. Create WochenplanPlan table with foreign keys and indexes.
--   2. Create WochenplanPlanAllocation table with foreign keys and indexes.
--   3. Partial unique indexes for one active/default plan per tenant.
--   4. Backfill one default+active plan per existing tenant (neutral name).
--   5. WOCHENPLAN-2.0-01E: Add WeekplannerPlan.wochenplanPlanId stable link.

-- =============================================================================
-- 1. Create WochenplanPlan table
-- =============================================================================

CREATE TABLE "WochenplanPlan" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "isDefault"    BOOLEAN NOT NULL DEFAULT false,
    "isActive"     BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "archivedAt"   TIMESTAMP(3),

    CONSTRAINT "WochenplanPlan_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WochenplanPlan"
    ADD CONSTRAINT "WochenplanPlan_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WochenplanPlan_tenantId_idx" ON "WochenplanPlan"("tenantId");
CREATE INDEX "WochenplanPlan_tenantId_isActive_idx" ON "WochenplanPlan"("tenantId", "isActive");
CREATE INDEX "WochenplanPlan_tenantId_isDefault_idx" ON "WochenplanPlan"("tenantId", "isDefault");
CREATE INDEX "WochenplanPlan_tenantId_archivedAt_idx" ON "WochenplanPlan"("tenantId", "archivedAt");

-- At most one non-archived active plan per tenant.
CREATE UNIQUE INDEX "WochenplanPlan_tenantId_isActive_unique"
    ON "WochenplanPlan"("tenantId")
    WHERE ("isActive" = true AND "archivedAt" IS NULL);

-- At most one non-archived default plan per tenant.
CREATE UNIQUE INDEX "WochenplanPlan_tenantId_isDefault_unique"
    ON "WochenplanPlan"("tenantId")
    WHERE ("isDefault" = true AND "archivedAt" IS NULL);

-- Plan name is unique (case-insensitive) among non-archived plans per tenant.
CREATE UNIQUE INDEX "WochenplanPlan_tenantId_name_unique"
    ON "WochenplanPlan"(lower("name"), "tenantId")
    WHERE ("archivedAt" IS NULL);

-- =============================================================================
-- 2. Create WochenplanPlanAllocation table
-- =============================================================================

CREATE TABLE "WochenplanPlanAllocation" (
    "id"                   TEXT NOT NULL,
    "tenantId"             TEXT NOT NULL,
    "wochenplanPlanId"     TEXT NOT NULL,
    "eventId"              TEXT NOT NULL,
    "pitchCode"            TEXT,
    "homeDressingRoomCode" TEXT,
    "awayDressingRoomCode" TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WochenplanPlanAllocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WochenplanPlanAllocation"
    ADD CONSTRAINT "WochenplanPlanAllocation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WochenplanPlanAllocation"
    ADD CONSTRAINT "WochenplanPlanAllocation_wochenplanPlanId_fkey"
    FOREIGN KEY ("wochenplanPlanId") REFERENCES "WochenplanPlan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WochenplanPlanAllocation_wochenplanPlanId_eventId_key"
    ON "WochenplanPlanAllocation"("wochenplanPlanId", "eventId");

CREATE INDEX "WochenplanPlanAllocation_tenantId_idx" ON "WochenplanPlanAllocation"("tenantId");
CREATE INDEX "WochenplanPlanAllocation_wochenplanPlanId_idx" ON "WochenplanPlanAllocation"("wochenplanPlanId");
CREATE INDEX "WochenplanPlanAllocation_eventId_idx" ON "WochenplanPlanAllocation"("eventId");

-- =============================================================================
-- 3. Backfill one default+active plan per tenant
-- =============================================================================

INSERT INTO "WochenplanPlan" (
    "id",
    "tenantId",
    "name",
    "isDefault",
    "isActive",
    "displayOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    'clwcp' || substr(md5("id" || ':wochenplan-default'), 1, 21),
    "id",
    'Wochenplan',
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Tenant"
WHERE NOT EXISTS (
    SELECT 1 FROM "WochenplanPlan" wp WHERE wp."tenantId" = "Tenant"."id"
);

-- =============================================================================
-- 4. WOCHENPLAN-2.0-01E — stable ID link from WeekplannerPlan to WochenplanPlan
-- =============================================================================
--
-- Human-readable plan names are display labels only. A week-scoped concrete
-- plan resolves to its tenant-level definition via wochenplanPlanId, never
-- by name equality.

ALTER TABLE "WeekplannerPlan" ADD COLUMN "wochenplanPlanId" TEXT;

ALTER TABLE "WeekplannerPlan"
    ADD CONSTRAINT "WeekplannerPlan_wochenplanPlanId_fkey"
    FOREIGN KEY ("wochenplanPlanId") REFERENCES "WochenplanPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WeekplannerPlan_tenantId_weekId_wochenplanPlanId_idx"
    ON "WeekplannerPlan"("tenantId", "weekId", "wochenplanPlanId");

-- At most one non-archived concrete week plan per tenant-level definition per week.
CREATE UNIQUE INDEX "WeekplannerPlan_tenantId_weekId_wochenplanPlanId_unique"
    ON "WeekplannerPlan"("tenantId", "weekId", "wochenplanPlanId")
    WHERE ("archivedAt" IS NULL AND "wochenplanPlanId" IS NOT NULL);
