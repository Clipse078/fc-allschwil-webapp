import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { DEFAULT_TENANT_KEY } from "@/lib/tenants/queries";

export default async function DashboardRegistrationArchivePage() {
  await requireAnyPermission([
    PERMISSIONS.REGISTRATIONS_VIEW,
    PERMISSIONS.REGISTRATIONS_EDIT,
  ]);

  const ctx = await getActiveTenant();
  const tenantKey = ctx?.key ?? DEFAULT_TENANT_KEY;

  redirect(`/tenant/${tenantKey}/cockpit/registrations/archiv`);
}
