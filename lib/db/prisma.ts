import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

/**
 * Lazily initialise the Prisma client so that modules which import this file
 * (e.g. auth.ts) do not crash at import time when DATABASE_URL is absent.
 * The error is thrown only when an actual database operation is attempted,
 * producing a clearer stack trace and allowing non-DB pages to render.
 *
 * If DATABASE_URL is missing on Vercel:
 *   1. Go to Vercel → Settings → Environment Variables
 *   2. Ensure DATABASE_URL is enabled for Production, Preview, and Development
 *   3. Redeploy STAGE from the Vercel dashboard
 */
function buildPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const message =
      "DATABASE_URL is not set. " +
      "Open Vercel → Settings → Environment Variables, " +
      "enable DATABASE_URL for Production, Preview, and Development, then redeploy.";
    console.error("[sportclubevo] FATAL:", message);
    throw new Error(message);
  }

  const pool =
    globalForPrisma.prismaPool ??
    new Pool({
      connectionString,
    });

  const adapter = new PrismaPg(pool);

  const client =
    globalForPrisma.prisma ??
    new PrismaClient({
      adapter,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaPool = pool;
    globalForPrisma.prisma = client;
  }

  return client;
}

// Export a lazy proxy so that importing this module does not throw.
// The error surfaces only when a DB method is actually called.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return buildPrismaClient()[prop as keyof PrismaClient];
  },
});
