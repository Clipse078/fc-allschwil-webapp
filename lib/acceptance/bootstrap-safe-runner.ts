import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { resolve } from "node:path";
import {
  ACCEPTANCE_DATABASE_NAME,
  assertAcceptanceBootstrapEnvironment,
  getAcceptanceDatabaseIdentity,
} from "@/lib/acceptance/bootstrap";
import { resolveTsxCliPath } from "@/lib/server/tsx-cli";

export const ACCEPTANCE_POOLED_HOST_REQUIRED_MESSAGE =
  "Acceptance bootstrap requires the pooled database host, not the direct endpoint.";

export type SafeAcceptanceBootstrapIdentity = {
  environment: "acceptance";
  host: string;
  database: string;
  user?: string;
};

export type BootstrapAcceptanceSafeDependencies = {
  spawnSync: (
    command: string,
    args: readonly string[],
    options: { stdio: "inherit"; env: NodeJS.ProcessEnv },
  ) => SpawnSyncReturns<Buffer>;
  exit: (code?: number | string | null) => never;
  env: NodeJS.ProcessEnv;
  execPath: string;
  resolveTsxCliPath: () => string;
  resolveBootstrapScriptPath: () => string;
  log: (message: string) => void;
  error: (message: string) => void;
};

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

const NEON_SSL_SEARCH_PARAMS = {
  sslmode: "require",
} as const;

const OPERATIONAL_URL_ENV_NAMES = [
  "STAGE_DB_URL",
  "STAGE_DIRECT_URL",
  "PROD_DB_URL",
  "PROD_DIRECT_URL",
  "PRODUCTION_DATABASE_URL",
] as const;

export function redactDatabaseSecrets(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/)([^:@/]+):([^@/]+)@/gi, "$1$2:***@")
    .replace(
      /(ACCEPTANCE_DATABASE_PASSWORD=)([^\s"'`]+)/gi,
      "$1***",
    );
}

export function parseSafeDatabaseUser(databaseUrl: string): string | undefined {
  try {
    const parsed = new URL(databaseUrl);
    const user = decodeURIComponent(parsed.username);
    return user || undefined;
  } catch {
    return undefined;
  }
}

export function assertAcceptancePooledBootstrapHost(host: string): void {
  const normalized = host.trim().toLowerCase();
  if (LOCAL_DATABASE_HOSTS.has(normalized)) {
    throw new Error(
      "Acceptance bootstrap refuses localhost database targets.",
    );
  }
  if (normalized.endsWith(".neon.tech") && !normalized.includes("-pooler.")) {
    throw new Error(ACCEPTANCE_POOLED_HOST_REQUIRED_MESSAGE);
  }
}

export function buildAcceptanceDatabaseUrlFromParts(
  env: NodeJS.ProcessEnv,
): string {
  const host = env.ACCEPTANCE_DATABASE_HOST?.trim().toLowerCase();
  const database =
    env.ACCEPTANCE_DATABASE_NAME?.trim() || ACCEPTANCE_DATABASE_NAME;
  const user = env.ACCEPTANCE_DATABASE_USER?.trim();
  const password = env.ACCEPTANCE_DATABASE_PASSWORD?.trim();

  if (!host) {
    throw new Error("ACCEPTANCE_DATABASE_HOST is required.");
  }
  if (!user) {
    throw new Error("ACCEPTANCE_DATABASE_USER is required.");
  }
  if (!password) {
    throw new Error(
      "ACCEPTANCE_DATABASE_PASSWORD is required before any database connection is attempted.",
    );
  }
  if (database !== ACCEPTANCE_DATABASE_NAME) {
    throw new Error(
      `Acceptance bootstrap database name must be exactly ${ACCEPTANCE_DATABASE_NAME}.`,
    );
  }

  assertAcceptancePooledBootstrapHost(host);

  const url = new URL("postgresql://placeholder");
  url.username = user;
  url.password = password;
  url.hostname = host;
  url.port = "5432";
  url.pathname = `/${database}`;
  for (const [key, value] of Object.entries(NEON_SSL_SEARCH_PARAMS)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

export function resolveAcceptanceBootstrapDatabaseUrl(
  env: NodeJS.ProcessEnv,
): string {
  const existing = env.DATABASE_URL?.trim();
  if (existing) {
    return existing;
  }
  return buildAcceptanceDatabaseUrlFromParts(env);
}

export function assertSafeAcceptanceBootstrapTarget(
  env: NodeJS.ProcessEnv,
): { databaseUrl: string; identity: SafeAcceptanceBootstrapIdentity } {
  const allowlistedHost = env.ACCEPTANCE_DATABASE_HOST?.trim().toLowerCase();
  if (!allowlistedHost) {
    throw new Error("ACCEPTANCE_DATABASE_HOST is required.");
  }

  const databaseUrl = resolveAcceptanceBootstrapDatabaseUrl(env);
  const identity = getAcceptanceDatabaseIdentity(databaseUrl);

  assertAcceptancePooledBootstrapHost(identity.host);

  if (identity.host !== allowlistedHost) {
    throw new Error(
      `Database identity is not an explicitly allowlisted remote ${ACCEPTANCE_DATABASE_NAME} database.`,
    );
  }
  if (identity.database !== ACCEPTANCE_DATABASE_NAME) {
    throw new Error(
      `Acceptance bootstrap database name must be exactly ${ACCEPTANCE_DATABASE_NAME}.`,
    );
  }

  for (const name of OPERATIONAL_URL_ENV_NAMES) {
    const candidate = env[name]?.trim();
    if (!candidate) continue;
    const operational = getAcceptanceDatabaseIdentity(candidate);
    if (
      operational.host === identity.host &&
      operational.database === identity.database
    ) {
      throw new Error(`Acceptance database matches the protected ${name} target.`);
    }
  }

  const preparedEnv: NodeJS.ProcessEnv = {
    ...env,
    DATABASE_URL: databaseUrl,
    ACCEPTANCE_DATABASE_HOST: allowlistedHost,
  };
  assertAcceptanceBootstrapEnvironment(preparedEnv);

  return {
    databaseUrl,
    identity: {
      environment: "acceptance",
      host: identity.host,
      database: identity.database,
      user: parseSafeDatabaseUser(databaseUrl),
    },
  };
}

export function formatSafeAcceptanceBootstrapIdentity(
  identity: SafeAcceptanceBootstrapIdentity,
): string[] {
  const lines = [
    `environment = ${identity.environment}`,
    `host = ${identity.host}`,
    `database = ${identity.database}`,
  ];
  if (identity.user) {
    lines.push(`role = ${identity.user}`);
  }
  return lines;
}

export function runBootstrapAcceptanceSafe(
  deps: BootstrapAcceptanceSafeDependencies = {
    spawnSync,
    exit: process.exit,
    env: process.env,
    execPath: process.execPath,
    resolveTsxCliPath,
    resolveBootstrapScriptPath: () =>
      resolve(process.cwd(), "scripts/bootstrap-acceptance.ts"),
    log: console.log,
    error: console.error,
  },
): void {
  let prepared: ReturnType<typeof assertSafeAcceptanceBootstrapTarget>;
  try {
    prepared = assertSafeAcceptanceBootstrapTarget(deps.env);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown validation error.";
    deps.error(
      `[bootstrap-acceptance:safe] Refused: ${redactDatabaseSecrets(message)}`,
    );
    deps.exit(1);
  }

  for (const line of formatSafeAcceptanceBootstrapIdentity(prepared.identity)) {
    deps.log(`[bootstrap-acceptance:safe] ${line}`);
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...deps.env,
    DATABASE_URL: prepared.databaseUrl,
    ACCEPTANCE_DATABASE_HOST: prepared.identity.host,
  };

  deps.log(
    "[bootstrap-acceptance:safe] Validation passed; invoking canonical Acceptance bootstrap.",
  );

  const tsxCliPath = deps.resolveTsxCliPath();
  const bootstrapScriptPath = deps.resolveBootstrapScriptPath();
  const result = deps.spawnSync(
    deps.execPath,
    [tsxCliPath, bootstrapScriptPath],
    {
      stdio: "inherit",
      env: childEnv,
    },
  );

  if (result.error) {
    throw result.error;
  }

  deps.exit(result.status ?? 1);
}
