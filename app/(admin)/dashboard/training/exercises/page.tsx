import Link from "next/link";
import { ExerciseSport } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  EXERCISE_SPORT_LABELS,
  EXERCISE_CATALOG,
} from "@/lib/training/exercise-catalog";
import { getClubExercises } from "@/lib/training/exercise-queries";
import ExerciseCatalogPanel from "@/components/admin/training/ExerciseCatalogPanel";
import ClubExercisesPanel from "@/components/admin/training/ClubExercisesPanel";

type PageProps = {
  searchParams?: Promise<{ sport?: string }>;
};

async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { startDate: "desc" },
  });
}

const ALL_SPORTS = Object.values(ExerciseSport) as ExerciseSport[];

export default async function ExercisesPage({ searchParams }: PageProps) {
  await requireAnyPermission([
    PERMISSIONS.SEASONS_VIEW,
    PERMISSIONS.SEASONS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
  ]);

  const params = (await searchParams) ?? {};
  const sportParam = params.sport?.toUpperCase();
  const sportFilter =
    sportParam && ALL_SPORTS.includes(sportParam as ExerciseSport)
      ? (sportParam as ExerciseSport)
      : null;

  const [activeSeason, allImported] = await Promise.all([
    getActiveSeason(),
    getClubExercises({ seasonId: null }),
  ]);

  const importedTemplateIds = new Set(
    allImported.map((e) => e.templateId).filter(Boolean) as string[],
  );

  const catalogCount = EXERCISE_CATALOG.length;

  return (
    <div className="space-y-7">
      <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur-xl lg:p-7">
        <p className="fca-eyebrow">Training</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2] lg:text-[2.35rem]">
          Übungsdatenbank
        </h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          {catalogCount} kuratierte Übungen für Amateurvereine. Importiere Übungen in deine
          Vereinsbibliothek und passe sie nach Bedarf an.
        </p>
        {activeSeason && (
          <p className="mt-2 text-xs font-semibold text-slate-400">
            Aktive Saison: {activeSeason.name}
          </p>
        )}
      </section>

      {/* Sport filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/training/exercises"
          className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
            !sportFilter
              ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          Alle Sportarten
        </Link>
        {ALL_SPORTS.map((sport) => {
          const count = EXERCISE_CATALOG.filter((e) => e.sport === sport).length;
          if (count === 0) return null;
          return (
            <Link
              key={sport}
              href={`/dashboard/training/exercises?sport=${sport.toLowerCase()}`}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
                sportFilter === sport
                  ? "border-[#0b4aa2] bg-[#0b4aa2] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {EXERCISE_SPORT_LABELS[sport]}
              <span className="ml-1.5 opacity-60">({count})</span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        <ExerciseCatalogPanel
          seasonId={activeSeason?.id}
          importedTemplateIds={importedTemplateIds}
          sportFilter={sportFilter}
        />

        <ClubExercisesPanel
          exercises={
            sportFilter
              ? allImported.filter((e) => e.sport === sportFilter)
              : allImported
          }
        />
      </div>
    </div>
  );
}
