CREATE TYPE "ImprovementArea" AS ENUM ('TECHNIK', 'TAKTIK', 'ATHLETIK', 'MENTAL', 'TEAMKULTUR');

ALTER TABLE "Event" ADD COLUMN "improvementArea" "ImprovementArea";

CREATE TABLE "StrategyPlan" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyTarget" (
    "id" TEXT NOT NULL,
    "strategyPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "improvementArea" "ImprovementArea",
    "targetPercentage" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_seasonId_teamId_type_improvementArea_idx" ON "Event"("seasonId", "teamId", "type", "improvementArea");
CREATE INDEX "StrategyPlan_seasonId_teamId_idx" ON "StrategyPlan"("seasonId", "teamId");
CREATE INDEX "StrategyPlan_seasonId_isActive_idx" ON "StrategyPlan"("seasonId", "isActive");
CREATE UNIQUE INDEX "StrategyTarget_strategyPlanId_title_key" ON "StrategyTarget"("strategyPlanId", "title");
CREATE INDEX "StrategyTarget_strategyPlanId_improvementArea_idx" ON "StrategyTarget"("strategyPlanId", "improvementArea");

ALTER TABLE "StrategyPlan" ADD CONSTRAINT "StrategyPlan_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategyPlan" ADD CONSTRAINT "StrategyPlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategyTarget" ADD CONSTRAINT "StrategyTarget_strategyPlanId_fkey" FOREIGN KEY ("strategyPlanId") REFERENCES "StrategyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
