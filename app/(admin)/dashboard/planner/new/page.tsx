import PlannerEntryCreateForm from "@/components/admin/planner/PlannerEntryCreateForm";
import { getPlannerCreateFormData } from "@/lib/planner/queries";

type PlannerNewPageProps = {
  searchParams?: Promise<{
    season?: string;
    type?: string;
  }>;
};

export default async function PlannerNewPage({
  searchParams,
}: PlannerNewPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getPlannerCreateFormData({
    selectedSeasonKey: params.season,
    selectedType: params.type,
  });

  return <PlannerEntryCreateForm data={data} />;
}
