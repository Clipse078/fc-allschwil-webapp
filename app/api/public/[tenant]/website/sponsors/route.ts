/**
 * GET /api/public/[tenant]/website/sponsors
 *
 * Sponsors public feed — PLACEHOLDER (no Sponsor data model yet).
 *
 * STATUS: foundation-ready placeholder.
 *
 * The SportClubEvo WebApp does not yet have a dedicated Sponsor entity.
 * Sponsor-related content is currently available through two existing mechanisms:
 *
 *   1. ReusableComponent of type "SPONSOR_BANNER"
 *      → GET /api/public/[tenant]/website/components/[id]
 *      → Carries sponsorName, logoMediaAssetId, logoUrl, headline, text, ctaLabel,
 *        ctaUrl, campaignStart, campaignEnd, clickTrackingEnabled
 *
 *   2. HomepageSection of type "sponsorsTeaser" (foundation-ready)
 *      → GET /api/public/[tenant]/website/homepage
 *      → Block is marked "foundation-ready" in the block registry — no backing
 *        data source yet; config carries heading only
 *
 * This endpoint returns a stable envelope with an empty sponsors list today.
 * The response shape is intentionally forward-compatible: when the Sponsor
 * entity is added, this endpoint will begin returning populated data without
 * a breaking shape change.
 *
 * When the Sponsor module is implemented, this route will:
 *   - Query a Sponsor model (with tiers/categories and logo DAM references).
 *   - Return only active/public sponsors for the tenant.
 *   - Resolve logos through the DAM public feed.
 *   - Support sponsor categories / tiers if available.
 *
 * Website consumers SHOULD already wire this endpoint and render zero-state
 * gracefully so the transition to a live feed requires no website changes.
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *
 * Cache:
 *   - Successful responses: public, s-maxage=60, stale-while-revalidate=300
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

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

    // No Sponsor model exists yet — return an empty list with contract metadata.
    // Shape is forward-compatible: once sponsors are implemented, `sponsors`
    // will be populated and `_contract.status` will change to "available".
    const response = NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { sponsors: [] },
        {
          total: 0,
          _contract: {
            status: "placeholder",
            note: "Sponsor model not yet implemented. Use ReusableComponent type SPONSOR_BANNER via /api/public/[tenant]/website/components/[id] for individual sponsor blocks. This endpoint will return live data once the Sponsor entity is added.",
          },
        },
      ),
    );
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    console.error("[public/[tenant]/website/sponsors] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Sponsoren konnten nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
