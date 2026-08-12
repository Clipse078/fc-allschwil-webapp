/**
 * TEAM-SEASON-ORGUNIT-01: FC Allschwil 2026/2027 TeamSeasonOrgUnit Inventory
 *
 * Phase 1: Read-only inventory of all FC Allschwil teams for season 2026/2027.
 * Reports existing TeamSeasonOrgUnit assignments and identifies missing ones.
 * Does NOT mutate any data.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Locate tenant ---
  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { OR: [{ key: { contains: "allschwil" } }, { name: { contains: "Allschwil" } }] },
    select: { id: true, name: true, key: true },
  });
  console.log(`\n=== Tenant: ${tenant.name} (${tenant.key}) id=${tenant.id} ===`);

  // --- Locate season ---
  const season = await prisma.season.findFirstOrThrow({
    where: { key: "2026/2027" },
    select: { id: true, key: true, startDate: true, endDate: true },
  });
  console.log(`=== Season: ${season.key} id=${season.id} (${season.startDate.toISOString().slice(0,10)} - ${season.endDate.toISOString().slice(0,10)}) ===\n`);

  // --- Load all OrgUnits for this tenant ---
  const orgUnits = await prisma.orgUnit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, key: true, name: true, type: true, status: true },
    orderBy: { key: "asc" },
  });
  console.log("--- OrgUnits for tenant ---");
  for (const ou of orgUnits) {
    console.log(`  key=${ou.key.padEnd(20)} name=${ou.name.padEnd(30)} type=${ou.type} status=${ou.status} id=${ou.id}`);
  }

  const orgUnitByKey = new Map(orgUnits.map((ou) => [ou.key, ou]));

  // --- Canonical OrgUnit keys from task spec ---
  const canonicalKeys = ["aktive", "frauen", "junioren", "kinderfussball", "senioren", "trainingsgruppe"];

  // --- Load all Teams for this tenant ---
  const teams = await prisma.team.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      orgUnitId: true,
      teamSeasons: {
        where: { seasonId: season.id },
        select: {
          id: true,
          displayName: true,
          status: true,
          orgUnits: {
            select: {
              id: true,
              orgUnitId: true,
              isPrimary: true,
              orgUnit: { select: { key: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n--- Total teams for tenant: ${teams.length} ---`);

  // Teams that have a TeamSeason for this season
  const teamsWithSeason = teams.filter((t) => t.teamSeasons.length > 0);
  const teamsWithoutSeason = teams.filter((t) => t.teamSeasons.length === 0);

  console.log(`Teams with TeamSeason for ${season.key}: ${teamsWithSeason.length}`);
  console.log(`Teams without TeamSeason for ${season.key}: ${teamsWithoutSeason.length}`);
  if (teamsWithoutSeason.length > 0) {
    console.log("  (no TeamSeason — not relevant for this task):");
    for (const t of teamsWithoutSeason) {
      console.log(`    name=${t.name} id=${t.id}`);
    }
  }

  // --- Categorise by canonical OrgUnit ---
  const grouped: Record<string, typeof teamsWithSeason> = {};
  for (const k of [...canonicalKeys, "unresolved"]) grouped[k] = [];

  for (const team of teamsWithSeason) {
    const ts = team.teamSeasons[0];
    let assignedKey: string | null = null;

    if (ts.orgUnits.length > 0) {
      assignedKey = ts.orgUnits[0].orgUnit.key;
    } else if (team.orgUnitId) {
      // legacy assignment — use for grouping display only
      const legacyOu = orgUnits.find((ou) => ou.id === team.orgUnitId);
      if (legacyOu && canonicalKeys.includes(legacyOu.key)) {
        assignedKey = legacyOu.key;
      }
    }

    if (assignedKey && canonicalKeys.includes(assignedKey)) {
      grouped[assignedKey].push(team);
    } else {
      grouped["unresolved"].push(team);
    }
  }

  console.log("\n==============================");
  console.log("INVENTORY BY ORGUNIT GROUP");
  console.log("==============================");

  for (const key of [...canonicalKeys, "unresolved"]) {
    const ou = orgUnitByKey.get(key);
    const label = ou ? `${key} (${ou.name}) id=${ou.id}` : `${key} [OrgUnit NOT FOUND]`;
    console.log(`\n--- ${label} ---`);
    const groupTeams = grouped[key];
    if (groupTeams.length === 0) {
      console.log("  (no teams)");
      continue;
    }
    for (const team of groupTeams) {
      const ts = team.teamSeasons[0];
      const hasTsou = ts.orgUnits.length > 0;
      const legacyOu = team.orgUnitId ? orgUnits.find((ou) => ou.id === team.orgUnitId) : null;
      console.log(`  Team: ${team.name}`);
      console.log(`    id=${team.id} slug=${team.slug} category=${team.category}`);
      console.log(`    TeamSeason id=${ts.id} status=${ts.status}`);
      console.log(`    TeamSeasonOrgUnit: ${hasTsou ? ts.orgUnits.map((tsou) => `${tsou.orgUnit.key} (primary=${tsou.isPrimary})`).join(", ") : "MISSING"}`);
      console.log(`    Legacy orgUnitId: ${team.orgUnitId ?? "null"} ${legacyOu ? `(key=${legacyOu.key})` : ""}`);
    }
  }

  // --- Summary ---
  console.log("\n==============================");
  console.log("SUMMARY");
  console.log("==============================");

  const withTsou = teamsWithSeason.filter((t) => t.teamSeasons[0].orgUnits.length > 0);
  const withoutTsou = teamsWithSeason.filter((t) => t.teamSeasons[0].orgUnits.length === 0);

  console.log(`Total teams with season ${season.key}: ${teamsWithSeason.length}`);
  console.log(`  Already have TeamSeasonOrgUnit: ${withTsou.length}`);
  console.log(`  MISSING TeamSeasonOrgUnit: ${withoutTsou.length}`);
  console.log(`\nMissing teams detail:`);
  for (const team of withoutTsou) {
    const ts = team.teamSeasons[0];
    const legacyOu = team.orgUnitId ? orgUnits.find((ou) => ou.id === team.orgUnitId) : null;
    console.log(
      `  ${team.name.padEnd(40)} legacy=${legacyOu ? legacyOu.key : "null"} TeamSeason=${ts.id}`
    );
  }

  console.log("\nUnresolved teams (cannot map to canonical OrgUnit):");
  if (grouped["unresolved"].length === 0) {
    console.log("  (none)");
  } else {
    for (const team of grouped["unresolved"]) {
      const ts = team.teamSeasons[0];
      const legacyOu = team.orgUnitId ? orgUnits.find((ou) => ou.id === team.orgUnitId) : null;
      console.log(`  ${team.name.padEnd(40)} legacy=${legacyOu ? legacyOu.key : "null"} orgUnitId=${team.orgUnitId ?? "null"}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
