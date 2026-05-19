import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function VereinsleitungMeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const actor = await getActorContext(session.user);
  const meetings = await getMeetings(actor);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meetings"
        description="Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag."
        actions={
          <Link
            href="/vereinsleitung/meetings/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#08357a]"
          >
            <Plus className="h-4 w-4" />
            Neues Meeting
          </Link>
        }
      />
      <VereinsleitungMeetingsList meetings={meetings} />
    </div>
  );
}
