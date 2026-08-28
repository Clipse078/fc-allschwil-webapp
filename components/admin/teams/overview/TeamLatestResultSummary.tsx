import Link from "next/link";
import SportingTeamLogo from "@/components/shared/SportingTeamLogo";
import type { TeamCockpitResult } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import { formatResultDateLine } from "./team-overview-formatters";

type Props = {
  teamId: string;
  result: TeamCockpitResult | null;
  formatConfig: TenantFormatConfig;
};

const RESULT_LABELS = {
  WON: "Sieg",
  DRAW: "Unentschieden",
  LOST: "Niederlage",
  UNKNOWN: "",
} as const;

function formatScore(result: TeamCockpitResult): string {
  if (result.scoreHome == null || result.scoreAway == null) {
    return "–";
  }

  return `${result.scoreHome} : ${result.scoreAway}`;
}

export default function TeamLatestResultSummary({
  teamId,
  result,
  formatConfig,
}: Props) {
  const href = `/dashboard/teams/${teamId}/resultate`;
  const perspectiveLabel = result
    ? RESULT_LABELS[result.resultPerspective]
    : "";

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]/60"
      aria-label="Letztes Resultat — Details in Resultate"
      data-testid="team-latest-result-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Letztes Resultat
        </h3>
        <span className="text-xs font-medium text-[var(--blue)] group-hover:underline">
          Alle Resultate
        </span>
      </div>

      {result ? (
        <>
          <p
            className="text-2xl font-semibold tracking-tight text-[var(--foreground)]"
            data-testid="team-latest-result-score"
          >
            {formatScore(result)}
          </p>

          <div className="space-y-1">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)] items-center gap-1.5 text-sm text-[var(--text-2)]">
              <SportingTeamLogo logoUrl={result.home.logoUrl} size="sm" />
              <span className="truncate">{result.home.displayName}</span>
              <span>vs.</span>
              <SportingTeamLogo logoUrl={result.away.logoUrl} size="sm" />
              <span className="truncate">{result.away.displayName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-2)]">
              <span>{result.side === "HOME" ? "Heim" : "Auswärts"}</span>
              <span aria-hidden="true">·</span>
              <span>{formatResultDateLine(result.startAt, formatConfig)}</span>
              {perspectiveLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className="font-medium text-[var(--foreground)]"
                    data-testid="team-latest-result-perspective"
                  >
                    {perspectiveLabel}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]" data-testid="team-latest-result-empty">
          Keine Resultate vorhanden.
        </p>
      )}
    </Link>
  );
}
