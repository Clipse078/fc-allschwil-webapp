/**
 * GET /api/public/website/news/[slug]
 *
 * Returns a single published news article by slug.
 *
 * Query params:
 *   tenant — explicit tenant slug override (for dev/testing)
 *
 * Returns 404 when the article does not exist or is not yet published.
 * No auth required — public endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import { getPublishedNewsPostBySlug } from "@/lib/website/news-queries";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Slug fehlt." }, { status: 400 });
    }

    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    const article = await getPublishedNewsPostBySlug(tenant.id, slug);
    if (!article) {
      return NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (error) {
    console.error("Public website news article failed:", error);
    return NextResponse.json(
      { error: "Artikel konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
