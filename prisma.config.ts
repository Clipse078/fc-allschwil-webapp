import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  // Fallback placeholder so `prisma generate` succeeds without a live DB.
  // Actual DB access will fail fast with a clear error at runtime.
  "postgresql://missing:missing@localhost:5432/missing";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});