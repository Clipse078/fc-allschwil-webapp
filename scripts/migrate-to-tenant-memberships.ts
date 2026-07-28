/**
 * RPERM-02 — TenantMembership Backfill
 *
 * Reads User.tenantId and creates a TenantMembership row for every user
 * that has a tenantId and doesn't already have a membership record.
 *
 * Safe to run multiple times (idempotent).
 *
 * Output:
 *   created   — new TenantMembership rows created
 *   existing  — rows that already existed (skipped)
 *   skipped   — users with no tenantId
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      tenantId: true,
      isActive: true,
      createdAt: true,
    },
  });

  let created = 0;
  let existing = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.tenantId) {
      skipped++;
      continue;
    }

    const alreadyExists = await prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId: user.tenantId, userId: user.id } },
      select: { id: true },
    });

    if (alreadyExists) {
      existing++;
      continue;
    }

    await prisma.tenantMembership.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        isActive: user.isActive,
        joinedAt: user.createdAt,
        createdAt: user.createdAt,
      },
    });

    created++;
  }

  console.log(
    `TenantMembership backfill complete — created: ${created}, already existing: ${existing}, skipped (no tenantId): ${skipped}`,
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
