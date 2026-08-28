-- MATCHCENTER-CANONICAL-OPPONENT-01B: canonical guest-club identity for
-- manually created matches. Nullable FK — existing Event rows remain valid.

ALTER TABLE "Event" ADD COLUMN "opponentExternalClubId" TEXT;

CREATE INDEX "Event_opponentExternalClubId_idx" ON "Event"("opponentExternalClubId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_opponentExternalClubId_fkey" FOREIGN KEY ("opponentExternalClubId") REFERENCES "ExternalClub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
