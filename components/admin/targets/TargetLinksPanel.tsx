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
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-slate-400" />
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Verknüpfungen
          </h3>
        </div>
        {totalLinks > 0 ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {totalLinks}
          </span>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Initiativen
          </p>
          {initiativeRefs.length === 0 ? (
            <p className="text-[12px] text-slate-400 italic">
              Keine Initiativen verknüpft.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {initiativeRefs.map((ref) => (
                <li key={ref.slug}>
                  <Link
                    href={ref.url ?? `/initiatives/${ref.slug}`}
                    className="flex items-center gap-2 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-800 transition hover:border-slate-200 hover:bg-white hover:text-[#0b4aa2]"
                  >
                    <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
            Meetings
          </p>
          {meetingRefs.length === 0 ? (
            <p className="text-[12px] text-slate-400 italic">
              Keine Meetings verknüpft.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {meetingRefs.map((ref) => (
                <li key={ref.slug}>
                  <Link
                    href={ref.url ?? `/meetings/${ref.slug}`}
                    className="flex items-center gap-2 rounded-[12px] border border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-800 transition hover:border-slate-200 hover:bg-white hover:text-[#0b4aa2]"
                  >
                    <span className="min-w-0 flex-1 truncate">{ref.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <Link
          href={`/targets/${targetId}/edit#links`}
          className="text-[11px] font-medium text-[#0b4aa2] hover:underline"
        >
          Verknüpfungen bearbeiten →
        </Link>
      </div>
    </section>
  );
}
