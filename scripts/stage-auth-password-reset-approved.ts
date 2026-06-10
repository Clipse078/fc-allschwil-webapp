/**
 * scripts/stage-auth-password-reset-approved.ts
 *
 * Approved one-time password reset for admin@fcallschwil.ch ONLY.
 *
 * SAFETY INVARIANT:
 *   Updates EXACTLY ONE column ("passwordHash") on EXACTLY ONE row
 *   (WHERE email = 'admin@fcallschwil.ch').
 *   The UPDATE is guarded by a prior SELECT — if the user is not found,
 *   no UPDATE is executed.
 *   It NEVER touches any other user, tenant, role, seed, Prisma,
 *   or migration file.
 *   It NEVER prints STAGE_NEW_PASSWORD, passwordHash, DATABASE_URL,
 *   NEXTAUTH_SECRET, or any other credential value.
 *
 * Uses raw node-postgres (pg) — no Prisma generation required.
 * Uses bcryptjs with cost factor 12.
 *
 * Required env vars:
 *   DATABASE_URL       — connection string for the target DB
 *   STAGE_NEW_PASSWORD — new plaintext password (value never printed)
 *
 * Output (exactly two lines):
 *   user found       = YES/NO
 *   password updated = YES/NO
 *
 * Exit code: 0 on success, 1 on fatal misconfiguration (missing env var).
 *
 * Usage:
 *   DATABASE_URL=<url> STAGE_NEW_PASSWORD=<pw> npx tsx scripts/stage-auth-password-reset-approved.ts
 *
 * With .env / .env.local (auto-loaded):
 *   npx tsx scripts/stage-auth-password-reset-approved.ts
 */

import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";

const TARGET_EMAIL = "admin@fcallschwil.ch";
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL?.trim();
  const newPassword = process.env.STAGE_NEW_PASSWORD ?? "";

  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL is not set.");
    process.exit(1);
  }

  if (!newPassword) {
    console.error("ERROR: STAGE_NEW_PASSWORD is not set.");
    process.exit(1);
  }

  let userFound = false;
  let passwordUpdated = false;

  const client = new Client({
    connectionString: dbUrl,
    connectionTimeoutMillis: 8000,
    ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // SELECT first — only proceed if the target user exists.
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM "User" WHERE email = $1 LIMIT 1`,
      [TARGET_EMAIL],
    );

    if (rows.length === 0) {
      console.log(`user found       = NO`);
      console.log(`password updated = NO`);
      return;
    }

    userFound = true;

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    const result = await client.query(
      `UPDATE "User" SET "passwordHash" = $1 WHERE email = $2`,
      [newHash, TARGET_EMAIL],
    );

    passwordUpdated = (result.rowCount ?? 0) === 1;
  } finally {
    await client.end().catch(() => null);
  }

  console.log(`user found       = ${userFound ? "YES" : "NO"}`);
  console.log(`password updated = ${passwordUpdated ? "YES" : "NO"}`);
}

main().catch((err) => {
  console.error("ERROR:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
