import { auth } from "@/auth";
import { redirect } from "next/navigation";
import InitiativeForm from "@/components/admin/initiatives/InitiativeForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function NewInitiativePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Initiativen"
        title="Neue Initiative erstellen"
        description="Initiative erfassen mit Status, Fortschritt und Sichtbarkeitseinstellungen."
      />
      <InitiativeForm mode="create" />
    </div>
  );
}
