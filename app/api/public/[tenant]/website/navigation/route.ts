/**
 * GET /api/public/[tenant]/website/navigation
 *
 * Returns the visible navigation tree for a tenant.
 *
 * - Unauthenticated public endpoint.
 * - Tenant resolved from URL path segment.
 * - Returns only items where isVisible=true.
 * - Ordered by area, parent, sortOrder.
 * - Response follows the standard website envelope (version, tenant, generatedAt, data, meta).
 *
 * Privacy:
 *   - No tenantId exposed.
 *   - No createdAt/updatedAt exposed.
 *   - No visibilityMode or other admin metadata exposed.
 *   - No internal permission fields.
 *
 * Response shape:
 * {
 *   version: "1",
 *   tenant: { key, name },
 *   generatedAt: ISO string,
 *   data: {
 *     areas: {
 *       header: NavItem[],
 *       footer: NavItem[],
 *       utility: NavItem[]
 *     }
 *   },
 *   meta: { total: number }
 * }
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import {
  getPublicNavigation,
  countPublicNavItems,
} from "@/lib/navigation/public-nav-feed";

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

    const areas = await getPublicNavigation(tenant.id);
    const total = await countPublicNavItems(tenant.id);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { areas },
        { total },
      ),
    );
  } catch (error) {
    console.error("[public/navigation] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
