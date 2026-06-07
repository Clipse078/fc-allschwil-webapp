/**
 * GET /api/public/v1/website/homepage
 *
 * Returns all published homepage blocks for the resolved tenant,
 * ordered by sortOrder ascending.
 *
 * Only PUBLISHED blocks are exposed. Draft, in-review, scheduled,
 * and archived blocks are never included in this response.
 * Internal fields (status, tenantId, reviewNotes, heroMediaId, etc.)
 * are never returned.
 *
 * Tenant resolution: X-Tenant-Slug header → default tenant fallback.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromRequest,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicHomepageBlocks } from "@/lib/homepage-blocks/public-blocks-feed";

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const blocks = await getPublicHomepageBlocks(tenant.id);

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { blocks },
        { count: blocks.length },
      ),
    );
  } catch (error) {
    console.error("Public homepage blocks endpoint failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Homepage-Blöcke konnten nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
