import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { assertAcceptanceDatabaseTarget } from "@/lib/acceptance/bootstrap";
import { getRuntimeEnvironment } from "@/lib/env";
import { shouldApplyDatabaseMigrations } from "@/lib/server/database-migration-policy";
import { resolveNpxCommand } from "@/lib/server/npx-command";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";

export type DeployMigrationsDependencies = {
  spawnSync: (
    command: string,
    args: readonly string[],
    options: { stdio: "inherit"; env: NodeJS.ProcessEnv },
  ) => SpawnSyncReturns<Buffer>;
  exit: (code?: number | string | null) => never;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
};

export function runDeployMigrationsIfEnabled(
  deps: DeployMigrationsDependencies = {
    spawnSync,
    exit: process.exit,
    env: process.env,
    platform: process.platform,
  },
): void {
  const enabled = shouldApplyDatabaseMigrations(deps.env);

  if (!enabled) {
    console.log(
      '[migrate] Skipped: APPLY_DATABASE_MIGRATIONS is not exactly "true".',
    );
    deps.exit(0);
  }

  const databaseUrl =
    deps.env.DIRECT_URL?.trim() || deps.env.DATABASE_URL?.trim();
  const runtime = getRuntimeEnvironment({
    ...deps.env,
    NODE_ENV: deps.env.NODE_ENV ?? "development",
  });

  if (runtime.isAcceptance && databaseUrl) {
    assertAcceptanceDatabaseTarget(databaseUrl, [
      deps.env.ACCEPTANCE_DATABASE_HOST,
      deps.env.ACCEPTANCE_DIRECT_DATABASE_HOST,
    ]);
  }

  assertOperationalMutationAllowed(
    {
      operationId: "deploy-migrations",
      databaseUrl,
      explicitIntent: enabled,
      allowedRemoteEnvironments: ["acceptance", "stage", "prod"],
      operationSpecificAuthorization: enabled,
    },
    deps.env,
  );

  console.log("[migrate] Authorized; running prisma migrate deploy.");
  const result = deps.spawnSync(
    resolveNpxCommand(deps.platform),
    ["prisma", "migrate", "deploy"],
    {
      stdio: "inherit",
      env: deps.env,
    },
  );

  if (result.error) {
    throw result.error;
  }

  deps.exit(result.status ?? 1);
}
