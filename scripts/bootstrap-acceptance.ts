/**
 * Creates the permanent synthetic fixture set in a dedicated Acceptance DB.
 *
 * This script is intentionally not part of `prisma db seed`. It refuses
 * non-Acceptance runtimes, non-allowlisted database identities, databases
 * containing non-Acceptance tenant/user data, and ambiguous operator intent.
 *
 * Secret values are accepted only through protected environment inputs and
 * are never logged. Existing users and credentials are never updated.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  ACCEPTANCE_DATABASE_NAME,
  ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
  assertAcceptanceBootstrapEnvironment,
  bootstrapAcceptanceData,
  readAcceptancePasswords,
} from "@/lib/acceptance/bootstrap";

async function main(): Promise<void> {
  const { databaseUrl } = assertAcceptanceBootstrapEnvironment(process.env);
  const passwords = readAcceptancePasswords(process.env);
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ database_name: string }>>(
      "SELECT current_database() AS database_name",
    );
    if (rows[0]?.database_name !== ACCEPTANCE_DATABASE_NAME) {
      throw new Error("Connected database identity is not the Acceptance database.");
    }

    await prisma.$transaction(
      async (tx) => {
        await bootstrapAcceptanceData(tx, passwords);
      },
      ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
    );

    console.log("[bootstrap-acceptance] Synthetic Acceptance bootstrap complete.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "[bootstrap-acceptance] FAILED:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
