-- AddColumn: Event.intermediateResultLabel
--
-- Stores the live or half-time intermediate score label for a match Event,
-- as provided by the SFV match-detail API (GET /api/match/{matchId}).
-- Format: "X:Y (HZ)" when an intermediate score is available; NULL otherwise.
--
-- This field is set and updated exclusively by match-detail synchronization
-- (Slice 3C). It is a provider-managed field and must never be treated as
-- club-managed data.
--
-- Safe: nullable column with no default — backward-compatible with all
-- existing Event rows (they will have intermediateResultLabel = NULL).

ALTER TABLE "Event" ADD COLUMN "intermediateResultLabel" TEXT;
