-- Add MEETINGS to PermissionModule enum.
-- Allows seeding meetings.view and meetings.manage Permission records.
ALTER TYPE "PermissionModule" ADD VALUE 'MEETINGS';
