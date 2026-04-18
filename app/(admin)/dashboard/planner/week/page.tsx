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
  const params = (await searchParams) ?? {};
  return <WeekPlannerPage seasonKey={params.season} week={params.week} />;
}
