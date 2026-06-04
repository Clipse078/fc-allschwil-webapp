import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import OrgUnitForm from "@/components/admin/org/OrgUnitForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

// Slice 11.2b: tenant resolved from session-carried tenantId.

export default async function NewOrgUnitPage() {
  const session = await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);
  const tenant = await getTenantFromSession(session.user?.tenantId);
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
