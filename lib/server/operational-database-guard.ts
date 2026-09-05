import { getRuntimeEnvironment, type AppEnv } from "@/lib/env";

export type DatabaseTargetClass = "local" | "remote" | "unknown";

export type OperationalMutationGuardInput = {
  operationId: string;
  databaseUrl: string | undefined;
  explicitIntent: boolean;
  allowedRemoteEnvironments?: readonly Extract<
    AppEnv,
    "acceptance" | "stage" | "prod"
  >[];
  /**
   * An existing, operation-specific authorization can be supplied by tightly
   * scoped deployment code (for example APPLY_DATABASE_MIGRATIONS=true).
   * Interactive scripts should use SCE_OPERATION_AUTHORIZATION instead.
   */
  operationSpecificAuthorization?: boolean;
};

export type OperationalMutationGuardResult =
  | {
      allowed: true;
      environment: AppEnv;
      databaseTarget: Exclude<DatabaseTargetClass, "unknown">;
    }
  | {
      allowed: false;
      environment: AppEnv;
      databaseTarget: DatabaseTargetClass;
      reason: string;
    };

const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function classifyDatabaseTarget(
  databaseUrl: string | undefined,
): DatabaseTargetClass {
  const value = databaseUrl?.trim();
  if (!value) return "unknown";

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return "unknown";
    }
    return LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase())
      ? "local"
      : "remote";
  } catch {
    return "unknown";
  }
}

export function evaluateOperationalMutationGuard(
  input: OperationalMutationGuardInput,
  env: NodeJS.ProcessEnv = process.env,
): OperationalMutationGuardResult {
  const runtime = getRuntimeEnvironment({
    ...env,
    NODE_ENV: env.NODE_ENV ?? "development",
  });
  const databaseTarget = classifyDatabaseTarget(input.databaseUrl);

  const denied = (reason: string): OperationalMutationGuardResult => ({
    allowed: false,
    environment: runtime.appEnv,
    databaseTarget,
    reason,
  });

  if (!input.explicitIntent) {
    return denied("explicit operation intent is required");
  }

  if (databaseTarget === "unknown") {
    return denied("database target is missing, malformed, or unsupported");
  }

  if (runtime.isPreview || runtime.isUnknown || runtime.isDeployed && runtime.isLocal) {
    return denied(
      `environment ${runtime.appEnv} is not authorized for persistent mutation`,
    );
  }

  if (runtime.isLocal || runtime.isTest) {
    return databaseTarget === "local"
      ? {
          allowed: true,
          environment: runtime.appEnv,
          databaseTarget,
        }
      : denied("local/test operations may mutate local database targets only");
  }

  if (databaseTarget !== "remote") {
    return denied(
      `${runtime.appEnv} operations require an explicitly remote target`,
    );
  }

  const allowedRemoteEnvironments = input.allowedRemoteEnvironments ?? [];
  if (
    runtime.appEnv !== "acceptance" &&
    runtime.appEnv !== "stage" &&
    runtime.appEnv !== "prod" ||
    !allowedRemoteEnvironments.includes(runtime.appEnv)
  ) {
    return denied(`operation is not designed for ${runtime.appEnv}`);
  }

  const expectedAuthorization = `${input.operationId}:${runtime.appEnv}`;
  const hasOperationAuthorization =
    input.operationSpecificAuthorization === true ||
    env.SCE_OPERATION_AUTHORIZATION?.trim() === expectedAuthorization;

  if (!hasOperationAuthorization) {
    return denied(
      `explicit authorization ${expectedAuthorization} is required`,
    );
  }

  if (
    runtime.isProd &&
    env.SCE_PRODUCTION_MUTATION_APPROVAL?.trim() !== expectedAuthorization
  ) {
    return denied(
      `independent production approval ${expectedAuthorization} is required`,
    );
  }

  return {
    allowed: true,
    environment: runtime.appEnv,
    databaseTarget,
  };
}

export function assertOperationalMutationAllowed(
  input: OperationalMutationGuardInput,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = evaluateOperationalMutationGuard(input, env);
  if (!result.allowed) {
    throw new Error(
      `[operation:${input.operationId}] BLOCKED: ${result.reason}. ` +
        `Environment=${result.environment}; databaseTarget=${result.databaseTarget}.`,
    );
  }
}
