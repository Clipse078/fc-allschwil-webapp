/**
 * GET /api/public/v1/website/navigation
 *
 * Returns the main and footer navigation for the tenant.
 * Only visible items are included. PAGE items linked to non-PUBLISHED pages
 * are silently dropped. Internal IDs and workflow fields are never exposed.
 *
 * Tenant resolution: X-Tenant-Slug header → default tenant fallback.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromRequest,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicNavigation } from "@/lib/navigation/public-nav-feed";

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const navigation = await getPublicNavigation(tenant.id);

    return NextResponse.json(
      buildWebsiteEnvelope(tenant, { navigation }, {}),
    );
  } catch (error) {
    console.error("Public website navigation endpoint failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Navigation konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
