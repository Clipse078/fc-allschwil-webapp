export type AppEnv = "local" | "stage" | "prod";

export type RuntimeEnvironment = {
  nodeEnv: string;
  appEnv: AppEnv;
  rawAppEnv: string | null;
  vercelEnv: string | null;
  appBaseUrl: string | null;
  nextAuthUrl: string | null;
  hasDatabaseUrl: boolean;
  hasDirectUrl: boolean;
  hasAuthSecret: boolean;
  hasNextAuthSecret: boolean;
  hasAnyAuthSecret: boolean;
  isLocal: boolean;
  isStage: boolean;
  isProd: boolean;
  isVercel: boolean;
  parseErrors: string[];
};

const APP_ENV_VALUES = new Set<AppEnv>(["local", "stage", "prod"]);

function readOptionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function normalizeUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }

  const parsed = new URL(url);

  return parsed.toString().replace(/\/$/, "");
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const parseErrors: string[] = [];
  const nodeEnv = readOptionalString(process.env.NODE_ENV) ?? "missing";
  const rawAppEnv = readOptionalString(process.env.APP_ENV);
  let appEnv: AppEnv = "local";

  if (rawAppEnv) {
    if (APP_ENV_VALUES.has(rawAppEnv as AppEnv)) {
      appEnv = rawAppEnv as AppEnv;
    } else {
      parseErrors.push(
        "Invalid APP_ENV value: " +
          rawAppEnv +
          ". Allowed values: local, stage, prod.",
      );
    }
  }

  const vercelEnv = readOptionalString(process.env.VERCEL_ENV);
  const authSecret = readOptionalString(process.env.AUTH_SECRET);
  const nextAuthSecret = readOptionalString(process.env.NEXTAUTH_SECRET);
  let appBaseUrl: string | null = null;
  let nextAuthUrl: string | null = null;

  try {
    appBaseUrl = normalizeUrl(
      readOptionalString(process.env.APP_BASE_URL),
    );
  } catch {
    parseErrors.push(
      "Invalid URL in environment variable APP_BASE_URL: " +
        String(process.env.APP_BASE_URL),
    );
  }

  try {
    nextAuthUrl = normalizeUrl(
      readOptionalString(process.env.NEXTAUTH_URL),
    );
  } catch {
    parseErrors.push(
      "Invalid URL in environment variable NEXTAUTH_URL: " +
        String(process.env.NEXTAUTH_URL),
    );
  }

  return {
    nodeEnv,
    appEnv,
    rawAppEnv,
    vercelEnv,
    appBaseUrl,
    nextAuthUrl,
    hasDatabaseUrl: Boolean(readOptionalString(process.env.DATABASE_URL)),
    hasDirectUrl: Boolean(readOptionalString(process.env.DIRECT_URL)),
    hasAuthSecret: Boolean(authSecret),
    hasNextAuthSecret: Boolean(nextAuthSecret),
    hasAnyAuthSecret: Boolean(authSecret || nextAuthSecret),
    isLocal: appEnv === "local",
    isStage: appEnv === "stage",
    isProd: appEnv === "prod",
    isVercel: Boolean(readOptionalString(process.env.VERCEL)),
    parseErrors,
  };
}

export function getPublicEnvironmentLabel(
  appEnv: AppEnv,
): "LOCAL" | "STAGE" | "PROD" {
  if (appEnv === "stage") {
    return "STAGE";
  }

  if (appEnv === "prod") {
    return "PROD";
  }

  return "LOCAL";
}

export function getEnvironmentWarnings(env: RuntimeEnvironment): string[] {
  const warnings: string[] = [];

  if (!env.appBaseUrl) {
    warnings.push("APP_BASE_URL is not configured.");
  }

  if (!env.nextAuthUrl) {
    warnings.push("NEXTAUTH_URL is not configured.");
  }

  if (!env.hasDatabaseUrl) {
    warnings.push("DATABASE_URL is not configured.");
  }

  if (!env.hasAnyAuthSecret) {
    warnings.push("AUTH_SECRET or NEXTAUTH_SECRET is not configured.");
  }

  if (env.vercelEnv === "preview") {
    warnings.push(
      "Preview deployment detected. Preview URLs are disposable and are not the canonical operational truth. Validate the dedicated STAGE production deployment before assuming an app bug.",
    );
  }

  if (env.isStage && env.vercelEnv === "production") {
    warnings.push(
      "APP_ENV is stage while VERCEL_ENV is production. This is expected on the dedicated STAGE Vercel project, but verify the domain and secrets carefully.",
    );
  }

  if (env.isProd && env.vercelEnv && env.vercelEnv !== "production") {
    warnings.push(
      "APP_ENV is prod while VERCEL_ENV is not production. Verify deployment wiring carefully.",
    );
  }

  return warnings;
}
