/**
 * READ-ONLY verification for all five canonical Acceptance fixture passwords.
 *
 * NEVER writes, updates, deletes, or alters any row.
 * NEVER prints passwords, password hashes, DATABASE_URL, or DB credentials.
 */
import "dotenv/config";

import { Client } from "pg";
import {
  ACCEPTANCE_DATABASE_NAME,
  readAcceptancePasswords,
} from "@/lib/acceptance/bootstrap";
import {
  assertAcceptanceFixturePasswordDatabaseTarget,
  formatAcceptanceFixturePasswordVerifyOutput,
  verifyAcceptanceFixturePasswordMatches,
} from "@/lib/acceptance/fixture-password-sync";

async function main(): Promise<void> {
  const target = assertAcceptanceFixturePasswordDatabaseTarget(process.env);
  const passwords = readAcceptancePasswords(process.env);
  const client = new Client({
    connectionString: target.databaseUrl,
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

    const results = await verifyAcceptanceFixturePasswordMatches(
      async (email) => {
        const { rows } = await client.query<{ password_hash: string | null }>(
          `SELECT u."passwordHash" AS password_hash
             FROM "User" u
            WHERE u.email = $1
            LIMIT 1`,
          [email],
        );
        return rows[0]?.password_hash ?? null;
      },
      passwords,
    );

    for (const line of formatAcceptanceFixturePasswordVerifyOutput(results)) {
      console.log(line);
    }

    if (results.some((result) => !result.match)) {
      process.exitCode = 1;
    }
  } finally {
    await client.end().catch(() => null);
  }
}

main().catch((error) => {
  console.error(
    "[acceptance-verify-fixture-passwords] Refused:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exit(1);
});
