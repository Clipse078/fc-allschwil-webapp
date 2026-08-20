/**
 * GET /api/tenants/[tenantSlug]/waiting-list/scope-options
 *
 * REG-WAIT-01D — Tenant-scoped OrgUnit / TeamSeason picker data for waiting-list UX.
 */

import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { getWaitingListScopeOptionsForTenant } from "@/lib/registrations/waiting-list-scope-options";

type Context = { params: Promise<{ tenantSlug: string }> };

export async function GET(_request: Request, context: Context) {
  const { tenantSlug } = await context.params;

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
    const options = await getWaitingListScopeOptionsForTenant(tenantSlug);
    return NextResponse.json(options);
  } catch (error) {
    console.error("Waiting list scope options failed:", error);
    return NextResponse.json({ error: "Auswahloptionen konnten nicht geladen werden." }, { status: 500 });
  }
}
