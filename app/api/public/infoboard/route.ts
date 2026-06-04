import { NextRequest, NextResponse } from "next/server";
import { getInfoboardFeed } from "@/lib/events/public-event-feed";
import { getDefaultTenant } from "@/lib/tenants/queries";

// TODO(tenant-isolation): Public InfoBoard feed is currently not tenant-scoped.
//
// For the current single-tenant FC Allschwil deployment this is intentional —
// all infoboard-visible events belong to the same tenant and the kiosk is
// operated on-site.
//
// Before multi-tenant public websites go live, this route must resolve a
// tenant from the request context (subdomain / custom domain / path prefix)
// and scope the DB query accordingly:
//
//   const tenant = await resolveTenantFromRequest(request); // host header / path
//   const events = await getInfoboardFeed({ ...params, tenantId: tenant.id });
//
// Without this change, a multi-tenant deployment would show a cross-tenant
// event mix on every public InfoBoard screen — a data-visibility violation.
// Tracked: Admin → Facilities & Resources MVP will introduce the domain/tenant
// configuration table that this resolver will depend on.

function parseLimit(value: string | null) {
  if (!value) {
    return 100;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 100;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const seasonKey = searchParams.get("seasonKey");
    const teamSlug = searchParams.get("teamSlug");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));

    // Resolve the default tenant so facility/resource labels use tenant-configured names.
    // TODO(tenant-isolation/website): replace with resolveTenantFromRequest(request).
    const tenant = await getDefaultTenant();

    const events = await getInfoboardFeed({
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
      tenantId: tenant?.id ?? null,
    });

    return NextResponse.json({
      count: events.length,
      filters: {
        seasonKey,
        teamSlug,
        dateFrom,
        dateTo,
        limit,
      },
      events,
    });
  } catch (error) {
    console.error("Public Infoboard feed failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Technischer Fehler: " + error.message
            : "Infoboard Feed konnte nicht geladen werden.",
      },
      { status: 500 }
    );
  }
}