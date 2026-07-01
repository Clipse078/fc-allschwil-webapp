import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import { PageShell } from "@/components/ui/page";
import { ListPagePattern } from "@/components/ui/patterns";
import { buttonVariants } from "@/components/ui";

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
          <Link href="/vereinsleitung/meetings/new" className={buttonVariants({ variant: "primary" })}>
            <Plus className="h-4 w-4" />
            Neues Meeting
          </Link>
        }
        isEmpty={meetings.length === 0}
        emptyIcon={<CalendarDays className="h-10 w-10" />}
        emptyHeading="Keine zugänglichen Meetings"
        emptyDescription="Noch keine Meetings erfasst oder keine für dich sichtbaren Einträge."
      >
        <VereinsleitungMeetingsList meetings={meetings} />
      </ListPagePattern>
    </PageShell>
  );
}
