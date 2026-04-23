import VereinsleitungMeetingsList from "@/components/admin/vereinsleitung/VereinsleitungMeetingsList";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";
import {
  formatMeetingListDateLabel,
  formatMeetingTimeLabel,
  getMeetingApprovalStatusLabel,
  getMeetingStatusLabel,
  isMeetingApprovalLocked,
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
      statusLabel: getMeetingStatusLabel(meeting.status),
      approvalStatus: meeting.approvalStatus,
      approvalStatusLabel: getMeetingApprovalStatusLabel(meeting.approvalStatus),
      isApprovalLocked: isMeetingApprovalLocked(meeting.approvalStatus),
      dateLabel: formatMeetingListDateLabel(meeting.startAt),
      timeLabel: formatMeetingTimeLabel(meeting.startAt, meeting.endAt),
      location: meeting.location,
      linkedMatterCount: meeting.matterLinks.length,
      openMatterCount,
    };
  });

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
        <p className="text-sm font-medium text-slate-500">
          Alle Sitzungen zentral verwalten, öffnen und weiterbearbeiten.
        </p>
      </section>

      <VereinsleitungMeetingsList meetings={meetingItems} />
    </div>
  );
}