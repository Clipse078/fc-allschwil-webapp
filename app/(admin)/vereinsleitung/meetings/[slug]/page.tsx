/**
 * Meeting detail page — currently at /vereinsleitung/meetings/[slug].
 *
 * TODO(decoupling — Meetings Module):
 * This route will move to /meetings/[slug] or /meetings/[id] when the Meetings
 * module is decoupled from Vereinsleitung.
 * The [slug] routing itself will likely become [id] once a real Meeting model
 * exists in the database.
 * The meeting detail sub-cards (Agenda, Decisions, Actions, Participants, Info)
 * will be renamed from VereinsleitungMeeting* → Meeting* and moved to
 * components/admin/meetings/.
 *
 * Blocker: Meeting data model not in schema; route migration pending.
 */
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";

type MeetingDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const resolvedParams = await params;

  return <VereinsleitungMeetingDetail slug={resolvedParams.slug} />;
}
