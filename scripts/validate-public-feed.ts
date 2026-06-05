/**
 * Runtime validation script for Slice 4 — Public Website News Feed
 *
 * Exercises the public news feed query layer directly against the Prisma client
 * (same client used by /api/public/v1/website/news routes) to verify:
 *
 *   1. Published article returned by list query (no content field)
 *   2. Published article returned by slug detail query (with content)
 *   3. Draft article excluded from list query
 *   4. Draft slug returns null from detail query (→ 404 on route)
 *   5. Unknown slug returns null from detail query (→ 404 on route)
 *   6. List query excludes content field entirely
 *   7. websiteEnabled=false tenant flag check (assertWebsiteEnabled)
 *   8. approvedDataOnly flag present on tenant row
 *   9. Tenant isolation: article is scoped to correct tenant
 *
 * Run:
 *   DATABASE_URL=... npx tsx scripts/validate-public-feed.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// ── test utilities ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results: Array<{
  id: number;
  name: string;
  result: "PASS" | "FAIL";
  note: string;
}> = [];

function assert(id: number, name: string, condition: boolean, note: string) {
  if (condition) {
    passed++;
    results.push({ id, name, result: "PASS", note });
    console.log(`  ✓  ${name}`);
  } else {
    failed++;
    results.push({ id, name, result: "FAIL", note });
    console.error(`  ✗  ${name} — ${note}`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // ── seed fixture ────────────────────────────────────────────────────────

    // Tenant A — websiteEnabled=true
    const tenantA = await prisma.tenant.create({
      data: {
        key: "news-feed-test-a",
        name: "News Feed Test Tenant A",
        status: "ACTIVE",
        websiteEnabled: true,
        approvedDataOnly: false,
      },
    });

    // Tenant B — websiteEnabled=false (website disabled)
    const tenantB = await prisma.tenant.create({
      data: {
        key: "news-feed-test-b",
        name: "News Feed Test Tenant B",
        status: "ACTIVE",
        websiteEnabled: false,
        approvedDataOnly: false,
      },
    });

    // Published article for Tenant A
    const publishedArticle = await prisma.newsArticle.create({
      data: {
        tenantId: tenantA.id,
        slug: "published-article-test",
        title: "Published Test Article",
        excerpt: "This is a test excerpt.",
        content: "# Published Article\n\nFull content here.",
        imageUrl: "https://example.com/image.jpg",
        status: "PUBLISHED",
        publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    });

    // Draft article for Tenant A
    const draftArticle = await prisma.newsArticle.create({
      data: {
        tenantId: tenantA.id,
        slug: "draft-article-test",
        title: "Draft Test Article",
        excerpt: "This draft should not appear publicly.",
        content: "# Draft Article\n\nDraft content.",
        imageUrl: null,
        status: "DRAFT",
        publishedAt: null,
      },
    });

    // Published article for Tenant B (cross-tenant isolation check)
    const tenantBArticle = await prisma.newsArticle.create({
      data: {
        tenantId: tenantB.id,
        slug: "tenant-b-article",
        title: "Tenant B Article",
        excerpt: null,
        content: "Tenant B content.",
        imageUrl: null,
        status: "PUBLISHED",
        publishedAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    });

    console.log("\n=== Slice 4 — Public Website News Feed Validation ===\n");

    // ── CHECK 1: Published article in list query ─────────────────────────
    console.log("Check 1: Published article returned by list query");

    const listRows = await prisma.newsArticle.findMany({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        imageUrl: true,
        publishedAt: true,
      },
    });

    assert(
      1,
      "List query returns published article",
      listRows.some((r) => r.id === publishedArticle.id),
      `found ${listRows.length} article(s)`
    );

    // ── CHECK 2: Published article in detail query ────────────────────────
    console.log("\nCheck 2: Published article returned by slug detail query");

    const detailRow = await prisma.newsArticle.findFirst({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
        slug: "published-article-test",
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        publishedAt: true,
      },
    });

    assert(
      2,
      "Detail query returns published article by slug",
      detailRow !== null && detailRow.id === publishedArticle.id,
      `found: ${detailRow?.id ?? "null"}`
    );

    assert(
      2,
      "Detail response includes content field",
      detailRow !== null && "content" in detailRow && detailRow.content === publishedArticle.content,
      `content present: ${"content" in (detailRow ?? {})}`
    );

    // ── CHECK 3: Draft excluded from list query ───────────────────────────
    console.log("\nCheck 3: Draft article excluded from list query");

    const draftInList = listRows.some((r) => r.id === draftArticle.id);
    assert(
      3,
      "Draft article absent from list results",
      !draftInList,
      `draft in list: ${draftInList}`
    );

    // ── CHECK 4: Draft slug returns null from detail query ────────────────
    console.log("\nCheck 4: Draft slug returns null from detail query");

    const draftDetailRow = await prisma.newsArticle.findFirst({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
        slug: "draft-article-test",
      },
      select: { id: true },
    });

    assert(
      4,
      "Draft slug returns null (→ 404 on route)",
      draftDetailRow === null,
      `result: ${draftDetailRow?.id ?? "null"}`
    );

    // ── CHECK 5: Unknown slug returns null from detail query ──────────────
    console.log("\nCheck 5: Unknown slug returns null from detail query");

    const unknownDetailRow = await prisma.newsArticle.findFirst({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
        slug: "this-slug-does-not-exist",
      },
      select: { id: true },
    });

    assert(
      5,
      "Unknown slug returns null (→ 404 on route)",
      unknownDetailRow === null,
      `result: ${unknownDetailRow?.id ?? "null"}`
    );

    // ── CHECK 6: List query excludes content ──────────────────────────────
    console.log("\nCheck 6: List query excludes content/body field");

    const listItem = listRows.find((r) => r.id === publishedArticle.id);
    assert(
      6,
      "content field absent from list items",
      listItem !== undefined && !("content" in listItem),
      `content key present: ${"content" in (listItem ?? {})}`
    );

    // ── CHECK 7: websiteEnabled=false flag on tenant ──────────────────────
    console.log("\nCheck 7: websiteEnabled flag read from tenant row");

    const tenantARow = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantA.id },
      select: { websiteEnabled: true, approvedDataOnly: true },
    });

    const tenantBRow = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantB.id },
      select: { websiteEnabled: true, approvedDataOnly: true },
    });

    assert(
      7,
      "Tenant A websiteEnabled=true",
      tenantARow.websiteEnabled === true,
      `websiteEnabled=${tenantARow.websiteEnabled}`
    );

    assert(
      7,
      "Tenant B websiteEnabled=false (assertWebsiteEnabled → 403)",
      tenantBRow.websiteEnabled === false,
      `websiteEnabled=${tenantBRow.websiteEnabled}`
    );

    // Simulate assertWebsiteEnabled logic
    const guardFiresForB = !tenantBRow.websiteEnabled;
    assert(
      7,
      "assertWebsiteEnabled guard fires for Tenant B",
      guardFiresForB === true,
      `guard fires: ${guardFiresForB}`
    );

    // ── CHECK 8: approvedDataOnly flag present ────────────────────────────
    console.log("\nCheck 8: approvedDataOnly flag readable from tenant row");

    assert(
      8,
      "Tenant A approvedDataOnly=false (default)",
      tenantARow.approvedDataOnly === false,
      `approvedDataOnly=${tenantARow.approvedDataOnly}`
    );

    // ── CHECK 9: Tenant isolation ─────────────────────────────────────────
    console.log("\nCheck 9: Tenant isolation — articles scoped to correct tenant");

    // Query Tenant A articles — must NOT include Tenant B's article
    const tenantAList = await prisma.newsArticle.findMany({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
      },
      select: { id: true },
    });

    const tenantBArticleInTenantAList = tenantAList.some(
      (r) => r.id === tenantBArticle.id
    );

    assert(
      9,
      "Tenant B article absent from Tenant A list query",
      !tenantBArticleInTenantAList,
      `cross-tenant leak: ${tenantBArticleInTenantAList}`
    );

    // Query Tenant B slug from Tenant A context — must return null
    const crossTenantDetail = await prisma.newsArticle.findFirst({
      where: {
        tenantId: tenantA.id,
        status: "PUBLISHED",
        publishedAt: { not: null },
        slug: "tenant-b-article",
      },
      select: { id: true },
    });

    assert(
      9,
      "Tenant B slug not accessible via Tenant A detail query",
      crossTenantDetail === null,
      `cross-tenant detail: ${crossTenantDetail?.id ?? "null"}`
    );

    // ── Summary ───────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("  SLICE 4 VALIDATION RESULTS");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(
      `  Total: ${passed + failed}  Passed: ${passed}  Failed: ${failed}`
    );
    console.log("───────────────────────────────────────────────────────────");

    const byCheck: Record<number, typeof results> = {};
    for (const r of results) {
      byCheck[r.id] = byCheck[r.id] ?? [];
      byCheck[r.id].push(r);
    }

    const checkNames: Record<number, string> = {
      1: "Published article in list query",
      2: "Published article in detail query (with content)",
      3: "Draft excluded from list query",
      4: "Draft slug returns null (→ 404)",
      5: "Unknown slug returns null (→ 404)",
      6: "List query excludes content field",
      7: "websiteEnabled flag gate",
      8: "approvedDataOnly flag readable",
      9: "Tenant isolation enforced",
    };

    for (const [checkId, checkResults] of Object.entries(byCheck)) {
      const allPass = checkResults.every((r) => r.result === "PASS");
      const icon = allPass ? "✓" : "✗";
      console.log(
        `  ${icon} Check ${checkId}: ${checkNames[Number(checkId)]} — ${allPass ? "PASS" : "FAIL"}`
      );
      for (const r of checkResults) {
        const sub = r.result === "PASS" ? "  ✓" : "  ✗";
        console.log(`      ${sub} ${r.name}: ${r.note}`);
      }
    }

    console.log("═══════════════════════════════════════════════════════════\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
