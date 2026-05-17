-- AlterTable: add nullable tenantId to Season
ALTER TABLE "Season" ADD COLUMN "tenantId" TEXT;

-- AlterTable: add nullable tenantId to Team
ALTER TABLE "Team" ADD COLUMN "tenantId" TEXT;

-- AlterTable: add nullable tenantId to Event
ALTER TABLE "Event" ADD COLUMN "tenantId" TEXT;

-- CreateIndex
CREATE INDEX "Season_tenantId_idx" ON "Season"("tenantId");

-- CreateIndex
CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");

-- CreateIndex
CREATE INDEX "Event_tenantId_idx" ON "Event"("tenantId");

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
