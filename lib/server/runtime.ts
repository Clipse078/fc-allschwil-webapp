import {
  getEnvironmentWarnings,
  getRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/env";
import { prisma } from "@/lib/db/prisma";

export type RuntimeCheckResult = {
  env: RuntimeEnvironment;
  errors: string[];
  warnings: string[];
  ok: boolean;
};

export type DatabaseHealthCheckResult = {
  ok: boolean;
  message: string;
};

function validateLocal(env: RuntimeEnvironment): string[] {
  const errors: string[] = [];

  if (
    env.nodeEnv !== "development" &&
    env.nodeEnv !== "test" &&
    env.nodeEnv !== "production"
  ) {
    errors.push("NODE_ENV must be development, test, or production.");
  }

  return errors;
}

function validateStage(env: RuntimeEnvironment): string[] {
  const errors: string[] = [];

  if (env.nodeEnv !== "production") {
    errors.push("STAGE must run with NODE_ENV=production.");
  }

  if (!env.appBaseUrl) {
    errors.push("STAGE requires APP_BASE_URL.");
  }

  if (!env.nextAuthUrl) {
    errors.push("STAGE requires NEXTAUTH_URL.");
  }

  if (!env.hasDatabaseUrl) {
    errors.push("STAGE requires DATABASE_URL.");
  }

  if (!env.hasNextAuthSecret) {
    errors.push("STAGE requires NEXTAUTH_SECRET.");
  }

  if (env.appBaseUrl && env.appBaseUrl.includes("localhost")) {
    errors.push("STAGE APP_BASE_URL must not point to localhost.");
  }

  if (env.nextAuthUrl && env.nextAuthUrl.includes("localhost")) {
    errors.push("STAGE NEXTAUTH_URL must not point to localhost.");
  }

  return errors;
}

function validateProd(env: RuntimeEnvironment): string[] {
  const errors: string[] = [];

  if (env.nodeEnv !== "production") {
    errors.push("PROD must run with NODE_ENV=production.");
  }

  if (!env.appBaseUrl) {
    errors.push("PROD requires APP_BASE_URL.");
  }

  if (!env.nextAuthUrl) {
    errors.push("PROD requires NEXTAUTH_URL.");
  }

  if (!env.hasDatabaseUrl) {
    errors.push("PROD requires DATABASE_URL.");
  }

  if (!env.hasNextAuthSecret) {
    errors.push("PROD requires NEXTAUTH_SECRET.");
  }

  if (env.appBaseUrl && env.appBaseUrl.includes("localhost")) {
    errors.push("PROD APP_BASE_URL must not point to localhost.");
  }

  if (env.nextAuthUrl && env.nextAuthUrl.includes("localhost")) {
    errors.push("PROD NEXTAUTH_URL must not point to localhost.");
  }

  return errors;
}

export function evaluateRuntimeConfiguration(): RuntimeCheckResult {
  const env = getRuntimeEnvironment();
  const warnings = getEnvironmentWarnings(env);

  let errors: string[] = [];

  if (env.isProd) {
    errors = validateProd(env);
  } else if (env.isStage) {
    errors = validateStage(env);
  } else {
    errors = validateLocal(env);
  }

  return {
    env,
    errors,
    warnings,
    ok: errors.length === 0,
  };
}

export function assertRuntimeConfiguration(): RuntimeEnvironment {
  const result = evaluateRuntimeConfiguration();

  if (!result.ok) {
    throw new Error(
      [
        "Runtime configuration invalid.",
        ...result.errors.map(function (error) {
          return "- " + error;
        }),
      ].join("\n"),
    );
  }

  return result.env;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      ok: true,
      message: "Database connection successful.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";

    return {
      ok: false,
      message,
    };
  }
}
