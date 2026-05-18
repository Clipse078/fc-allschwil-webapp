import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetings } from "@/lib/meetings/queries";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function VereinsleitungMeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const meetings = await getMeetings();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meetings"
        description="Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag."
      />
      <VereinsleitungMeetingsList meetings={meetings} />
    </div>
  );
}
