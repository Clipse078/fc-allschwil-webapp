/**
 * Read-only DB trace for standings identity mappings.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { SFV_PROVIDER } from "@/lib/integrations/sfv/season-bridge";
import { currentTeamSeasonWhere } from "@/lib/teams/current-season";
import { loadEffectiveTeamStandingsMapping } from "@/lib/teams/team-standings-mapping";

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.STAGE_DB_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { key: "fc-allschwil" },
      select: { id: true, name: true, sfvConfig: true },
    });
    if (!tenant) throw new Error("tenant not found");
    console.log("TENANT", tenant.id, tenant.sfvConfig);

    const clubs = await prisma.externalClub.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { name: { contains: "Basler", mode: "insensitive" } },
          { name: { contains: "BVB", mode: "insensitive" } },
          { name: { contains: "Alemannia", mode: "insensitive" } },
          { name: { contains: "Betriebe", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        logoUrl: true,
        providerMappings: {
          select: { providerClubId: true, providerClubName: true },
        },
        externalTeams: {
          select: {
            id: true,
            name: true,
            shortName: true,
            providerMappings: {
              select: {
                providerTeamId: true,
                providerTeamName: true,
                providerClubId: true,
                providerLeagueName: true,
                providerGroupName: true,
              },
            },
          },
        },
      },
    });
    console.log("\nRELEVANT CLUBS", JSON.stringify(clubs, null, 2));

    const seasonWhere = currentTeamSeasonWhere(null);
    const seniorenTeams = await prisma.team.findMany({
      where: {
        tenantId: tenant.id,
        name: { contains: "Senioren 50", mode: "insensitive" },
        teamSeasons: { some: seasonWhere },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        teamSeasons: {
          where: seasonWhere,
          take: 1,
          select: {
            id: true,
            displayName: true,
            season: { select: { key: true } },
          },
        },
      },
    });
    console.log("\nSENIOREN TEAMS", JSON.stringify(seniorenTeams, null, 2));

    for (const team of seniorenTeams) {
      const ts = team.teamSeasons[0];
      if (!ts) continue;
      const mapping = await loadEffectiveTeamStandingsMapping({
        tenantId: tenant.id,
        teamSeasonId: ts.id,
        seasonKey: ts.season.key,
      });
      console.log("\nMAPPING FOR", team.name, JSON.stringify(mapping, null, 2));
    }

    const dupClub = await prisma.$queryRaw<
      Array<{ providerClubId: number; count: bigint; ids: string }>
    >`
      SELECT "providerClubId", COUNT(*)::bigint AS count, string_agg("externalClubId", ',') AS ids
      FROM "ExternalClubProviderMapping"
      WHERE "tenantId" = ${tenant.id} AND provider = ${SFV_PROVIDER}
      GROUP BY "providerClubId"
      HAVING COUNT(*) > 1
    `;
    const dupTeam = await prisma.$queryRaw<
      Array<{ providerTeamId: number; count: bigint; ids: string }>
    >`
      SELECT "providerTeamId", COUNT(*)::bigint AS count, string_agg("externalTeamId", ',') AS ids
      FROM "ExternalTeamProviderMapping"
      WHERE "tenantId" = ${tenant.id} AND provider = ${SFV_PROVIDER}
      GROUP BY "providerTeamId"
      HAVING COUNT(*) > 1
    `;
    console.log("\nDUPLICATE providerClubId", dupClub);
    console.log("DUPLICATE providerTeamId", dupTeam);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
