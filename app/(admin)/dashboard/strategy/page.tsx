import Link from "next/link";
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

export default async function StrategyPage() {
  await requireAnyPermission([
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
  ]);

  const activeSeason = await getActiveSeason();

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
