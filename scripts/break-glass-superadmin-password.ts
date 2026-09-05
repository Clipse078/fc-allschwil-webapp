/**
 * Exceptional operator-only recovery for an existing active platform
 * Superadmin. This script never creates, activates, or promotes an account.
 *
 * Required:
 *   TARGET_SUPERADMIN_EMAIL=<exact email>
 *   BREAK_GLASS_NEW_PASSWORD=<new password, minimum 12 characters>
 *   BREAK_GLASS_CONFIRM=RESET_EXISTING_ACTIVE_PLATFORM_SUPERADMIN
 *   SCE_OPERATION_AUTHORIZATION=break-glass-superadmin-password:<stage|prod>
 * Production additionally requires the standard independent approval variable.
 *
 * Secret values, password hashes, reset tokens, and database URLs are never
 * printed.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { hashPassword } from "@/lib/auth/password";
import { assertOperationalMutationAllowed } from "@/lib/server/operational-database-guard";
import {
  acquirePlatformSuperAdminMutationLock,
  platformSuperAdminAssignmentWhere,
} from "@/lib/security/platform-superadmin";

const OPERATION_ID = "break-glass-superadmin-password";
const CONFIRMATION = "RESET_EXISTING_ACTIVE_PLATFORM_SUPERADMIN";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const targetEmail = process.env.TARGET_SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BREAK_GLASS_NEW_PASSWORD ?? "";
  const confirmed = process.env.BREAK_GLASS_CONFIRM === CONFIRMATION;

  if (!databaseUrl || !targetEmail || password.length < 12 || !confirmed) {
    throw new Error(
      "Required break-glass inputs are missing or invalid. No changes were made.",
    );
  }

  assertOperationalMutationAllowed({
    operationId: OPERATION_ID,
    databaseUrl,
    explicitIntent: confirmed,
    allowedRemoteEnvironments: ["stage", "prod"],
  });

  const pool = new Pool({ connectionString: databaseUrl });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const passwordHash = await hashPassword(password);
    await client.$transaction(async (tx) => {
      await acquirePlatformSuperAdminMutationLock(tx);
      const target = await tx.user.findUnique({
        where: { email: targetEmail },
        select: {
          id: true,
          isActive: true,
          userRoles: {
            where: platformSuperAdminAssignmentWhere,
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!target?.isActive || target.userRoles.length === 0) {
        throw new Error(
          "Target is not an existing active platform Superadmin. No changes were made.",
        );
      }

      const changedAt = new Date();
      await tx.user.update({
        where: { id: target.id },
        data: { passwordHash, passwordChangedAt: changedAt },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: null,
          moduleKey: "security",
          entityType: "User",
          entityId: target.id,
          action: "BREAK_GLASS_PASSWORD_RESET",
          metadataJson: {
            operationId: OPERATION_ID,
            sessionsRevokedAt: changedAt.toISOString(),
          },
        },
      });
    });

    console.log(
      "[break-glass-superadmin-password] SUCCESS: password changed, prior sessions revoked, audit event recorded.",
    );
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    "[break-glass-superadmin-password] FAILED:",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
});
