import {
  ACCEPTANCE_EMAIL_DOMAIN,
  ACCEPTANCE_FIXTURE,
  readAcceptancePasswords,
} from "@/lib/acceptance/bootstrap";
import type { AcceptanceSecuritySmokeConfig } from "@/lib/acceptance/security-smoke/types";

export const ACCEPTANCE_SECURITY_SMOKE_CONFIRM = "RUN_ACCEPTANCE_SECURITY_SMOKE";

const BLOCKED_HOST_FRAGMENTS = [
  "stage-webapp.fcallschwil.ch",
  "fcallschwil.sportclubevo.com",
  "fcallschwil.ch",
] as const;

const ALLOWED_ACCEPTANCE_HOSTS = new Set([
  "acceptance.sportclubevo.com",
  "acceptance.example.test",
]);

export class AcceptanceSecuritySmokeEnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcceptanceSecuritySmokeEnvironmentError";
  }
}

export function resolveAcceptanceBaseUrl(env: NodeJS.ProcessEnv): string {
  const candidate =
    env.ACCEPTANCE_BASE_URL?.trim() || env.APP_BASE_URL?.trim() || "";
  if (!candidate) {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      "ACCEPTANCE_BASE_URL (or APP_BASE_URL) is required.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      "Acceptance base URL must be a valid absolute URL.",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      "Acceptance base URL must use http or https.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const normalized = `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ""}`;

  for (const blocked of BLOCKED_HOST_FRAGMENTS) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      throw new AcceptanceSecuritySmokeEnvironmentError(
        `Refusing blocked non-Acceptance host: ${hostname}.`,
      );
    }
  }

  if (!ALLOWED_ACCEPTANCE_HOSTS.has(hostname)) {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      `Acceptance base URL host is not allowlisted: ${hostname}.`,
    );
  }

  if (hostname !== "acceptance.example.test" && parsed.protocol !== "https:") {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      "Deployed Acceptance base URL must use https.",
    );
  }

  return normalized;
}

export function assertAcceptanceSecuritySmokeEnvironment(
  env: NodeJS.ProcessEnv,
): AcceptanceSecuritySmokeConfig {
  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv !== "acceptance") {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      "APP_ENV must be set to acceptance before running the security smoke suite.",
    );
  }

  if (env.ACCEPTANCE_SECURITY_SMOKE_CONFIRM !== ACCEPTANCE_SECURITY_SMOKE_CONFIRM) {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      `Set ACCEPTANCE_SECURITY_SMOKE_CONFIRM=${ACCEPTANCE_SECURITY_SMOKE_CONFIRM} to run against a live Acceptance deployment.`,
    );
  }

  const baseUrl = resolveAcceptanceBaseUrl(env);
  const passwords = readAcceptancePasswords(env);

  for (const fixture of Object.values(ACCEPTANCE_FIXTURE.users)) {
    if (!fixture.email.endsWith(`@${ACCEPTANCE_EMAIL_DOMAIN}`)) {
      throw new AcceptanceSecuritySmokeEnvironmentError(
        "Fixture emails must remain within the Acceptance synthetic domain.",
      );
    }
  }

  return { baseUrl, passwords };
}

export function getFixturePassword(
  passwords: AcceptancePasswords,
  passwordEnv: AcceptancePasswordEnvName,
): string {
  const password = passwords[passwordEnv];
  if (!password) {
    throw new AcceptanceSecuritySmokeEnvironmentError(
      `${passwordEnv} is required for Acceptance security smoke tests.`,
    );
  }
  return password;
}
