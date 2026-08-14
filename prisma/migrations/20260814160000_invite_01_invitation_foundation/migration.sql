-- Migration: 20260814160000_invite_01_invitation_foundation
--
-- INVITE-01: MVP Invitation Foundation — Person↔User per-tenant identity
--            and invitation lifecycle.
--
-- Changes:
--
-- 1. PERSON.userId: drop global @unique, add per-tenant @@unique([tenantId, userId])
--    Allows one User to link to one Person per tenant (multi-tenant support).
--    A User in multiple tenants gets a separate Person record in each.
--    "A Person max one User" is still enforced by the per-tenant unique.
--    NULL userId values are excluded from the unique constraint (PostgreSQL).
--
-- 2. ADD INDEX: Person.userId for fast reverse lookups (User.persons[]).
--
-- 3. Invitation table: tenant-scoped, token-based user invitations targeting
--    a specific Person record.
--
-- Invariants preserved:
--   - Person master data is never deleted by invitation revocation.
--   - User/TenantMembership/UserRole are never touched by the invitation schema.
--   - PersonAssignment (organisational data) is not affected.
--   - All existing Person rows remain valid; the constraint change is safe
--     because no two Person rows in the same tenant can share a non-NULL userId
--     (previously enforced globally; now enforced per-tenant, which is stricter
--     in the edge case of cross-tenant data but still satisfied for all rows
--     present with tenantId NOT NULL and global @unique already enforced).

-- ── 1. Replace global @unique on Person.userId with per-tenant unique ────────

-- Drop the old global unique index
DROP INDEX IF EXISTS "Person_userId_key";

-- Add per-tenant unique constraint (NULL userId rows are excluded per SQL standard)
CREATE UNIQUE INDEX "Person_tenantId_userId_key" ON "Person"("tenantId", "userId")
  WHERE "userId" IS NOT NULL;

-- ── 2. Add index on Person.userId for efficient User.persons[] lookups ────────

CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- ── 3. Invitation table ───────────────────────────────────────────────────────

CREATE TABLE "Invitation" (
  "id"         TEXT         NOT NULL,
  "tenantId"   TEXT         NOT NULL,
  "personId"   TEXT         NOT NULL,
  "email"      TEXT         NOT NULL,
  "tokenHash"  TEXT         NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "Invitation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "Invitation_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_tenantId_idx"                    ON "Invitation"("tenantId");
CREATE INDEX "Invitation_tokenHash_idx"                   ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_personId_idx"                    ON "Invitation"("personId");
CREATE INDEX "Invitation_tenantId_acceptedAt_revokedAt_idx"
  ON "Invitation"("tenantId", "acceptedAt", "revokedAt");

-- ── 4. Permission: users.invite (idempotent — already seeded, ensure present) ─

INSERT INTO "Permission" ("id", "key", "name", "module", "scope", "grantableByAdmin", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'users.invite',
  'Invite users to the tenant',
  'USERS',
  'TENANT',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
