import { NextRequest, NextResponse } from "next/server";
import { getInfoboardFeed } from "@/lib/events/public-event-feed";
import { getDefaultTenant } from "@/lib/tenants/queries";

// Legacy tenant resolution remains the default-tenant fallback. The resolved
// tenant id is nevertheless mandatory for every feed query: failure to resolve
// the default tenant must never degrade into an unscoped public event query.

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
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    }

    const events = await getInfoboardFeed({
      seasonKey,
      teamSlug,
      dateFrom,
      dateTo,
      limit,
      tenantId: tenant.id,
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