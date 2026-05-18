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

  // Try to find in DB. If not found (e.g. still using a legacy mock slug),
  // the existing mock detail renders unchanged — zero regression.
  const dbMeeting = await getMeetingBySlug(slug);

  return (
    <div className="space-y-5">
      {dbMeeting ? (
        <MeetingGovernanceBanner meeting={dbMeeting} />
      ) : null}
      <VereinsleitungMeetingDetail slug={slug} />
    </div>
  );
}
