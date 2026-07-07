import WeekPlannerPage from "@/components/admin/planner/WeekPlannerPage";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type PlannerWeekPageProps = {
  searchParams?: Promise<{
    season?: string;
    week?: string;
  }>;
};

export default async function PlannerWeekPageRoute({
  searchParams,
}: PlannerWeekPageProps) {
  const session = await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);
  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    throw new Error("Tenant context is required for planner access.");
  }

  const params = (await searchParams) ?? {};

  return (
    <WeekPlannerPage
      tenantId={tenantId}
      seasonKey={params.season}
      week={params.week}
    />
  );
}
