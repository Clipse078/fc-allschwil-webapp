-- CreateEnum
CREATE TYPE "ReviewWorkflowStage" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkflowDomain" AS ENUM ('EVENTS', 'SEASONS', 'TEAMS', 'PEOPLE', 'USERS', 'IMPORTS', 'WEBSITE', 'NEWS', 'INFOBOARD', 'WOCHENPLAN', 'FIXTURES', 'FUNCTIONS', 'SESSION_SECURITY');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'REVIEW', 'APPROVE', 'REJECT', 'PUBLISH', 'IMPORT');

-- AlterEnum
ALTER TYPE "EventSource" ADD VALUE 'MUNICIPALITY_API';

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'VACATION_PERIOD';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "approvedByUserId" TEXT,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedByUserId" TEXT,
ADD COLUMN     "rejectedByUserId" TEXT,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reviewStage" "ReviewWorkflowStage" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canAccessVereinsleitung" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canAttendVereinsleitungMeetings" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoleWorkflowRule" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "domain" "WorkflowDomain" NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "allowsDirectManage" BOOLEAN NOT NULL DEFAULT false,
    "allowsReview" BOOLEAN NOT NULL DEFAULT false,
    "allowsApprove" BOOLEAN NOT NULL DEFAULT false,
    "allowsPublish" BOOLEAN NOT NULL DEFAULT false,
    "allowsSeriesReview" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleWorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleWorkflowReviewAssignment" (
    "id" TEXT NOT NULL,
    "workflowRuleId" TEXT NOT NULL,
    "reviewerRoleId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleWorkflowReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleWorkflowRule_domain_action_idx" ON "RoleWorkflowRule"("domain", "action");

-- CreateIndex
CREATE INDEX "RoleWorkflowRule_isActive_idx" ON "RoleWorkflowRule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RoleWorkflowRule_roleId_domain_action_key" ON "RoleWorkflowRule"("roleId", "domain", "action");

-- CreateIndex
CREATE INDEX "RoleWorkflowReviewAssignment_reviewerRoleId_idx" ON "RoleWorkflowReviewAssignment"("reviewerRoleId");

-- CreateIndex
CREATE INDEX "RoleWorkflowReviewAssignment_sortOrder_idx" ON "RoleWorkflowReviewAssignment"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoleWorkflowReviewAssignment_workflowRuleId_reviewerRoleId_key" ON "RoleWorkflowReviewAssignment"("workflowRuleId", "reviewerRoleId");

-- CreateIndex
CREATE INDEX "Event_reviewStage_idx" ON "Event"("reviewStage");

-- CreateIndex
CREATE INDEX "Event_reviewRequestedAt_idx" ON "Event"("reviewRequestedAt");

-- CreateIndex
CREATE INDEX "Event_publishedAt_idx" ON "Event"("publishedAt");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_canAccessVereinsleitung_idx" ON "Role"("canAccessVereinsleitung");

-- CreateIndex
CREATE INDEX "Role_canAttendVereinsleitungMeetings_idx" ON "Role"("canAttendVereinsleitungMeetings");

-- AddForeignKey
ALTER TABLE "RoleWorkflowRule" ADD CONSTRAINT "RoleWorkflowRule_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleWorkflowReviewAssignment" ADD CONSTRAINT "RoleWorkflowReviewAssignment_workflowRuleId_fkey" FOREIGN KEY ("workflowRuleId") REFERENCES "RoleWorkflowRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleWorkflowReviewAssignment" ADD CONSTRAINT "RoleWorkflowReviewAssignment_reviewerRoleId_fkey" FOREIGN KEY ("reviewerRoleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;