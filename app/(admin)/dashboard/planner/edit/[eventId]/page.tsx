import { redirect } from "next/navigation";
import PlannerEntryCreateForm from "@/components/admin/planner/PlannerEntryCreateForm";
import { getPlannerEditFormData } from "@/lib/planner/queries";

type PlannerEditPageProps = {
  params: Promise<{
    eventId: string;
  }>;
  searchParams?: Promise<{
    season?: string;
    type?: string;
  }>;
};

export default async function PlannerEditPage({
  params,
  searchParams,
}: PlannerEditPageProps) {
  const { eventId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const data = await getPlannerEditFormData(eventId, {
    selectedType: resolvedSearchParams?.type ?? null,
  });

  if (!data) {
    const redirectSeason = resolvedSearchParams?.season;
    const params = new URLSearchParams();

    if (redirectSeason) {
      params.set("season", redirectSeason);
    }

    params.set("status", "update-invalid-event");

    redirect(`/dashboard/planner?${params.toString()}`);
  }

  return <PlannerEntryCreateForm data={data} mode="edit" />;
}
