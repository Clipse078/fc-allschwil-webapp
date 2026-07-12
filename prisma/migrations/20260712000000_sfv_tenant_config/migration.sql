-- Slice: Tenant-Scoped SFV Integration Configuration
--
-- Adds TenantSfvConfig: one record per tenant, holding the SFV/ClubCorner
-- integration parameters (clubId, defaultSeasonId, organisationId, enabled).
--
-- Design:
--   - 1:1 with Tenant via UNIQUE constraint on tenantId.
--   - Tenants without SFV integration have no row (optional relation).
--   - CASCADE on tenantId: deleting a tenant removes its SFV config.
--   - enabled defaults TRUE so newly inserted configs are live immediately.
--   - No data migration required: existing tenants start without a config row.

CREATE TABLE "TenantSfvConfig" (
    "id"              TEXT         NOT NULL,
    "tenantId"        TEXT         NOT NULL,
    "clubId"          INTEGER      NOT NULL,
    "defaultSeasonId" INTEGER      NOT NULL,
    "organisationId"  INTEGER,
    "enabled"         BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSfvConfig_pkey" PRIMARY KEY ("id")
);

-- Unique: one config per tenant
CREATE UNIQUE INDEX "TenantSfvConfig_tenantId_key" ON "TenantSfvConfig"("tenantId");

-- Index on enabled to efficiently find all active integrations
CREATE INDEX "TenantSfvConfig_enabled_idx" ON "TenantSfvConfig"("enabled");

-- Foreign key: cascade deletion when the tenant is deleted
ALTER TABLE "TenantSfvConfig" ADD CONSTRAINT "TenantSfvConfig_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
