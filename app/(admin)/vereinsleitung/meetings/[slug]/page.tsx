import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetingBySlug } from "@/lib/meetings/queries";
import { buildActorContext } from "@/lib/visibility/actor-context";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import MeetingGovernanceBanner from "@/components/admin/meetings/MeetingGovernanceBanner";

type MeetingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = buildActorContext(session.user);

  // 404-masking: getMeetingBySlug returns null if actor cannot see this record.
  // The mock fallback renders identically to "slug not in DB" — no 403 leakage.
  const dbMeeting = await getMeetingBySlug(slug, actor);

  return (
    <div className="space-y-5">
      {dbMeeting ? (
        <MeetingGovernanceBanner meeting={dbMeeting} />
      ) : null}
      <VereinsleitungMeetingDetail dbMeeting={dbMeeting} />
    </div>
  );
}
