import Link from "next/link";
import { Flag, Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiatives } from "@/lib/initiatives/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungInitiativenList from "@/components/admin/vereinsleitung/VereinsleitungInitiativenList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

export default async function VereinsleitungInitiativenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await getActorContext(session.user, session.user?.tenantId ?? undefined);
  const initiatives = await getInitiatives(actor);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Initiativen"
        title="Initiativen"
        description="Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag."
        breadcrumbs={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Initiativen" },
        ]}
        headerActions={
          <Link href="/vereinsleitung/initiativen/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neue Initiative
          </Link>
        }
        isEmpty={initiatives.length === 0}
        emptyIcon={<Flag className="h-10 w-10" />}
        emptyHeading="Noch keine Initiativen"
        emptyDescription="Starte die erste Initiative, um Projekte und strategische Vorhaben zentral zu verfolgen."
        emptyAction={
          <Link href="/vereinsleitung/initiativen/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Erste Initiative anlegen
          </Link>
        }
      >
        <VereinsleitungInitiativenList initiatives={initiatives} />
      </ListPagePattern>
    </PageShell>
  );
}
