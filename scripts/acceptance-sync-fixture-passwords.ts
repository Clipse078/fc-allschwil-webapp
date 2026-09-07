/**
 * Acceptance-only repair: synchronize canonical fixture-user password hashes
 * with the five protected ACCEPTANCE_*_PASSWORD environment variables.
 *
 * Updates ONLY passwordHash for the five canonical fixture users.
 * Never prints passwords, password hashes, DATABASE_URL, or DB credentials.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
  ACCEPTANCE_DATABASE_NAME,
} from "@/lib/acceptance/bootstrap";
import {
  assertAcceptanceFixturePasswordSyncAuthorization,
  formatAcceptanceFixturePasswordSyncOutput,
  syncAcceptanceFixturePasswordHashes,
} from "@/lib/acceptance/fixture-password-sync";

async function main(): Promise<void> {
  const { target, passwords } = assertAcceptanceFixturePasswordSyncAuthorization(
    process.env,
  );
  const pool = new Pool({ connectionString: target.databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ database_name: string }>>(
      "SELECT current_database() AS database_name",
    );
    if (rows[0]?.database_name !== ACCEPTANCE_DATABASE_NAME) {
      throw new Error("Connected database identity is not the Acceptance database.");
    }

    const updated = await prisma.$transaction(
      async (tx) => syncAcceptanceFixturePasswordHashes(tx, passwords),
      ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
    );

    for (const line of formatAcceptanceFixturePasswordSyncOutput(updated)) {
      console.log(line);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "[acceptance-sync-fixture-passwords] Refused:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exit(1);
});
