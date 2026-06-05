import { type NextRequest, NextResponse } from "next/server";
import { getPublicNewsArticles } from "@/lib/news/public-news-feed";
import {
  buildWebsiteEnvelope,
  resolveTenantFromRequest,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

// TODO(tenant-isolation/website): resolve tenant from request context
// (host/subdomain/path) for multi-tenant deployments. Currently resolves via
// X-Tenant-Slug header then falls back to the fc-allschwil default tenant.
// See resolveTenantFromRequest() in lib/website/response-helpers.ts.

function parseLimit(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found." },
        { status: 404 }
      );
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));

    const articles = await getPublicNewsArticles({
      tenantId: tenant.id,
      limit,
    });

    return NextResponse.json(
      buildWebsiteEnvelope(
        tenant,
        { articles },
        { total: articles.length, limit: limit ?? 20 }
      )
    );
  } catch (error) {
    console.error("Public website news feed failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "News Feed konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}
