import PlanningResourcesManager from "@/components/admin/resources/PlanningResourcesManager";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  const resources = await prisma.planningResource.findMany({
    orderBy: [
      { type: "asc" },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      sortOrder: true,
      isActive: true,
      notes: true,
    },
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Operations & Organisation"
        title="Ressourcen"
        description="Zentrale Verwaltung von Spielfeldern, Garderoben, Hallen und weiteren Infrastruktur-Ressourcen für Jahresplan, Wochenplan, Tagesplan und Infoboard."
      />

      <PlanningResourcesManager resources={resources} />
    </div>
  );
}
