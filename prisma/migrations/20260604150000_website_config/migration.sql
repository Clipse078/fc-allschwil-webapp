-- FC Allschwil Website ↔ WebApp Integration — Website Config
-- Adds WebsiteConfig for per-tenant website settings (contact, social, SEO, tagline).
-- Safe and non-destructive: new table only, no existing columns modified.

-- CreateTable: WebsiteConfig
CREATE TABLE "WebsiteConfig" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "websiteTitle"       TEXT,
    "websiteDescription" TEXT,
    "heroTagline"        TEXT,
    "contactEmail"       TEXT,
    "contactPhone"       TEXT,
    "addressStreet"      TEXT,
    "addressCity"        TEXT,
    "addressCountry"     TEXT,
    "googleMapsUrl"      TEXT,
    "facebookUrl"        TEXT,
    "instagramUrl"       TEXT,
    "youtubeUrl"         TEXT,
    "twitterUrl"         TEXT,
    "tiktokUrl"          TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique per tenant (1:1)
CREATE UNIQUE INDEX "WebsiteConfig_tenantId_key"
    ON "WebsiteConfig"("tenantId");

-- AddForeignKey: WebsiteConfig → Tenant
ALTER TABLE "WebsiteConfig"
    ADD CONSTRAINT "WebsiteConfig_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
