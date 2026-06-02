-- AlterEnum: Add TENANTS to PermissionModule
-- Fixes runtime crash: Value 'TENANTS' not found in enum 'PermissionModule'
-- during prisma.user.findUnique() with userRoles.role.rolePermissions.permission.
--
-- ⚠️  ALTER TYPE … ADD VALUE cannot run inside a transaction block.
--     If prisma migrate deploy fails here, apply manually:
--
--     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'TENANTS';"
--     npx prisma migrate resolve --applied 20260602000000_add_tenants_permission_module

ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'TENANTS';
