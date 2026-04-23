import { prisma } from "@/lib/db/prisma";
import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";
import {
  formatMeetingListDateLabel,
  formatMeetingTimeLabel,
} from "@/lib/vereinsleitung/meeting-utils";

function getOwnerName(
  owner: {
    firstName: string;
    lastName: string;
    displayName: string | null;
  } | null,
) {
  if (!owner) {
    return null;
  }

  return owner.displayName ?? [owner.firstName, owner.lastName].filter(Boolean).join(" ");
}

function getInitials(value: string | null) {
  if (!value) {
    return "--";
  }

  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "--";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function formatDueLabel(value: Date | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "short",
  }).format(value);
}

export default async function VereinsleitungDashboard() {
  const [matters, meetings] = await Promise.all([
    prisma.vereinsleitungMatter.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.vereinsleitungMeeting.findMany({
      orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
      take: 4,
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
    }),
  ]);

  const matterCards = matters.map((matter) => {
    const ownerName = getOwnerName(matter.owner);

    return {
      id: matter.id,
      title: matter.title,
      ownerName,
      ownerInitials: getInitials(ownerName),
      dueLabel: formatDueLabel(matter.dueDate),
      priority: matter.priority as "LOW" | "MEDIUM" | "HIGH",
      status: matter.status as "OPEN" | "IN_PROGRESS" | "DONE",
    };
  });

  const meetingCards = meetings.map((meeting) => {
    const openMatterCount = meeting.matterLinks.filter(
      (link) => link.matter.status !== "DONE",
    ).length;

    return {
      id: meeting.id,
      slug: meeting.slug,
      title: meeting.title,
      status: meeting.status,
      dateLabel: formatMeetingListDateLabel(meeting.startAt),
      timeLabel: formatMeetingTimeLabel(meeting.startAt, meeting.endAt),
      linkedMatterCount: meeting.matterLinks.length,
      openMatterCount,
    };
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungInitiativesCard />
        <VereinsleitungMeetingsCard meetings={meetingCards} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungTasksCard matters={matterCards} />
        <VereinsleitungDecisionsCard />
      </section>
    </div>
  );
}