import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const PRISMA_COMMANDS_WITHOUT_DATABASE_URL = new Set(["generate", "format", "validate"]);
const FALLBACK_DATABASE_URL = "postgresql://prisma:prisma@127.0.0.1:5432/prisma";

function resolveDatasourceUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  const prismaCommand = process.argv
    .slice(2)
    .find((argument) => PRISMA_COMMANDS_WITHOUT_DATABASE_URL.has(argument));

  if (prismaCommand) {
    return FALLBACK_DATABASE_URL;
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
    url: resolveDatasourceUrl(),
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL?.trim() || undefined,
  },
});