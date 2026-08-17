import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import FacilitiesAdminPanel from "@/components/admin/facilities/FacilitiesAdminPanel";

export default async function FacilitiesPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.FACILITIES_VIEW,
    PERMISSIONS.FACILITIES_MANAGE,
  ]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const canManage = hasPermission(session, PERMISSIONS.FACILITIES_MANAGE);
  const canDelete = hasPermission(session, PERMISSIONS.FACILITIES_DELETE);

  let facilities: Awaited<ReturnType<typeof getFacilitiesForTenant>> = [];
  try {
    facilities = await getFacilitiesForTenant(tenantId);
  } catch {
    facilities = [];
  }

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Anlagen & Ressourcen"
        description="Sportanlagen, Plätze und Garderoben konfigurieren. Einmal gepflegt, werden die Bezeichnungen automatisch auf dem Infoboard und in der Wochenplanung verwendet."
      />
      <FacilitiesAdminPanel
        initialFacilities={facilities}
        canManage={canManage}
        canDelete={canDelete}
        tenantId={tenantId}
      />
    </div>
  );
}
