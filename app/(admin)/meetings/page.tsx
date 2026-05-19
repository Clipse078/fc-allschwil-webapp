import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let meetings;
  try {
    const actor = await getActorContext(session.user);
    meetings = await getMeetings(actor);
  } catch (error) {
    console.error("[meetings] Failed to load meetings:", error);
    return (
      <div className="space-y-6">
        <AdminSectionHeader
          eyebrow="Meetings"
          title="Meetings"
          description="Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag."
        />
        <section className="rounded-[30px] border border-amber-200/80 bg-amber-50/60 p-10 shadow-[0_10px_30px_rgba(15,23,42,0.04)] text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-400" />
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Meetings konnten nicht geladen werden
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Die Datenbankverbindung ist momentan nicht verfügbar. Bitte versuche es später erneut.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meetings"
        description="Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag."
        actions={
          <Link
            href="/meetings/new"
            className="inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] hover:bg-[#2f52a0]"
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
