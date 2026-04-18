-- CreateEnum
CREATE TYPE "TrainerTeamStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "PermissionModule" ADD VALUE 'SEASONS';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPlayer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTrainer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TrainerTeamMember" (
    "id" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "TrainerTeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "roleLabel" TEXT,
    "isWebsiteVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainerTeamMember_personId_idx" ON "TrainerTeamMember"("personId");

-- CreateIndex
CREATE INDEX "TrainerTeamMember_teamSeasonId_status_idx" ON "TrainerTeamMember"("teamSeasonId", "status");

-- CreateIndex
CREATE INDEX "TrainerTeamMember_teamSeasonId_isWebsiteVisible_idx" ON "TrainerTeamMember"("teamSeasonId", "isWebsiteVisible");

-- CreateIndex
CREATE INDEX "TrainerTeamMember_teamSeasonId_sortOrder_idx" ON "TrainerTeamMember"("teamSeasonId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerTeamMember_teamSeasonId_personId_key" ON "TrainerTeamMember"("teamSeasonId", "personId");

-- CreateIndex
CREATE INDEX "Person_isActive_idx" ON "Person"("isActive");

-- CreateIndex
CREATE INDEX "Person_isPlayer_idx" ON "Person"("isPlayer");

-- CreateIndex
CREATE INDEX "Person_isTrainer_idx" ON "Person"("isTrainer");

-- AddForeignKey
ALTER TABLE "TrainerTeamMember" ADD CONSTRAINT "TrainerTeamMember_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerTeamMember" ADD CONSTRAINT "TrainerTeamMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
