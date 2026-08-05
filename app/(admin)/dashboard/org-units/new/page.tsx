import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import OrgUnitForm from "@/components/admin/org/OrgUnitForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

// RPERM-04: tenant resolved via the single tenant-context helper (session.activeTenantId,
// derived from TenantMembership — never the legacy User.tenantId column).

export default async function NewOrgUnitPage() {
  await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);
  const tenant = await getActiveTenant();
  if (!tenant) notFound();
  const parentOptions = await getOrgUnits(tenant.id);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Organisation"
        title="Neue Organisationseinheit"
        description="Erstelle eine Einheit im Organigramm des Vereins."
      />
      <OrgUnitForm mode="create" parentOptions={parentOptions} />
    </div>
  );
}
