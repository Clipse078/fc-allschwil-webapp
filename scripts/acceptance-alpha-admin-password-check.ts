/**
 * READ-ONLY password-match check for the canonical Acceptance Alpha Admin fixture.
 *
 * SAFETY INVARIANT:
 *   Executes ONLY a SELECT against the Acceptance database.
 *   NEVER writes, updates, deletes, or alters any row.
 *   NEVER prints passwordHash, DATABASE_URL, DB credentials, or password values.
 *
 * Required env:
 *   APP_ENV=acceptance
 *   ACCEPTANCE_DATABASE_HOST — allowlisted Neon pooled host
 *   ACCEPTANCE_ALPHA_ADMIN_PASSWORD — local candidate password (never printed)
 *
 * Database URL resolution matches the safe Acceptance bootstrap runner:
 *   DATABASE_URL when set, otherwise built from ACCEPTANCE_DATABASE_* parts.
 *
 * Output (three lines only):
 *   ALPHA ADMIN USER FOUND: YES/NO
 *   PASSWORD HASH PRESENT: YES/NO
 *   LOCAL PASSWORD MATCHES DB HASH: YES/NO
 *
 * Exit code: 0 when guards pass (even if password does not match).
 * Exit code: 1 when environment or database target validation fails.
 */
import "dotenv/config";

import { Client } from "pg";
import {
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_FIXTURE,
  assertAcceptanceDatabaseTarget,
  getAcceptanceDatabaseIdentity,
} from "@/lib/acceptance/bootstrap";
import {
  assertAcceptancePooledBootstrapHost,
  resolveAcceptanceBootstrapDatabaseUrl,
} from "@/lib/acceptance/bootstrap-safe-runner";
import { verifyPassword } from "@/lib/auth/password";

const OPERATIONAL_URL_ENV_NAMES = [
  "STAGE_DB_URL",
  "STAGE_DIRECT_URL",
  "PROD_DB_URL",
  "PROD_DIRECT_URL",
  "PRODUCTION_DATABASE_URL",
] as const;

function assertReadOnlyAcceptanceEnvironment(env: NodeJS.ProcessEnv): string {
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

  return databaseUrl;
}

async function main(): Promise<void> {
  const databaseUrl = assertReadOnlyAcceptanceEnvironment(process.env);
  const candidatePassword = process.env.ACCEPTANCE_ALPHA_ADMIN_PASSWORD?.trim() ?? "";
  const fixtureEmail = ACCEPTANCE_FIXTURE.users.alphaAdmin.email;

  let userFound = false;
  let hashPresent = false;
  let passwordMatches = false;

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const dbIdentity = await client.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    if (dbIdentity.rows[0]?.database_name !== ACCEPTANCE_DATABASE_NAME) {
      throw new Error("Connected database identity is not the Acceptance database.");
    }

    const { rows } = await client.query<{ password_hash: string | null }>(
      `SELECT u."passwordHash" AS password_hash
         FROM "User" u
        WHERE u.email = $1
        LIMIT 1`,
      [fixtureEmail],
    );

    if (rows.length > 0) {
      userFound = true;
      const hash = rows[0].password_hash ?? "";
      hashPresent = hash.length > 0;

      if (hashPresent && candidatePassword.length >= 12) {
        passwordMatches = await verifyPassword(candidatePassword, hash);
      }
    }
  } finally {
    await client.end().catch(() => null);
  }

  console.log(`ALPHA ADMIN USER FOUND: ${userFound ? "YES" : "NO"}`);
  console.log(`PASSWORD HASH PRESENT: ${hashPresent ? "YES" : "NO"}`);
  console.log(`LOCAL PASSWORD MATCHES DB HASH: ${passwordMatches ? "YES" : "NO"}`);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown validation error.";
  console.error(`[acceptance-alpha-admin-password-check] Refused: ${message}`);
  process.exit(1);
});
