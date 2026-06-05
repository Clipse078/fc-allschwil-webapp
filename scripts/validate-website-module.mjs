#!/usr/bin/env node
/**
 * Website Module — Route Access & Tenant Isolation Validation
 *
 * This script performs static validation by inspecting auth guard patterns
 * in the new website module routes and components.
 *
 * Run: node scripts/validate-website-module.mjs
 */

import { readFileSync, existsSync } from "fs";

const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
const WARN = "⚠️  WARN";

let failures = 0;

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`${PASS}  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`${FAIL}  ${name}${detail ? ` — ${detail}` : ""}`);
    failures++;
  }
}

function readFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8");
}

console.log("\n=== Website Module — Validation Report ===\n");

// ── 1. Route existence ─────────────────────────────────────────────────────
console.log("── Route files ──");
const routeFiles = [
  "app/(admin)/dashboard/website/page.tsx",
  "app/(admin)/dashboard/website/sections/page.tsx",
  "app/(admin)/dashboard/website/settings/page.tsx",
  "app/(admin)/dashboard/admin/website/page.tsx",
  "app/api/website/status/route.ts",
  "app/api/website/sections/route.ts",
  "app/api/website/sections/[sectionId]/route.ts",
  "app/api/website/config/route.ts",
  "app/api/public/website/route.ts",
];
for (const f of routeFiles) {
  check(`File exists: ${f}`, existsSync(f));
}

// ── 2. Auth gate on page routes ────────────────────────────────────────────
console.log("\n── Page auth gates (requireAnyPermission) ──");
const pageAuthFiles = [
  "app/(admin)/dashboard/website/page.tsx",
  "app/(admin)/dashboard/website/sections/page.tsx",
  "app/(admin)/dashboard/website/settings/page.tsx",
  "app/(admin)/dashboard/admin/website/page.tsx",
];
for (const f of pageAuthFiles) {
  const content = readFile(f);
  check(
    `${f} — requireAnyPermission gated`,
    content?.includes("requireAnyPermission") ?? false,
  );
  check(
    `${f} — WEBSITE_MANAGE permission`,
    content?.includes("PERMISSIONS.WEBSITE_MANAGE") ?? false,
  );
}

// ── 3. API auth gate ───────────────────────────────────────────────────────
console.log("\n── API auth gates (requireApiPermission) ──");
const apiAuthFiles = [
  "app/api/website/status/route.ts",
  "app/api/website/sections/route.ts",
  "app/api/website/sections/[sectionId]/route.ts",
  "app/api/website/config/route.ts",
];
for (const f of apiAuthFiles) {
  const content = readFile(f);
  check(
    `${f} — requireApiPermission gated`,
    content?.includes("requireApiPermission") ?? false,
  );
  check(
    `${f} — returns 401/403 on failure`,
    content?.includes("access.status") ?? false,
  );
}

// ── 4. Tenant isolation ────────────────────────────────────────────────────
console.log("\n── Tenant isolation ──");
const isolationFiles = [
  "app/api/website/status/route.ts",
  "app/api/website/sections/route.ts",
  "app/api/website/sections/[sectionId]/route.ts",
  "app/api/website/config/route.ts",
];
for (const f of isolationFiles) {
  const content = readFile(f);
  check(
    `${f} — tenantId derived from session`,
    content?.includes("session.user?.tenantId") ?? false,
  );
}

// Section route also checks ownership
const sectionRoute = readFile("app/api/website/sections/[sectionId]/route.ts");
check(
  "Section PATCH — ownership verified (tenantId WHERE clause)",
  sectionRoute?.includes("where: { id: sectionId, tenantId }") ?? false,
);

// ── 5. Public API — no auth required ──────────────────────────────────────
console.log("\n── Public API (no auth) ──");
const publicRoute = readFile("app/api/public/website/route.ts");
check(
  "Public website route exists and has no requireApiPermission",
  publicRoute !== null && !publicRoute.includes("requireApiPermission"),
);
check(
  "Public API gates on websiteEnabled flag",
  publicRoute?.includes("websiteEnabled") ?? false,
);
check(
  "Public API respects approvedDataOnly flag",
  publicRoute?.includes("approvedDataOnly") ?? false,
);

// ── 6. Navigation — permission-gated ──────────────────────────────────────
console.log("\n── Navigation ──");
const navConfig = readFile("lib/nav/nav-config.ts");
check(
  "Nav: 'website' key present",
  navConfig?.includes('"website"') ?? false,
);
check(
  "Nav: website gated by WEBSITE_MANAGE",
  navConfig?.includes("PERMISSIONS.WEBSITE_MANAGE") ?? false,
);
check(
  "Nav: admin-website child entry present",
  navConfig?.includes('"admin-website"') ?? false,
);

// ── 7. Module definitions ──────────────────────────────────────────────────
console.log("\n── Module definitions ──");
check(
  "Nav: website MODULE_DEFINITIONS entry present",
  navConfig?.includes('key: "website"') ?? false,
);

// ── 8. Prisma schema ──────────────────────────────────────────────────────
console.log("\n── Prisma schema ──");
const schema = readFile("prisma/schema.prisma");
check("Schema: WebsitePublishStatus enum", schema?.includes("enum WebsitePublishStatus") ?? false);
check("Schema: WebsiteSectionType enum", schema?.includes("enum WebsiteSectionType") ?? false);
check("Schema: WebsiteSection model", schema?.includes("model WebsiteSection") ?? false);
check("Schema: PublishedSnapshot model", schema?.includes("model PublishedSnapshot") ?? false);
check("Schema: Tenant.websiteEnabled field", schema?.includes("websiteEnabled") ?? false);
check("Schema: Tenant.approvedDataOnly field", schema?.includes("approvedDataOnly") ?? false);
check("Schema: Tenant.websiteDomain field", schema?.includes("websiteDomain") ?? false);

// ── 9. Migration file ─────────────────────────────────────────────────────
console.log("\n── Migration ──");
const migration = readFile(
  "prisma/migrations/20260605140000_website_management_foundation/migration.sql",
);
check("Migration file exists", migration !== null);
check("Migration: creates WebsitePublishStatus enum", migration?.includes("CREATE TYPE \"WebsitePublishStatus\"") ?? false);
check("Migration: creates WebsiteSectionType enum", migration?.includes("CREATE TYPE \"WebsiteSectionType\"") ?? false);
check("Migration: creates WebsiteSection table", migration?.includes("CREATE TABLE \"WebsiteSection\"") ?? false);
check("Migration: creates PublishedSnapshot table", migration?.includes("CREATE TABLE \"PublishedSnapshot\"") ?? false);
check("Migration: adds Tenant website columns", migration?.includes("ADD COLUMN \"websiteDomain\"") ?? false);
check("Migration: no destructive operations (no DROP)", !migration?.includes("DROP ") ?? true);
check("Migration: no ALTER TYPE ADD VALUE", !migration?.includes("ALTER TYPE") ?? true);

// ── Summary ───────────────────────────────────────────────────────────────
console.log("\n=== Summary ===");
if (failures === 0) {
  console.log(`${PASS} All checks passed.\n`);
  process.exit(0);
} else {
  console.log(`${FAIL} ${failures} check(s) failed.\n`);
  process.exit(1);
}
