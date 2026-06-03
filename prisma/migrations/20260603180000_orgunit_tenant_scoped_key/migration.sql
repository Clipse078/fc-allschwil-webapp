-- Slice 11.2 — Tenant Isolation Hardening: OrgUnit.key scoped to tenant
--
-- BEFORE: OrgUnit.key had a global UNIQUE constraint ("OrgUnit_key_key"),
--         enforcing uniqueness across all tenants. This was a single-tenant
--         v1 assumption introduced in add_org_builder_foundation.
--
-- AFTER: OrgUnit.key is unique per (tenantId, key) pair.
--        Tenants may now reuse the same key independently of one another.
--
-- NULL tenantId handling:
--   PostgreSQL treats NULL as distinct in UNIQUE constraints — two rows with
--   tenantId IS NULL and the same key value do NOT violate the constraint.
--   This preserves safe handling for any legacy null-tenant rows that were
--   not caught by the 20260601124700_add_org_membership_relations_tenant_backfill
--   migration. Null-tenant rows therefore remain accessible but are isolated
--   from tenant-scoped rows.

-- Step 1: Drop the global unique index on OrgUnit.key
DROP INDEX "OrgUnit_key_key";

-- Step 2: Add the tenant-scoped composite unique index on (tenantId, key)
CREATE UNIQUE INDEX "OrgUnit_tenantId_key_key" ON "OrgUnit"("tenantId", "key");
