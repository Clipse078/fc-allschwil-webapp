-- CLUB-DIRECTORY-04: External Team Competition Context
--
-- Adds providerLeagueName / providerGroupName to ExternalTeamProviderMapping
-- so provider-linked ExternalTeams (e.g. multiple SFV teams that all share
-- the same canonical club-managed name, such as "AC Rossoneri") can be
-- distinguished in the Club Directory UI by real sporting context (league,
-- competition group) actually reported by the provider — never invented,
-- never derived from the team name.
--
-- Both columns are nullable and provider-owned: refreshed on every sync
-- (see lib/club-directory/provider-sync.ts#buildExternalTeamMappingUpdate),
-- never written by any tenant-managed edit path, and never a substitute for
-- ExternalTeam.name / .categoryLabel (canonical tenant-managed identity,
-- untouched by this migration).

-- AlterTable
ALTER TABLE "ExternalTeamProviderMapping" ADD COLUMN     "providerGroupName" TEXT,
ADD COLUMN     "providerLeagueName" TEXT;
