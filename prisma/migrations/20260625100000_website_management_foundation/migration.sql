-- Website Management Foundation: extended tenant website configuration fields.
-- Safe additive DDL: new enum type, new nullable/defaulted columns on Tenant.
-- No data transformation or data loss.

-- 1. Create the WebsitePublishMode enum
CREATE TYPE "WebsitePublishMode" AS ENUM ('DRAFT', 'STAGED', 'LIVE');

-- 2. Add new website configuration columns to Tenant
ALTER TABLE "Tenant"
  ADD COLUMN "websiteBaseUrl"         VARCHAR(2048),
  ADD COLUMN "websitePrimaryLanguage" VARCHAR(10),
  ADD COLUMN "websitePublishMode"     "WebsitePublishMode" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "websiteLastPublishedAt" TIMESTAMP(3),
  ADD COLUMN "websiteCacheStrategy"   VARCHAR(64);
