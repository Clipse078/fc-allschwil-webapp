-- USER-ADMIN-02: Invitation token support + users.invite permission.
--
-- 1. Extends PasswordResetToken with isInvitation flag to distinguish
--    admin-issued invitation tokens (72 h, first-login flow) from
--    self-service password-reset tokens (60 min). Both share the same
--    security invariants (SHA-256 hash only, single-use, expiry).
--
-- 2. Inserts the users.invite permission so it is present in deployed
--    databases that ran the seed before this permission was added.
--    The seed (prisma/seed.ts) is idempotent and grants this permission
--    to the tenant club_admin role on each deploy via the
--    tenantPermissionKeys loop; this INSERT ensures the Permission row
--    is available when the seed runs after this migration.

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN "isInvitation" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_isInvitation_idx" ON "PasswordResetToken"("userId", "isInvitation");

-- Permission: users.invite (idempotent — ON CONFLICT DO NOTHING)
-- scope = TENANT so that tenant club_admin roles receive it via the seed
-- tenantPermissionKeys loop. grantableByAdmin = true so Club Admins can
-- delegate this permission to custom tenant roles.
INSERT INTO "Permission" ("id", "key", "name", "module", "scope", "grantableByAdmin", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'users.invite',
  'Invite users',
  'USERS',
  'TENANT',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

-- Grant users.invite to every existing tenant club_admin role.
-- Club Admin is identified by the canonical key pattern club_admin__<tenantKey>.
-- This INSERT is idempotent: ON CONFLICT DO NOTHING prevents duplicate grants.
INSERT INTO "RolePermission" ("id", "roleId", "permissionId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  r."id",
  p."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" LIKE 'club_admin__%'
  AND r."scope" = 'TENANT'
  AND r."isArchived" = false
  AND p."key" = 'users.invite'
ON CONFLICT DO NOTHING;
