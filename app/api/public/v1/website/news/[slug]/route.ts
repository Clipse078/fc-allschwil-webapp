import { type NextRequest, NextResponse } from "next/server";
import { getPublicNewsArticleBySlug } from "@/lib/news/public-news-feed";
import {
  buildWebsiteEnvelope,
  resolveTenantFromRequest,
  assertWebsiteEnabled,
} from "@/lib/website/response-helpers";

// TODO(tenant-isolation/website): resolve tenant from request context
// (host/subdomain/path) for multi-tenant deployments. Currently resolves via
// X-Tenant-Slug header then falls back to the fc-allschwil default tenant.
// See resolveTenantFromRequest() in lib/website/response-helpers.ts.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const tenant = await resolveTenantFromRequest(request);

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found." },
        { status: 404 }
      );
    }

    const guard = assertWebsiteEnabled(tenant);
    if (guard) return guard;

    const article = await getPublicNewsArticleBySlug({
      tenantId: tenant.id,
      slug,
    });

    if (!article) {
      return NextResponse.json(
        { error: "News article not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      buildWebsiteEnvelope(tenant, { article }, {})
    );
  } catch (error) {
    console.error("Public website news detail failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "News Artikel konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}
