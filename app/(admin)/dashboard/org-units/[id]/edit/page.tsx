import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById, getOrgUnits } from "@/lib/org/queries";
import { getTenantFromSession } from "@/lib/tenants/queries";
import OrgUnitForm from "@/components/admin/org/OrgUnitForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

// Slice 11.2b: tenant resolved from session-carried tenantId.

type PageProps = { params: Promise<{ id: string }> };

export default async function EditOrgUnitPage({ params }: PageProps) {
  const session = await requireAnyPermission([PERMISSIONS.ORG_MANAGE]);

  const { id } = await params;
  const tenant = await getTenantFromSession(session.user?.tenantId);
  if (!tenant) notFound();

  const [unit, parentOptions] = await Promise.all([
    getOrgUnitById(id),
    getOrgUnits(tenant.id),
  ]);

  if (!unit) notFound();
  // Tenant guard: null tenantId = pre-migration residue; allow (backwards-compat).
  if (unit.tenantId !== null && unit.tenantId !== tenant.id) notFound();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Organisation"
        title={`${unit.name} bearbeiten`}
        description="Passe Stammdaten der Organisationseinheit an. Der Key bleibt unveränderlich."
        actions={
          <Link href={`/dashboard/org-units/${unit.id}`} className="fca-button-secondary">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        }
      />
      <OrgUnitForm
        mode="edit"
        orgUnitId={unit.id}
        parentOptions={parentOptions}
        defaultValues={{
          name: unit.name,
          key: unit.key,
          type: unit.type,
          parentId: unit.parentId ?? "",
          description: unit.description ?? "",
          sortOrder: unit.sortOrder,
          status: unit.status,
        }}
      />
    </div>
  );
}
