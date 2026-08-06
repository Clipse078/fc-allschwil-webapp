import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_MANAGE } from "@/lib/roles/access";
import { getTenantPermissionCatalog } from "@/lib/roles/tenant-queries";
import CreateTenantRoleForm from "@/components/admin/roles/CreateTenantRoleForm";

export default async function NewTenantRolePage() {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_MANAGE, tenantId);

  const moduleGroups = await getTenantPermissionCatalog();

  return (
    <div className="max-w-[900px] space-y-6">
      <Link
        href="/dashboard/administration/roles"
        className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--text-2)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Alle Rollen
      </Link>

      <div>
        <h3 className="text-lg font-semibold text-[var(--foreground)]">Neue Rolle</h3>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Mandanten-eigene Rolle für diesen Verein. Scope ist immer TENANT und kann nicht geändert
          werden.
        </p>
      </div>

      <CreateTenantRoleForm moduleGroups={moduleGroups} />
    </div>
  );
}
