-- INVITE-01: Add invitationTenantId to PasswordResetToken.
--
-- Enables exact tenant-membership activation on invitation acceptance.
-- Previously, acceptance used a 72-hour joinedAt heuristic which was unsafe:
-- a user invited to TenantB then TenantC would have two recent isActive=false
-- memberships; the heuristic could not determine which to activate.
--
-- invitationTenantId is nullable:
--   - NULL for standard password-reset tokens (isInvitation=false)
--   - Non-null for invitation tokens (isInvitation=true), set to the
--     tenantId the invitation was issued for
--
-- Idempotent: IF NOT EXISTS guards re-application on STAGE.

ALTER TABLE "PasswordResetToken"
  ADD COLUMN IF NOT EXISTS "invitationTenantId" TEXT;
