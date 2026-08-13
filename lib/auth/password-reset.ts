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
    include: { user: { select: { id: true, email: true, isActive: true } } },
  });

  if (!record) return null;
  if (record.usedAt !== null) return null;
  if (record.expiresAt < new Date()) return null;
  if (!record.user.isActive) return null;

  return {
    tokenId: record.id,
    userId: record.user.id,
    userEmail: record.user.email,
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
 * Returns true on success, false if the token is invalid/expired/used.
 */
export async function consumePasswordResetToken(
  prisma: PrismaClient,
  rawToken: string,
  newPassword: string,
): Promise<boolean> {
  const validated = await validatePasswordResetToken(prisma, rawToken);
  if (!validated) return false;

  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: validated.userId },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: validated.tokenId },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: validated.userId,
        id: { not: validated.tokenId },
      },
    }),
  ]);

  return true;
}
