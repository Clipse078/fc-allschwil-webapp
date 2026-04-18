import SeasonPlannerPage from "@/components/admin/planner/SeasonPlannerPage";

type PlannerPageProps = {
  searchParams?: Promise<{
    season?: string;
    status?: string;
  }>;
};

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const params = (await searchParams) ?? {};
  return <SeasonPlannerPage seasonKey={params.season} status={params.status} />;
}
