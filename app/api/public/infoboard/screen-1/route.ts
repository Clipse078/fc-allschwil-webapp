/**
 * app/api/public/infoboard/screen-1/route.ts
 *
 * GET /api/public/infoboard/screen-1
 *
 * Public JSON endpoint for Infoboard Screen 1 live data.
 *
 * Tenant resolution:
 *   1. X-Tenant-Slug request header — explicit override (matches
 *      the existing resolveTenantFromRequest pattern in
 *      lib/website/response-helpers.ts).
 *   2. Default tenant fallback — single-tenant path (current FC Allschwil
 *      setup).
 *
 * Response: InfoboardScreen1LivePayload serialised as JSON.
 * Caching: Cache-Control: no-store (operational kiosk feed; must be fresh).
 * Errors: 404 tenant not found; 400 tenant misconfigured; 500 internal.
 *
 * Security:
 *   - No stack traces in responses.
 *   - No rejected-event diagnostics.
 *   - No database details.
 *   - Tenant isolation enforced: only events for the resolved tenant are loaded.
 *
 * Design constraints:
 *   - No duplicate publication policy logic.
 *   - No duplicate temporal grouping logic.
 *   - No hardcoded tenant key in business logic (DEFAULT_TENANT_KEY
 *     is used as a single-tenant fallback only, consistent with the
 *     existing convention in lib/tenants/queries.ts).
 *   - Prisma usage confined to this composition boundary.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";
import {
  createScreen1SourceLoader,
  type Screen1SourceDatabase,
  type Screen1DbEventRow,
  type Screen1FacilityResourceRow,
} from "@/lib/publishing/infoboard/screen1-source-loader";
import {
  buildScreen1LivePayload,
  type Screen1TenantContext,
} from "@/lib/publishing/infoboard/screen1-live-service";

// ── Tenant select ─────────────────────────────────────────────────────────────

const INFOBOARD_TENANT_SELECT = {
  id: true,
  key: true,
  name: true,
  status: true,
  timezone: true,
  logoUrl: true,
} as const;

type InforboardTenantRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  timezone: string | null;
  logoUrl: string | null;
};

// ── Prisma adapter ────────────────────────────────────────────────────────────

/**
 * Creates a Screen1SourceDatabase implementation backed by the Prisma client.
 * Type assertions bridge the gap between Prisma's generic findMany signatures
 * and the specific Screen1DbEventRow / Screen1FacilityResourceRow shapes.
 * The runtime behaviour is correct: Prisma returns exactly the selected fields.
 */
function createPrismaDb(): Screen1SourceDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as Promise<Screen1DbEventRow[]>,
    },
    facilityResource: {
      findMany: (args) =>
        prisma.facilityResource.findMany(
          args as Parameters<typeof prisma.facilityResource.findMany>[0],
        ) as unknown as Promise<Screen1FacilityResourceRow[]>,
    },
  };
}

// ── Tenant resolution ─────────────────────────────────────────────────────────

async function resolveInfoboardTenant(
  request: NextRequest,
): Promise<InforboardTenantRow | null> {
  const headerSlug = request.headers.get("X-Tenant-Slug");
  const tenantKey = headerSlug ?? DEFAULT_TENANT_KEY;

  return prisma.tenant.findFirst({
    where: { key: tenantKey, status: "ACTIVE" },
    select: INFOBOARD_TENANT_SELECT,
  });
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Resolve tenant ─────────────────────────────────────────────────────
    const tenantRow = await resolveInfoboardTenant(request);

    if (!tenantRow) {
      return NextResponse.json(
        { error: "Tenant not found." },
        { status: 404 },
      );
    }

    if (!tenantRow.timezone) {
      return NextResponse.json(
        { error: "Tenant timezone is not configured." },
        { status: 400 },
      );
    }

    const tenant: Screen1TenantContext = {
      id: tenantRow.id,
      key: tenantRow.key,
      name: tenantRow.name,
      timezone: tenantRow.timezone,
      logoUrl: tenantRow.logoUrl,
    };

    // ── Request time ────────────────────────────────────────────────────────
    // Created once at the request boundary and passed through unchanged.
    const now = new Date();

    // ── Source loader ──────────────────────────────────────────────────────
    const db = createPrismaDb();
    const loader = createScreen1SourceLoader(db);

    // ── Build live payload ─────────────────────────────────────────────────
    const payload = await buildScreen1LivePayload({ tenant, now, loader });

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[screen-1 API] Internal error:", error);

    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
