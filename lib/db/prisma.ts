import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { requireSafeTestDatabaseUrlForPrisma } from "@/lib/test/safe-test-database";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

// Vitest must never inherit a runtime DATABASE_URL. Any test that obtains the
// real application singleton must first prove an explicit local test target.
const connectionString =
  process.env.NODE_ENV === "test"
    ? requireSafeTestDatabaseUrlForPrisma()
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaPool = pool;
}
