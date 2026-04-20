import Link from "next/link";
import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import VereinsleitungMeetingDetail from "@/components/admin/vereinsleitung/VereinsleitungMeetingDetail";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import { getMeetingDetailItem } from "@/lib/vereinsleitung/meeting-detail";

type VereinsleitungMeetingDetailPageProps = {
  params: Promise<{
    meetingId: string;
  }>;
};

export default async function VereinsleitungMeetingDetailPage({
  params,
}: VereinsleitungMeetingDetailPageProps) {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ);

  const resolvedParams = await params;
  const meeting = await getMeetingDetailItem(resolvedParams.meetingId);

  if (!meeting) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Meeting Detail"
        title={meeting.title}
        description="DB-basierte Meeting-Ansicht mit Pendenzen, Teilnehmern, Protokoll und vorbereitetem Beschlussbereich."
        actions={
          <Link href="/vereinsleitung/meetings" className="fca-button-secondary">
            Zurueck zur Uebersicht
          </Link>
        }
      />

      <VereinsleitungMeetingDetail meeting={meeting} />
    </div>
  );
}
