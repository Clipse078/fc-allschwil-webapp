import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import TrainingSessionBlocksPanel from "@/components/admin/training/TrainingSessionBlocksPanel";

type Props = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  seasonKey: string;
};

async function getNextTraining(teamId: string, seasonId: string) {
  return prisma.event.findFirst({
    where: {
      teamId,
      seasonId,
      type: "TRAINING",
      status: { in: ["SCHEDULED", "LIVE"] },
      startAt: { gt: new Date() },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      startAt: true,
      location: true,
      trainingFocus: true,
    },
  });
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

export default async function TeamTrainingGuidancePanel({
  teamId,
  teamName,
  seasonId,
  seasonName,
  seasonKey,
}: Props) {
  const nextTraining = await getNextTraining(teamId, seasonId);

  const plannerHref = nextTraining
    ? `/dashboard/planner/edit/${nextTraining.id}?season=${encodeURIComponent(seasonKey)}&type=TRAINING`
    : `/dashboard/planner/new?season=${encodeURIComponent(seasonKey)}&type=TRAINING`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Trainingsplanung · {seasonName}
          </p>
        </div>
        <Link
          href={plannerHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {nextTraining ? "Nächstes Training" : "Training planen"}
        </Link>
      </div>

      {nextTraining && (
        <div className="rounded-[18px] border border-slate-200/80 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Nächstes Training
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {nextTraining.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDate(nextTraining.startAt)}
                {nextTraining.location ? ` · ${nextTraining.location}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {nextTraining.trainingFocus ? (
                <span className="rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2]">
                  {nextTraining.trainingFocus}
                </span>
              ) : (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                  Kein Schwerpunkt
                </span>
              )}
              <Link
                href={`/dashboard/planner/edit/${nextTraining.id}?season=${encodeURIComponent(seasonKey)}&type=TRAINING`}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Bearbeiten
              </Link>
            </div>
          </div>
        </div>
      )}

      <TrainingSessionBlocksPanel
        seasonId={seasonId}
        teamId={teamId}
        teamName={teamName}
      />
    </div>
  );
}
