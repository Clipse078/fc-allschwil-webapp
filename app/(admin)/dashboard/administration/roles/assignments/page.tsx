import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_ASSIGN } from "@/lib/roles/access";
import { getEligibleTenantMembers, getTenantRolesOverview } from "@/lib/roles/tenant-queries";
import RoleAssignmentPanel from "@/components/admin/roles/RoleAssignmentPanel";
import { EmptyState } from "@/components/ui/page";
import { Users } from "lucide-react";

export default async function TenantRoleAssignmentsPage() {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_ASSIGN, tenantId);

  const [members, roles] = await Promise.all([
    getEligibleTenantMembers(tenantId),
    getTenantRolesOverview(tenantId),
  ]);

  if (members.length === 0) {
    return (
      <div className="sce-detail-section">
        <div className="sce-detail-section-body">
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            heading="Keine aktiven Mitglieder"
            description="Es gibt derzeit keine aktiven Mitgliedschaften in diesem Mandanten, denen eine Rolle zugewiesen werden könnte."
          />
        </div>
      </div>
    );
  }

  return (
    <RoleAssignmentPanel
      initialMembers={members}
      roles={roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem, isArchived: r.isArchived }))}
    />
  );
}
