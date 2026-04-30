import PlanningResourcesManager from "@/components/admin/resources/PlanningResourcesManager";
import { PageHeader, PageShell } from "@/components/shared/page";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  await requirePermission(PERMISSIONS.EVENTS_MANAGE);

  const resources = await prisma.planningResource.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, type: true, sortOrder: true, isActive: true, notes: true },
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations & Organisation"
        title="Ressourcen"
        description="Zentrale Verwaltung von Spielfeldern, Garderoben, Hallen und weiteren Infrastruktur-Ressourcen für Jahresplan, Wochenplan, Tagesplan und Infoboard."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Operations", href: "/dashboard/operations" },
          { label: "Ressourcen" },
        ]}
      />

      <PlanningResourcesManager resources={resources} />
    </PageShell>
  );
}
