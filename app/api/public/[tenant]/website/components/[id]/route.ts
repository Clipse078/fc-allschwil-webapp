/**
 * GET /api/public/[tenant]/website/components/[id]
 *
 * Returns a single published reusable component for the specified tenant.
 * Used by the public website to embed reusable content blocks referenced
 * from homepage sections and website page sections.
 *
 * Public visibility rules:
 *   - Component must not be archived.
 *   - publishStatus = "PUBLISHED" OR scheduledPublishAt <= now().
 *   - For ANNOUNCEMENT type: config.publishFrom <= now() <= config.publishUntil
 *     (when those config fields are set).
 *
 * Error behaviour:
 *   - Unknown tenant → 404
 *   - websiteEnabled = false → 403
 *   - Component not found, archived, or not published → 404
 *
 * Privacy:
 *   - No tenantId, publishStatus, publishedAt, scheduledPublishAt exposed.
 *   - No approval metadata or workflow fields exposed.
 *   - No archivedAt, createdAt, slug, description, or createdByUserId exposed.
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
import { getPublicReusableComponent } from "@/lib/reusable-components/public-reusable-component-feed";

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

    const component = await getPublicReusableComponent(tenant.id, id);
    if (!component) {
      return NextResponse.json(
        { error: "Component not found." },
        { status: 404 },
      );
    }

    const response = NextResponse.json(
      buildWebsiteEnvelope(tenant, { component }),
    );
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
    return response;
  } catch (error) {
    console.error(
      "[public/[tenant]/website/components/[id]] GET failed:",
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Komponente konnte nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
