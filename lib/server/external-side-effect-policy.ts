import { getRuntimeEnvironment } from "@/lib/env";

export const EXTERNAL_SIDE_EFFECT_PROVIDERS = [
  "resend",
  "inbound-email",
  "sfv",
  "public-blob",
  "workspace-blob",
  "ops-backup",
  "website-revalidation",
  "cron",
  "stripe",
] as const;

export type ExternalSideEffectProvider =
  (typeof EXTERNAL_SIDE_EFFECT_PROVIDERS)[number];

const ACCEPTANCE_PROVIDER_ALLOWLIST =
  "ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS";

function hasConfiguredValue(
  env: NodeJS.ProcessEnv,
  variableName: string,
): boolean {
  return Boolean(env[variableName]?.trim());
}

function getAcceptanceProviderAllowlist(
  env: NodeJS.ProcessEnv,
): Set<string> {
  return new Set(
    (env[ACCEPTANCE_PROVIDER_ALLOWLIST] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * External providers keep their existing credential gates outside Acceptance.
 * Acceptance requires both complete provider configuration and an explicit
 * provider allowlist entry, preventing copied ambient credentials from
 * silently enabling side effects.
 */
export function isExternalSideEffectConfigured(
  provider: ExternalSideEffectProvider,
  requiredEnvironmentVariables: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (
    requiredEnvironmentVariables.length === 0 ||
    !requiredEnvironmentVariables.every((name) =>
      hasConfiguredValue(env, name),
    )
  ) {
    return false;
  }

  const runtime = getRuntimeEnvironment({
    ...env,
    NODE_ENV: env.NODE_ENV ?? "development",
  });

  if (!runtime.isAcceptance) {
    return true;
  }

  return getAcceptanceProviderAllowlist(env).has(provider);
}
