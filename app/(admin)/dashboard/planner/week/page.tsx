import { auth } from "@/auth";
import WeekPlannerPage from "@/components/admin/planner/WeekPlannerPage";

type PlannerWeekPageProps = {
  searchParams?: Promise<{
    season?: string;
    week?: string;
  }>;
};

export default async function PlannerWeekPageRoute({
  searchParams,
}: PlannerWeekPageProps) {
  const [rawParams, session] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    auth(),
  ]);
  const params = rawParams as { season?: string; week?: string };
  const activeTenantId = session?.user?.activeTenantId ?? "";

  return (
    <WeekPlannerPage
      seasonKey={params.season}
      week={params.week}
      tenantId={activeTenantId || undefined}
    />
  );
}
