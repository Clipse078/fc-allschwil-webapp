/**
 * One-time seed script: creates a minimal STAGE-only published news article
 * for fc-allschwil to enable end-to-end validation of the website feed API.
 *
 * Safe to re-run — upserts by slug so it will not create duplicates.
 *
 * Run:
 *   DATABASE_URL=<stage-db-url> npx tsx scripts/seed-stage-test-article.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { key: "fc-allschwil" },
      select: { id: true, key: true, name: true, websiteEnabled: true },
    });

    if (!tenant) {
      console.error("ERROR: fc-allschwil tenant not found in database.");
      process.exit(1);
    }

    console.log(`Tenant: ${tenant.name} (${tenant.key}) — websiteEnabled=${tenant.websiteEnabled}`);

    const SLUG = "stage-test-news-article";

    const existing = await prisma.newsArticle.findFirst({
      where: { slug: SLUG, tenantId: tenant.id },
      select: { id: true, slug: true, status: true, publishedAt: true },
    });

    if (existing) {
      console.log(`Article already exists: id=${existing.id} status=${existing.status}`);
      console.log("No action taken — article already seeded.");
      return;
    }

    const article = await prisma.newsArticle.create({
      data: {
        tenantId: tenant.id,
        slug: SLUG,
        title: "STAGE Test News Article",
        excerpt: "This is a minimal test article used to validate the Website ↔ WebApp integration on STAGE.",
        content: [
          "## STAGE Test Article",
          "",
          "This article exists solely to validate the public news feed API on the STAGE environment.",
          "",
          "It confirms that:",
          "",
          "- The `/api/public/v1/website/news` list endpoint returns published articles.",
          "- The `/api/public/v1/website/news/stage-test-news-article` detail endpoint returns full content.",
          "- Tenant resolution for `fc-allschwil` is working correctly.",
          "",
          "> This is not production content.",
        ].join("\n"),
        imageUrl: null,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true, slug: true, title: true, status: true, publishedAt: true },
    });

    console.log("\nSeeded article:");
    console.log(JSON.stringify(article, null, 2));
    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
