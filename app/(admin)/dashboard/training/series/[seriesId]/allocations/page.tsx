import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import { listAllocationsByTrainingSeries } from "@/lib/training/training-allocation-service";
import { TrainingSeriesNotFoundError } from "@/lib/training/errors";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { TrainingAllocationEditor } from "@/components/admin/training/TrainingAllocationEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type Props = { params: Promise<{ seriesId: string }> };

export default async function TrainingAllocationsPage({ params }: Props) {
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
  ]);

  const tenantId = session.user?.tenantId;
  if (!tenantId) notFound();

  const canManage = hasPermission(session, PERMISSIONS.TRAININGS_MANAGE);
  const { seriesId } = await params;

  // Verify the training series exists and belongs to this tenant
  const series = await prisma.trainingSeries.findFirst({
    where: { id: seriesId, tenantId },
    select: { id: true, title: true, status: true },
  });
  if (!series) notFound();

  // Load current allocations and available resources in parallel
  let allocations: Awaited<ReturnType<typeof listAllocationsByTrainingSeries>>;
  try {
    allocations = await listAllocationsByTrainingSeries(tenantId, seriesId);
  } catch (err) {
    if (err instanceof TrainingSeriesNotFoundError) notFound();
    throw err;
  }

  const facilities = await getFacilitiesForTenant(tenantId);

  // Build facility groups for the selector (only non-archived resources)
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

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Training"
        title={`Ressourcen: ${series.title}`}
        description="Weisen Sie dieser Trainingsserie eine oder mehrere Anlagen-Ressourcen zu. Die Zuweisung gilt für alle Trainings dieser Serie und dient als einzige Quelle für Wochenplanung, Infoboard und Ressourcennutzung."
      />

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <TrainingAllocationEditor
          trainingSeriesId={seriesId}
          trainingSeriesTitle={series.title}
          initialAllocations={allocations}
          facilityGroups={facilityGroups}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
