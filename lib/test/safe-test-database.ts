/**
 * lib/test/safe-test-database.ts
 *
 * TEAM-SFV-03B2 — fail-closed guard for database-mutating integration tests.
 *
 * Contract:
 *   - Mutating integration tests MUST set `TEST_DATABASE_URL` to a disposable,
 *     local PostgreSQL database.
 *   - `NODE_ENV=test` alone is never sufficient proof of isolation.
 *   - Shared STAGE / production / Neon runtime targets are rejected before any
 *     test body executes.
 *
 * Error messages intentionally redact credentials — see `maskDatabaseUrl()`.
 */

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

export type ParsedDatabaseTarget = {
  protocol: string;
  hostname: string;
  database: string;
};

/** Known FC Allschwil STAGE Neon cluster identifiers (host fragments only). */
const KNOWN_FCA_STAGE_NEON_HOST_FRAGMENTS = ["ep-wispy-hall-aso93dy6"] as const;

const RUNTIME_REFERENCE_ENV_VARS = [
  "STAGE_DB_URL",
  "STAGE_DIRECT_URL",
  "DATABASE_URL",
  "DIRECT_URL",
] as const;

export function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return "(not set)";
  try {
    const parsed = new URL(url);
    const user = parsed.username || "(no user)";
    return `${parsed.protocol}//${user}:***@${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url.replace(/:[^@/]*@/, ":***@");
  }
}

export function parseDatabaseTarget(url: string): ParsedDatabaseTarget {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname.toLowerCase(),
    database: parsed.pathname.replace(/^\//, "") || "(default)",
  };
}

export function normalizeDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/$/, "") || "/";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

export function isLocalTestDatabaseHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

export function getTestDatabaseUrl(): string | null {
  const url = process.env.TEST_DATABASE_URL?.trim();
  return url || null;
}

export function isKnownSharedOrRuntimeDatabase(
  url: string,
): { unsafe: true; reason: string } | { unsafe: false } {
  const target = parseDatabaseTarget(url);
  const normalizedCandidate = normalizeDatabaseUrl(url);

  for (const envVar of RUNTIME_REFERENCE_ENV_VARS) {
    const reference = process.env[envVar]?.trim();
    if (!reference) continue;
    if (normalizeDatabaseUrl(reference) === normalizedCandidate) {
      if (envVar === "STAGE_DB_URL" || envVar === "STAGE_DIRECT_URL") {
        return {
          unsafe: true,
          reason: `matches ${envVar} (shared STAGE target)`,
        };
      }
      if (!isLocalTestDatabaseHost(target.hostname)) {
        return {
          unsafe: true,
          reason: `matches ${envVar} runtime database target`,
        };
      }
    }
  }

  for (const fragment of KNOWN_FCA_STAGE_NEON_HOST_FRAGMENTS) {
    if (target.hostname.includes(fragment)) {
      return {
        unsafe: true,
        reason: "matches known FC Allschwil STAGE Neon host",
      };
    }
  }

  if (target.hostname.endsWith(".neon.tech")) {
    return {
      unsafe: true,
      reason: "Neon cloud database target (shared/runtime)",
    };
  }

  const lower = url.toLowerCase();
  if (lower.includes("prod") && !isLocalTestDatabaseHost(target.hostname)) {
    return {
      unsafe: true,
      reason: "appears to be a production database target",
    };
  }

  if (
    (lower.includes("stage") || target.hostname.includes("stage")) &&
    !isLocalTestDatabaseHost(target.hostname)
  ) {
    return {
      unsafe: true,
      reason: "appears to be a STAGE database target",
    };
  }

  if (
    process.env.APP_ENV?.trim().toLowerCase() === "prod" &&
    !isLocalTestDatabaseHost(target.hostname)
  ) {
    return {
      unsafe: true,
      reason: "APP_ENV=prod runtime forbids non-local mutation tests",
    };
  }

  if (
    process.env.VERCEL_ENV?.trim().toLowerCase() === "production" &&
    !isLocalTestDatabaseHost(target.hostname)
  ) {
    return {
      unsafe: true,
      reason: "VERCEL_ENV=production runtime forbids non-local mutation tests",
    };
  }

  return { unsafe: false };
}

/**
 * Fail-closed guard for DB-mutating integration tests.
 * Returns the validated TEST_DATABASE_URL when safe.
 */
export function assertSafeTestDatabase(url?: string): string {
  const candidate = url?.trim() || getTestDatabaseUrl();
  if (!candidate) {
    throw new UnsafeTestDatabaseError(
      "Refusing DB-mutating test: explicit local TEST_DATABASE_URL required.",
    );
  }

  let target: ParsedDatabaseTarget;
  try {
    target = parseDatabaseTarget(candidate);
  } catch {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: TEST_DATABASE_URL is malformed. Target: ${maskDatabaseUrl(candidate)}`,
    );
  }

  if (!target.hostname || target.database === "(default)") {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: TEST_DATABASE_URL is malformed. Target: ${maskDatabaseUrl(candidate)}`,
    );
  }

  if (target.protocol !== "postgresql:" && target.protocol !== "postgres:") {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: TEST_DATABASE_URL must use PostgreSQL. Target: ${maskDatabaseUrl(candidate)}`,
    );
  }

  let shared: ReturnType<typeof isKnownSharedOrRuntimeDatabase>;
  try {
    shared = isKnownSharedOrRuntimeDatabase(candidate);
  } catch {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: TEST_DATABASE_URL is malformed. Target: ${maskDatabaseUrl(candidate)}`,
    );
  }
  if (shared.unsafe) {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: unsafe target (${shared.reason}). Target: ${maskDatabaseUrl(candidate)}`,
    );
  }

  if (!isLocalTestDatabaseHost(target.hostname)) {
    throw new UnsafeTestDatabaseError(
      `Refusing DB-mutating test: TEST_DATABASE_URL must be local (localhost/127.0.0.1/::1). Target: ${maskDatabaseUrl(candidate)}`,
    );
  }

  return candidate;
}

export function canRunDbMutatingIntegrationTests(): boolean {
  try {
    assertSafeTestDatabase();
    return true;
  } catch {
    return false;
  }
}

/**
 * When TEST_DATABASE_URL is configured and passes the guard, wire it into the
 * process env before `@/lib/db/prisma` is imported by test modules.
 */
export function applyConfiguredTestDatabaseUrlToProcessEnv(): void {
  const url = getTestDatabaseUrl();
  if (!url) return;
  const safeUrl = assertSafeTestDatabase(url);
  process.env.DATABASE_URL = safeUrl;
  process.env.DIRECT_URL = safeUrl;
}

/**
 * Mandatory boundary used by the application Prisma singleton under Vitest.
 * It never falls back to ambient DATABASE_URL.
 */
export function requireSafeTestDatabaseUrlForPrisma(): string {
  const safeUrl = assertSafeTestDatabase();
  process.env.DATABASE_URL = safeUrl;
  process.env.DIRECT_URL = safeUrl;
  return safeUrl;
}
