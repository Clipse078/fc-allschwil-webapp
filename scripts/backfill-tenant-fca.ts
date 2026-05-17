/**
 * Backfill tenantId on existing Team, Season, and Event rows that don't have
 * one yet. Uses the "fc-allschwil" tenant as the target.
 * Safe to run multiple times — only updates rows with tenantId = NULL.
 *
 * Usage:
 *   npm run backfill:tenant:fca
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "fc-allschwil" },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error(
      "Tenant 'fc-allschwil' not found. Run npm run bootstrap:admin first.",
    );
  }

  console.log(`✓ Target tenant: ${tenant.name} (${tenant.id})`);

  // ── Teams ──────────────────────────────────────────────────────────────────
  const teamsResult = await prisma.team.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  console.log(`✓ Teams backfilled:   ${teamsResult.count} rows`);

  // ── Seasons ────────────────────────────────────────────────────────────────
  const seasonsResult = await prisma.season.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  console.log(`✓ Seasons backfilled: ${seasonsResult.count} rows`);

  // ── Events ─────────────────────────────────────────────────────────────────
  const eventsResult = await prisma.event.updateMany({
    where: { tenantId: null },
    data: { tenantId: tenant.id },
  });
  console.log(`✓ Events backfilled:  ${eventsResult.count} rows`);

  const total = teamsResult.count + seasonsResult.count + eventsResult.count;
  console.log(`\nBackfill complete — ${total} total rows updated.`);
}

main()
  .catch((e) => {
    console.error("backfill:tenant:fca failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
