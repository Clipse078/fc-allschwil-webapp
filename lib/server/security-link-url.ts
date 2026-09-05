import "server-only";

import { getRuntimeEnvironment } from "@/lib/env";

const PASSWORD_RESET_PATH = "/reset-password";

export type SecurityLinkConfigurationErrorCode =
  | "MISSING_BASE_URL"
  | "INVALID_BASE_URL";

export class SecurityLinkConfigurationError extends Error {
  constructor(public readonly code: SecurityLinkConfigurationErrorCode) {
    super(
      code === "MISSING_BASE_URL"
        ? "Security link base URL is not configured."
        : "Security link base URL configuration is invalid.",
    );
    this.name = "SecurityLinkConfigurationError";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "[::1]" ||
    normalized === "::1"
  ) {
    return true;
  }

  const ipv4Parts = normalized.split(".");
  return (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part)) &&
    Number(ipv4Parts[0]) === 127 &&
    ipv4Parts.every((part) => Number(part) <= 255)
  );
}

/**
 * Resolves the only trusted origin for security-sensitive bearer links.
 *
 * APP_BASE_URL has priority. NEXTAUTH_URL is retained as the product's
 * compatibility fallback only when APP_BASE_URL is blank or absent. Request
 * headers are intentionally not accepted as an input.
 */
export function resolveSecurityLinkBaseUrl(
  processEnv: NodeJS.ProcessEnv = process.env,
): URL {
  const appBaseUrl = processEnv.APP_BASE_URL?.trim();
  const nextAuthUrl = processEnv.NEXTAUTH_URL?.trim();
  const configuredUrl = appBaseUrl || nextAuthUrl;

  if (!configuredUrl) {
    throw new SecurityLinkConfigurationError("MISSING_BASE_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new SecurityLinkConfigurationError("INVALID_BASE_URL");
  }

  const runtime = getRuntimeEnvironment(processEnv);
  const allowsLocalUrl =
    !runtime.isDeployed && (runtime.isLocal || runtime.isTest);
  const isLoopback = isLoopbackHostname(parsed.hostname);
  const hasRootPathOnly = parsed.pathname === "/" || parsed.pathname === "";
  const validProtocol =
    parsed.protocol === "https:" ||
    (allowsLocalUrl && isLoopback && parsed.protocol === "http:");

  if (
    !validProtocol ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    !hasRootPathOnly ||
    (!allowsLocalUrl && isLoopback)
  ) {
    throw new SecurityLinkConfigurationError("INVALID_BASE_URL");
  }

  return new URL(parsed.origin);
}

export function buildPasswordResetLink(
  rawToken: string,
  processEnv: NodeJS.ProcessEnv = process.env,
): string {
  const url = new URL(PASSWORD_RESET_PATH, resolveSecurityLinkBaseUrl(processEnv));
  url.searchParams.set("token", rawToken);
  return url.toString();
}
