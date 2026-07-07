import SeasonPlannerPage from "@/components/admin/planner/SeasonPlannerPage";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type PlannerPageProps = {
  searchParams?: Promise<{
    season?: string;
    status?: string;
  }>;
};

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const session = await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);
  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    throw new Error("Tenant context is required for planner access.");
  }

  const params = (await searchParams) ?? {};

  return (
    <SeasonPlannerPage
      tenantId={tenantId}
      seasonKey={params.season}
      status={params.status}
    />
  );
}
