import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OrgUnitSearchableList from "@/components/admin/org/OrgUnitSearchableList";

// Slice 11.2b: tenant resolved from session-carried tenantId.

export default async function OrgUnitsPage() {
  const session = await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const tenant = await getTenantFromSession(session.user?.tenantId);
  if (!tenant) notFound();
  const orgUnits = await getOrgUnits(tenant.id);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Organisation"
        title="Organisationseinheiten"
        description="Organigramm-Grundlage für Sichtbarkeit, Kommunikation und Workflow-Routing."
        actions={
          <Link href="/dashboard/org-units/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue Einheit
          </Link>
        }
      />

      <OrgUnitSearchableList orgUnits={orgUnits} />
    </div>
  );
}
