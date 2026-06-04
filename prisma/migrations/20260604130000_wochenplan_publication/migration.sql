-- Website Weekplan Publishing + Active Variant Display
-- Adds WochenplanPublication to track active plan variant per week per tenant.
-- Safe and non-destructive: new table only, no existing columns modified.
--
-- variantLabel stores the human-readable plan name shown on InfoBoard / website,
-- e.g. "Normalplan", "Schlechtwetter-Wochenplan", "Ferienplan".
-- Public display format: "KW 23 | Schlechtwetter-Wochenplan aktiv"

-- CreateTable: WochenplanPublication
CREATE TABLE "WochenplanPublication" (
    "id"                TEXT         NOT NULL,
    "tenantId"          TEXT         NOT NULL,
    "weekId"            TEXT         NOT NULL,
    "variantLabel"      TEXT         NOT NULL DEFAULT 'Normalplan',
    "isPublished"       BOOLEAN      NOT NULL DEFAULT false,
    "publishedAt"       TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WochenplanPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WochenplanPublication_tenantId_weekId_key"
    ON "WochenplanPublication"("tenantId", "weekId");

CREATE INDEX "WochenplanPublication_tenantId_weekId_idx"
    ON "WochenplanPublication"("tenantId", "weekId");

CREATE INDEX "WochenplanPublication_tenantId_isPublished_idx"
    ON "WochenplanPublication"("tenantId", "isPublished");

-- AddForeignKey: WochenplanPublication → Tenant
ALTER TABLE "WochenplanPublication"
    ADD CONSTRAINT "WochenplanPublication_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
