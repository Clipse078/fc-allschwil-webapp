import { prisma } from "@/lib/db/prisma";
import VereinsleitungKpisPage from "@/components/admin/vereinsleitung/VereinsleitungKpisPage";
import TrainingSessionBlocksPanel from "@/components/admin/training/TrainingSessionBlocksPanel";

async function getActiveSeason() {
  return prisma.season.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { startDate: "desc" },
  });
}

export default async function VereinsleitungKpisRoutePage() {
  const activeSeason = await getActiveSeason();

  return (
    <div className="space-y-5">
      <VereinsleitungKpisPage />

      {activeSeason && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Trainingsblöcke vs. Strategie-Ziele · {activeSeason.name}
          </p>
          <TrainingSessionBlocksPanel seasonId={activeSeason.id} />
        </div>
      )}
    </div>
  );
}
