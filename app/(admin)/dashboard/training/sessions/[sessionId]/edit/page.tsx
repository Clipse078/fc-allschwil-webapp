import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { getTrainingSession } from "@/lib/training/session-generation-service";
import { TrainingSessionNotFoundError } from "@/lib/training/errors";
import { listAllocationsByTrainingSeries } from "@/lib/training/training-allocation-service";
import { listAllocationsByTrainingSession } from "@/lib/training/session-allocation-service";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ToastProvider } from "@/components/ui/ToastProvider";
import TrainingSessionEditForm from "@/components/admin/training/TrainingSessionEditForm";
import { TrainingSessionAllocationEditor } from "@/components/admin/training/TrainingSessionAllocationEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type Props = { params: Promise<{ sessionId: string }> };

function formatWallTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

export default async function TrainingSessionEditPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  const { sessionId } = await params;

  let trainingSession;
  try {
    trainingSession = await getTrainingSession(tenantContext.id, sessionId);
  } catch (err) {
    if (err instanceof TrainingSessionNotFoundError) notFound();
    throw err;
  }

  // Cancelled/inactive occurrences have nothing to edit — editing a
  // recurrence slot that is no longer a genuine SCHEDULED occurrence would
  // silently do nothing operationally useful (see session-reschedule-service.ts).
  if (trainingSession.status !== "SCHEDULED") notFound();

  const locale = tenantContext.locale ?? "de-CH";

  const [seriesAllocations, sessionAllocations, facilities] = await Promise.all([
    listAllocationsByTrainingSeries(tenantContext.id, trainingSession.trainingSeriesId),
    listAllocationsByTrainingSession(tenantContext.id, sessionId),
    getFacilitiesForTenant(tenantContext.id),
  ]);

  const facilityGroups: FacilityGroup[] = facilities
    .filter((f) => f.status !== "ARCHIVED")
    .map((f) => ({
      facilityId: f.id,
      facilityName: f.name,
      resources: f.resources
        .filter((r) => r.status !== "ARCHIVED")
        .map((r) => ({
          id: r.id,
          name: r.name,
          code: r.code,
          type: r.type,
          facilityId: f.id,
          facilityName: f.name,
        })),
    }))
    .filter((fg) => fg.resources.length > 0);

  const dayHref = `/dashboard/training?tab=kalender&view=day&day=${trainingSession.date}`;

  return (
    <ToastProvider>
      <div className="max-w-[900px] space-y-6">
        <Link
          href={dayHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)] transition hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum Tag
        </Link>

        <AdminSectionHeader
          eyebrow="TrainingCenter · Einzeltraining bearbeiten"
          title={`${trainingSession.teamName} · ${trainingSession.trainingSeriesTitle}`}
          description="Änderungen gelten ausschliesslich für dieses eine Training. Die Trainingsserie und alle anderen Termine bleiben unverändert."
        />

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <TrainingSessionEditForm
            sessionId={trainingSession.id}
            canManage={canManage}
            isRescheduled={trainingSession.isRescheduled}
            effectiveDate={trainingSession.date}
            effectiveStartTime={formatWallTime(trainingSession.startAt, trainingSession.timezone)}
            effectiveEndTime={formatWallTime(trainingSession.endAt, trainingSession.timezone)}
            originalDate={trainingSession.originalDate}
            originalStartTime={formatWallTime(trainingSession.originalStartAt, trainingSession.timezone)}
            originalEndTime={formatWallTime(trainingSession.originalEndAt, trainingSession.timezone)}
            timezone={trainingSession.timezone}
            locale={locale}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <TrainingSessionAllocationEditor
            sessionId={trainingSession.id}
            initialAllocations={sessionAllocations}
            seriesAllocations={seriesAllocations}
            facilityGroups={facilityGroups}
            canManage={canManage}
            sessionStartAt={trainingSession.startAt}
            sessionEndAt={trainingSession.endAt}
          />
        </div>
      </div>
    </ToastProvider>
  );
}
