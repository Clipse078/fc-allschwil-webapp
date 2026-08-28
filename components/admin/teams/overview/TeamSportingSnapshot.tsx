import type {
  TeamCockpitMatch,
  TeamCockpitResult,
  TeamCockpitStandings,
} from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import TeamNextMatchSummary from "./TeamNextMatchSummary";
import TeamLatestResultSummary from "./TeamLatestResultSummary";
import TeamStandingsSummary from "./TeamStandingsSummary";

type Props = {
  teamId: string;
  nextMatch: TeamCockpitMatch | null;
  latestResult: TeamCockpitResult | null;
  standings: TeamCockpitStandings | null;
  formatConfig: TenantFormatConfig;
};

export default function TeamSportingSnapshot({
  teamId,
  nextMatch,
  latestResult,
  standings,
  formatConfig,
}: Props) {
  return (
    <section
      aria-label="Sportlicher Überblick"
      data-testid="team-sporting-snapshot"
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"
    >
      <div className="grid divide-y divide-[var(--border)] md:grid-cols-3 md:divide-x md:divide-y-0">
        <TeamNextMatchSummary
          teamId={teamId}
          match={nextMatch}
          formatConfig={formatConfig}
        />
        <TeamLatestResultSummary
          teamId={teamId}
          result={latestResult}
          formatConfig={formatConfig}
        />
        <TeamStandingsSummary teamId={teamId} standings={standings} />
      </div>
    </section>
  );
}
