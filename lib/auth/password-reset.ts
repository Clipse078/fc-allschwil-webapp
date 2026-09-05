/**
 * USER-ADMIN-01 — Password Reset Service
 *
 * Implements the secure token lifecycle for the "Passwort vergessen?" flow:
 *   1. createPasswordResetToken  — generates a cryptographically secure
 *      token, stores only its SHA-256 hash, returns the raw token to the
 *      caller (who embeds it in the reset URL, never logs it).
 *   2. validatePasswordResetToken — looks up a token by hash, checks
 *      expiry and single-use invariants, returns the associated User.
 *   3. consumePasswordResetToken — atomically updates the user's
 *      passwordHash + passwordChangedAt and marks the token used, then
 *      deletes all other reset tokens for that user.
 *
 * Security invariants (see issue USER-ADMIN-01):
 *   - Raw tokens are NEVER stored in the database or logged.
 *   - Only the SHA-256 hash is persisted (tokenHash column).
 *   - Token expiry: TOKEN_EXPIRY_MS (default 60 minutes).
 *   - Single-use: usedAt is set on consumption; used tokens are rejected.
 *   - A new request invalidates all previous active tokens for the user.
 *   - consumePasswordResetToken modifies ONLY passwordHash,
 *     passwordChangedAt, and the PasswordResetToken rows — no roles,
 *     memberships, or unrelated user fields.
 */

import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditRecord } from "@/lib/audit/audit-record";
import {
  acquirePlatformSuperAdminMutationLock,
  platformSuperAdminAssignmentWhere,
} from "@/lib/security/platform-superadmin";

export const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes
export const TOKEN_BYTES = 32; // 256 bits of entropy

/**
 * Hash a raw reset token with SHA-256 for storage.
 * This is a pure, synchronous operation — never async.
 */
export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a new raw reset token and store its hash in the database.
 *
 * - Deletes all existing PasswordResetToken rows for the user first,
 *   invalidating any prior outstanding reset requests.
 * - Returns the raw token (never stored); the caller must embed it in
 *   the reset URL and never log it.
 */
export async function createPasswordResetToken(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Invalidate all previous active reset tokens for this user.
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return rawToken;
}

export type ValidatedToken = {
  tokenId: string;
  userId: string;
  userEmail: string;
  /** True when this token was issued as an invitation (isInvitation flag set). */
  isInvitation: boolean;
  /**
   * True when the user has previously logged in (lastLoginAt is set).
   * On invitation acceptance pages, existing users should be directed to
   * login rather than shown the password-setup form.
   */
  isExistingUser: boolean;
  /**
   * Non-null for invitation tokens: the tenantId the invitation was issued for.
   * Used by both acceptance paths to activate exactly that TenantMembership,
   * without timestamp heuristics.
   */
  invitationTenantId: string | null;
};

/**
 * Validate a raw reset token presented by the user.
 *
 * Returns ValidatedToken on success.
 * Returns null when the token is unknown, expired, or already used —
 * callers must treat all failure cases identically (opaque response).
 *
 * Does NOT consume the token; call consumePasswordResetToken after
 * collecting the new password.
 */
export async function validatePasswordResetToken(
  prisma: PrismaClient,
  rawToken: string,
): Promise<ValidatedToken | null> {
  if (!rawToken) return null;

  const tokenHash = hashResetToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          userRoles: {
            where: platformSuperAdminAssignmentWhere,
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!record) return null;
  if (record.usedAt !== null) return null;
  if (record.expiresAt < new Date()) return null;
  if (!record.user.isActive) return null;
  // Privileged accounts use authenticated self-service, another authorized
  // platform administrator, or the explicit operator break-glass path.
  if (record.user.userRoles.length > 0) return null;

  return {
    tokenId: record.id,
    userId: record.user.id,
    userEmail: record.user.email,
    isInvitation: record.isInvitation,
    isExistingUser: record.user.lastLoginAt !== null,
    invitationTenantId: record.invitationTenantId ?? null,
  };
}

/**
 * Consume a validated token and update the user's password.
 *
 * Operations (all must succeed atomically):
 *   1. Re-validate the token (guards against race conditions).
 *   2. Hash the new password.
 *   3. Update User.passwordHash and User.passwordChangedAt.
 *   4. Mark the token as used (usedAt = now()).
 *   5. Delete all other PasswordResetToken rows for this user.
 *
 * Only modifies:
 *   - User.passwordHash
 *   - User.passwordChangedAt
 *   - PasswordResetToken rows for this user
 *
 * Never touches: roles, memberships, permissions, isActive, email,
 * tenantId, or any other user field.
 *
 * Returns the consumed token context on success, null otherwise.
 */
export async function consumePasswordResetToken(
  prisma: PrismaClient,
  rawToken: string,
  newPassword: string,
): Promise<ValidatedToken | null> {
  const validated = await validatePasswordResetToken(prisma, rawToken);
  if (!validated) return null;

  const newPasswordHash = await hashPassword(newPassword);
  const tokenHash = hashResetToken(rawToken);

  return prisma.$transaction(async (tx) => {
    await acquirePlatformSuperAdminMutationLock(tx);
    const current = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            userRoles: {
              where: platformSuperAdminAssignmentWhere,
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    const now = new Date();
    if (
      !current ||
      current.usedAt !== null ||
      current.expiresAt <= now ||
      !current.user.isActive ||
      current.user.userRoles.length > 0
    ) {
      return null;
    }

    const claimed = await tx.passwordResetToken.updateMany({
      where: {
        id: current.id,
        usedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({
      where: { id: current.user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
      },
    });
    await tx.passwordResetToken.deleteMany({
      where: {
        userId: current.user.id,
        id: { not: current.id },
      },
    });
    await writeAuditRecord(tx, {
      tenantId: current.invitationTenantId ?? null,
      actorUserId: null,
      moduleKey: "security",
      entityType: "User",
      entityId: current.user.id,
      action: current.isInvitation
        ? "INVITATION_PASSWORD_SET"
        : "PASSWORD_RESET_COMPLETED",
      metadataJson: {
        authenticationMethod: "single_use_recovery_link",
        priorSessionsInvalidated: true,
      },
    });

    return {
      tokenId: current.id,
      userId: current.user.id,
      userEmail: current.user.email,
      isInvitation: current.isInvitation,
      isExistingUser: current.user.lastLoginAt !== null,
      invitationTenantId: current.invitationTenantId ?? null,
    };
  });
}

/**
 * Atomically consumes an invitation token without changing a password.
 * Existing-user invitation acceptance shares the same one-winner claim as
 * password reset consumption.
 */
export async function consumeExistingUserInvitationToken(
  prisma: PrismaClient,
  rawToken: string,
): Promise<ValidatedToken | null> {
  if (!rawToken) return null;
  const tokenHash = hashResetToken(rawToken);

  return prisma.$transaction(async (tx) => {
    await acquirePlatformSuperAdminMutationLock(tx);
    const current = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            lastLoginAt: true,
            userRoles: {
              where: platformSuperAdminAssignmentWhere,
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    const now = new Date();
    if (
      !current ||
      !current.isInvitation ||
      current.user.lastLoginAt === null ||
      current.usedAt !== null ||
      current.expiresAt <= now ||
      !current.user.isActive ||
      current.user.userRoles.length > 0
    ) {
      return null;
    }

    const claimed = await tx.passwordResetToken.updateMany({
      where: {
        id: current.id,
        usedAt: null,
        expiresAt: { gt: now },
        user: { isActive: true },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    return {
      tokenId: current.id,
      userId: current.user.id,
      userEmail: current.user.email,
      isInvitation: true,
      isExistingUser: true,
      invitationTenantId: current.invitationTenantId ?? null,
    };
  });
}
