/**
 * /api/news — Admin news article list and creation.
 *
 * GET  → list all articles for the authenticated user's tenant (all statuses)
 * POST → create a new DRAFT article
 *
 * Permission: NEWS_MANAGE
 * Tenant isolation: tenantId from session.user.tenantId (strict, no fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  getNewsArticlesForTenant,
  createNewsArticle,
  isSlugAvailable,
  slugify,
} from "@/lib/news/admin-queries";

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const articles = await getNewsArticlesForTenant(tenantId);
  return NextResponse.json({ articles });
}

export async function POST(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.NEWS_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { error: "Kein Mandant in der Sitzung." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title ist erforderlich." }, { status: 400 });
  }

  const title: string = body.title.trim();
  const rawSlug: string =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim()
      : slugify(title);

  const slug = slugify(rawSlug);
  if (!slug) {
    return NextResponse.json(
      { error: "Slug konnte nicht generiert werden. Bitte manuell eingeben." },
      { status: 400 },
    );
  }

  const available = await isSlugAvailable(slug, tenantId);
  if (!available) {
    return NextResponse.json(
      { error: `Slug "${slug}" ist bereits vergeben. Bitte einen anderen wählen.` },
      { status: 409 },
    );
  }

  const content = typeof body.content === "string" ? body.content : "";
  const excerpt =
    typeof body.excerpt === "string" ? body.excerpt.trim() || null : null;
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;

  const article = await createNewsArticle({
    tenantId,
    title,
    slug,
    excerpt,
    content,
    imageUrl,
  });

  return NextResponse.json({ article }, { status: 201 });
}
