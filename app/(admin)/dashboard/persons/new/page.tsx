import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonForm from "@/components/admin/persons/PersonForm";

export default async function NewPersonPage() {
  await requirePermission(PERMISSIONS.PEOPLE_MANAGE);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Personen"
        title="Neue Person"
        description="Lege einen neuen Personendatensatz im System an."
        actions={
          <Link
            href="/dashboard/persons"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        }
      />
      <PersonForm mode="create" />
    </div>
  );
}
