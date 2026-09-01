import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getTrainingSeries } from "@/lib/training/training-service";
import { findTeamSeasonPickerRow } from "@/lib/training/queries";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";
import { countSeriesOccurrenceAllocationExceptions } from "@/lib/training/series-cockpit-exception-data";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TrainingSeriesForm from "@/components/admin/training/TrainingSeriesForm";
import TrainingSeriesDeleteControl from "@/components/admin/training/TrainingSeriesDeleteControl";

type Props = { params: Promise<{ seriesId: string }> };

/** Formats an ISO datetime as "YYYY-MM-DD" for a native date input. */
function toDateInputValue(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export default async function EditTrainingSeriesPage({ params }: Props) {
  // ADMIN-DELETE-02A: a delegated user may hold trainings.delete without
  // trainings.manage — they must still be able to reach this page to
  // exercise the permanent-delete action gated below (mirrors
  // app/(admin)/dashboard/teams/[teamId]/page.tsx, ADMIN-DELETE-01B).
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.TRAININGS_DELETE,
  ]);

  // ADMIN-DELETE-02A: permanent "Löschen" gating — deliberately independent
  // of trainings.manage (manage alone must never authorize deletion).
  const canDelete = hasPermission(session, PERMISSIONS.TRAININGS_DELETE);

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

  const [teamSeasonRow, occurrenceExceptionCount] = await Promise.all([
    // TEAMCENTER-UX-01C: the team/season assignment is immutable on edit, and
    // findTeamSeasonsForTenant now intentionally scopes to the current season
    // only (see lib/training/queries.ts) — so a series created in a prior
    // season must still resolve its own TeamSeason for display here.
    findTeamSeasonPickerRow(tenantId, series.teamSeasonId),
    countSeriesOccurrenceAllocationExceptions(tenantId, seriesId, series.timezone),
  ]);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="TrainingCenter"
        title={`Bearbeiten: ${series.title}`}
        description="Änderungen an Wochentagen, Zeiten oder Zeitraum werden beim Speichern sofort in generierte Termine übernommen. Bereits generierte Termine werden nicht dupliziert."
      />

      {occurrenceExceptionCount > 0 ? (
        <div
          className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          data-testid="training-series-edit-exception-notice"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden />
          <div className="space-y-1">
            <p>
              Diese Serie hat{" "}
              <span className="font-semibold">
                {occurrenceExceptionCount === 1
                  ? "1 Einzeltermin-Ausnahme"
                  : `${occurrenceExceptionCount} Einzeltermin-Ausnahmen`}
              </span>
              . Änderungen an der Serie wirken sich nicht automatisch auf bereits abweichend zugewiesene Einzeltermine aus.
            </p>
            <Link
              href={`/dashboard/training?tab=serien`}
              className="inline-flex text-xs font-semibold text-blue-800 underline-offset-2 hover:underline"
            >
              Ausnahmen im Serien-Cockpit ansehen
            </Link>
          </div>
        </div>
      ) : null}

      <TrainingSeriesForm
        mode="edit"
        seriesId={series.id}
        teamSeasons={teamSeasonRow ? [teamSeasonRow] : []}
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

      <TrainingSeriesDeleteControl
        seriesId={series.id}
        seriesTitle={series.title}
        canDelete={canDelete}
      />
    </div>
  );
}
