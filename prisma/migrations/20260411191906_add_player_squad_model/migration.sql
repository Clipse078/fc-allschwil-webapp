-- CreateEnum
CREATE TYPE "PlayerSquadStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'INJURED', 'ABSENT', 'ARCHIVED');

-- AlterTable
ALTER TABLE "TeamSeason" ADD COLUMN     "squadWebsiteVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trainerTeamWebsiteVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PlayerSquadMember" (
    "id" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "PlayerSquadStatus" NOT NULL DEFAULT 'ACTIVE',
    "shirtNumber" INTEGER,
    "positionLabel" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isViceCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isWebsiteVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerSquadMember_personId_idx" ON "PlayerSquadMember"("personId");

-- CreateIndex
CREATE INDEX "PlayerSquadMember_teamSeasonId_status_idx" ON "PlayerSquadMember"("teamSeasonId", "status");

-- CreateIndex
CREATE INDEX "PlayerSquadMember_teamSeasonId_isWebsiteVisible_idx" ON "PlayerSquadMember"("teamSeasonId", "isWebsiteVisible");

-- CreateIndex
CREATE INDEX "PlayerSquadMember_teamSeasonId_sortOrder_idx" ON "PlayerSquadMember"("teamSeasonId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSquadMember_teamSeasonId_personId_key" ON "PlayerSquadMember"("teamSeasonId", "personId");

-- CreateIndex
CREATE INDEX "TeamSeason_squadWebsiteVisible_idx" ON "TeamSeason"("squadWebsiteVisible");

-- CreateIndex
CREATE INDEX "TeamSeason_trainerTeamWebsiteVisible_idx" ON "TeamSeason"("trainerTeamWebsiteVisible");

-- AddForeignKey
ALTER TABLE "PlayerSquadMember" ADD CONSTRAINT "PlayerSquadMember_teamSeasonId_fkey" FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSquadMember" ADD CONSTRAINT "PlayerSquadMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
