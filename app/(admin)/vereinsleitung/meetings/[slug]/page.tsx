import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMeetingBySlug } from "@/lib/meetings/queries";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import MeetingGovernanceBanner from "@/components/admin/meetings/MeetingGovernanceBanner";

type MeetingDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;

  // Try to find in DB. If not found (legacy mock slug or slug not in DB),
  // the existing mock detail renders unchanged — zero regression.
  //
  // TODO: Phase 2 — visibility check
  // getMeetingBySlug() must silently return null for meetings the actor cannot
  // see (RESTRICTED/PRIVATE outside allowlist). Returning null here causes the
  // page to show the mock fallback, which is the correct "not found" experience
  // without leaking that a restricted record exists (no 403 vs 404 information
  // disclosure). Pass session.user to getMeetingBySlug() once the actor context
  // parameter is added.
  const dbMeeting = await getMeetingBySlug(slug);

  return (
    <div className="space-y-5">
      {dbMeeting ? (
        <MeetingGovernanceBanner meeting={dbMeeting} />
      ) : null}
      <VereinsleitungMeetingDetail dbMeeting={dbMeeting} />
    </div>
  );
}
