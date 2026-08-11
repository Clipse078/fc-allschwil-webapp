-- ADMIN-DELETE-02A-C1: SFV match deletion suppression (tombstone).
--
-- A club admin holding matches.delete may permanently delete an
-- SFV-imported Match (Event, type=MATCH) at any time — dependencies are
-- impact/warnings, never blockers. Deleting the Match cascades away its
-- MatchExternalMapping (the (tenantId, provider, externalMatchId) identity
-- SFV sync upserts by), so without this table the very next schedule sync
-- would treat the fixture as brand new and recreate it. This table lets
-- lib/matchcenter/match-lifecycle-service.ts record exactly which provider
-- match was intentionally deleted, and lib/integrations/sfv/sync/
-- schedule-persistence.ts's create path skip it on every future sync.
--
-- Additive only: new table, new indexes, new foreign key. No existing data
-- or columns touched.

-- CreateTable
CREATE TABLE "SfvMatchDeletionTombstone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalMatchId" INTEGER NOT NULL,
    "externalSeasonId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedByUserId" TEXT,

    CONSTRAINT "SfvMatchDeletionTombstone_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SfvMatchDeletionTombstone" ADD CONSTRAINT "SfvMatchDeletionTombstone_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SfvMatchDeletionTombstone_tenantId_idx" ON "SfvMatchDeletionTombstone"("tenantId");

-- One tombstone per intentionally-deleted provider match.
CREATE UNIQUE INDEX "SfvMatchDeletionTombstone_tenantId_provider_externalMatchI_key" ON "SfvMatchDeletionTombstone"("tenantId", "provider", "externalMatchId");
