import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import VereinsleitungDecisionsCard from "@/components/admin/vereinsleitung/VereinsleitungDecisionsCard";
import VereinsleitungGoalsCard from "@/components/admin/vereinsleitung/VereinsleitungGoalsCard";
import VereinsleitungInitiativesCard from "@/components/admin/vereinsleitung/VereinsleitungInitiativesCard";
import VereinsleitungKpiCard from "@/components/admin/vereinsleitung/VereinsleitungKpiCard";
import VereinsleitungMeetingsCard from "@/components/admin/vereinsleitung/VereinsleitungMeetingsCard";
import VereinsleitungTasksCard from "@/components/admin/vereinsleitung/VereinsleitungTasksCard";
import {
  formatMeetingListDateLabel,
  formatMeetingTimeLabel,
} from "@/lib/vereinsleitung/meeting-utils";

const QUICK_LINKS = [
  {
    title: "Cockpit",
    description: "KPIs und Pendenzen zentral steuern",
    href: "/vereinsleitung/cockpit",
  },
  {
    title: "Meetings",
    description: "Sitzungen und spätere Pendenzen-Übernahme",
    href: "/vereinsleitung/meetings",
  },
  {
    title: "Initiativen",
    description: "Roadmap, Timeline und strategische Themen",
    href: "/vereinsleitung/initiativen",
  },
] as const;

function getOwnerName(owner: {
  firstName: string;
  lastName: string;
  displayName: string | null;
} | null) {
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
  const [matters, meetings, activeTeamsCount, activeTrainerCount, activePeopleCount] =
    await Promise.all([
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
      prisma.team.count({
        where: {
          isActive: true,
        },
      }),
      prisma.person.count({
        where: {
          isActive: true,
          isTrainer: true,
        },
      }),
      prisma.person.count({
        where: {
          isActive: true,
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

  const openMattersCount = matters.filter((matter) => matter.status !== "DONE").length;

  const kpiItems = [
    {
      label: "Aktive Personen",
      value: String(activePeopleCount),
      delta: "Live",
      note: "aktive Personen im System",
      trend: "neutral" as const,
    },
    {
      label: "Aktive Teams",
      value: String(activeTeamsCount),
      delta: "Live",
      note: "aktive Teams im System",
      trend: "neutral" as const,
    },
    {
      label: "Trainer & Betreuer",
      value: String(activeTrainerCount),
      delta: "Live",
      note: "aktive Trainerprofile",
      trend: "neutral" as const,
    },
    {
      label: "Offene Pendenzen",
      value: String(openMattersCount),
      delta: "Live",
      note: "nicht erledigte Pendenzen",
      trend: openMattersCount > 0 ? ("up" as const) : ("neutral" as const),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="fca-eyebrow">Vereinsleitung</p>
            <h2 className="mt-2 text-[1.6rem] font-semibold tracking-[-0.02em] text-slate-900">
              Strategische Übersicht
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Übersicht für Ziele, KPI, Pendenzen, Meetings und Initiativen.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-3">
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:-translate-y-[1px] hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
            >
              <div className="text-sm font-semibold text-[#0b4aa2]">{item.title}</div>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <VereinsleitungGoalsCard />
        <VereinsleitungKpiCard items={kpiItems} />
      </section>

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
