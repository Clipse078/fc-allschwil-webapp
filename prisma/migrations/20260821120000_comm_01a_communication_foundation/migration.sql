-- COMM-01A: Tenant-safe communication/collaboration foundation
--
-- Additive migration — does NOT modify or drop any existing table/column.
--
-- Creates:
--   CommunicationTargetType enum
--   CommunicationMessageDirection enum
--   CommunicationMessageChannel enum
--   CommunicationMessageStatus enum
--   CommunicationThread table
--   CommunicationMessage table
--   InternalComment table
--   CommentMention table
--
-- ARCHITECTURAL INVARIANTS:
--   - One canonical thread per tenantId + targetType + targetId (@@unique).
--   - Every row carries explicit tenantId for defensive querying.
--   - Target ownership validated at service layer before thread creation.
--   - inboundReplyToken: opaque routing token for future inbound email (COMM-01D).

-- CreateEnum
CREATE TYPE "CommunicationTargetType" AS ENUM ('REGISTRATION', 'WAITING_LIST_ENTRY', 'PERSON', 'TEAM', 'TRAINING', 'MATCH', 'TOURNAMENT', 'DOCUMENT', 'MEETING', 'INITIATIVE');

-- CreateEnum
CREATE TYPE "CommunicationMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CommunicationMessageChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "CommunicationMessageStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateTable
CREATE TABLE "CommunicationThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "targetType" "CommunicationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "inboundReplyToken" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "CommunicationMessageDirection" NOT NULL,
    "channel" "CommunicationMessageChannel" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "fromAddress" TEXT,
    "toAddresses" JSONB,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "messageIdHeader" TEXT,
    "inReplyTo" TEXT,
    "references" JSONB,
    "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentMention" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationThread_inboundReplyToken_key" ON "CommunicationThread"("inboundReplyToken");

-- CreateIndex
CREATE INDEX "CommunicationThread_tenantId_idx" ON "CommunicationThread"("tenantId");

-- CreateIndex
CREATE INDEX "CommunicationThread_tenantId_createdAt_idx" ON "CommunicationThread"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationThread_tenantId_targetType_targetId_key" ON "CommunicationThread"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_idx" ON "CommunicationMessage"("tenantId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_threadId_idx" ON "CommunicationMessage"("tenantId", "threadId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_createdAt_idx" ON "CommunicationMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationMessage_tenantId_providerMessageId_idx" ON "CommunicationMessage"("tenantId", "providerMessageId");

-- CreateIndex
CREATE INDEX "InternalComment_tenantId_idx" ON "InternalComment"("tenantId");

-- CreateIndex
CREATE INDEX "InternalComment_tenantId_threadId_idx" ON "InternalComment"("tenantId", "threadId");

-- CreateIndex
CREATE INDEX "InternalComment_tenantId_createdAt_idx" ON "InternalComment"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CommentMention_tenantId_idx" ON "CommentMention"("tenantId");

-- CreateIndex
CREATE INDEX "CommentMention_tenantId_commentId_idx" ON "CommentMention"("tenantId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentMention_commentId_mentionedUserId_key" ON "CommentMention"("commentId", "mentionedUserId");

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalComment" ADD CONSTRAINT "InternalComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalComment" ADD CONSTRAINT "InternalComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalComment" ADD CONSTRAINT "InternalComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "InternalComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentMention" ADD CONSTRAINT "CommentMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
