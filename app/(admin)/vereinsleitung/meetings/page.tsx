import Link from "next/link";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import {
  formatMeetingListDateLabel,
  formatMeetingTimeLabel,
  type MeetingListItem,
} from "@/lib/vereinsleitung/meeting-utils";

export default async function VereinsleitungMeetingsPage() {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_MEETINGS_READ);

  const meetings = await prisma.vereinsleitungMeeting.findMany({
    orderBy: [{ startAt: "desc" }, { createdAt: "desc" }],
    include: {
      matterLinks: {
        include: {
          matter: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  const meetingItems: MeetingListItem[] = meetings.map((meeting) => {
    const openMatterCount = meeting.matterLinks.filter(
      (link) => link.matter.status !== "DONE",
    ).length;

    return {
      id: meeting.id,
      slug: meeting.slug,
      title: meeting.title,
      subtitle: meeting.subtitle,
      status: meeting.status,
      dateLabel: formatMeetingListDateLabel(meeting.startAt),
      timeLabel: formatMeetingTimeLabel(meeting.startAt, meeting.endAt),
      location: meeting.location,
      linkedMatterCount: meeting.matterLinks.length,
      openMatterCount,
    };
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Meetings"
        title="Meetings"
        description="Übersicht aller Sitzungen mit verknüpften Pendenzen – absteigend vom neuesten zum ältesten Eintrag."
        actions={
          <Link href="/vereinsleitung/meetings/new" className="fca-button-primary">
            Meeting planen
          </Link>
        }
      />

      <VereinsleitungMeetingsList meetings={meetingItems} />
    </div>
  );
}
