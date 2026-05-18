-- ============================================================
-- Migration: add_initiatives_module
-- Standalone Initiatives module — not coupled to Vereinsleitung.
-- Mirrors the Meetings module ownership pattern:
--   tenantSlug placeholder, optional Season/Team/OrgUnit, no hardcoded org unit.
-- Governance TODO fields (reviewStage, accessPolicy, etc.) are documented
-- in schema.prisma comments and will be added in the Organisation Builder sprint.
-- ============================================================

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InitiativePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InitiativeTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "tenantSlug" TEXT NOT NULL DEFAULT 'fc-allschwil',
    "seasonId" TEXT,
    "teamId" TEXT,
    "orgUnitLabel" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "InitiativePriority" NOT NULL DEFAULT 'MEDIUM',
    "startsAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerUserId" TEXT,
    "ownerPersonId" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeTask" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "assignedUserId" TEXT,
    "assignedPersonId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "InitiativeTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitiativeMilestone" (
    "id" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InitiativeMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Initiative_tenantSlug_status_idx" ON "Initiative"("tenantSlug", "status");

-- CreateIndex
CREATE INDEX "Initiative_tenantSlug_priority_idx" ON "Initiative"("tenantSlug", "priority");

-- CreateIndex
CREATE INDEX "Initiative_tenantSlug_dueDate_idx" ON "Initiative"("tenantSlug", "dueDate");

-- CreateIndex
CREATE INDEX "Initiative_tenantSlug_status_priority_idx" ON "Initiative"("tenantSlug", "status", "priority");

-- CreateIndex
CREATE INDEX "Initiative_seasonId_idx" ON "Initiative"("seasonId");

-- CreateIndex
CREATE INDEX "Initiative_teamId_idx" ON "Initiative"("teamId");

-- CreateIndex
CREATE INDEX "Initiative_orgUnitLabel_idx" ON "Initiative"("orgUnitLabel");

-- CreateIndex
CREATE INDEX "Initiative_status_idx" ON "Initiative"("status");

-- CreateIndex
CREATE INDEX "Initiative_priority_idx" ON "Initiative"("priority");

-- CreateIndex
CREATE INDEX "Initiative_dueDate_idx" ON "Initiative"("dueDate");

-- CreateIndex
CREATE INDEX "InitiativeTask_initiativeId_sortOrder_idx" ON "InitiativeTask"("initiativeId", "sortOrder");

-- CreateIndex
CREATE INDEX "InitiativeTask_initiativeId_status_idx" ON "InitiativeTask"("initiativeId", "status");

-- CreateIndex
CREATE INDEX "InitiativeTask_dueDate_status_idx" ON "InitiativeTask"("dueDate", "status");

-- CreateIndex
CREATE INDEX "InitiativeTask_assignedUserId_idx" ON "InitiativeTask"("assignedUserId");

-- CreateIndex
CREATE INDEX "InitiativeMilestone_initiativeId_sortOrder_idx" ON "InitiativeMilestone"("initiativeId", "sortOrder");

-- CreateIndex
CREATE INDEX "InitiativeMilestone_dueDate_idx" ON "InitiativeMilestone"("dueDate");

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeTask" ADD CONSTRAINT "InitiativeTask_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitiativeMilestone" ADD CONSTRAINT "InitiativeMilestone_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "Initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
