import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetingBySlug, getMeetingSubEntities } from "@/lib/meetings/queries";
import { getActorContext } from "@/lib/visibility/get-actor-context";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import MeetingGovernanceBanner from "@/components/admin/meetings/MeetingGovernanceBanner";

type MeetingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = await getActorContext(session.user, session.user?.tenantId ?? undefined);

  // 404-masking: null if actor cannot see this meeting
  const dbMeeting = await getMeetingBySlug(slug, actor);

  // Fetch sub-entities in parallel once meeting is confirmed visible
  const subEntities = dbMeeting ? await getMeetingSubEntities(dbMeeting.id) : null;

  return (
    <div className="space-y-5">
      {dbMeeting ? (
        <MeetingGovernanceBanner meeting={dbMeeting} />
      ) : null}
      <VereinsleitungMeetingDetail dbMeeting={dbMeeting} subEntities={subEntities} />
    </div>
  );
}
