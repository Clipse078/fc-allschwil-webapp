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
