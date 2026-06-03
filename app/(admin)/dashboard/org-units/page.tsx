import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits } from "@/lib/org/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OrgUnitSearchableList from "@/components/admin/org/OrgUnitSearchableList";

export default async function OrgUnitsPage() {
  await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const orgUnits = await getOrgUnits();

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
