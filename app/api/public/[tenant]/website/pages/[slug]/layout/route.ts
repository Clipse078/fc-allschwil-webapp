/**
 * GET /api/public/[tenant]/website/pages/[slug]/layout
 *
 * Returns the published page layout for the given tenant and page slug.
 * The layout includes the page metadata and its ordered, enabled sections
 * with public-safe block config projections.
 *
 * Public visibility rules:
 *   - Page must be status=PUBLISHED and publishedAt <= now()
 *   - Only enabled sections (isEnabled=true) are returned
 *   - Config is projected through the block registry's public-safe projection
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *   - Page not found or not published → 404
 *   - No sections configured → 200 with empty sections array
 *
 * Privacy:
 *   - No tenantId exposed
 *   - No createdAt / updatedAt
 *   - No approval metadata
 *   - No draft or private fields
 *   - Config projected through block registry
 *
 * Does NOT replace GET /api/public/v1/website/pages/[slug] — that endpoint
 * returns the raw Markdown body. This endpoint returns the block-based layout.
 * Both endpoints coexist for backward compatibility.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicPageLayout } from "@/lib/page-sections/public-page-layout-feed";

type RouteParams = { params: Promise<{ tenant: string; slug: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug, slug } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const layout = await getPublicPageLayout(tenant.id, slug);
    if (!layout) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { page: layout.page, sections: layout.sections },
        { sectionCount: layout.sections.length },
      ),
    );
  } catch (error) {
    console.error(
      "[public/[tenant]/website/pages/[slug]/layout] GET failed:",
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Seiten-Layout konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
