import {
  Building2,
  Calendar,
  Shield,
  Trophy,
  Users,
  UserRound,
} from "lucide-react";
import type { TeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";

type Props = {
  metrics: TeamCockpitMetrics;
};

type OverviewItemProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  prominent?: boolean;
};

function OverviewItem({ label, value, icon, prominent = true }: OverviewItemProps) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] px-3.5 py-3 ${
        prominent ? "bg-[var(--surface)]" : "bg-[var(--surface-2)]/60"
      }`}
    >
      <div className="mt-0.5 text-[var(--muted)]">{icon}</div>
      <div className="min-w-0">
        <p
          className={`font-medium text-[var(--muted)] ${
            prominent ? "text-[11px] uppercase tracking-[0.04em]" : "text-xs"
          }`}
        >
          {label}
        </p>
        <p
          className={`mt-0.5 truncate text-[var(--foreground)] ${
            prominent ? "text-sm font-semibold" : "text-sm"
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * TEAM-COCKPIT-01D: compact operational overview — primary metrics first,
 * classification metadata secondary.
 */
export default function TeamCockpitOverview({ metrics }: Props) {
  return (
    <div
      className="space-y-3"
      data-health-state={metrics.healthState}
      data-testid="team-cockpit-overview"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewItem
          label="Spieler"
          value={String(metrics.playerCount)}
          icon={<Users className="h-4 w-4" />}
        />
        <OverviewItem
          label="Trainer"
          value={String(metrics.trainerCount)}
          icon={<UserRound className="h-4 w-4" />}
        />
        <OverviewItem
          label="Saison"
          value={metrics.seasonLabel}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OverviewItem
          label="Wettbewerb"
          value={metrics.competitionLabel ?? "Kein Wettbewerb"}
          icon={<Trophy className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <OverviewItem
          label="Kategorie"
          value={metrics.categoryLabel}
          icon={<Shield className="h-4 w-4" />}
          prominent={false}
        />
        <OverviewItem
          label="Organisationseinheit"
          value={metrics.orgUnitName ?? "Nicht verknüpft"}
          icon={<Building2 className="h-4 w-4" />}
          prominent={false}
        />
      </div>
    </div>
  );
}
