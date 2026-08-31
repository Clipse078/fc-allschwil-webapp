/**
 * Simulate standings pipeline for Senioren 50+/7 using DB + fixture provider rows.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import {
  buildCanonicalClubNameIndexes,
  resolveCanonicalClubFromProviderTeamName,
} from "@/lib/club-directory/canonical-club-resolution";
import { normalizeClubNameForLookup } from "@/lib/club-directory/club-name-normalization";
import {
  buildStandingsClubEnrichmentByProviderTeamId,
  type StandingsClubEnrichmentDatabase,
} from "@/lib/club-directory/standings-club-enrichment";
import { resolveStandingsTable } from "@/lib/integrations/sfv/standings-table";
import type { ClubRankingEntry } from "@/lib/integrations/sfv/client";
import { presentStandingsRows } from "@/lib/sporting-data/standings-row-presentation";
import { mapPublicTeamStandings } from "@/lib/website/public-team-standings-mapper";

const FIXTURE_ROWS: Array<{
  position: number;
  teamName: string;
  teamId: number;
  clubNumber: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}> = [
  { position: 1, teamName: "FC Therwil a", teamId: 0, clubNumber: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  { position: 2, teamName: "FC Allschwil", teamId: 47357, clubNumber: 483, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  { position: 3, teamName: "AC Rossoneri", teamId: 0, clubNumber: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
  {
    position: 4,
    teamName: "BVB BCO Alemannia",
    teamId: 61472,
    clubNumber: 3202,
    matches: 2,
    wins: 1,
    draws: 0,
    losses: 1,
    goalsFor: 14,
    goalsAgainst: 10,
    points: 3,
  },
  { position: 5, teamName: "FC Amicitia Riehen", teamId: 0, clubNumber: 0, matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
];

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.STAGE_DB_URL;
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });
  const tenant = await prisma.tenant.findUnique({ where: { key: "fc-allschwil" }, select: { id: true, logoUrl: true } });
  if (!tenant) throw new Error("tenant missing");

  const dbTeams = await prisma.externalTeamProviderMapping.findMany({
    where: {
      tenantId: tenant.id,
      provider: SFV_PROVIDER,
      providerLeagueName: "Senioren 50+/7",
      providerGroupName: { contains: "Gruppe" },
    },
    select: {
      providerTeamId: true,
      providerTeamName: true,
      providerClubId: true,
      externalTeam: {
        select: {
          id: true,
          name: true,
          externalClub: { select: { id: true, name: true, shortName: true } },
        },
      },
    },
  });
  console.log("DB TEAMS IN LEAGUE", JSON.stringify(dbTeams, null, 2));

  for (const row of FIXTURE_ROWS) {
    if (!row.teamId) continue;
    const db = dbTeams.find((t) => t.providerTeamId === row.teamId);
    if (!db) console.log("MISSING DB MAPPING FOR", row.teamId, row.teamName);
  }

  const entries: ClubRankingEntry[] = FIXTURE_ROWS.map((row) => ({
    leagueId: 17161,
    leagueNumber: 0,
    leagueName: "Senioren 50+/7",
    divisionId: 1,
    divisionName: "Vorrunde",
    groupId: 1,
    groupName: "Gruppe 1",
    teamName: row.teamName,
    clubNumber: row.clubNumber,
    position: row.position,
    matches: row.matches,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    penaltyPoints: 0,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    teamId: row.teamId || 90000 + row.position,
  }));

  const table = resolveStandingsTable({
    entries,
    externalTeamId: 47357,
    providerLeagueId: 17161,
  });

  const identityDatabase: StandingsClubEnrichmentDatabase = {
    externalTeam: prisma.externalTeam as unknown as StandingsClubEnrichmentDatabase["externalTeam"],
    externalClub: prisma.externalClub as unknown as StandingsClubEnrichmentDatabase["externalClub"],
  };

  const enrichment = await buildStandingsClubEnrichmentByProviderTeamId({
    tenantId: tenant.id,
    rows: table!.rows.map((r) => ({ providerTeamId: r.externalTeamId, providerTeamName: r.teamName })),
    database: identityDatabase,
  });

  const canonicalClubs = await prisma.externalClub.findMany({
    where: { tenantId: tenant.id, archivedAt: null },
    select: {
      id: true,
      name: true,
      shortName: true,
      alternativeName: true,
      logoUrl: true,
      providerMappings: { select: { providerClubName: true } },
    },
  });
  const indexes = buildCanonicalClubNameIndexes(canonicalClubs);

  const publicStandings = mapPublicTeamStandings(table!, {
    currentExternalTeamId: 47357,
    currentTeamName: "FC Allschwil Senioren 50+",
    currentTeamShortName: null,
    tenantLogoUrl: tenant.logoUrl,
    enrichmentByProviderTeamId: enrichment,
  });

  for (const pos of [3, 4, 5]) {
    const providerRow = table!.rows.find((r) => r.position === pos)!;
    const publicRow = publicStandings.rows.find((r) => r.position === pos)!;
    const enrich = enrichment.get(providerRow.externalTeamId);
    const text = resolveCanonicalClubFromProviderTeamName(providerRow.teamName, indexes);
    console.log("\nPOS", pos);
    console.log("provider", providerRow.teamName, providerRow.externalTeamId);
    console.log("normalized", normalizeClubNameForLookup(providerRow.teamName));
    console.log("textResolution", text);
    console.log("enrichment", enrich);
    console.log("public", publicRow.team);
    console.log(
      "websiteDisplay(shortName||name)",
      publicRow.team.shortName?.trim() || publicRow.team.name,
    );
  }

  await prisma.$disconnect();
}

void main();
