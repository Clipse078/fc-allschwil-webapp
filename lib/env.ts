export type AppEnv =
  | "local"
  | "test"
  | "preview"
  | "stage"
  | "prod"
  | "unknown";

export type RuntimeEnvironment = {
  nodeEnv: string;
  appEnv: AppEnv;
  vercelEnv: string | null;
  appBaseUrl: string | null;
  nextAuthUrl: string | null;
  hasDatabaseUrl: boolean;
  hasDirectUrl: boolean;
  hasNextAuthSecret: boolean;
  isDeployed: boolean;
  isTest: boolean;
  isPreview: boolean;
  isLocal: boolean;
  isStage: boolean;
  isProd: boolean;
  isUnknown: boolean;
  isVercel: boolean;
};

const APP_ENV_VALUES = new Set<AppEnv>([
  "local",
  "test",
  "preview",
  "stage",
  "prod",
]);

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

function parseConfiguredAppEnv(rawValue: string | undefined): AppEnv | null {
  const trimmed = rawValue?.trim()?.toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (APP_ENV_VALUES.has(trimmed as AppEnv)) {
    return trimmed as AppEnv;
  }

  // Map common aliases that Vercel or operators might accidentally set
  if (trimmed === "production") return "prod";
  if (trimmed === "development") return "local";

  return "unknown";
}

function classifyAppEnv(env: NodeJS.ProcessEnv): {
  appEnv: AppEnv;
  isDeployed: boolean;
} {
  const configured = parseConfiguredAppEnv(env.APP_ENV);
  const vercelEnv = readOptionalString(env.VERCEL_ENV)?.toLowerCase() ?? null;
  const isVercel = Boolean(readOptionalString(env.VERCEL));
  const hasVercelMetadata =
    vercelEnv === "production" ||
    vercelEnv === "preview" ||
    vercelEnv === "development";
  const isDeployed = isVercel || hasVercelMetadata;

  // Vercel Preview is authoritative deployment metadata. It must never inherit
  // STAGE/local privileges from APP_ENV or from credentials currently in scope.
  if (vercelEnv === "preview") {
    return { appEnv: "preview", isDeployed: true };
  }

  if (isDeployed) {
    // A deployed runtime can only become STAGE/PROD through an explicit,
    // compatible APP_ENV. local/test/preview, missing, and malformed values
    // are deliberately classified as unknown.
    if (
      vercelEnv === "production" &&
      (configured === "stage" || configured === "prod")
    ) {
      return { appEnv: configured, isDeployed: true };
    }
    return { appEnv: "unknown", isDeployed: true };
  }

  if (configured && configured !== "unknown") {
    return { appEnv: configured, isDeployed: false };
  }

  if (configured === "unknown") {
    return { appEnv: "unknown", isDeployed: false };
  }

  return {
    appEnv: env.NODE_ENV === "test" ? "test" : "local",
    isDeployed: false,
  };
}

function normalizeUrl(url: string | null, variableName: string): string | null {
  if (!url) {
    return null;
  }

  // Try as-is first (must include a protocol like https://)
  try {
    const parsed = new URL(url);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    // Fall back to adding https:// in case the operator omitted the protocol
    try {
      const parsed = new URL("https://" + url);
      return parsed.toString().replace(/\/$/, "");
    } catch {
      // URL is unparseable in any form — return null and log via warnings
      console.warn("[env] Invalid " + variableName + " URL configuration");
      return null;
    }
  }
}

export function getRuntimeEnvironment(
  processEnv: NodeJS.ProcessEnv = process.env,
): RuntimeEnvironment {
  const nodeEnv = readRequiredString(processEnv.NODE_ENV, "NODE_ENV");
  const { appEnv, isDeployed } = classifyAppEnv(processEnv);
  const vercelEnv = readOptionalString(processEnv.VERCEL_ENV);
  const appBaseUrl = normalizeUrl(
    readOptionalString(processEnv.APP_BASE_URL),
    "APP_BASE_URL",
  );
  const nextAuthUrl = normalizeUrl(
    readOptionalString(processEnv.NEXTAUTH_URL),
    "NEXTAUTH_URL",
  );

  return {
    nodeEnv,
    appEnv,
    vercelEnv,
    appBaseUrl,
    nextAuthUrl,
    hasDatabaseUrl: Boolean(readOptionalString(processEnv.DATABASE_URL)),
    hasDirectUrl: Boolean(readOptionalString(processEnv.DIRECT_URL)),
    hasNextAuthSecret: Boolean(readOptionalString(processEnv.NEXTAUTH_SECRET)),
    isDeployed,
    isTest: appEnv === "test",
    isPreview: appEnv === "preview",
    isLocal: appEnv === "local",
    isStage: appEnv === "stage",
    isProd: appEnv === "prod",
    isUnknown: appEnv === "unknown",
    isVercel: Boolean(readOptionalString(processEnv.VERCEL)),
  };
}

export function getPublicEnvironmentLabel(
  appEnv: AppEnv,
): "LOCAL" | "TEST" | "PREVIEW" | "STAGE" | "PROD" | "UNKNOWN" {
  if (appEnv === "test") {
    return "TEST";
  }

  if (appEnv === "preview") {
    return "PREVIEW";
  }

  if (appEnv === "stage") {
    return "STAGE";
  }

  if (appEnv === "prod") {
    return "PROD";
  }

  return appEnv === "local" ? "LOCAL" : "UNKNOWN";
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

  if (!env.hasNextAuthSecret) {
    warnings.push("NEXTAUTH_SECRET is not configured.");
  }

  if (env.isUnknown) {
    warnings.push(
      "Deployed environment classification is unknown; privileged operations are disabled.",
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
