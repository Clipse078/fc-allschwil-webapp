-- CreateTable
CREATE TABLE "PlanningTimeSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningTimeSlot_tenantId_key_key" ON "PlanningTimeSlot"("tenantId", "key");

-- CreateIndex
CREATE INDEX "PlanningTimeSlot_tenantId_isActive_idx" ON "PlanningTimeSlot"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "PlanningTimeSlot_tenantId_sortOrder_idx" ON "PlanningTimeSlot"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PlanningTimeSlot" ADD CONSTRAINT "PlanningTimeSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
