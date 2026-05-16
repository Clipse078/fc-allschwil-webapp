import Link from "next/link";

type SeasonOption = {
  key: string;
  name: string;
  isActive?: boolean;
};

type SeasonContextSelectorProps = {
  title?: string;
  description?: string;
  seasons: SeasonOption[];
  selectedSeasonKey?: string;
  basePath: string;
};

export default function SeasonContextSelector({
  title = "Aktive Saison",
  description = "Die Saison wird als führender Kontext für diese Seite verwendet.",
  seasons,
  selectedSeasonKey,
  basePath,
}: SeasonContextSelectorProps) {
  const selectedSeason =
    seasons.find((season) => season.key === selectedSeasonKey) ??
    seasons.find((season) => season.isActive) ??
    seasons[0] ??
    null;

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <h3 className="mt-2 text-[1.15rem] font-semibold text-slate-900">
            {selectedSeason?.name ?? "Keine Saison verfügbar"}
          </h3>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {seasons.map((season) => {
            const isSelected = season.key === selectedSeason?.key;

            return (
              <Link
                key={season.key}
                href={`${basePath}?season=${encodeURIComponent(season.key)}`}
                className={
                  isSelected
                    ? "rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-[#0b4aa2]"
                    : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                }
              >
                {season.name}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
