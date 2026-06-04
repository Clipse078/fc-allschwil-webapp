-- Website Management Foundation — News Posts
-- Adds NewsPost to store tenant-scoped club news articles for the public website.
-- Safe and non-destructive: new table only, no existing columns modified.
--
-- body stores the article body in Markdown.
-- isPublished / publishedAt gate public visibility.
-- Public display: /api/public/website/news

-- CreateTable: NewsPost
CREATE TABLE "NewsPost" (
    "id"            TEXT         NOT NULL,
    "tenantId"      TEXT         NOT NULL,
    "slug"          TEXT         NOT NULL,
    "title"         TEXT         NOT NULL,
    "excerpt"       TEXT,
    "body"          TEXT         NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "authorName"    TEXT,
    "isPublished"   BOOLEAN      NOT NULL DEFAULT false,
    "publishedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique per tenant/slug
CREATE UNIQUE INDEX "NewsPost_tenantId_slug_key"
    ON "NewsPost"("tenantId", "slug");

CREATE INDEX "NewsPost_tenantId_isPublished_idx"
    ON "NewsPost"("tenantId", "isPublished");

CREATE INDEX "NewsPost_tenantId_publishedAt_idx"
    ON "NewsPost"("tenantId", "publishedAt");

-- AddForeignKey: NewsPost → Tenant
ALTER TABLE "NewsPost"
    ADD CONSTRAINT "NewsPost_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
