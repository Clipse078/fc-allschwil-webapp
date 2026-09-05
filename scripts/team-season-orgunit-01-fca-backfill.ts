/**
 * TEAM-SEASON-ORGUNIT-01: FC Allschwil 2026/2027 TeamSeasonOrgUnit Backfill
 *
 * Phase 3: Creates missing TeamSeasonOrgUnit records for season 2026/2027.
 *
 * Strategy:
 *   - Only targets FC Allschwil (fc-allschwil) and season 2026/2027.
 *   - Only creates records where the Team has NO existing TeamSeasonOrgUnit
 *     for its TeamSeason in this season.
 *   - OrgUnit is determined from existing legacy Team.orgUnitId.
 *   - If legacyOrgUnitId is null → left UNRESOLVED (not touched).
 *   - Never overwrites an existing TeamSeasonOrgUnit.
 *   - Idempotent: safe to run multiple times.
 *   - Never modifies Team.orgUnitId, Team.name, or any other field.
 *   - No other tenants or seasons are affected.
 *
 * Run with: npx tsx scripts/team-season-orgunit-01-fca-backfill.ts
 * Add --dry-run to preview without writing.
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

const DRY_RUN = process.argv.includes("--dry-run");
if (!DRY_RUN) {
  assertOperationalMutationAllowed({
    operationId: "team-season-orgunit-01-fca-backfill",
    databaseUrl: connectionString,
    explicitIntent: true,
    allowedRemoteEnvironments: ["stage"],
  });
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(DRY_RUN ? "\n=== DRY RUN (no writes) ===" : "\n=== LIVE RUN ===");

  // --- Locate tenant ---
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { key: "fc-allschwil" },
    select: { id: true, name: true, key: true },
  });
  console.log(`\nTenant: ${tenant.name} (${tenant.key}) id=${tenant.id}`);

  // --- Locate season ---
  const season = await prisma.season.findUniqueOrThrow({
    where: { key: "2026/2027" },
    select: { id: true, key: true },
  });
  console.log(`Season: ${season.key} id=${season.id}`);

  // --- Load all Teams for this tenant with their TeamSeason for this season ---
  const teams = await prisma.team.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      orgUnitId: true,
      teamSeasons: {
        where: { seasonId: season.id },
        select: {
          id: true,
          orgUnits: {
            select: { id: true },
          },
        },
      },
    },
  });

  const teamsWithSeason = teams.filter((t) => t.teamSeasons.length > 0);
  const missing = teamsWithSeason.filter((t) => t.teamSeasons[0].orgUnits.length === 0);
  const alreadyAssigned = teamsWithSeason.filter((t) => t.teamSeasons[0].orgUnits.length > 0);

  console.log(`\nTeams with season: ${teamsWithSeason.length}`);
  console.log(`Already have TeamSeasonOrgUnit: ${alreadyAssigned.length} (will not be touched)`);
  console.log(`Missing TeamSeasonOrgUnit: ${missing.length}`);

  // --- Load OrgUnits for verification ---
  const orgUnits = await prisma.orgUnit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, key: true, name: true, status: true },
  });
  const orgUnitById = new Map(orgUnits.map((ou) => [ou.id, ou]));

  // --- Partition missing teams ---
  const deterministic: Array<{
    team: (typeof missing)[0];
    teamSeasonId: string;
    orgUnitId: string;
    orgUnitKey: string;
  }> = [];
  const unresolved: Array<{ name: string; teamId: string; reason: string }> = [];

  for (const team of missing) {
    const ts = team.teamSeasons[0];

    if (!team.orgUnitId) {
      unresolved.push({
        name: team.name,
        teamId: team.id,
        reason: "No legacy orgUnitId",
      });
      continue;
    }

    const legacyOu = orgUnitById.get(team.orgUnitId);
    if (!legacyOu) {
      unresolved.push({
        name: team.name,
        teamId: team.id,
        reason: `Legacy orgUnitId ${team.orgUnitId} not found in OrgUnits`,
      });
      continue;
    }

    if (legacyOu.status !== "ACTIVE") {
      unresolved.push({
        name: team.name,
        teamId: team.id,
        reason: `Legacy OrgUnit ${legacyOu.key} is not ACTIVE (status=${legacyOu.status})`,
      });
      continue;
    }

    deterministic.push({
      team,
      teamSeasonId: ts.id,
      orgUnitId: legacyOu.id,
      orgUnitKey: legacyOu.key,
    });
  }

  console.log(`\nDeterministic assignments to create: ${deterministic.length}`);
  console.log(`Unresolved (will not be touched): ${unresolved.length}`);

  // --- Show plan ---
  console.log("\n--- Assignments to create ---");
  for (const item of deterministic) {
    console.log(
      `  [${DRY_RUN ? "DRY" : "WILL CREATE"}] ${item.team.name.padEnd(45)} → ${item.orgUnitKey} (TeamSeason=${item.teamSeasonId})`
    );
  }

  if (unresolved.length > 0) {
    console.log("\n--- Unresolved (left untouched) ---");
    for (const item of unresolved) {
      console.log(`  SKIP: ${item.name.padEnd(45)} reason="${item.reason}"`);
    }
  }

  if (DRY_RUN) {
    console.log("\n=== DRY RUN complete — no data written ===");
    return;
  }

  // --- Execute backfill ---
  console.log("\n--- Writing TeamSeasonOrgUnit records ---");
  let created = 0;
  let skipped = 0;

  for (const item of deterministic) {
    // Double-check: no existing assignment for this (teamSeasonId, orgUnitId)
    const existingCheck = await prisma.teamSeasonOrgUnit.findUnique({
      where: {
        teamSeasonId_orgUnitId: {
          teamSeasonId: item.teamSeasonId,
          orgUnitId: item.orgUnitId,
        },
      },
      select: { id: true },
    });

    if (existingCheck) {
      console.log(`  SKIP (already exists): ${item.team.name} → ${item.orgUnitKey}`);
      skipped++;
      continue;
    }

    await prisma.teamSeasonOrgUnit.create({
      data: {
        tenantId: tenant.id,
        teamSeasonId: item.teamSeasonId,
        orgUnitId: item.orgUnitId,
        isPrimary: true,
        displayOrder: 0,
      },
    });

    console.log(`  CREATED: ${item.team.name} → ${item.orgUnitKey}`);
    created++;
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already existed): ${skipped}`);
  console.log(`  Unresolved (not touched): ${unresolved.length}`);
  console.log(`  Pre-existing assignments preserved: ${alreadyAssigned.length}`);
}

main()
  .then(() => prisma.$disconnect().then(() => pool.end()))
  .catch((e) => {
    console.error(e);
    prisma.$disconnect().then(() => pool.end());
    process.exit(1);
  });
