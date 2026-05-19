import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MeetingForm from "@/components/admin/meetings/MeetingForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function NewMeetingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Neues Meeting erstellen"
        description="Meeting erfassen mit Datum, Ort und Sichtbarkeitseinstellungen."
      />
      <MeetingForm mode="create" />
    </div>
  );
}
