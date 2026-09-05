import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { assertSafeTestDatabase } from "@/lib/test/safe-test-database";

export type SafeTestPrisma = {
  prisma: PrismaClient;
  pool: Pool;
};

/**
 * The only supported factory for independent real Prisma clients in tests.
 * Validation completes before Pool construction, so an unsafe target is never
 * contacted. There is deliberately no DATABASE_URL fallback.
 */
export function createSafeTestPrismaClient(): SafeTestPrisma {
  const connectionString = assertSafeTestDatabase();
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return {
    prisma: new PrismaClient({ adapter }),
    pool,
  };
}
