import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    const message =
      "DATABASE_URL is not set. " +
      "Open Vercel → Settings → Environment Variables, " +
      "enable DATABASE_URL for Production and Preview, then redeploy.";
    console.error("[sportclubevo] FATAL:", message);
    throw new Error(message);
  }

  const adapter = new PrismaPg(connectionString);

  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

// Lazy proxy: importing this module does not throw.
// The error surfaces only when a DB method is actually called.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return getPrismaClient()[prop as keyof PrismaClient];
  },
});
