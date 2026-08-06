import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { requireActiveTenantId } from "@/lib/tenants/active-tenant";
import { TENANT_ROLES_VIEW } from "@/lib/roles/access";
import { getEligibleTenantMembers } from "@/lib/roles/tenant-queries";
import EffectiveAccessViewer from "@/components/admin/roles/EffectiveAccessViewer";
import { EmptyState } from "@/components/ui/page";
import { Users } from "lucide-react";

export default async function TenantEffectiveAccessPage() {
  const tenantId = await requireActiveTenantId();
  await requireAnyPermission(TENANT_ROLES_VIEW, tenantId);

  const members = await getEligibleTenantMembers(tenantId);

  if (members.length === 0) {
    return (
      <div className="sce-detail-section">
        <div className="sce-detail-section-body">
          <EmptyState
            icon={<Users className="h-10 w-10" />}
            heading="Keine aktiven Mitglieder"
            description="Es gibt derzeit keine aktiven Mitgliedschaften in diesem Mandanten."
          />
        </div>
      </div>
    );
  }

  return (
    <EffectiveAccessViewer
      members={members.map((m) => ({
        userId: m.userId,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
      }))}
    />
  );
}
