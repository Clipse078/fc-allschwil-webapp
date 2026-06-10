/**
 * scripts/stage-auth-password-check.ts
 *
 * READ-ONLY password-match check for admin@fcallschwil.ch.
 *
 * SAFETY INVARIANT:
 *   This script executes ONLY a SELECT statement.
 *   It NEVER writes, updates, deletes, or alters any row.
 *   It NEVER prints passwordHash, DATABASE_URL, NEXTAUTH_SECRET,
 *   STAGE_LOGIN_PASSWORD, or any other credential value.
 *   It is safe to run against STAGE or PROD at any time.
 *
 * Uses raw node-postgres (pg) — no Prisma generation required.
 * Uses bcryptjs — same library the project already depends on.
 *
 * Required env vars:
 *   DATABASE_URL          — connection string for the target DB
 *   STAGE_LOGIN_PASSWORD  — plaintext password to test (value never printed)
 *
 * Output (three lines only):
 *   user found    = YES/NO
 *   hash present  = YES/NO
 *   password match = YES/NO
 *
 * Exit code: always 0.
 *
 * Usage:
 *   DATABASE_URL=<url> STAGE_LOGIN_PASSWORD=<pw> npx tsx scripts/stage-auth-password-check.ts
 *
 * With .env / .env.local (auto-loaded):
 *   npx tsx scripts/stage-auth-password-check.ts
 */

import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";

const TARGET_EMAIL = "admin@fcallschwil.ch";

async function main(): Promise<void> {
  let userFound = false;
  let hashPresent = false;
  let passwordMatch = false;

  const dbUrl = process.env.DATABASE_URL?.trim();
  const candidatePassword = process.env.STAGE_LOGIN_PASSWORD ?? "";

  if (dbUrl) {
    const client = new Client({
      connectionString: dbUrl,
      connectionTimeoutMillis: 8000,
      ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    });

    try {
      await client.connect();

      const { rows } = await client.query<{ password_hash: string | null }>(
        `SELECT "passwordHash" AS password_hash FROM "User" WHERE email = $1 LIMIT 1`,
        [TARGET_EMAIL],
      );

      if (rows.length > 0) {
        userFound = true;
        const hash = rows[0].password_hash ?? "";
        hashPresent = hash.length > 0;

        if (hashPresent && candidatePassword.length > 0) {
          try {
            passwordMatch = await bcrypt.compare(candidatePassword, hash);
          } catch {
            passwordMatch = false;
          }
        }
      }
    } catch {
      // silently ignore — output will reflect what was learned
    } finally {
      await client.end().catch(() => null);
    }
  }

  console.log(`user found    = ${userFound ? "YES" : "NO"}`);
  console.log(`hash present  = ${hashPresent ? "YES" : "NO"}`);
  console.log(`password match = ${passwordMatch ? "YES" : "NO"}`);
}

main().catch(() => null).finally(() => process.exit(0));
