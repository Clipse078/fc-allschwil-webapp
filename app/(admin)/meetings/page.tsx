import Link from "next/link";
import { Plus, AlertTriangle } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import type { MeetingListItem } from "@/lib/meetings/queries";

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let meetings: MeetingListItem[] = [];
  let dbError: string | null = null;

  try {
    const actor = await getActorContext(session.user);
    meetings = await getMeetings(actor);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown database error.";
    console.error("[meetings/page] DB query failed:", message);
    dbError = message;
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

      {dbError ? (
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Daten konnten nicht geladen werden
              </p>
              <p className="mt-1 text-sm text-amber-700">
                Die Datenbankverbindung ist nicht verfügbar. Bitte prüfe die Serverkonfiguration.
              </p>
              {process.env.NODE_ENV !== "production" ? (
                <pre className="mt-3 rounded-lg bg-amber-100 p-3 text-xs text-amber-800 whitespace-pre-wrap break-all">
                  {dbError}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <VereinsleitungMeetingsList meetings={meetings} />
      )}
    </div>
  );
}
