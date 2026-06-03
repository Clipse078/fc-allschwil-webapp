import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTenants } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TenantList from "@/components/admin/tenants/TenantList";

export default async function TenantsPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.TENANTS_VIEW,
    PERMISSIONS.TENANTS_MANAGE,
  ]);
  const canManage = hasPermission(session, PERMISSIONS.TENANTS_MANAGE);
  const tenants = await getTenants();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Platform"
        title="Tenants"
        description="Alle Tenants dieser Instanz. Jeder Tenant repräsentiert eine eigenständige Vereinsinstanz."
        actions={
          canManage ? (
            <Link href="/dashboard/admin/tenants/new" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neuer Tenant
            </Link>
          ) : undefined
        }
      />

      <TenantList tenants={tenants} canManage={canManage} />
    </div>
  );
}
