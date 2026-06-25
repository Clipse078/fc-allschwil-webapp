import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits, getArchivedOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import OrgUnitSearchableList from "@/components/admin/org/OrgUnitSearchableList";

// Org Builder Foundation v1: view=archived param switches to the archived units view.
// Slice 11.2b: tenant resolved from session-carried tenantId.

type PageProps = { searchParams: Promise<{ view?: string }> };

export default async function OrgUnitsPage({ searchParams }: PageProps) {
  const session = await requireAnyPermission([PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_MANAGE]);
  const tenant = await getTenantFromSession(session.user?.tenantId);
  if (!tenant) notFound();

  const { view } = await searchParams;
  const showArchived = view === "archived";
  const canManage = hasPermission(session, PERMISSIONS.ORG_MANAGE);

  const [orgUnits, archivedOrgUnits] = await Promise.all([
    getOrgUnits(tenant.id),
    canManage ? getArchivedOrgUnits(tenant.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Organisation"
        title="Organisation Builder"
        description="Hierarchische Organisationsstruktur – Grundlage für Sichtbarkeit, Berechtigungen und Kommunikation."
        actions={
          canManage ? (
            <Link href="/dashboard/org-units/new" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neue Einheit
            </Link>
          ) : null
        }
      />

      {/* TODO(Phase 2): Replace with organization-based permission checks once
          the permission system is linked to org unit membership. Currently uses
          the existing admin/authorized access pattern (ORG_VIEW / ORG_MANAGE). */}

      <OrgUnitSearchableList
        orgUnits={orgUnits}
        archivedOrgUnits={archivedOrgUnits}
        showArchived={showArchived}
        canManage={canManage}
      />
    </div>
  );
}
