import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // DIRECT_URL bypasses the connection pooler (Neon pgBouncer) so that
    // prisma migrate deploy can acquire the session-level advisory lock it
    // needs.  Without this, migrate deploy fails on the pooled endpoint with
    // "Timed out trying to acquire a postgres advisory lock".
    directUrl: process.env.DIRECT_URL?.trim() || undefined,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});