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
  const params = (await searchParams) ?? {};
  return <DayPlannerPage seasonKey={params.season} day={params.day} />;
}
