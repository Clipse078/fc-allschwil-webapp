-- AddColumn: MatchExternalMapping.detailSyncedAt
--
-- Records the timestamp of the last successful match-detail synchronization
-- for each MatchExternalMapping row. Null until the first detail sync run.
--
-- Safe: nullable column, no default required, backward-compatible with
-- existing rows (all start with detailSyncedAt = NULL).

ALTER TABLE "MatchExternalMapping" ADD COLUMN "detailSyncedAt" TIMESTAMP(3);
