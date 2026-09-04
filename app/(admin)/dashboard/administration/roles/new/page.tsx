import Link from "next/link";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_MANAGE } from "@/lib/roles/access";
import { getTenantPermissionCatalog } from "@/lib/roles/tenant-queries";
import CreateTenantRoleForm from "@/components/admin/roles/CreateTenantRoleForm";
import { PageBreadcrumbs, PageHeader } from "@/components/ui/page";

export default async function NewTenantRolePage() {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_MANAGE, tenantId);

  const moduleGroups = await getTenantPermissionCatalog();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <PageBreadcrumbs
            items={[
              {
                label: "Administration",
                href: "/dashboard/administration/roles",
              },
              {
                label: "Rollen & Berechtigungen",
                href: "/dashboard/administration/roles",
              },
              { label: "Neue Rolle" },
            ]}
          />
          <PageHeader
            title="Neue Rolle erstellen"
            description="Definiere eine Rolle und wähle die passenden Berechtigungen aus. Rollen helfen, den Zugriff im Verein einfach und sicher zu steuern."
          />
        </div>

        <Link
          href="/dashboard/administration/roles"
          className="fca-button-secondary shrink-0 self-start"
        >
          Zurück zur Übersicht
        </Link>
      </div>

      <CreateTenantRoleForm moduleGroups={moduleGroups} />
    </div>
  );
}
