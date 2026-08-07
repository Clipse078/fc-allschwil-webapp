-- SFV-MATCH-SYNC-HOTFIX-01
-- Adds a lightweight, TTL-based overlap guard for the automatic (cron)
-- SFV schedule sync. Manual admin-triggered syncs are unaffected.
-- AlterTable
ALTER TABLE "TenantSfvConfig"
ADD COLUMN "syncLockedAt" TIMESTAMP(3);
