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
  let loadError: string | null = null;

  try {
    const actor = await getActorContext(session.user);
    meetings = await getMeetings(actor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[meetings] Failed to load meetings:", message);
    loadError = message;
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
      {loadError ? (
        <section className="rounded-[20px] border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <h3 className="text-sm font-semibold text-rose-800">
                Meetings konnten nicht geladen werden
              </h3>
              <p className="mt-1 text-sm text-rose-700">
                Die Datenbankverbindung ist derzeit nicht verfügbar. Bitte versuche es später erneut
                oder kontaktiere den Administrator.
              </p>
              <pre className="mt-3 max-w-full overflow-x-auto rounded bg-rose-100 px-3 py-2 text-xs text-rose-900">
                {loadError}
              </pre>
            </div>
          </div>
        </section>
      ) : (
        <VereinsleitungMeetingsList meetings={meetings ?? []} />
      )}
    </div>
  );
}
