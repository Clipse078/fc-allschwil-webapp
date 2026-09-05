/**
 * scripts/stage-auth-password-check.ts
 *
 * READ-ONLY password-match check for an operator-selected platform Superadmin.
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
 *   TARGET_SUPERADMIN_EMAIL — exact platform Superadmin email
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
 *   DATABASE_URL=<url> TARGET_SUPERADMIN_EMAIL=<email> STAGE_LOGIN_PASSWORD=<pw> npx tsx scripts/stage-auth-password-check.ts
 *
 * With .env / .env.local (auto-loaded):
 *   npx tsx scripts/stage-auth-password-check.ts
 */

import "dotenv/config";
import { Client } from "pg";
import bcrypt from "bcryptjs";

async function main(): Promise<void> {
  let userFound = false;
  let hashPresent = false;
  let passwordMatch = false;

  const dbUrl = process.env.DATABASE_URL?.trim();
  const targetEmail = process.env.TARGET_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const candidatePassword = process.env.STAGE_LOGIN_PASSWORD ?? "";

  if (dbUrl && targetEmail) {
    const client = new Client({
      connectionString: dbUrl,
      connectionTimeoutMillis: 8000,
      ssl: dbUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    });

    try {
      await client.connect();

      const { rows } = await client.query<{ password_hash: string | null }>(
        `SELECT u."passwordHash" AS password_hash
           FROM "User" u
          WHERE u.email = $1
            AND u."isActive" = true
            AND EXISTS (
              SELECT 1
                FROM "UserRole" ur
                JOIN "Role" r ON r.id = ur."roleId"
               WHERE ur."userId" = u.id
                 AND ur."tenantId" IS NULL
                 AND r.key = 'super_admin'
                 AND r.scope = 'PLATFORM'
                 AND r."tenantId" IS NULL
                 AND r."isArchived" = false
            )
          LIMIT 1`,
        [targetEmail],
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
