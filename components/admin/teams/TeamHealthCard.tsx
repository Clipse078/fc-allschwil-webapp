"use client";

type BirthYearCount = {
  year: number;
  count: number;
};

type DiplomaCount = {
  label: string;
  count: number;
};

type Props = {
  seasonLabel: string;
  playerCount: number;
  trainerCount: number;
  birthYears: BirthYearCount[];
  diplomas: DiplomaCount[];
};

export default function TeamHealthCard({
  seasonLabel,
  playerCount,
  trainerCount,
  birthYears,
  diplomas,
}: Props) {
  const ratio = trainerCount > 0 ? `${Math.round(playerCount / trainerCount)}:1` : "-";

  return (
    <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="fca-eyebrow">Team Health</p>
            <p className="mt-1 text-sm font-black text-slate-900">Saison {seasonLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
              {playerCount} Spieler
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0b4aa2] shadow-sm">
              {trainerCount} Trainer
            </span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
              Verhältnis {ratio}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-400">Spieler nach Jahrgang</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {birthYears.length > 0 ? (
                birthYears.map((item) => (
                  <span key={item.year} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#0b4aa2] shadow-sm">
                    {item.year}: {item.count} Spieler
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
              {diplomas.length > 0 ? (
                diplomas.map((item) => (
                  <span key={item.label} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0b4aa2] shadow-sm">
                    {item.label}: {item.count}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm">
                  Keine Trainerlizenzen
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
