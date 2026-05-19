export type AppEnv = "local" | "stage" | "prod";

export type RuntimeEnvironment = {
  nodeEnv: string;
  appEnv: AppEnv;
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
};

const APP_ENV_VALUES = new Set<AppEnv>(["local", "stage", "prod"]);

function readRequiredString(
  value: string | undefined,
  variableName: string,
): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error("Missing required environment variable: " + variableName);
  }

  return trimmed;
}

function readOptionalString(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function parseAppEnv(rawValue: string | undefined): AppEnv {
  const trimmed = rawValue?.trim();

  if (!trimmed) {
    return "local";
  }

  if (!APP_ENV_VALUES.has(trimmed as AppEnv)) {
    throw new Error(
      "Invalid APP_ENV value: " +
        trimmed +
        ". Allowed values: local, stage, prod.",
    );
  }

  return trimmed as AppEnv;
}

function normalizeUrl(url: string | null, variableName: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(
      "Invalid URL in environment variable " + variableName + ": " + url,
    );
  }
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const nodeEnv = readRequiredString(process.env.NODE_ENV, "NODE_ENV");
  const appEnv = parseAppEnv(process.env.APP_ENV);
  const vercelEnv = readOptionalString(process.env.VERCEL_ENV);
  const appBaseUrl = normalizeUrl(
    readOptionalString(process.env.APP_BASE_URL),
    "APP_BASE_URL",
  );
  const nextAuthUrl = normalizeUrl(
    readOptionalString(process.env.NEXTAUTH_URL),
    "NEXTAUTH_URL",
  );

  const hasAuthSecret = Boolean(readOptionalString(process.env.AUTH_SECRET));
  const hasNextAuthSecret = Boolean(
    readOptionalString(process.env.NEXTAUTH_SECRET),
  );

  return {
    nodeEnv,
    appEnv,
    vercelEnv,
    appBaseUrl,
    nextAuthUrl,
    hasDatabaseUrl: Boolean(readOptionalString(process.env.DATABASE_URL)),
    hasDirectUrl: Boolean(readOptionalString(process.env.DIRECT_URL)),
    hasAuthSecret,
    hasNextAuthSecret,
    hasAnyAuthSecret: hasAuthSecret || hasNextAuthSecret,
    isLocal: appEnv === "local",
    isStage: appEnv === "stage",
    isProd: appEnv === "prod",
    isVercel: Boolean(readOptionalString(process.env.VERCEL)),
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

  if (
    env.hasAuthSecret &&
    env.hasNextAuthSecret &&
    process.env.AUTH_SECRET !== process.env.NEXTAUTH_SECRET
  ) {
    warnings.push(
      "AUTH_SECRET and NEXTAUTH_SECRET are both set with different values. Keep them aligned to avoid auth inconsistencies.",
    );
  }

  if (env.vercelEnv === "preview") {
    warnings.push(
      "Running on a Vercel Preview deployment. Preview is disposable and not the canonical STAGE truth.",
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
