import "dotenv/config";
import { defineConfig, env } from "prisma/config";
import { resolvePrismaDatasourceUrlForCommand } from "./lib/server/prisma-datasource";

export function resolvePrismaDatasourceUrl(
  processEnv: NodeJS.ProcessEnv = process.env,
  argv: readonly string[] = process.argv,
): string {
  return (
    resolvePrismaDatasourceUrlForCommand(processEnv, argv) ?? env("DATABASE_URL")
  );
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
