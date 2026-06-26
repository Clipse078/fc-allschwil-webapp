/**
 * GET /api/public/[tenant]/website/homepage
 *
 * Returns the ordered list of enabled homepage sections for the specified tenant.
 * Tenant is resolved from the [tenant] path segment.
 *
 * Only enabled sections (isEnabled = true) are returned, ordered by sortOrder
 * ascending. No admin-only fields are exposed.
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *   - No sections configured → 200 with empty sections array
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicHomepageSections } from "@/lib/homepage/public-homepage-feed";

type RouteParams = { params: Promise<{ tenant: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const sections = await getPublicHomepageSections(tenant.id);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { sections },
        { total: sections.length },
      ),
    );
  } catch (error) {
    console.error("[public/[tenant]/website/homepage] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Homepage-Layout konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
