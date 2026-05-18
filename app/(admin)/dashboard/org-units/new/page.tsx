import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import OrgUnitForm from "@/components/admin/org/OrgUnitForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function NewOrgUnitPage() {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);
  const parentOptions = await getOrgUnits();

  return (
    <div className="space-y-6">
      <AdminSectionHeader eyebrow="Organisation" title="Neue Organisationseinheit" description="Erstelle eine Einheit im Organigramm." />
      <OrgUnitForm mode="create" parentOptions={parentOptions} />
    </div>
  );
}
