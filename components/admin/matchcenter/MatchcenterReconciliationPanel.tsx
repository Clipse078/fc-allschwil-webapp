import Link from "next/link";
import { CircleAlert } from "lucide-react";
import type { MatchcenterReconciliationRow } from "@/lib/matchcenter/view-model";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { formatReconciliationIssueLabel } from "@/lib/matchcenter/reconciliation-display";

type MatchcenterReconciliationPanelProps = {
  rows: readonly MatchcenterReconciliationRow[];
  locale: string;
  timezone: string;
};

function formatKickoff(
  value: Date,
  locale: string,
  timezone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

/**
 * Restrained administrative surface for fixtures classified as
 * NEEDS_RECONCILIATION. Never mixed into Spielplanung or Resultate.
 */
export default function MatchcenterReconciliationPanel({
  rows,
  locale,
  timezone,
}: MatchcenterReconciliationPanelProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <details
      className="rounded-lg border border-amber-200/80 bg-amber-50/60 text-sm text-amber-950"
      data-testid="matchcenter-reconciliation-panel"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <span className="font-medium">
          Datenprüfung erforderlich · {rows.length}
        </span>
      </summary>

      <div className="border-t border-amber-200/80 px-4 py-3">
        <p className="mb-3 text-xs text-amber-900/80">
          Diese Spiele erfordern eine manuelle Datenprüfung und erscheinen weder
          in Spielplanung noch in Resultate.
        </p>

        <ul className="space-y-2">
          {rows.map((row) => {
            const homeName = resolveMatchcenterCompactSideName(row.match.home);
            const awayName = resolveMatchcenterCompactSideName(row.match.away);
            const providerState =
              row.match.synchronization.providerMatchStateName?.trim() || null;

            return (
              <li
                key={row.match.id}
                className="rounded-md border border-amber-200/70 bg-white/70 px-3 py-2"
                data-testid={`matchcenter-reconciliation-row-${row.match.id}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">
                      {homeName} – {awayName}
                    </p>
                    <p className="text-xs text-[var(--text-2)]">
                      {formatKickoff(row.match.startAt, locale, timezone)}
                      {providerState ? ` · Provider: ${providerState}` : null}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/matchcenter/${row.match.id}`}
                    className="shrink-0 text-xs font-medium text-[var(--sce-primary)] hover:underline"
                  >
                    Details
                  </Link>
                </div>
                <p className="mt-1 text-xs text-amber-900/90">
                  {formatReconciliationIssueLabel(row.reconciliationIssue)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
