-- AlterTable
ALTER TABLE "TeamSeason" ADD COLUMN "trainingWebsiteVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "TeamSeason_trainingWebsiteVisible_idx" ON "TeamSeason"("trainingWebsiteVisible");
