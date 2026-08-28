import Link from "next/link";
import type { TeamCockpitMatch } from "@/lib/teams/team-cockpit-sporting-data";
import type { TenantFormatConfig } from "@/lib/tenant-runtime/formatters";
import { formatMatchDateLine } from "./team-overview-formatters";

type Props = {
  teamId: string;
  match: TeamCockpitMatch | null;
  formatConfig: TenantFormatConfig;
};

export default function TeamNextMatchSummary({
  teamId,
  match,
  formatConfig,
}: Props) {
  const href = `/dashboard/teams/${teamId}/spiele`;

  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]/60"
      aria-label="Nächstes Spiel — Details in Nächste Spiele"
      data-testid="team-next-match-summary"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">
          Nächstes Spiel
        </h3>
        <span className="text-xs font-medium text-[var(--blue)] group-hover:underline">
          Alle Spiele
        </span>
      </div>

      {match ? (
        <>
          <p className="text-sm text-[var(--text-2)]">
            {formatMatchDateLine(match.startAt, formatConfig)}
          </p>

          <div className="space-y-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {match.home.displayName}
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              vs.
            </p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {match.away.displayName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-2)]">
            <span>{match.side === "HOME" ? "Heim" : "Auswärts"}</span>
            {match.venueName || match.location ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{match.venueName ?? match.location}</span>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--muted)]" data-testid="team-next-match-empty">
          Kein nächstes Spiel geplant.
        </p>
      )}
    </Link>
  );
}
