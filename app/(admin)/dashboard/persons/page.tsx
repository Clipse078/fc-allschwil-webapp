import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import PersonsList from "@/components/admin/persons/PersonsList";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function PersonsPage() {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const persons: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    roleLabel?: string | null;
    imageSrc?: string | null;
    isActive?: boolean;
  }[] = [];

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Personen"
        title="Personen"
        description="Zentrale Übersicht für Personenprofile im FCA WebApp Stil – mit Foto, Rollenhinweisen und klarer Premium-Darstellung."
      />

      <PersonsList persons={persons} />
    </div>
  );
}
