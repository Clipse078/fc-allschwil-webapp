-- CMS V2 Slice 12: Reusable Content Components
--
-- Adds:
--   ReusableComponent  — centralised reusable content library
--   ReusableComponentUsage — cross-module usage tracking
--
-- Mirrors the field layout of HomepageSection / WebsitePageSection.
-- Publishing and approval status values are identical string constants.
-- Revisions are tracked via the existing ContentRevision table
-- (entityType = "ReusableComponent" — no schema change required).

-- ── ReusableComponent ────────────────────────────────────────────────────────

CREATE TABLE "ReusableComponent" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "type"               TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "slug"               TEXT NOT NULL,
    "description"        TEXT,
    "config"             JSONB NOT NULL DEFAULT '{}',
    "publishStatus"      TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt"        TIMESTAMP(3),
    "unpublishedAt"      TIMESTAMP(3),
    "lastPublishedAt"    TIMESTAMP(3),
    "scheduledPublishAt" TIMESTAMP(3),
    "approvalStatus"     TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "reviewerUserId"     TEXT,
    "reviewRequestedAt"  TIMESTAMP(3),
    "reviewedAt"         TIMESTAMP(3),
    "approvedAt"         TIMESTAMP(3),
    "rejectedAt"         TIMESTAMP(3),
    "approvalNote"       TEXT,
    "approvedByUserId"   TEXT,
    "rejectedByUserId"   TEXT,
    "createdByUserId"    TEXT,
    "archivedAt"         TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableComponent_pkey" PRIMARY KEY ("id")
);

-- ── ReusableComponentUsage ───────────────────────────────────────────────────

CREATE TABLE "ReusableComponentUsage" (
    "id"          TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "entityType"  TEXT NOT NULL,
    "entityId"    TEXT NOT NULL,
    "fieldPath"   TEXT NOT NULL DEFAULT 'config',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReusableComponentUsage_pkey" PRIMARY KEY ("id")
);

-- ── Unique constraints ────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "ReusableComponent_tenantId_slug_key"
    ON "ReusableComponent"("tenantId", "slug");

CREATE UNIQUE INDEX "ReusableComponentUsage_componentId_entityType_entityId_fieldPath_key"
    ON "ReusableComponentUsage"("componentId", "entityType", "entityId", "fieldPath");

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX "ReusableComponent_tenantId_idx"
    ON "ReusableComponent"("tenantId");

CREATE INDEX "ReusableComponent_tenantId_type_idx"
    ON "ReusableComponent"("tenantId", "type");

CREATE INDEX "ReusableComponent_tenantId_publishStatus_idx"
    ON "ReusableComponent"("tenantId", "publishStatus");

CREATE INDEX "ReusableComponent_tenantId_archivedAt_idx"
    ON "ReusableComponent"("tenantId", "archivedAt");

CREATE INDEX "ReusableComponent_tenantId_updatedAt_idx"
    ON "ReusableComponent"("tenantId", "updatedAt");

CREATE INDEX "ReusableComponentUsage_tenantId_idx"
    ON "ReusableComponentUsage"("tenantId");

CREATE INDEX "ReusableComponentUsage_componentId_idx"
    ON "ReusableComponentUsage"("componentId");

CREATE INDEX "ReusableComponentUsage_entityType_entityId_idx"
    ON "ReusableComponentUsage"("entityType", "entityId");

-- ── Foreign keys ──────────────────────────────────────────────────────────────

ALTER TABLE "ReusableComponent"
    ADD CONSTRAINT "ReusableComponent_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReusableComponent"
    ADD CONSTRAINT "ReusableComponent_createdByUserId_fkey"
        FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReusableComponent"
    ADD CONSTRAINT "ReusableComponent_reviewerUserId_fkey"
        FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReusableComponent"
    ADD CONSTRAINT "ReusableComponent_approvedByUserId_fkey"
        FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReusableComponent"
    ADD CONSTRAINT "ReusableComponent_rejectedByUserId_fkey"
        FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReusableComponentUsage"
    ADD CONSTRAINT "ReusableComponentUsage_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReusableComponentUsage"
    ADD CONSTRAINT "ReusableComponentUsage_componentId_fkey"
        FOREIGN KEY ("componentId") REFERENCES "ReusableComponent"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
