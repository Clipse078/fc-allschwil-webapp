/**
 * Standalone diagnostic script — run with:
 *   npx tsx scripts/debug-team-schema.ts
 *
 * Queries information_schema for the Team table to identify
 * NOT NULL columns with no DB default (must be explicitly supplied).
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
  const rows = await prisma.$queryRaw<
    Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>
  >`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Team'
    ORDER BY ordinal_position
  `;

  console.log("\n── Team table columns (information_schema) ──────────────────────────");
  for (const row of rows) {
    const nullable = row.is_nullable === "YES" ? "NULL    " : "NOT NULL";
    const def = row.column_default ? ` DEFAULT ${row.column_default}` : " (no default)";
    console.log(`  ${row.column_name.padEnd(22)} ${row.data_type.padEnd(18)} ${nullable}${def}`);
  }

  const required = rows.filter((r) => r.is_nullable === "NO" && r.column_default === null);
  console.log("\n── NOT NULL columns with NO default (required in INSERT) ────────────");
  if (required.length === 0) {
    console.log("  (none — all NOT NULL columns have a default or are auto-managed)");
  } else {
    for (const r of required) {
      console.log(`  ✗ ${r.column_name} (${r.data_type})`);
    }
  }

  const seedPayload = [
    "name",
    "slug",
    "category",
    "genderGroup",
    "ageGroup",
    "sortOrder",
    "isActive",
    "websiteVisible",
    "infoboardVisible",
    "updatedAt",
    "tenantId",
  ];

  const missingFromPayload = required.filter(
    (r) => !seedPayload.includes(r.column_name) && r.column_name !== "id" && r.column_name !== "createdAt",
  );

  console.log("\n── Columns required by DB but missing from seed payload ─────────────");
  if (missingFromPayload.length === 0) {
    console.log("  ✓ All required columns are covered by the seed payload.");
  } else {
    for (const r of missingFromPayload) {
      console.log(`  ✗ MISSING: ${r.column_name} (${r.data_type}) — add to syncTeam create payload`);
    }
  }

  console.log("\n── Seed payload fields ───────────────────────────────────────────────");
  for (const f of seedPayload) {
    const col = rows.find((r) => r.column_name === f);
    if (col) {
      const nullable = col.is_nullable === "YES" ? "NULL" : "NOT NULL";
      console.log(`  ✓ ${f.padEnd(22)} → DB column exists (${nullable})`);
    } else {
      console.log(`  ? ${f.padEnd(22)} → not found in DB (extra field, Prisma will ignore)`);
    }
  }

  console.log("");
}

main()
  .catch((e) => {
    console.error("debug-team-schema failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
