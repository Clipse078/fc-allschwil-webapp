-- TOURNAMENTCENTER-UX-03: canonical ExternalClub participant identity.
--
-- New external TournamentParticipant rows reference the canonical
-- ExternalClub directly (externalClubId) plus a tournament-specific
-- Anzeigename (displayName), instead of an ExternalTeam. This is purely
-- additive:
--   - teamId / externalTeamId / manualLabel are untouched.
--   - Existing externalTeamId-linked participants remain fully
--     readable/editable and unaffected by this migration.
--   - No uniqueness constraint is added on externalClubId (deliberately —
--     the same ExternalClub may participate in one tournament multiple
--     times with distinct displayName values, e.g. "AC Rossoneri" + "Gelb"
--     and "AC Rossoneri" + "E1").

-- AlterTable
ALTER TABLE "TournamentParticipant" ADD COLUMN     "externalClubId" TEXT,
ADD COLUMN     "displayName" TEXT;

-- CreateIndex
CREATE INDEX "TournamentParticipant_externalClubId_idx" ON "TournamentParticipant"("externalClubId");

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_externalClubId_fkey" FOREIGN KEY ("externalClubId") REFERENCES "ExternalClub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
