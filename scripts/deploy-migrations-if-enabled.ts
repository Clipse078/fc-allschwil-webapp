import { spawnSync } from "node:child_process";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";
import { shouldApplyDatabaseMigrations } from "@/lib/server/database-migration-policy";

const enabled = shouldApplyDatabaseMigrations();

if (!enabled) {
  console.log(
    '[migrate] Skipped: APPLY_DATABASE_MIGRATIONS is not exactly "true".',
  );
  process.exit(0);
}

const databaseUrl =
  process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();

assertOperationalMutationAllowed({
  operationId: "deploy-migrations",
  databaseUrl,
  explicitIntent: enabled,
  allowedRemoteEnvironments: ["stage", "prod"],
  operationSpecificAuthorization: enabled,
});

console.log("[migrate] Authorized; running prisma migrate deploy.");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
