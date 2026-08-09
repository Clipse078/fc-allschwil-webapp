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
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "@/lib/publishing/infoboard/canonical-source-loader";
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
 * Creates a CanonicalInfoboardPolicyDatabase implementation backed by the
 * Prisma client. Only publication-policy metadata (never planning/time/
 * resource data — that comes from the canonical Weekplanner pipeline) is
 * read here. Type assertions bridge the gap between Prisma's generic
 * findMany signatures and the specific row shapes; the runtime behaviour is
 * correct since Prisma returns exactly the selected fields.
 */
function createPrismaDb(): CanonicalInfoboardPolicyDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["event"]["findMany"]>,
    },
    trainingSession: {
      findMany: (args) =>
        prisma.trainingSession.findMany(
          args as Parameters<typeof prisma.trainingSession.findMany>[0],
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["trainingSession"]["findMany"]>,
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
    const loader = createCanonicalInfoboardSourceLoader(db);

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
