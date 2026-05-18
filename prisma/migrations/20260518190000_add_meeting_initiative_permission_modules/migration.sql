-- AlterEnum: Add MEETINGS and INITIATIVES to PermissionModule
--
-- ⚠️  PostgreSQL transaction caveat:
--   ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
--   If prisma migrate deploy fails on this file, apply manually:
--     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'MEETINGS';"
--     psql $DATABASE_URL -c "ALTER TYPE \"PermissionModule\" ADD VALUE IF NOT EXISTS 'INITIATIVES';"
--   Then mark applied:
--     npx prisma migrate resolve --applied 20260518190000_add_meeting_initiative_permission_modules
--
ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'MEETINGS';
ALTER TYPE "PermissionModule" ADD VALUE IF NOT EXISTS 'INITIATIVES';
