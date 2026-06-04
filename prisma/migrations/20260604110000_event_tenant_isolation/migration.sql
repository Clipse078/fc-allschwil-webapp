-- Week Planner V1: Event Tenant Isolation
-- Adds nullable tenantId to Event for per-tenant scoping of allocation + publish APIs.
-- Nullable for backward compatibility: existing seed/legacy events get NULL.
-- New events set tenantId from the authenticated user's session.

-- AlterTable
ALTER TABLE "Event"
  ADD COLUMN "tenantId" TEXT;

-- AddForeignKey
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Event_tenantId_idx" ON "Event"("tenantId");
