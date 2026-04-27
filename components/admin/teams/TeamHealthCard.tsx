"use client";

type BirthYearCount = {
  year: number;
  count: number;
};

type DiplomaCount = {
  label: string;
  count: number;
};

type DiplomaRequirement = "D-Diplom" | "C-Diplom" | "B-Diplom" | null;

type Props = {
  seasonLabel: string;
  playerCount: number;
  trainerCount: number;
  birthYears: BirthYearCount[];
  diplomas: DiplomaCount[];
  diplomaRequirement?: DiplomaRequirement;
  maxPlayersPerTrainer?: number;
  hasHealthyPlayerTrainerRatio?: boolean;
};

function getRatioLabel(playerCount: number, trainerCount: number) {
  if (trainerCount <= 0) return "-";
  const ratio = Math.round((playerCount / trainerCount) * 10) / 10;
  return `${ratio}:1`;
}

function getRatioClass(playerCount: number, trainerCount: number, maxPlayersPerTrainer?: number, hasHealthy?: boolean) {
  if (trainerCount <= 0) return "border-slate-200 bg-slate-50 text-slate-500";

  if (typeof maxPlayersPerTrainer === "number") {
    if (hasHealthy) return "border-emerald-100 bg-emerald-50 text-emerald-700";
    return "border-red-100 bg-red-50 text-red-700";
  }

  const ratio = playerCount / trainerCount;
  if (ratio <= 6) return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (ratio <= 10) return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-red-100 bg-red-50 text-red-700";
}

function diplomaMatchesRequirement(label: string, requirement: DiplomaRequirement) {
  if (!requirement) return true;

  const normalized = label.toUpperCase();

  if (requirement === "D-Diplom") {
    return normalized.includes("D-DIPLOM") || normalized.includes("SFV D") || normalized.includes("KINDERFUSSBALL");
  }

  if (requirement === "C-Diplom") {
    return normalized.includes("C-DIPLOM") || normalized.includes("UEFA C");
  }

  if (requirement === "B-Diplom") {
    return normalized.includes("B-DIPLOM") || normalized.includes("UEFA B");
  }

  return false;
}

function diplomaPriority(label: string) {
  const normalized = label.toUpperCase();

  if (normalized.includes("A-DIPLOM") || normalized.includes("UEFA A")) return 1;
  if (normalized.includes("B-DIPLOM") || normalized.includes("UEFA B")) return 2;
  if (normalized.includes("C-DIPLOM") || normalized.includes("UEFA C")) return 3;
  if (normalized.includes("D-DIPLOM") || normalized.includes("SFV D")) return 4;
  if (normalized.includes("KINDERFUSSBALL")) return 5;

  return 99;
}

export default function TeamHealthCard({
  seasonLabel,
  playerCount,
  trainerCount,
  birthYears,
  diplomas,
  diplomaRequirement = null,
  maxPlayersPerTrainer,
  hasHealthyPlayerTrainerRatio,
}: Props) {
  const ratioLabel = getRatioLabel(playerCount, trainerCount);
  const ratioClass = getRatioClass(playerCount, trainerCount, maxPlayersPerTrainer, hasHealthyPlayerTrainerRatio);
  const sortedDiplomas = [...diplomas].sort((a, b) => diplomaPriority(a.label) - diplomaPriority(b.label) || a.label.localeCompare(b.label));
  const requirementMet = diplomaRequirement ? sortedDiplomas.some((item) => diplomaMatchesRequirement(item.label, diplomaRequirement)) : null;
  const requirementClass =
    requirementMet === null
      ? "border-slate-200 bg-slate-50 text-slate-500"
      : requirementMet
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : "border-amber-100 bg-amber-50 text-amber-700";

  return (
    <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="fca-eyebrow">Team Übersicht</p>
            <p className="mt-1 text-sm font-black text-slate-900">Saison {seasonLabel}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Total: {playerCount} Spieler · {trainerCount} Trainer
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
              {playerCount} Spieler
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0b4aa2] shadow-sm">
              {trainerCount} Trainer
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${ratioClass}`}>
              Verhältnis {ratioLabel} {maxPlayersPerTrainer ? `· Soll ≤ ${maxPlayersPerTrainer}` : ""}
            </span>
            {diplomaRequirement ? (
              <span className={`rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${requirementClass}`}>
                {requirementMet ? "Diplom erfüllt" : "Diplom fehlt"} · Soll: {diplomaRequirement}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-400">Spieler nach Jahrgang</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {birthYears.length > 0 ? (
                birthYears.map((item) => (
                  <span key={item.year} className="inline-flex flex-col rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs shadow-sm">
                    <span className="font-black text-[#0b4aa2]">{item.year}</span>
                    <span className="font-bold text-slate-500">{item.count} Spieler</span>
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  Keine Jahrgangsdaten
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-400">Trainerlizenzen</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sortedDiplomas.length > 0 ? (
                sortedDiplomas.map((item) => (
                  <span key={item.label} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0b4aa2] shadow-sm">
                    🎓 {item.label}: {item.count}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  Keine Diplome erfasst
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





