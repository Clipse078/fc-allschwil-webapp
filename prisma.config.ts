import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma v7 removed directUrl. The url here is used by ALL Prisma CLI
    // commands (migrate deploy, migrate dev, migrate status, etc.).
    // DIRECT_URL bypasses the Neon pgBouncer pooled endpoint so that
    // prisma migrate deploy can acquire the session-level advisory lock it
    // needs. Falls back to DATABASE_URL when DIRECT_URL is not configured
    // (local dev without a separate direct URL).
    // The runtime PrismaClient in lib/db/prisma.ts uses DATABASE_URL
    // (pooled) via @prisma/adapter-pg — no change there.
    url: process.env.DIRECT_URL?.trim() || env("DATABASE_URL"),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});