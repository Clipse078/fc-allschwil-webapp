import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersons } from "@/lib/people/queries";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonSearchableList from "@/components/admin/persons/PersonSearchableList";

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
          <Link href="/dashboard/persons/new" className="fca-button-primary">
            <UserPlus className="h-4 w-4" />
            Neue Person
          </Link>
        }
      />

      <PersonSearchableList persons={persons} />
    </div>
  );
}
