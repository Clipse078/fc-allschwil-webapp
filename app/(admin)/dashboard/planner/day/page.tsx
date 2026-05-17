import { auth } from "@/auth";
import DayPlannerPage from "@/components/admin/planner/DayPlannerPage";

type PlannerDayPageProps = {
  searchParams?: Promise<{
    season?: string;
    day?: string;
  }>;
};

export default async function PlannerDayPageRoute({
  searchParams,
}: PlannerDayPageProps) {
  const [rawParams, session] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    auth(),
  ]);
  const params = rawParams as { season?: string; day?: string };
  const activeTenantId = session?.user?.activeTenantId ?? "";

  return (
    <DayPlannerPage
      seasonKey={params.season}
      day={params.day}
      tenantId={activeTenantId || undefined}
    />
  );
}
