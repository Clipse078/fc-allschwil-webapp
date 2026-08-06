/**
 * GET  /api/website-pages  — list website pages (admin, all statuses).
 * POST /api/website-pages  — create a new draft page.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session — never from request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  listWebsitePagesAdmin,
  countWebsitePagesAdmin,
  createWebsitePage,
  isPageSlugAvailable,
  slugifyPage,
  type PageStatus,
} from "@/lib/pages/admin-queries";

const VALID_STATUSES: PageStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
];

// ── GET /api/website-pages ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status")?.toUpperCase();
  const status = VALID_STATUSES.includes(rawStatus as PageStatus)
    ? (rawStatus as PageStatus)
    : undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const [pages, total] = await Promise.all([
    listWebsitePagesAdmin({ tenantId, status, limit, offset }),
    countWebsitePagesAdmin(tenantId, status),
  ]);

  return NextResponse.json({ pages, meta: { total, limit, offset } });
}

// ── POST /api/website-pages ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "Titel ist erforderlich." }, { status: 400 });
  }

  const pageBody = typeof body.body === "string" ? body.body : "";

  let slug = typeof body.slug === "string" ? body.slug.trim() : "";
  if (!slug) slug = slugifyPage(title);

  let finalSlug = slug;
  let counter = 1;
  while (!(await isPageSlugAvailable(tenantId, finalSlug))) {
    finalSlug = `${slug}-${counter++}`;
  }

  const page = await createWebsitePage({
    tenantId,
    slug: finalSlug,
    title,
    body: pageBody,
    seoTitle: typeof body.seoTitle === "string" ? body.seoTitle.trim() || null : null,
    seoDescription:
      typeof body.seoDescription === "string" ? body.seoDescription.trim() || null : null,
    scheduledAt: typeof body.scheduledAt === "string" ? new Date(body.scheduledAt) : null,
    authorPersonId: typeof body.authorPersonId === "string" ? body.authorPersonId : null,
  });

  return NextResponse.json({ page }, { status: 201 });
}
