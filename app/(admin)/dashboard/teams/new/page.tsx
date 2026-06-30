import TeamCreateForm from "@/components/admin/teams/TeamCreateForm";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";

export default async function NewTeamPage() {
  const session = await requirePermission(PERMISSIONS.TEAMS_MANAGE);

  const tenant = await getTenantFromSession(session.user?.tenantId);
  const availableOrgUnits = await getOrgUnits(tenant?.id);

  return <TeamCreateForm availableOrgUnits={availableOrgUnits} />;
}
