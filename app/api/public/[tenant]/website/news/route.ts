/**
 * GET /api/public/[tenant]/website/news
 *
 * Returns a paginated list of published news articles for the specified tenant.
 * Tenant is resolved from the [tenant] path segment (the tenant slug).
 *
 * Only PUBLISHED articles with publishedAt ≤ now are returned.
 * Content/body is intentionally excluded from list responses — use the
 * individual slug route (/api/public/v1/website/news/[slug]) for full content.
 *
 * Query params:
 *   limit   — max articles returned (1–100, default 20)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getPublicNewsArticles } from "@/lib/news/public-news-feed";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

type RouteParams = { params: Promise<{ tenant: string }> };

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));

    const articles = await getPublicNewsArticles({
      tenantId: tenant.id,
      limit,
    });

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { articles },
        { total: articles.length, limit: limit ?? 20 },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/news] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "News Feed konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
