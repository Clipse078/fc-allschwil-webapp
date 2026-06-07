/**
 * GET /api/public/v1/website/homepage
 *
 * Returns published, enabled homepage blocks for the tenant.
 * Only PUBLISHED blocks with enabled=true in the HOMEPAGE context are returned.
 * No internal fields (tenantId, reviewNotes, status) are leaked.
 *
 * Tenant resolution: X-Tenant-Slug header or default tenant fallback.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  resolveTenantFromRequest,
  assertWebsiteEnabled,
  buildWebsiteEnvelope,
} from "@/lib/website/response-helpers";
import { getPublicHomepageBlocks } from "@/lib/homepage/public-feed";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
  }

  const guard = assertWebsiteEnabled(tenant);
  if (guard) return guard;

  const blocks = await getPublicHomepageBlocks(tenant.id);

  return NextResponse.json(
    buildWebsiteEnvelope(tenant, { blocks }),
  );
}
