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
import { addCorsHeaders, handleCorsPreflightPublic } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightPublic(request) ?? new NextResponse(null, { status: 204 });
}

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
      return addCorsHeaders(
        NextResponse.json({ error: "Artikel nicht gefunden." }, { status: 404 }),
        request,
      );
    }

    return addCorsHeaders(NextResponse.json({ article }), request);
  } catch (error) {
    console.error("Public website news article failed:", error);
    return addCorsHeaders(
      NextResponse.json(
        { error: "Artikel konnte nicht geladen werden." },
        { status: 500 },
      ),
      request,
    );
  }
}
