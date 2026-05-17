-- Tenant Core Phase 1
-- Adds Tenant and UserTenant models, plus nullable tenantId on Season, Team, Event.
-- All FK columns are nullable so no existing data is affected.

-- CreateTable: Tenant
CREATE TABLE "Tenant" (
    "id"             TEXT        NOT NULL,
    "slug"           TEXT        NOT NULL,
    "name"           TEXT        NOT NULL,
    "displayName"    TEXT,
    "countryCode"    TEXT        DEFAULT 'CH',
    "sportType"      TEXT        DEFAULT 'football',
    "primaryColor"   TEXT,
    "secondaryColor" TEXT,
    "logoUrl"        TEXT,
    "isActive"       BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UserTenant
CREATE TABLE "UserTenant" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "tenantId"  TEXT        NOT NULL,
    "roleLabel" TEXT,
    "isDefault" BOOLEAN     NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTenant_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Season — add nullable tenantId
ALTER TABLE "Season" ADD COLUMN "tenantId" TEXT;

-- AlterTable: Team — add nullable tenantId
ALTER TABLE "Team" ADD COLUMN "tenantId" TEXT;

-- AlterTable: Event — add nullable tenantId
ALTER TABLE "Event" ADD COLUMN "tenantId" TEXT;

-- CreateIndex: Tenant
CREATE UNIQUE INDEX "Tenant_slug_key"     ON "Tenant"("slug");
CREATE INDEX        "Tenant_isActive_idx" ON "Tenant"("isActive");
CREATE INDEX        "Tenant_slug_idx"     ON "Tenant"("slug");

-- CreateIndex: UserTenant
CREATE UNIQUE INDEX "UserTenant_userId_tenantId_key" ON "UserTenant"("userId", "tenantId");
CREATE INDEX        "UserTenant_userId_idx"          ON "UserTenant"("userId");
CREATE INDEX        "UserTenant_tenantId_idx"        ON "UserTenant"("tenantId");
CREATE INDEX        "UserTenant_isDefault_idx"       ON "UserTenant"("isDefault");

-- CreateIndex: Season.tenantId
CREATE INDEX "Season_tenantId_idx" ON "Season"("tenantId");

-- CreateIndex: Team.tenantId
CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");

-- CreateIndex: Event.tenantId
CREATE INDEX "Event_tenantId_idx" ON "Event"("tenantId");

-- AddForeignKey: UserTenant → User
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: UserTenant → Tenant
ALTER TABLE "UserTenant" ADD CONSTRAINT "UserTenant_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Season → Tenant (nullable, SET NULL on tenant delete)
ALTER TABLE "Season" ADD CONSTRAINT "Season_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Team → Tenant (nullable, SET NULL on tenant delete)
ALTER TABLE "Team" ADD CONSTRAINT "Team_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Event → Tenant (nullable, SET NULL on tenant delete)
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
