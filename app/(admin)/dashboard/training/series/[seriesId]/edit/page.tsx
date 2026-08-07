import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTrainingSeries } from "@/lib/training/training-service";
import { findTeamSeasonsForTenant } from "@/lib/training/queries";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesForm from "@/components/admin/training/TrainingSeriesForm";

type Props = { params: Promise<{ seriesId: string }> };

/** Formats an ISO datetime as "YYYY-MM-DD" for a native date input. */
function toDateInputValue(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export default async function EditTrainingSeriesPage({ params }: Props) {
  const session = await requireAnyPermission([PERMISSIONS.TRAININGS_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const { seriesId } = await params;

  let series;
  try {
    series = await getTrainingSeries(tenantId, seriesId);
  } catch (err) {
    if (err instanceof TrainingSeriesNotFoundError) notFound();
    throw err;
  }

  const teamSeasons = await findTeamSeasonsForTenant(tenantId);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="TrainingCenter"
        title={`Bearbeiten: ${series.title}`}
        description="Änderungen an Wochentagen, Zeiten oder Zeitraum werden beim Speichern sofort in generierte Termine übernommen. Bereits generierte Termine werden nicht dupliziert."
      />

      <TrainingSeriesForm
        mode="edit"
        seriesId={series.id}
        teamSeasons={teamSeasons}
        defaultValues={{
          teamSeasonId: series.teamSeasonId,
          title: series.title,
          description: series.description,
          timezone: series.timezone,
          validFrom: toDateInputValue(series.validFrom),
          validUntil: toDateInputValue(series.validUntil),
          weekdaySchedules: series.weekdaySchedules,
        }}
      />
    </div>
  );
}
