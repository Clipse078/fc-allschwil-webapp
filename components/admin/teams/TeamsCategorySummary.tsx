type CategoryStat = {
  label: string;
  count: number;
  accentClass: string;
  dotClass: string;
};

type TeamsCategorySummaryProps = {
  categories: CategoryStat[];
  totalTeams: number;
  activeTeams: number;
};

export default function TeamsCategorySummary({
  categories,
  totalTeams,
  activeTeams,
}: TeamsCategorySummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {/* Total KPI */}
      <div className="sce-kpi-card sm:col-span-2 xl:col-span-1">
        <p className="sce-data-label">Teams gesamt</p>
        <p className="mt-1.5 text-3xl font-bold text-[var(--foreground)]">
          {totalTeams}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {activeTeams} aktiv · {totalTeams - activeTeams} inaktiv
        </p>
      </div>

      {/* Category pills */}
      {categories.map((cat) => (
        <div
          key={cat.label}
          className={`flex items-center gap-4 rounded-[var(--radius-xl)] border p-4 ${cat.accentClass}`}
        >
          <span className={`h-3 w-3 flex-shrink-0 rounded-full ${cat.dotClass}`} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--text-2)]">
              {cat.label}
            </p>
          </div>
          <span className="text-lg font-bold text-[var(--foreground)]">
            {cat.count}
          </span>
        </div>
      ))}
    </div>
  );
}
