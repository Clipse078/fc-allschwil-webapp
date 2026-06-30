import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnits, getArchivedOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import OrgUnitSearchableList from "@/components/admin/org/OrgUnitSearchableList";
import { AppPage, AppPageHeader } from "@/components/ui/layout";

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
    <AppPage>
      <AppPageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Organisation" },
          { label: "Organisationseinheiten" },
        ]}
        eyebrow="Organisation"
        title="Organisation Builder"
        description="Hierarchische Organisationsstruktur – Grundlage für Sichtbarkeit, Berechtigungen und Kommunikation."
        actions={
          canManage ? (
            <Link href="/dashboard/org-units/new" className="fca-button-primary">
              <Plus className="h-4 w-4" />
              Neue Einheit
            </Link>
          ) : undefined
        }
      />

      {/* Phase 2 (org-based permissions) implemented: the detail page now grants
          access to active members of each org unit via canAccessOrgUnit().
          This list page retains ORG_VIEW / ORG_MANAGE as the module-level gate
          (browsing the full list is an admin operation, not a member operation). */}

      <OrgUnitSearchableList
        orgUnits={orgUnits}
        archivedOrgUnits={archivedOrgUnits}
        showArchived={showArchived}
        canManage={canManage}
      />
    </AppPage>
  );
}
