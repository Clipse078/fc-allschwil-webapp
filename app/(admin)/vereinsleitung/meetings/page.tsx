import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";

export default async function VereinsleitungMeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await getActorContext(session.user, session.user?.tenantId ?? undefined);
  const meetings = await getMeetings(actor);

  return (
    <PageShell fullWidth>
      <ListPagePattern
        eyebrow="Meetings"
        title="Meetings"
        description="Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag."
        breadcrumbs={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Meetings" },
        ]}
        headerActions={
          <Link href="/vereinsleitung/meetings/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Neues Meeting
          </Link>
        }
        isEmpty={meetings.length === 0}
        emptyIcon={<CalendarDays className="h-10 w-10" />}
        emptyHeading="Noch keine Meetings"
        emptyDescription="Plane das erste Meeting, um Sitzungen, Protokolle und Beschlüsse zentral zu erfassen."
        emptyAction={
          <Link href="/vereinsleitung/meetings/new" className="fca-button-primary">
            <Plus className="h-4 w-4" />
            Erstes Meeting anlegen
          </Link>
        }
      >
        <VereinsleitungMeetingsList meetings={meetings} />
      </ListPagePattern>
    </PageShell>
  );
}
