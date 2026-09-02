/**
 * app/api/public/infoboard/transport/route.ts
 *
 * GET /api/public/infoboard/transport
 *
 * Public JSON endpoint for canonical Infoboard Screen 2 transport refresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import {
  getCanonicalKioskTransport,
  getKioskTransportRefreshSeconds,
} from "@/lib/infoboard/kiosk-transport";
import { resolveTenantTransportConfig } from "@/lib/transport/transport-config";

const INFOBOARD_TENANT_SELECT = {
  key: true,
  status: true,
} as const;

async function resolveTenantKey(request: NextRequest): Promise<string | null> {
  const headerSlug = request.headers.get("x-tenant-slug")?.trim();
  if (headerSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { key: headerSlug },
      select: INFOBOARD_TENANT_SELECT,
    });
    if (!tenant || tenant.status !== "ACTIVE") {
      return null;
    }
    return tenant.key;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { key: DEFAULT_TENANT_KEY },
    select: INFOBOARD_TENANT_SELECT,
  });

  if (!tenant || tenant.status !== "ACTIVE") {
    return null;
  }

  return tenant.key;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantKey = await resolveTenantKey(request);
    if (!tenantKey) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const config = resolveTenantTransportConfig(tenantKey);
    if (!config) {
      return NextResponse.json(
        { error: "Transport not configured for tenant." },
        { status: 404 },
      );
    }

    const transport = await getCanonicalKioskTransport(tenantKey);
    const refreshSeconds = getKioskTransportRefreshSeconds(tenantKey);

    return NextResponse.json(transport, {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=${refreshSeconds}`,
      },
    });
  } catch (error) {
    console.error("[infoboard transport API] Internal error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
