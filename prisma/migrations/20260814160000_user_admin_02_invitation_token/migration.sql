-- USER-ADMIN-02: Invitation token support.
--
-- Extends PasswordResetToken with isInvitation flag to distinguish
-- admin-issued invitation tokens (72 h, first-login flow) from
-- self-service password-reset tokens (60 min). Both share the same
-- security invariants (SHA-256 hash only, single-use, expiry).

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN "isInvitation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_isInvitation_idx" ON "PasswordResetToken"("userId", "isInvitation");
