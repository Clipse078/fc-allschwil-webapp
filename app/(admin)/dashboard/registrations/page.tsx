import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenantContextFromSession } from "@/lib/tenants/context";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";

/**
 * /dashboard/registrations — gateway page for Registrations V2.
 *
 * Resolves the current user's tenant from the session and redirects to the
 * tenant-scoped registration inbox at /tenant/[tenantSlug]/cockpit/registrations.
 *
 * This gives the nav item a stable, permission-gated href while keeping
 * registration data correctly scoped per tenant.
 */
export default async function DashboardRegistrationsPage() {
  await requireAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);

  const session = await auth();
  const ctx = await getTenantContextFromSession(session?.user?.tenantId);
  const tenantKey = ctx?.key ?? DEFAULT_TENANT_KEY;

  redirect(`/tenant/${tenantKey}/cockpit/registrations`);
}
