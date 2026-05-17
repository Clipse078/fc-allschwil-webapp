/**
 * backfill-fc-allschwil-tenant.ts
 *
 * One-shot backfill: sets tenantId on Season, Team, and Event rows that
 * currently have tenantId = NULL, pointing them to the FC Allschwil tenant.
 *
 * Safe to run multiple times — only rows with tenantId IS NULL are touched.
 * No rows are deleted or structurally changed.
 *
 * Run with:
 *   npm run backfill:tenant:fca
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FC_ALLSCHWIL_SLUG = "fc-allschwil";

async function backfill() {
  console.log("\n── FC Allschwil tenant backfill ──────────────────────────");

  // ── 1. Resolve the fc-allschwil tenant ────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({
    where: { slug: FC_ALLSCHWIL_SLUG },
    select: { id: true, slug: true, name: true },
  });

  if (!tenant) {
    console.error(
      `\nERROR: Tenant with slug "${FC_ALLSCHWIL_SLUG}" not found.\n` +
        "Run  npm run bootstrap:admin  first to seed the tenant record.",
    );
    process.exit(1);
  }

  console.log(`✓  Tenant found:   ${tenant.name} (id: ${tenant.id})`);

  // ── 2. Count rows to be backfilled ────────────────────────────────────────
  const [nullSeasons, nullTeams, nullEvents] = await Promise.all([
    prisma.season.count({ where: { tenantId: null } }),
    prisma.team.count({ where: { tenantId: null } }),
    prisma.event.count({ where: { tenantId: null } }),
  ]);

  console.log(`\n   Rows with tenantId = NULL:`);
  console.log(`   Season  ${nullSeasons}`);
  console.log(`   Team    ${nullTeams}`);
  console.log(`   Event   ${nullEvents}`);

  if (nullSeasons === 0 && nullTeams === 0 && nullEvents === 0) {
    console.log("\n   Nothing to backfill — all rows already have a tenantId.\n");
    return;
  }

  // ── 3. Backfill ───────────────────────────────────────────────────────────
  const [seasonResult, teamResult, eventResult] = await Promise.all([
    nullSeasons > 0
      ? prisma.season.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        })
      : Promise.resolve({ count: 0 }),

    nullTeams > 0
      ? prisma.team.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        })
      : Promise.resolve({ count: 0 }),

    nullEvents > 0
      ? prisma.event.updateMany({
          where: { tenantId: null },
          data: { tenantId: tenant.id },
        })
      : Promise.resolve({ count: 0 }),
  ]);

  console.log(`\n   Rows updated:`);
  console.log(`   Season  ${seasonResult.count}`);
  console.log(`   Team    ${teamResult.count}`);
  console.log(`   Event   ${eventResult.count}`);
  console.log(`\n✓  Backfill complete.\n`);
  console.log(
    "   All null-tenantId rows for Season, Team and Event now point to:\n" +
      `   ${tenant.name} (slug: ${tenant.slug}, id: ${tenant.id})\n`,
  );
}

backfill()
  .catch((error: unknown) => {
    console.error("\nbackfill-fc-allschwil-tenant failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
