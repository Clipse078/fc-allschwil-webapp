-- Slice 11.6 — Target Groups Foundation: TargetGroup.key scoped to tenant
--
-- BEFORE: TargetGroup.key had a global UNIQUE constraint ("TargetGroup_key_key"),
--         enforcing uniqueness across all tenants. This was a single-tenant
--         assumption introduced in add_org_builder_foundation (20260518230000).
--
-- AFTER: TargetGroup.key is unique per (tenantId, key) pair.
--        Tenants may now reuse the same key independently of one another.
--
-- NULL tenantId handling:
--   PostgreSQL treats NULL as distinct in UNIQUE constraints — two rows with
--   tenantId IS NULL and the same key value do NOT violate the constraint.
--   This preserves safe handling for any legacy null-tenant rows.

-- Step 1: Drop the global unique index on TargetGroup.key
DROP INDEX "TargetGroup_key_key";

-- Step 2: Add the tenant-scoped composite unique index on (tenantId, key)
CREATE UNIQUE INDEX "TargetGroup_tenantId_key_key" ON "TargetGroup"("tenantId", "key");
