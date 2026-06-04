/**
 * GET /api/public/website/config
 *
 * Returns the public website configuration for the requesting tenant:
 * tenant branding (name, logo, colors) + website-specific settings
 * (tagline, contact, social links, SEO meta).
 *
 * Consumed by the FC Allschwil public website to hydrate layout, hero,
 * footer, and SEO metadata without hardcoding values.
 *
 * No auth required. CORS enabled for the website origin.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantFromRequest } from "@/lib/tenants/resolve-from-request";
import { getWebsiteConfig } from "@/lib/website/config-queries";
import { addCorsHeaders, handleCorsPreflightPublic } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  return handleCorsPreflightPublic(request) ?? new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant) {
      return addCorsHeaders(
        NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 }),
        request,
      );
    }

    const websiteConfig = await getWebsiteConfig(tenant.id);

    const response = NextResponse.json({
      tenant: {
        name: tenant.name,
        key: tenant.key,
      },
      config: websiteConfig,
    });

    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Public website config failed:", error);
    return addCorsHeaders(
      NextResponse.json(
        { error: "Website-Konfiguration konnte nicht geladen werden." },
        { status: 500 },
      ),
      request,
    );
  }
}
