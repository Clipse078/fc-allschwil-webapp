import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getOrgUnitById, getOrgUnits } from "@/lib/org/queries";
import OrgUnitForm from "@/components/admin/org/OrgUnitForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditOrgUnitPage({ params }: PageProps) {
  await requireAnyPermission([PERMISSIONS.USERS_MANAGE]);

  const { id } = await params;
  const [unit, parentOptions] = await Promise.all([
    getOrgUnitById(id),
    getOrgUnits(),
  ]);

  if (!unit) notFound();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Organisation"
        title={`${unit.name} bearbeiten`}
        description="Passe Stammdaten der Organisationseinheit an. Der Key bleibt unveränderlich."
        actions={
          <Link href={`/dashboard/org-units/${unit.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />Zurück
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
