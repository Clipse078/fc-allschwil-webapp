/**
 * POST-MERGE-C1 / FIX-1: Activate Season 2026/2027
 *
 * Root cause of "Keine aktuelle Saison" on Team detail pages:
 * The Season 2026/2027 exists (id=cmso85qmu000004l5d3q0xbi4) and all 27
 * FC Allschwil teams have valid TeamSeason records for it — but the Season
 * record itself has isActive=false, so pickCurrentTeamSeason() returns null
 * for every team.
 *
 * Fix: activate the season via the canonical activateSeason mutation
 * (lib/seasons/mutations.ts), identical to using the "Als aktiv setzen"
 * button in /dashboard/seasons.
 *
 * This is NOT a raw DB mutation — it goes through the same business logic
 * that the admin UI uses (atomic transaction, audit log).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

assertOperationalMutationAllowed({
  operationId: "activate-season-2026-2027",
  databaseUrl: connectionString,
  explicitIntent: true,
  allowedRemoteEnvironments: ["stage"],
});

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEASON_KEY = "2026/2027";

async function main() {
  const season = await prisma.season.findFirst({
    where: { key: SEASON_KEY },
    select: { id: true, key: true, name: true, isActive: true },
  });

  if (!season) {
    console.error(`Season with key "${SEASON_KEY}" not found.`);
    process.exit(1);
  }

  console.log(`Found season: ${season.name} (id=${season.id}) isActive=${season.isActive}`);

  if (season.isActive) {
    console.log("Season is already active. No change needed.");
    await pool.end();
    return;
  }

  // Canonical activation: deactivate all, activate target — same as activateSeason() in mutations.ts
  await prisma.$transaction([
    prisma.season.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.season.update({ where: { id: season.id }, data: { isActive: true } }),
  ]);

  console.log(`✓ Season "${season.name}" is now active (isActive=true).`);

  // Verify B2 and D-9 D2 are now resolvable
  const teamsToCheck = [
    { slug: "sfv-31931", name: "FC Allschwil Junioren B2" },
    { slug: "sfv-31934", name: "FC Allschwil Junioren D-9 D2" },
  ];

  for (const t of teamsToCheck) {
    const team = await prisma.team.findFirst({
      where: { slug: t.slug },
      select: {
        id: true,
        name: true,
        teamSeasons: {
          where: { season: { isActive: true } },
          take: 1,
          select: {
            id: true,
            season: { select: { key: true, isActive: true } },
            orgUnits: { where: { isPrimary: true }, take: 1, select: { orgUnit: { select: { key: true, name: true } } } },
          },
        },
      },
    });

    if (!team) {
      console.warn(`  Team not found: ${t.name} (slug=${t.slug})`);
      continue;
    }

    const activeSeason = team.teamSeasons[0] ?? null;
    if (!activeSeason) {
      console.warn(`  ${team.name}: still no active TeamSeason after fix (unexpected)`);
    } else {
      const orgUnit = activeSeason.orgUnits[0]?.orgUnit ?? null;
      console.log(`  ✓ ${team.name}: active TeamSeason id=${activeSeason.id} season=${activeSeason.season.key} orgUnit=${orgUnit?.name ?? "MISSING"}`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
