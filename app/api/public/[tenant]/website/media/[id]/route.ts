/**
 * GET /api/public/[tenant]/website/media/[id]
 *
 * Returns public-safe metadata for a DAM media asset belonging to the specified tenant.
 * Used by the public website to resolve media asset metadata for rendering images
 * and videos referenced from homepage sections, website pages, and reusable components.
 *
 * Public visibility rules:
 *   - Asset must be ACTIVE (status = "ACTIVE", not archived).
 *   - Asset must belong to the specified tenant (tenant isolation).
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *   - Asset not found or archived → 404
 *
 * Privacy:
 *   - storageKey is NEVER exposed (internal blob storage reference).
 *   - createdByUserId is NEVER exposed.
 *   - tenantId is NEVER exposed.
 *   - folderId, tags, copyright, photographer, description, sizeBytes,
 *     durationSec, createdAt, updatedAt, archivedAt are NEVER exposed.
 *   - Only CDN-safe fields are returned: id, url, altText, caption, width,
 *     height, mimeType.
 *
 * Cache:
 *   - Successful responses: public, s-maxage=60, stale-while-revalidate=300
 *   - Error responses: not cached (implicit no-store)
 */

import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebsiteEnvelope,
  resolveTenantFromParams,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";
import { getPublicMediaAsset } from "@/lib/media/public-media-feed";

type RouteParams = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { tenant: tenantSlug, id } = await params;

    const tenant = await resolveTenantFromParams(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const asset = await getPublicMediaAsset(tenant.id, id);
    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found." },
        { status: 404 },
      );
    }

    const response = NextResponse.json(
      buildWebsiteEnvelope(tenant, { asset }),
    );
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    console.error("[public/[tenant]/website/media/[id]] GET failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Medien-Asset konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
