/**
 * GET /api/public/v1/website/pages/[slug]
 *
 * Returns a single published website page by slug.
 * Only PUBLISHED pages are exposed — draft, in-review, scheduled, and archived
 * pages return 404. Internal workflow fields (status, tenantId, reviewNotes, etc.)
 * are never included in the response.
 *
 * Tenant resolution: X-Tenant-Slug header → default tenant fallback.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromRequest,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicWebsitePageBySlug } from "@/lib/pages/public-pages-feed";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const { slug } = await params;

    const page = await getPublicWebsitePageBySlug({
      tenantId: tenant.id,
      slug,
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }

    return NextResponse.json(
      buildWebsiteEnvelope(tenant, { page }, {}),
    );
  } catch (error) {
    console.error("Public website page endpoint failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Seite konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
