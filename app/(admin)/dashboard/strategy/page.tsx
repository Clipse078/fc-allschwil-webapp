import Link from "next/link";
import { Lightbulb, Target } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import ClubGoalsPanel from "@/components/admin/strategy/ClubGoalsPanel";
import TrendCardsPanel from "@/components/admin/strategy/TrendCardsPanel";
import TrainingSessionBlocksPanel from "@/components/admin/training/TrainingSessionBlocksPanel";

async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { startDate: "desc" },
  });
}

async function getUntaggedTrainingCount(seasonId: string) {
  return prisma.event.count({
    where: { seasonId, type: "TRAINING", trainingFocus: null },
  });
}

async function getStrategyTargetCount(seasonId: string) {
  return prisma.strategyTarget.count({ where: { seasonId } });
}

export default async function StrategyPage() {
  await requireAnyPermission([
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
  ]);

  const activeSeason = await getActiveSeason();
  const [untaggedCount, targetCount] = activeSeason
    ? await Promise.all([
        getUntaggedTrainingCount(activeSeason.id),
        getStrategyTargetCount(activeSeason.id),
      ])
    : [0, 0];

  return (
    <div className="space-y-7">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Vereinsleitung</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Strategie-Dashboard
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Strategieziele pro Modul definieren, empfohlene Vereinsziele importieren und
          den Abgleich mit der Trainingsplanung verfolgen.
        </p>
        {activeSeason && (
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Aktive Saison: {activeSeason.name}
          </p>
        )}
      </section>

      {!activeSeason ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">
            Keine aktive Saison gefunden.{" "}
            <Link href="/dashboard/seasons" className="font-semibold text-[#0b4aa2] underline">
              Saison aktivieren
            </Link>
          </p>
        </div>
      ) : (
        <>
          {targetCount === 0 && (
            <div className="flex items-start gap-3 rounded-[20px] border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-5 py-4">
              <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4aa2]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0b4aa2]">
                  Strategie-Ziele aktivieren
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Noch keine Ziel-Prozentwerte für diese Saison hinterlegt. Importiere empfohlene Trainingsplanungsziele um das KPI-Tracking zu starten.
                </p>
                <a
                  href="#katalog"
                  className="mt-2 inline-block text-[12px] font-semibold text-[#0b4aa2] underline hover:text-[#08357a]"
                >
                  Empfohlene Ziele ansehen ↓
                </a>
              </div>
            </div>
          )}

          {untaggedCount > 0 && (
            <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 px-5 py-4">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-sm text-amber-900">
                <span className="font-semibold">
                  {untaggedCount} Training{untaggedCount !== 1 ? "s" : ""} ohne Schwerpunkt
                </span>{" "}
                in dieser Saison.{" "}
                <Link
                  href="/dashboard/training/bulk-tag"
                  className="font-semibold underline hover:text-amber-950"
                >
                  Jetzt taggen
                </Link>{" "}
                um die KPI-Genauigkeit zu verbessern.
              </p>
            </div>
          )}

          <TrendCardsPanel seasonId={activeSeason.id} />

          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
            <div className="space-y-7">
              <ClubGoalsPanel
                seasonId={activeSeason.id}
                seasonName={activeSeason.name}
              />
            </div>

            <div className="space-y-5">
              <TrainingSessionBlocksPanel seasonId={activeSeason.id} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
