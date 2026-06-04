/**
 * /api/website/config
 *
 * GET   — returns current WebsiteConfig for the actor's tenant
 * PATCH — upserts WebsiteConfig for the actor's tenant
 *
 * Permission: WEBSITE_MANAGE
 * Tenant isolation: derived from session.user.tenantId
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getWebsiteConfig, upsertWebsiteConfig } from "@/lib/website/config-queries";
import type { WebsiteConfigData } from "@/lib/website/config-queries";

export async function GET() {
  const access = await requireApiAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });

  const config = await getWebsiteConfig(tenantId);
  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const access = await requireApiAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const tenantId = access.session?.user?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Kein Tenant zugeordnet." }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const allowed: Array<keyof WebsiteConfigData> = [
    "websiteTitle",
    "websiteDescription",
    "heroTagline",
    "contactEmail",
    "contactPhone",
    "addressStreet",
    "addressCity",
    "addressCountry",
    "googleMapsUrl",
    "facebookUrl",
    "instagramUrl",
    "youtubeUrl",
    "twitterUrl",
    "tiktokUrl",
  ];

  const patch: Partial<WebsiteConfigData> = {};
  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      patch[key] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  const config = await upsertWebsiteConfig(tenantId, patch);
  return NextResponse.json({ config });
}
