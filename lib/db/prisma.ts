import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  __sportclubevo_prisma?: PrismaClient;
  __sportclubevo_pool?: Pool;
};

function getOrCreateClient(): PrismaClient {
  if (globalForPrisma.__sportclubevo_prisma) {
    return globalForPrisma.__sportclubevo_prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const message =
      "DATABASE_URL is not set. " +
      "Open Vercel → Settings → Environment Variables, " +
      "enable DATABASE_URL for Production and Preview, then redeploy.";
    console.error("[sportclubevo] FATAL:", message);
    throw new Error(message);
  }

  const pool =
    globalForPrisma.__sportclubevo_pool ??
    new Pool({ connectionString });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  globalForPrisma.__sportclubevo_pool = pool;
  globalForPrisma.__sportclubevo_prisma = client;

  return client;
}

/**
 * Lazy proxy — importing this module never throws.
 * The real PrismaClient is created (and cached globally) on first use.
 * In dev, the global cache survives HMR reloads.
 * In production, a single instance is reused for the process lifetime.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return getOrCreateClient()[prop as keyof PrismaClient];
  },
});
