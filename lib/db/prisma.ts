import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { requireSafeTestDatabaseUrlForPrisma } from "@/lib/test/safe-test-database";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};
let modulePrisma: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  const existing = modulePrisma ?? globalForPrisma.prisma;
  if (existing) {
    return existing;
  }

  // Vitest must never inherit a runtime DATABASE_URL. Any test that actually
  // uses the application client must first prove an explicit local test target.
  const connectionString =
    process.env.NODE_ENV === "test"
      ? requireSafeTestDatabaseUrlForPrisma()
      : process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not configured. Database-backed runtime features are unavailable.",
    );
  }

  const pool = new Pool({ connectionString });
  const client = new PrismaClient({
    adapter: new PrismaPg(pool),
  });
  modulePrisma = client;

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaPool = pool;
  }

  return client;
}

/**
 * Import-safe Prisma facade.
 *
 * Next.js imports route modules while collecting build metadata. Constructing
 * the database client at module evaluation made credential-poor Preview builds
 * fail even though no database feature was invoked. The first actual property
 * access initializes the real client and still fails closed when DATABASE_URL
 * is absent.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
