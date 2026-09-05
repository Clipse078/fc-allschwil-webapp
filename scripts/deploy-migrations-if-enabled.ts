import { spawnSync } from "node:child_process";
import { assertAcceptanceDatabaseTarget } from "@/lib/acceptance/bootstrap";
import { getRuntimeEnvironment } from "@/lib/env";
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
const runtime = getRuntimeEnvironment({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

if (runtime.isAcceptance && databaseUrl) {
  assertAcceptanceDatabaseTarget(databaseUrl, [
    process.env.ACCEPTANCE_DATABASE_HOST,
    process.env.ACCEPTANCE_DIRECT_DATABASE_HOST,
  ]);
}

assertOperationalMutationAllowed({
  operationId: "deploy-migrations",
  databaseUrl,
  explicitIntent: enabled,
  allowedRemoteEnvironments: ["acceptance", "stage", "prod"],
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
