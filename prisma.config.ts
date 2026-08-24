import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const POSTGRES_URL_SCHEME_RE = /^postgres(ql)?:\/\//i;

function resolvePrismaDatasourceUrl(): string {
  const directUrl = process.env.DIRECT_URL?.trim();
  if (directUrl && POSTGRES_URL_SCHEME_RE.test(directUrl)) {
    return directUrl;
  }
  return env("DATABASE_URL");
}

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
    // or is not a valid PostgreSQL connection URL (local dev without a
    // separate direct URL, or misconfigured deployment secrets).
    // The runtime PrismaClient in lib/db/prisma.ts uses DATABASE_URL
    // (pooled) via @prisma/adapter-pg — no change there.
    url: resolvePrismaDatasourceUrl(),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});
