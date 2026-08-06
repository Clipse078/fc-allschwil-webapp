import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiAnyPermission } from "@/lib/permissions/require-api-any-permission";
import { requireApiTenantContextForSlug } from "@/lib/tenants/active-tenant";
import { listRegistrationsForTenant } from "@/lib/registrations/queries";

type Context = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

export async function GET(_: NextRequest, context: Context) {
  const { tenantSlug } = await context.params;

  // RPERM-04-C1: resolve + validate the tenant named in the URL FIRST — never
  // authorize this route against session.user.activeTenantId. Rejects before
  // any registration data is fetched if the tenant does not exist, is not
  // ACTIVE, or the caller has no active membership in it.
  const tenantResult = await requireApiTenantContextForSlug(tenantSlug);
  if (!tenantResult.ok) {
    return NextResponse.json({ error: tenantResult.error }, { status: tenantResult.status });
  }

  // Permission is evaluated against the EXACT tenant resolved from the URL.
  const access = await requireApiAnyPermission(
    [PERMISSIONS.REGISTRATIONS_VIEW, PERMISSIONS.REGISTRATIONS_EDIT],
    tenantResult.tenantId,
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const registrations = await listRegistrationsForTenant(tenantSlug);

    return NextResponse.json({ registrations });
  } catch (error) {
    console.error("List registrations failed:", error);

    if (error instanceof Error && error.message.startsWith("Active tenant not found")) {
      return NextResponse.json({ error: "Tenant nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Anmeldungen konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}
