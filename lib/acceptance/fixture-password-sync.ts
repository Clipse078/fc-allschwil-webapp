import type { Prisma } from "@prisma/client";
import {
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_FIXTURE,
  assertAcceptanceDatabaseTarget,
  getAcceptanceDatabaseIdentity,
  readAcceptancePasswords,
  type AcceptancePasswords,
} from "@/lib/acceptance/bootstrap";
import {
  assertAcceptancePooledBootstrapHost,
  resolveAcceptanceBootstrapDatabaseUrl,
} from "@/lib/acceptance/bootstrap-safe-runner";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM =
  "SYNC_ACCEPTANCE_FIXTURE_PASSWORDS";
export const ACCEPTANCE_FIXTURE_PASSWORD_SYNC_AUTHORIZATION =
  "acceptance-sync-fixture-passwords:acceptance";

export const ACCEPTANCE_FIXTURE_PASSWORD_SYNC_ORDER = [
  "superadmin",
  "alphaAdmin",
  "alphaMember",
  "betaAdmin",
  "betaMember",
] as const;

export type AcceptanceFixturePasswordSyncUserKey =
  (typeof ACCEPTANCE_FIXTURE_PASSWORD_SYNC_ORDER)[number];

export const ACCEPTANCE_FIXTURE_PASSWORD_SYNC_LABELS: Record<
  AcceptanceFixturePasswordSyncUserKey,
  string
> = {
  superadmin: "SUPERADMIN",
  alphaAdmin: "ALPHA ADMIN",
  alphaMember: "ALPHA MEMBER",
  betaAdmin: "BETA ADMIN",
  betaMember: "BETA MEMBER",
};

const OPERATIONAL_URL_ENV_NAMES = [
  "STAGE_DB_URL",
  "STAGE_DIRECT_URL",
  "PROD_DB_URL",
  "PROD_DIRECT_URL",
  "PRODUCTION_DATABASE_URL",
] as const;

type PasswordHasher = (password: string) => Promise<string>;

export type AcceptanceFixturePasswordDatabaseTarget = {
  databaseUrl: string;
  host: string;
  database: string;
};

export type AcceptanceFixturePasswordMatch = {
  key: AcceptanceFixturePasswordSyncUserKey;
  label: string;
  match: boolean;
};

export function assertAcceptanceFixturePasswordDatabaseTarget(
  env: NodeJS.ProcessEnv,
): AcceptanceFixturePasswordDatabaseTarget {
  if (env.APP_ENV?.trim().toLowerCase() !== "acceptance") {
    throw new Error("APP_ENV must be set to acceptance.");
  }

  const allowlistedHost = env.ACCEPTANCE_DATABASE_HOST?.trim().toLowerCase();
  if (!allowlistedHost) {
    throw new Error("ACCEPTANCE_DATABASE_HOST is required.");
  }

  const databaseUrl = resolveAcceptanceBootstrapDatabaseUrl(env);
  const identity = assertAcceptanceDatabaseTarget(databaseUrl, [allowlistedHost]);
  assertAcceptancePooledBootstrapHost(identity.host);

  if (identity.database === "neondb") {
    throw new Error("Refusing protected database identity neondb.");
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

  return {
    databaseUrl,
    host: identity.host,
    database: identity.database,
  };
}

export function assertAcceptanceFixturePasswordSyncAuthorization(
  env: NodeJS.ProcessEnv,
): { target: AcceptanceFixturePasswordDatabaseTarget; passwords: AcceptancePasswords } {
  const target = assertAcceptanceFixturePasswordDatabaseTarget(env);

  if (
    env.ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM !==
    ACCEPTANCE_FIXTURE_PASSWORD_SYNC_CONFIRM
  ) {
    throw new Error("Acceptance fixture password sync confirmation is missing or invalid.");
  }
  if (
    env.SCE_OPERATION_AUTHORIZATION !== ACCEPTANCE_FIXTURE_PASSWORD_SYNC_AUTHORIZATION
  ) {
    throw new Error("Acceptance fixture password sync authorization is missing or invalid.");
  }

  const passwords = readAcceptancePasswords(env);
  return { target, passwords };
}

export async function syncAcceptanceFixturePasswordHashes(
  tx: Prisma.TransactionClient,
  passwords: AcceptancePasswords,
  passwordHasher: PasswordHasher = hashPassword,
): Promise<number> {
  let updated = 0;

  for (const key of ACCEPTANCE_FIXTURE_PASSWORD_SYNC_ORDER) {
    const fixture = ACCEPTANCE_FIXTURE.users[key];
    const existing = await tx.user.findUnique({
      where: { email: fixture.email },
      select: { id: true },
    });

    if (!existing) {
      throw new Error(`Canonical Acceptance fixture user is missing: ${key}.`);
    }
    if (existing.id !== fixture.id) {
      throw new Error(`Existing user ${fixture.email} is not the Acceptance fixture.`);
    }

    const passwordHash = await passwordHasher(passwords[fixture.passwordEnv]);
    await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });
    updated += 1;
  }

  return updated;
}

export async function verifyAcceptanceFixturePasswordMatches(
  loadPasswordHash: (email: string) => Promise<string | null>,
  passwords: AcceptancePasswords,
): Promise<AcceptanceFixturePasswordMatch[]> {
  const results: AcceptanceFixturePasswordMatch[] = [];

  for (const key of ACCEPTANCE_FIXTURE_PASSWORD_SYNC_ORDER) {
    const fixture = ACCEPTANCE_FIXTURE.users[key];
    const passwordHash = await loadPasswordHash(fixture.email);
    const candidatePassword = passwords[fixture.passwordEnv];
    const match =
      Boolean(passwordHash) &&
      candidatePassword.length >= 12 &&
      (await verifyPassword(candidatePassword, passwordHash!));

    results.push({
      key,
      label: ACCEPTANCE_FIXTURE_PASSWORD_SYNC_LABELS[key],
      match,
    });
  }

  return results;
}

export function formatAcceptanceFixturePasswordSyncOutput(updated: number): string[] {
  const lines = ["ACCEPTANCE DB SAFETY: PASS"];
  for (const key of ACCEPTANCE_FIXTURE_PASSWORD_SYNC_ORDER) {
    lines.push(
      `${ACCEPTANCE_FIXTURE_PASSWORD_SYNC_LABELS[key]} PASSWORD SYNC: PASS`,
    );
  }
  lines.push(`TOTAL FIXTURE PASSWORDS UPDATED: ${updated}`);
  return lines;
}

export function formatAcceptanceFixturePasswordVerifyOutput(
  results: readonly AcceptanceFixturePasswordMatch[],
): string[] {
  return results.map(
    (result) => `${result.label} MATCH: ${result.match ? "YES" : "NO"}`,
  );
}
