import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiatives } from "@/lib/initiatives/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungInitiativenList from "@/components/admin/vereinsleitung/VereinsleitungInitiativenList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function VereinsleitungInitiativenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await getActorContext(session.user);
  const initiatives = await getInitiatives(actor);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Initiativen"
        title="Initiativen"
        description="Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag."
        actions={
          <Link
            href="/vereinsleitung/initiativen/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <Plus className="h-4 w-4" />
            Neue Initiative
          </Link>
        }
      />
      <VereinsleitungInitiativenList initiatives={initiatives} />
    </div>
  );
}
