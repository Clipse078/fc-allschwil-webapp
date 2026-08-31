/**
 * STANDINGS-INTEGRITY-01 — read-only full FCA standings audit.
 *
 * Usage:
 *   DATABASE_URL=<stage-url> npx tsx scripts/standings-integrity-01-audit.ts
 *   DATABASE_URL=<stage-url> npx tsx scripts/standings-integrity-01-audit.ts --trace "Senioren 50+"
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

import {
  buildCanonicalClubNameIndexes,
  resolveCanonicalClubFromProviderTeamName,
} from "@/lib/club-directory/canonical-club-resolution";
import { normalizeClubNameForLookup } from "@/lib/club-directory/club-name-normalization";
import {
  buildStandingsClubEnrichmentByProviderTeamId,
  type StandingsClubEnrichmentDatabase,
} from "@/lib/club-directory/standings-club-enrichment";
import { fetchClubRanking } from "@/lib/integrations/sfv/client";
import { resolveStandingsTable } from "@/lib/integrations/sfv/standings-table";
import { requireEnabledSfvConfigForTenant } from "@/lib/integrations/sfv/tenant-config-service";
import { presentStandingsRows } from "@/lib/sporting-data/standings-row-presentation";
import { mapPublicTeamStandings } from "@/lib/website/public-team-standings-mapper";
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";
import { loadEffectiveTeamStandingsMapping } from "@/lib/teams/team-standings-mapping";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";

const TENANT_KEY = "fc-allschwil";

type RowClassification =
  | "PASS"
  | "IDENTITY_MISMATCH"
  | "SPORTING_DATA_MISMATCH"
  | "UNRESOLVED_IDENTITY"
  | "LOGO_ONLY_MISSING";

type MismatchedRow = {
  team: string;
  competition: string;
  position: number;
  providerTeamId: number;
  providerName: string;
  publicName: string;
  publicShortName: string | null;
  classification: RowClassification;
  details: string;
};

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL ?? process.env.STAGE_DB_URL;
  if (!url) {
    throw new Error("DATABASE_URL or STAGE_DB_URL is required");
  }
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function traceTextResolution(
  providerTeamName: string,
  indexes: ReturnType<typeof buildCanonicalClubNameIndexes>,
) {
  const normalized = normalizeClubNameForLookup(providerTeamName);
  const exactCandidates = normalized
    ? [...indexes.exactIndex.entries()]
        .filter(([key]) => key === normalized)
        .map(([, club]) => club)
    : [];
  const prefixCandidates = normalized
    ? indexes.prefixVariants
        .filter(
          (variant) =>
            variant.variantLength > 0 &&
            normalized.startsWith(variant.normalized),
        )
        .slice(0, 10)
        .map((variant) => ({
          normalized: variant.normalized,
          clubId: variant.club.id,
          clubName: variant.club.name,
        }))
    : [];
  const winner = resolveCanonicalClubFromProviderTeamName(
    providerTeamName,
    indexes,
  );

  return {
    original: providerTeamName,
    normalized,
    exactCandidates: exactCandidates.map((club) => ({
      id: club.id,
      name: club.name,
    })),
    prefixCandidates,
    winner: winner
      ? { id: winner.id, name: winner.name, source: winner.source }
      : null,
  };
}

async function main() {
  const traceFilter = process.argv.includes("--trace")
    ? process.argv[process.argv.indexOf("--trace") + 1]
    : null;

  const prisma = createPrisma();

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { key: TENANT_KEY },
      select: { id: true, key: true, name: true, logoUrl: true },
    });
    if (!tenant) {
      throw new Error(`Tenant ${TENANT_KEY} not found`);
    }

    const seasonWhere = currentTeamSeasonWhere(null);
    const teams = await prisma.team.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        teamSeasons: { some: seasonWhere },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        teamSeasons: {
          where: seasonWhere,
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            displayName: true,
            shortName: true,
            season: { select: { key: true, name: true } },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const sfvConfig = await requireEnabledSfvConfigForTenant(tenant.id);
    const rawEntries = await fetchClubRanking({
      SeasonId: sfvConfig.defaultSeasonId,
      ClubId: sfvConfig.clubId,
      ...(sfvConfig.organisationId !== null
        ? { OrganisationId: sfvConfig.organisationId }
        : {}),
    });

    const canonicalClubs = await prisma.externalClub.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      select: {
        id: true,
        name: true,
        shortName: true,
        alternativeName: true,
        logoUrl: true,
        providerMappings: { select: { providerClubName: true, providerClubId: true } },
      },
    });
    const nameIndexes = buildCanonicalClubNameIndexes(canonicalClubs);

    const identityDatabase: StandingsClubEnrichmentDatabase = {
      externalTeam: prisma.externalTeam as unknown as StandingsClubEnrichmentDatabase["externalTeam"],
      externalClub: prisma.externalClub as unknown as StandingsClubEnrichmentDatabase["externalClub"],
    };

    const matrix: Array<{
      team: string;
      competition: string;
      providerTeamId: number;
      rows: number;
      identityMismatch: number;
      sportingMismatch: number;
      unresolved: number;
      logoMissing: number;
      official: "PASS" | "FAIL" | "UNAVAILABLE";
    }> = [];
    const mismatches: MismatchedRow[] = [];
    const providerUnavailable: string[] = [];

    for (const team of teams) {
      const teamSeason = team.teamSeasons[0];
      if (!teamSeason) continue;

      const mapping = await loadEffectiveTeamStandingsMapping({
        tenantId: tenant.id,
        teamSeasonId: teamSeason.id,
        seasonKey: teamSeason.season.key,
      });

      if (!mapping) continue;

      const standingsTable = resolveStandingsTable({
        entries: rawEntries,
        externalTeamId: mapping.externalTeamId,
        providerLeagueId: mapping.providerLeagueId,
      });

      if (!standingsTable) {
        providerUnavailable.push(
          `${team.name} | ${mapping.providerLeagueName ?? "unknown league"}`,
        );
        continue;
      }

      const competitionLabel = [
        standingsTable.competition.name,
        standingsTable.competition.divisionName,
        standingsTable.competition.groupName,
      ]
        .filter(Boolean)
        .join(" — ");

      const enrichment = await buildStandingsClubEnrichmentByProviderTeamId({
        tenantId: tenant.id,
        rows: standingsTable.rows.map((row) => ({
          providerTeamId: row.externalTeamId,
          providerTeamName: row.teamName,
        })),
        database: identityDatabase,
      });

      const publicStandings = mapPublicTeamStandings(standingsTable, {
        currentExternalTeamId: mapping.externalTeamId,
        currentTeamName: teamSeason.displayName,
        currentTeamShortName: teamSeason.shortName,
        tenantLogoUrl: tenant.logoUrl,
        enrichmentByProviderTeamId: enrichment,
      });

      const presented = presentStandingsRows({
        rows: standingsTable.rows,
        currentExternalTeamId: mapping.externalTeamId,
        currentTeamShortName: teamSeason.shortName,
        tenantLogoUrl: tenant.logoUrl,
        enrichmentByProviderTeamId: enrichment,
      });

      let identityMismatch = 0;
      let sportingMismatch = 0;
      let unresolved = 0;
      let logoMissing = 0;

      for (const providerRow of standingsTable.rows) {
        const publicRow = publicStandings.rows.find(
          (row) => row.position === providerRow.position,
        );
        const presentedRow = presented.find(
          (row) => row.position === providerRow.position,
        );
        const enrich = enrichment.get(providerRow.externalTeamId);

        if (!publicRow || !presentedRow) {
          sportingMismatch += 1;
          mismatches.push({
            team: team.name,
            competition: competitionLabel,
            position: providerRow.position,
            providerTeamId: providerRow.externalTeamId,
            providerName: providerRow.teamName,
            publicName: publicRow?.team.name ?? "(missing)",
            publicShortName: publicRow?.team.shortName ?? null,
            classification: "SPORTING_DATA_MISMATCH",
            details: "Public row missing for provider position",
          });
          continue;
        }

        const providerClubEntry = rawEntries.find(
          (entry) => entry.teamId === providerRow.externalTeamId,
        );

        const authoritativeIdentityName =
          enrich?.resolutionSource === "explicit_provider_mapping" &&
          enrich.providerTeamName?.trim()
            ? enrich.providerTeamName.trim()
            : providerRow.teamName;

        let classification: RowClassification = "PASS";
        const details: string[] = [];

        if (publicRow.team.name !== authoritativeIdentityName) {
          classification = "IDENTITY_MISMATCH";
          details.push(
            `name: authoritative="${authoritativeIdentityName}" ranking="${providerRow.teamName}" public="${publicRow.team.name}"`,
          );
        }

        const statsMismatch =
          publicRow.played !== providerRow.played ||
          publicRow.won !== providerRow.won ||
          publicRow.drawn !== providerRow.drawn ||
          publicRow.lost !== providerRow.lost ||
          publicRow.goalsFor !== providerRow.goalsFor ||
          publicRow.goalsAgainst !== providerRow.goalsAgainst ||
          publicRow.points !== providerRow.points ||
          publicRow.position !== providerRow.position;

        if (statsMismatch) {
          classification =
            classification === "IDENTITY_MISMATCH"
              ? "IDENTITY_MISMATCH"
              : "SPORTING_DATA_MISMATCH";
          details.push("sporting stats differ from provider");
        }

        if (
          enrich?.resolutionSource === "unresolved" ||
          enrich?.canonicalClubId == null
        ) {
          if (classification === "PASS") {
            classification = "UNRESOLVED_IDENTITY";
          }
          details.push("no safe canonical club resolution");
        } else if (!enrich.logoUrl && classification === "PASS") {
          classification = "LOGO_ONLY_MISSING";
          details.push("canonical resolution ok but logo missing");
        }

        if (classification === "IDENTITY_MISMATCH") identityMismatch += 1;
        else if (classification === "SPORTING_DATA_MISMATCH") sportingMismatch += 1;
        else if (classification === "UNRESOLVED_IDENTITY") unresolved += 1;
        else if (classification === "LOGO_ONLY_MISSING") logoMissing += 1;

        if (classification !== "PASS" && classification !== "LOGO_ONLY_MISSING") {
          mismatches.push({
            team: team.name,
            competition: competitionLabel,
            position: providerRow.position,
            providerTeamId: providerRow.externalTeamId,
            providerName: providerRow.teamName,
            publicName: publicRow.team.name,
            publicShortName: publicRow.team.shortName,
            classification,
            details: details.join("; "),
          });
        }

        const shouldTrace =
          traceFilter &&
          (team.name.toLowerCase().includes(traceFilter.toLowerCase()) ||
            competitionLabel.toLowerCase().includes(traceFilter.toLowerCase()));

        if (shouldTrace && [3, 4, 5].includes(providerRow.position)) {
          const explicitTeam = await prisma.externalTeam.findFirst({
            where: {
              tenantId: tenant.id,
              providerMappings: {
                some: {
                  provider: SFV_PROVIDER,
                  providerTeamId: providerRow.externalTeamId,
                },
              },
            },
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
              externalClub: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  logoUrl: true,
                  providerMappings: {
                    select: { providerClubId: true, providerClubName: true },
                  },
                },
              },
              providerMappings: {
                where: {
                  provider: SFV_PROVIDER,
                  providerTeamId: providerRow.externalTeamId,
                },
                select: {
                  providerTeamId: true,
                  providerClubId: true,
                  providerTeamName: true,
                },
              },
            },
          });

          const textResolution = traceTextResolution(
            providerRow.teamName,
            nameIndexes,
          );

          console.log("\n=== TRACE ROW", providerRow.position, "===");
          console.log("Team:", team.name);
          console.log("Competition:", competitionLabel);
          console.log("RAW PROVIDER:", {
            teamName: providerRow.teamName,
            teamId: providerRow.externalTeamId,
            clubNumber: providerClubEntry?.clubNumber ?? null,
            rank: providerRow.position,
            played: providerRow.played,
            wins: providerRow.won,
            draws: providerRow.drawn,
            losses: providerRow.lost,
            goalsFor: providerRow.goalsFor,
            goalsAgainst: providerRow.goalsAgainst,
            goalDifference: providerRow.goalsFor - providerRow.goalsAgainst,
            points: providerRow.points,
          });
          console.log("MAPPING:", {
            explicitExternalTeam: explicitTeam,
          });
          console.log("TEXT RESOLUTION:", textResolution);
          console.log("ENRICHMENT:", enrich);
          console.log("PRESENTED:", {
            teamName: presentedRow.teamName,
            shortName: presentedRow.shortName,
            logoUrl: presentedRow.logoUrl,
          });
          console.log("PUBLIC API:", {
            name: publicRow.team.name,
            shortName: publicRow.team.shortName,
            logoUrl: publicRow.team.logoUrl,
            canonicalWouldBe: enrich?.canonicalClubId,
          });
        }
      }

      matrix.push({
        team: team.name,
        competition: competitionLabel,
        providerTeamId: mapping.externalTeamId,
        rows: standingsTable.rows.length,
        identityMismatch,
        sportingMismatch,
        unresolved,
        logoMissing,
        official: identityMismatch + sportingMismatch > 0 ? "FAIL" : "PASS",
      });
    }

    console.log("\n=== FULL STANDINGS AUDIT MATRIX ===");
    console.log(
      "Team | Competition | Provider team ID | Rows | Identity mismatch | Sporting mismatch | Unresolved | Logo missing | Official",
    );
    for (const row of matrix) {
      console.log(
        [
          row.team,
          row.competition,
          row.providerTeamId,
          row.rows,
          row.identityMismatch,
          row.sportingMismatch,
          row.unresolved,
          row.logoMissing,
          row.official,
        ].join(" | "),
      );
    }

    console.log("\n=== MISMATCHED ROWS ===");
    if (mismatches.length === 0) {
      console.log("(none)");
    } else {
      for (const row of mismatches) {
        console.log(JSON.stringify(row));
      }
    }

    console.log("\n=== PROVIDER UNAVAILABLE ===");
    if (providerUnavailable.length === 0) {
      console.log("(none)");
    } else {
      for (const row of providerUnavailable) {
        console.log(row);
      }
    }

    const duplicateProviderClubIds = await prisma.$queryRaw<
      Array<{ providerClubId: number; count: bigint }>
    >`
      SELECT "providerClubId", COUNT(*)::bigint AS count
      FROM "ExternalClubProviderMapping"
      WHERE "tenantId" = ${tenant.id} AND provider = ${SFV_PROVIDER}
      GROUP BY "providerClubId"
      HAVING COUNT(*) > 1
    `;

    const duplicateProviderTeamIds = await prisma.$queryRaw<
      Array<{ providerTeamId: number; count: bigint }>
    >`
      SELECT "providerTeamId", COUNT(*)::bigint AS count
      FROM "ExternalTeamProviderMapping"
      WHERE "tenantId" = ${tenant.id} AND provider = ${SFV_PROVIDER}
      GROUP BY "providerTeamId"
      HAVING COUNT(*) > 1
    `;

    console.log("\n=== DATABASE DUPLICATES ===");
    console.log("Duplicate providerClubId:", duplicateProviderClubIds);
    console.log("Duplicate providerTeamId:", duplicateProviderTeamIds);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
