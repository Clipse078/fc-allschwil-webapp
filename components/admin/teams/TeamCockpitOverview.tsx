import {
  Building2,
  Calendar,
  Globe,
  Monitor,
  Shield,
  Trophy,
  Users,
  UserRound,
} from "lucide-react";
import type { TeamCockpitMetrics } from "@/lib/teams/team-cockpit-metrics";
import { SectionCard } from "@/components/ui/page";

type Props = {
  metrics: TeamCockpitMetrics;
};

type OverviewItemProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
};

function OverviewItem({ label, value, icon }: OverviewItemProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
      <div className="mt-0.5 text-[var(--muted)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-[var(--foreground)]">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * TEAM-COCKPIT-01: compact operational overview for the dedicated Team page.
 * TEAM-COCKPIT-04 can extend the wrapper with health-state styling via
 * `data-health-state` without restructuring this component.
 */
export default function TeamCockpitOverview({ metrics }: Props) {
  return (
    <SectionCard
      title="Team-Übersicht"
      description="Operative Kennzahlen der aktuellen Saison."
    >
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        data-health-state={metrics.healthState}
        data-testid="team-cockpit-overview"
      >
        <OverviewItem
          label="Spieler"
          value={String(metrics.playerCount)}
          icon={<Users className="h-4 w-4" />}
        />
        <OverviewItem
          label="Trainer & Staff"
          value={String(metrics.trainerCount)}
          icon={<UserRound className="h-4 w-4" />}
        />
        <OverviewItem
          label="Saison"
          value={metrics.seasonName ?? "Keine aktive Saison"}
          icon={<Calendar className="h-4 w-4" />}
        />
        <OverviewItem
          label="Wettbewerb"
          value={metrics.competitionLabel ?? "Kein Wettbewerb"}
          icon={<Trophy className="h-4 w-4" />}
        />
        <OverviewItem
          label="Kategorie"
          value={metrics.categoryLabel}
          icon={<Shield className="h-4 w-4" />}
        />
        <OverviewItem
          label="Organisationseinheit"
          value={metrics.orgUnitName ?? "Nicht verknüpft"}
          icon={<Building2 className="h-4 w-4" />}
        />
        <OverviewItem
          label="Website"
          value={metrics.websiteVisible ? "Sichtbar" : "Versteckt"}
          icon={<Globe className="h-4 w-4" />}
        />
        <OverviewItem
          label="Infoboard"
          value={metrics.infoboardVisible ? "Sichtbar" : "Versteckt"}
          icon={<Monitor className="h-4 w-4" />}
        />
      </div>
    </SectionCard>
  );
}
