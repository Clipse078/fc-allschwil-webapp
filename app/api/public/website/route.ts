import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/public/website
 *
 * Public (unauthenticated) endpoint that returns the website publication status
 * for a given tenant, resolved via the `tenantKey` query parameter.
 *
 * This endpoint is intended for consumption by the external public website project.
 * It only returns data when websiteEnabled = true for the tenant.
 *
 * Query params:
 *   tenantKey — tenant key (e.g. "fc-allschwil")
 *
 * TODO(tenant-isolation): When multi-tenant domain resolution is ready,
 * replace tenantKey param lookup with resolveTenantFromRequest(request)
 * based on Host header subdomain/domain mapping.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantKey = searchParams.get("tenantKey");

  if (!tenantKey) {
    return NextResponse.json(
      { error: "tenantKey query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { key: tenantKey, status: "ACTIVE" },
      select: {
        id: true,
        key: true,
        name: true,
        websiteEnabled: true,
        approvedDataOnly: true,
        websiteDomain: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    if (!tenant.websiteEnabled) {
      return NextResponse.json(
        {
          tenantKey: tenant.key,
          tenantName: tenant.name,
          websiteEnabled: false,
          sections: [],
        },
        { status: 200 },
      );
    }

    // Fetch published sections only
    const sections = await prisma.websiteSection.findMany({
      where: {
        tenantId: tenant.id,
        isEnabled: true,
        status: tenant.approvedDataOnly
          ? { in: ["APPROVED", "PUBLISHED"] }
          : undefined,
      },
      select: {
        sectionType: true,
        status: true,
        label: true,
        lastPublishedAt: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      tenantKey: tenant.key,
      tenantName: tenant.name,
      websiteEnabled: true,
      approvedDataOnly: tenant.approvedDataOnly,
      sections,
    });
  } catch (err) {
    console.error("[api/public/website]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
