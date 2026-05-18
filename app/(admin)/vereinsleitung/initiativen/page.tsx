import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiatives } from "@/lib/initiatives/queries";
import { buildActorContext } from "@/lib/visibility/actor-context";
import VereinsleitungInitiativenList from "@/components/admin/vereinsleitung/VereinsleitungInitiativenList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function VereinsleitungInitiativenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = buildActorContext(session.user);
  const initiatives = await getInitiatives(actor);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Initiativen"
        title="Initiativen"
        description="Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag."
      />
      <VereinsleitungInitiativenList initiatives={initiatives} />
    </div>
  );
}
