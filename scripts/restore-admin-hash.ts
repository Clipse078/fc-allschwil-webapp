/**
 * scripts/restore-admin-hash.ts
 *
 * ONE-TIME controlled credential recovery helper.
 *
 * Applies a pre-computed bcrypt hash to the admin@fcallschwil.ch user row.
 * Takes the hash as an environment variable — NEVER a plaintext password.
 *
 * Requirements:
 *   DATABASE_URL   — connection string for the target database
 *   ADMIN_PASSWORD_HASH — a valid bcrypt hash ($2b$12$... or $2a$12$...)
 *   ALLOW_PASSWORD_CHANGE=true — explicit opt-in required
 *
 * Usage (STAGE):
 *   DATABASE_URL=<stage-url> \
 *     ALLOW_PASSWORD_CHANGE=true \
 *     ADMIN_PASSWORD_HASH='$2b$12$...' \
 *     npx tsx scripts/restore-admin-hash.ts
 *
 * This script:
 *   - Updates ONLY admin@fcallschwil.ch
 *   - Updates ONLY passwordHash (no other fields touched)
 *   - Verifies the row exists and is active before writing
 *   - Prints a confirmation row after writing (email, hash prefix, lastLoginAt)
 *   - Changes NO other user records
 *
 * After use, delete or archive this script — it is a one-time recovery tool.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const ADMIN_EMAIL = "admin@fcallschwil.ch";

// ── Safety checks ──────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[restore-admin-hash] ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

if (process.env.ALLOW_PASSWORD_CHANGE !== "true") {
  console.error(
    "[restore-admin-hash] BLOCKED: ALLOW_PASSWORD_CHANGE=true is required.\n" +
    "This script must be invoked with explicit approval: ALLOW_PASSWORD_CHANGE=true"
  );
  process.exit(1);
}

const rawHash = process.env.ADMIN_PASSWORD_HASH;
if (!rawHash) {
  console.error("[restore-admin-hash] ERROR: ADMIN_PASSWORD_HASH is not set.");
  process.exit(1);
}
// Explicitly typed as string so TypeScript carries the narrowed type into
// async function closures — process.exit() above guarantees rawHash is set.
const hash: string = rawHash;

// Validate bcrypt hash format ($2b$12$... or $2a$12$..., length 60)
if (!/^\$2[ab]\$\d{2}\$.{53}$/.test(hash)) {
  console.error(
    "[restore-admin-hash] ERROR: ADMIN_PASSWORD_HASH does not look like a valid " +
    "bcrypt hash. Expected format: $2b$12$<53 chars> (length 60).\n" +
    "Provided prefix: " + hash.substring(0, 7) + "..., length: " + hash.length
  );
  process.exit(1);
}

// ── Apply ─────────────────────────────────────────────────────────────────────

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Read existing row first — refuse to create; only update an existing user.
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, isActive: true, tenantId: true, lastLoginAt: true },
  });

  if (!existing) {
    console.error(
      `[restore-admin-hash] ERROR: ${ADMIN_EMAIL} does not exist in this database. ` +
      "Cannot restore — use bootstrap-admin.ts to create."
    );
    process.exit(1);
  }

  if (!existing.isActive) {
    console.error(
      `[restore-admin-hash] ERROR: ${ADMIN_EMAIL} exists but isActive=false. ` +
      "Refusing to set a password on an inactive account. Reactivate first."
    );
    process.exit(1);
  }

  console.log(`\n[restore-admin-hash] Found ${ADMIN_EMAIL} (id=${existing.id})`);
  console.log(`  isActive  : ${existing.isActive}`);
  console.log(`  tenantId  : ${existing.tenantId ?? "(null — run bootstrap to fix)"}`);
  console.log(`  lastLoginAt: ${existing.lastLoginAt?.toISOString() ?? "never"}`);
  console.log(`\n[restore-admin-hash] Applying new hash (prefix: ${hash.substring(0, 7)})…`);

  // Update ONLY passwordHash — no other fields.
  await prisma.user.update({
    where: { email: ADMIN_EMAIL },
    data: { passwordHash: hash },
  });

  // Read back to confirm.
  const after = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { email: true, passwordHash: true, isActive: true },
  });

  if (!after || after.passwordHash !== hash) {
    console.error("[restore-admin-hash] ERROR: hash mismatch after write — verify DB permissions.");
    process.exit(1);
  }

  console.log(`\n[restore-admin-hash] SUCCESS`);
  console.log(`  email      : ${after.email}`);
  console.log(`  hash prefix: ${after.passwordHash.substring(0, 7)}`);
  console.log(`  isActive   : ${after.isActive}`);
  console.log(`\nLogin with ${ADMIN_EMAIL} using the password that produced this hash.`);
  console.log("Change the password via the admin UI after first successful login.\n");
}

main()
  .catch((err) => {
    console.error("[restore-admin-hash] FAILED:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
