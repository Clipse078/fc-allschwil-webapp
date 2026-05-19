import Link from "next/link";
import { Link2, ExternalLink } from "lucide-react";
import { resolveTargetCrossLinks } from "@/lib/linking/helpers";

type TargetLinksPanelProps = {
  targetId: string;
  linkedInitiativeRefsRaw: unknown;
  linkedMeetingRefsRaw: unknown;
};

export default function TargetLinksPanel({
  targetId,
  linkedInitiativeRefsRaw,
  linkedMeetingRefsRaw,
}: TargetLinksPanelProps) {
  const { initiativeRefs, meetingRefs } = resolveTargetCrossLinks(
    linkedInitiativeRefsRaw,
    linkedMeetingRefsRaw,
  );

  const totalLinks = initiativeRefs.length + meetingRefs.length;

  return (
    <section className="sce-page-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[var(--sce-subtle)]" />
          <h3 className="sce-kicker">
            Verknüpfungen
          </h3>
        </div>
        {totalLinks > 0 ? (
          <span className="sce-chip px-2 py-0.5 text-[10px]">
            {totalLinks}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <p className="sce-kicker mb-2">
            Initiativen
          </p>
          {initiativeRefs.length === 0 ? (
            <p className="text-[12px] italic text-[var(--sce-subtle)]">
              Keine Initiativen verknüpft.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {initiativeRefs.map((ref) => (
                <li key={ref.slug}>
                  <Link
                    href={ref.url ?? `/vereinsleitung/initiativen/${ref.slug}`}
                    className="flex items-center gap-2 rounded-[12px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--sce-foreground)] transition hover:border-[var(--sce-border-strong)] hover:text-[var(--sce-primary-strong)]"
                  >
                    <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-[var(--sce-subtle)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="sce-kicker mb-2">
            Meetings
          </p>
          {meetingRefs.length === 0 ? (
            <p className="text-[12px] italic text-[var(--sce-subtle)]">
              Keine Meetings verknüpft.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {meetingRefs.map((ref) => (
                <li key={ref.slug}>
                  <Link
                    href={ref.url ?? `/vereinsleitung/meetings/${ref.slug}`}
                    className="flex items-center gap-2 rounded-[12px] border border-[var(--sce-border)] bg-[var(--sce-surface-muted)] px-3 py-2 text-[12px] font-medium text-[var(--sce-foreground)] transition hover:border-[var(--sce-border-strong)] hover:text-[var(--sce-primary-strong)]"
                  >
                    <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-[var(--sce-subtle)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[var(--sce-border)] pt-3">
        <Link
          href={`/vereinsleitung/targets/${targetId}/edit#links`}
          className="text-[11px] font-medium text-[var(--sce-primary-strong)] hover:underline"
        >
          Verknüpfungen bearbeiten →
        </Link>
      </div>
    </section>
  );
}
