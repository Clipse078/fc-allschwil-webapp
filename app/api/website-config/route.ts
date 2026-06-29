/**
 * GET   /api/website-config  — fetch (or lazily create) the tenant's WebsiteConfig.
 * PATCH /api/website-config  — partial update of WebsiteConfig fields.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId resolved from session — never from request body.
 *
 * Introduced: CMS V4.2 — Website Platform UX Unification
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrCreateWebsiteConfig, updateWebsiteConfig } from "@/lib/website-config/queries";

// ── GET /api/website-config ───────────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  const config = await getOrCreateWebsiteConfig(tenantId);
  return NextResponse.json({ config });
}

// ── PATCH /api/website-config ─────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Kein Mandant in der Sitzung." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  // Only extract known keys; ignore unexpected fields for forward-compat.
  const str = (key: string) =>
    typeof body[key] === "string"
      ? (body[key] as string).trim() || null
      : body[key] === null
        ? null
        : undefined;

  const bool = (key: string) =>
    typeof body[key] === "boolean" ? (body[key] as boolean) : undefined;

  const input = Object.fromEntries(
    Object.entries({
      siteName: str("siteName"),
      siteDescription: str("siteDescription"),
      siteUrl: str("siteUrl"),
      contactEmail: str("contactEmail"),
      seoTitle: str("seoTitle"),
      seoDescription: str("seoDescription"),
      seoKeywords: str("seoKeywords"),
      robotsIndex: bool("robotsIndex"),
      robotsFollow: bool("robotsFollow"),
      canonicalUrl: str("canonicalUrl"),
      ogTitle: str("ogTitle"),
      ogDescription: str("ogDescription"),
      ogImageUrl: str("ogImageUrl"),
      twitterHandle: str("twitterHandle"),
      twitterCard: str("twitterCard"),
      googleAnalyticsId: str("googleAnalyticsId"),
      googleTagManagerId: str("googleTagManagerId"),
      facebookPixelId: str("facebookPixelId"),
      plausibleDomain: str("plausibleDomain"),
      customHeadHtml: str("customHeadHtml"),
      customBodyHtml: str("customBodyHtml"),
      maintenanceMode: bool("maintenanceMode"),
      maintenanceMsg: str("maintenanceMsg"),
      pwaEnabled: bool("pwaEnabled"),
      pwaName: str("pwaName"),
      pwaShortName: str("pwaShortName"),
      pwaThemeColor: str("pwaThemeColor"),
      cookieEnabled: bool("cookieEnabled"),
      cookieBannerText: str("cookieBannerText"),
      cookiePolicyUrl: str("cookiePolicyUrl"),
    }).filter(([, v]) => v !== undefined),
  );

  const config = await updateWebsiteConfig(tenantId, input);
  return NextResponse.json({ config });
}
