-- Non-destructive: add isDefault flag to UserTenant.
-- Existing rows get false (correct — no user has a default set yet).
-- Used by auth.ts to pick the preferred login tenant and by the
-- User ↔ Tenant assignment UI to let superadmin designate a default.

ALTER TABLE "UserTenant" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserTenant_isDefault_idx" ON "UserTenant"("isDefault");
