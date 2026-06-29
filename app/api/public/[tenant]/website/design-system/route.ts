/**
 * GET /api/public/[tenant]/website/design-system
 *
 * Returns the fully-resolved tenant design system tokens.
 *
 * This endpoint exposes the Design System Manager configuration for consumption
 * by the public website renderer and any downstream template system.
 *
 * The response is:
 *   - Tenant-scoped (path-segment tenant slug).
 *   - Safe for public consumption (no admin metadata, no internal IDs).
 *   - Always fully-resolved (DEFAULT_DESIGN_SYSTEM applied for any null fields).
 *   - Colour tokens primary/secondary are sourced from the existing branding
 *     system (Tenant.primaryColor / secondaryColor), not duplicated.
 *   - Cacheable (s-maxage=120, stale-while-revalidate=600).
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *
 * Response envelope:
 *   {
 *     version: "1",
 *     tenant: { key, name },
 *     generatedAt: ISO-8601,
 *     data: {
 *       designSystem: ResolvedDesignSystem
 *     },
 *     meta: { source: "stored" | "defaults" }
 *   }
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getResolvedDesignSystemByKey } from "@/lib/website/design-system-queries";
import { getRawDesignSystem } from "@/lib/website/design-system-queries";
import { getActiveTenantForWebsiteFeed } from "@/lib/tenants/queries";

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

    const designSystem = await getResolvedDesignSystemByKey(tenantSlug);

    // Determine whether this is stored config or pure defaults (for meta transparency).
    const tenantFull = await getActiveTenantForWebsiteFeed(tenantSlug);
    const raw = tenantFull ? await getRawDesignSystem(tenant.id) : null;
    const source = raw ? "stored" : "defaults";

    const response = NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { designSystem },
        { source },
      ),
    );

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=120, stale-while-revalidate=600",
    );

    return response;
  } catch (error) {
    console.error("[public/[tenant]/website/design-system] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Design System konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
