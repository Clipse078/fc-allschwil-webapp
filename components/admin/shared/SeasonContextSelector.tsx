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
    <section className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {title}
          </p>
          <h3 className="mt-2 text-[1.15rem] font-semibold text-[var(--foreground)]">
            {selectedSeason?.name ?? "Keine Saison verfügbar"}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-2)]">{description}</p>
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
                    ? "fca-pill-year"
                    : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
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
