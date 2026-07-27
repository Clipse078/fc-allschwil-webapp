import { Globe, Monitor, CheckCircle2, Archive, CalendarDays } from "lucide-react";

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
  teamsInSeason: number;
  websiteVisible: number;
  infoboardVisible: number;
};

type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  accent?: string;
};

function MetricCard({ icon, label, value, note, accent = "text-[var(--foreground)]" }: MetricCardProps) {
  return (
    <div className="sce-kpi-card flex flex-col gap-1.5 p-4">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p
        className={`text-2xl font-bold ${accent}`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </p>
      {note && (
        <p className="text-xs text-[var(--muted)]">{note}</p>
      )}
    </div>
  );
}

export default function TeamsCategorySummary({
  categories,
  totalTeams,
  activeTeams,
  teamsInSeason,
  websiteVisible,
  infoboardVisible,
}: TeamsCategorySummaryProps) {
  const archivedTeams = totalTeams - activeTeams;

  return (
    <div className="space-y-4">
      {/* Operational metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          label="In Saison"
          value={teamsInSeason}
          note={`von ${totalTeams} Teams`}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="Aktiv"
          value={activeTeams}
          accent="text-emerald-700"
        />
        <MetricCard
          icon={<Archive className="h-4 w-4" aria-hidden="true" />}
          label="Inaktiv"
          value={archivedTeams}
          accent={archivedTeams > 0 ? "text-[var(--muted)]" : "text-[var(--foreground)]"}
        />
        <MetricCard
          icon={<Globe className="h-4 w-4" aria-hidden="true" />}
          label="Website sichtbar"
          value={websiteVisible}
        />
        <MetricCard
          icon={<Monitor className="h-4 w-4" aria-hidden="true" />}
          label="Infoboard sichtbar"
          value={infoboardVisible}
        />
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => (
            <div
              key={cat.label}
              className={`flex items-center gap-3 rounded-xl border p-3 ${cat.accentClass}`}
            >
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${cat.dotClass}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--text-2)]">
                  {cat.label}
                </p>
              </div>
              <span
                className="text-base font-bold text-[var(--foreground)]"
                style={{ fontFamily: "var(--font-display)" }}
                aria-label={`${cat.count} Teams`}
              >
                {cat.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
