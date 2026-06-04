-- Slice 11.2b — Session Tenant Context: add User.tenantId FK
--
-- Adds a nullable tenantId column to User so the JWT can carry
-- tenant context, replacing the hard-coded DEFAULT_TENANT_KEY lookups.
--
-- Design decisions:
--   1. Nullable (String?) — no breaking change for existing users.
--   2. Backfill sets all existing rows to the default tenant (fc-allschwil).
--      Any user without a tenant after deploy falls back to getDefaultTenant()
--      as a safe legacy path.
--   3. FK is SET NULL on tenant delete — users are not deleted when a tenant is.
--   4. Index on tenantId enables fast per-tenant user queries.
--
-- After all active users have a populated tenantId, getDefaultTenant() callers
-- in API routes and server components can be removed in a later cleanup pass.

-- Step 1: Add nullable tenantId column
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;

-- Step 2: Backfill — set all existing users to the default tenant
UPDATE "User"
SET "tenantId" = t.id
FROM "Tenant" t
WHERE t.key = 'fc-allschwil'
  AND "User"."tenantId" IS NULL;

-- Step 3: Add FK constraint
ALTER TABLE "User"
  ADD CONSTRAINT "User_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Add index for per-tenant user queries
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
