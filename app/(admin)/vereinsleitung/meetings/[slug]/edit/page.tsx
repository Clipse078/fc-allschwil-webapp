import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetingBySlug } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import MeetingForm from "@/components/admin/meetings/MeetingForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

type PageProps = { params: Promise<{ slug: string }> };

export default async function EditMeetingPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = await getActorContext(session.user, session.user?.activeTenantId ?? undefined);
  const meeting = await getMeetingBySlug(slug, actor);

  if (!meeting) notFound();

  function parseStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === "string");
  }

  const defaultValues = {
    title: meeting.title,
    description: meeting.description ?? "",
    meetingDate: new Date(meeting.meetingDate).toISOString().slice(0, 16),
    location: meeting.location ?? "",
    attendeeCount: meeting.attendeeCount != null ? String(meeting.attendeeCount) : "",
    status: meeting.status,
    visibilityScope: meeting.visibilityScope as VisibilityScopeValue,
    visibleOrgUnitRefs: parseStringArray(meeting.visibleOrgUnitRefs),
    visibleRoleRefs: parseStringArray(meeting.visibleRoleRefs),
    visibleUserRefs: parseStringArray(meeting.visibleUserRefs),
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meeting bearbeiten"
        description={`Bearbeite: ${meeting.title}`}
      />
      <MeetingForm mode="edit" meetingId={meeting.id} defaultValues={defaultValues} />
    </div>
  );
}
