import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersonById } from "@/lib/people/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonForm from "@/components/admin/persons/PersonForm";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditPersonPage({ params }: PageProps) {
  await requirePermission(PERMISSIONS.PEOPLE_MANAGE);

  const { id } = await params;
  const person = await getPersonById(id);
  if (!person) notFound();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Personen"
        title={`${person.firstName} ${person.lastName} bearbeiten`}
        description="Stammdaten, Kontakt, Rollen und Status dieser Person anpassen."
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
      <PersonForm
        mode="edit"
        personId={person.id}
        defaultValues={{
          firstName: person.firstName,
          lastName: person.lastName,
          displayName: person.displayName ?? "",
          email: person.email ?? "",
          phone: person.phone ?? "",
          dateOfBirth: person.dateOfBirth?.toISOString().slice(0, 10) ?? "",
          notes: person.notes ?? "",
          isActive: person.isActive,
          isPlayer: person.isPlayer,
          isTrainer: person.isTrainer,
        }}
      />
    </div>
  );
}
