import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getPersons } from "@/lib/people/queries";
import PersonSearchableList from "@/components/admin/persons/PersonSearchableList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

export default async function PersonsPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const persons = await getPersons();

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Personen"
        title="Personen"
        description="Alle Personendatensätze im System — Mitglieder, Spieler, Trainer und weitere."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Personen" },
        ]}
        headerActions={
          <Link href="/dashboard/persons/new" className="fca-button-primary">
            <UserPlus className="h-4 w-4" />
            Neue Person
          </Link>
        }
      >
        <PersonSearchableList persons={persons} />
      </ListPagePattern>
    </PageShell>
  );
}
