import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantForm from "@/components/admin/tenants/TenantForm";

export default async function NewTenantPage() {
  await requirePermission(PERMISSIONS.TENANTS_MANAGE);

  return (
    <div className="space-y-8 max-w-2xl">
      <AdminSectionHeader
        eyebrow="Platform"
        title="Neuer Tenant"
        description="Erstelle eine neue Vereinsinstanz auf dieser Plattform."
      />
      <TenantForm mode="create" />
    </div>
  );
}
