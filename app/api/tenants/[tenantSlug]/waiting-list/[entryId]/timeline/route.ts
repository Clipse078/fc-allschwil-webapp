import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { getWaitingListTimeline } from "@/lib/registrations/waiting-list-timeline";

type Context = {
  params: Promise<{
    tenantSlug: string;
    entryId: string;
  }>;
};

/**
 * GET /api/tenants/[tenantSlug]/waiting-list/[entryId]/timeline
 *
 * REG-WAIT-01J — Waiting-list Verlauf with accountable actor identity.
 */
export async function GET(_: NextRequest, context: Context) {
  const { tenantSlug, entryId } = await context.params;

  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const timeline = await getWaitingListTimeline(tenantSlug, entryId);
    return NextResponse.json({ timeline });
  } catch (error) {
    console.error("Get waiting-list timeline failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({ error: "Verlauf konnte nicht geladen werden." }, { status: 500 });
  }
}
