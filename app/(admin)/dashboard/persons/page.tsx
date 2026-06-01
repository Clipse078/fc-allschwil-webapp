import Link from "next/link";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersons } from "@/lib/people/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonsList from "@/components/admin/persons/PersonsList";

export default async function PersonsPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const persons = await getPersons();

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Personen"
        title="Personen"
        description="Alle Personendatensätze im System — Mitglieder, Spieler, Trainer und weitere."
        actions={
          <Link
            href="/dashboard/persons/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#08357a]"
          >
            Neue Person
          </Link>
        }
      />

      <PersonsList persons={persons} />
    </div>
  );
}
