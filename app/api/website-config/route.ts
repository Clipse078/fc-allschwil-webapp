/**
 * GET  /api/website-config  — return current WebsiteConfig for tenant.
 * PATCH /api/website-config — upsert WebsiteConfig fields.
 *
 * Permission: WEBSITE_MANAGE
 * Isolation:  tenantId from session.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteConfig, upsertWebsiteConfig } from "@/lib/website-config/admin-queries";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const config = await getWebsiteConfig(tenantId);
  return NextResponse.json({ config: config ?? null });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const ALLOWED_STRING_FIELDS = [
  "seoSiteTitle", "seoTitleTemplate", "seoDefaultDescription", "seoDefaultKeywords",
  "seoCanonicalBase", "ogTitle", "ogDescription", "ogImageUrl", "twitterSite",
  "twitterCardType", "googleAnalyticsId", "googleTagManagerId", "robotsTxt",
  "faviconUrl", "pwaName", "pwaShortName", "pwaThemeColor", "pwaBgColor",
  "cookieBannerText", "cookieBannerLinkUrl", "cookieBannerLinkText",
] as const;

const ALLOWED_BOOL_FIELDS = [
  "sitemapEnabled", "pwaEnabled", "cookieBannerEnabled",
] as const;

export async function PATCH(req: NextRequest) {
  const access = await requireApiPermission(PERMISSIONS.WEBSITE_MANAGE);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Mandant." }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const data: Record<string, string | boolean | null> = {};

  for (const field of ALLOWED_STRING_FIELDS) {
    if (field in body) {
      data[field] = typeof body[field] === "string" ? (body[field] as string).trim() || null : null;
    }
  }
  for (const field of ALLOWED_BOOL_FIELDS) {
    if (field in body) {
      data[field] = Boolean(body[field]);
    }
  }

  try {
    const config = await upsertWebsiteConfig(tenantId, data);
    return NextResponse.json({ config });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Konfiguration konnte nicht gespeichert werden." }, { status: 500 });
  }
}
