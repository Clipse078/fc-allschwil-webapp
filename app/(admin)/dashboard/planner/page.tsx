import { auth } from "@/auth";
import SeasonPlannerPage from "@/components/admin/planner/SeasonPlannerPage";

type PlannerPageProps = {
  searchParams?: Promise<{
    season?: string;
    status?: string;
  }>;
};

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const [rawParams, session] = await Promise.all([
    searchParams ?? Promise.resolve({}),
    auth(),
  ]);
  const params = rawParams as { season?: string; status?: string };
  const activeTenantId = session?.user?.activeTenantId ?? "";

  return (
    <SeasonPlannerPage
      seasonKey={params.season}
      status={params.status}
      tenantId={activeTenantId || undefined}
    />
  );
}
