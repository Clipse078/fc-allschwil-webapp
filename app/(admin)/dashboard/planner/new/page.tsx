import PlannerEntryCreateForm from "@/components/admin/planner/PlannerEntryCreateForm";
import { getPlannerCreateFormData } from "@/lib/planner/queries";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

type PlannerNewPageProps = {
  searchParams?: Promise<{
    season?: string;
    type?: string;
  }>;
};

export default async function PlannerNewPage({
  searchParams,
}: PlannerNewPageProps) {
  const session = await requirePermission(PERMISSIONS.WOCHENPLAN_MANAGE);
  const tenantId = session.user?.tenantId;

  if (!tenantId) {
    throw new Error("Tenant context is required for planner access.");
  }

  const params = (await searchParams) ?? {};
  const data = await getPlannerCreateFormData(tenantId, {
    selectedSeasonKey: params.season,
    selectedType: params.type,
  });

  return <PlannerEntryCreateForm data={data} />;
}
