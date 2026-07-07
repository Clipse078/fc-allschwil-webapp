import DayPlannerPage from "@/components/admin/planner/DayPlannerPage";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type PlannerDayPageProps = {
  searchParams?: Promise<{
    season?: string;
    day?: string;
  }>;
};

export default async function PlannerDayPageRoute({
  searchParams,
}: PlannerDayPageProps) {
  const session = await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);
  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    throw new Error("Tenant context is required for planner access.");
  }

  const params = (await searchParams) ?? {};

  return (
    <DayPlannerPage
      tenantId={tenantId}
      seasonKey={params.season}
      day={params.day}
    />
  );
}
