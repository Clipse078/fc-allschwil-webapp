import Link from "next/link";
import { CheckCircle2, Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import type { TeamGuidanceKind, TeamGuidanceSummary } from "@/lib/training/team-guidance";

type TeamRow = {
  id: string;
  name: string;
  category: string;
};

type Props = {
  teams: TeamRow[];
  summaries: Map<string, TeamGuidanceSummary>;
  seasonKey: string;
};

const KIND_STYLES: Record<TeamGuidanceKind, string> = {
  BELOW_TARGET: "border-rose-200 bg-rose-50 text-rose-700",
  DOMINANCE: "border-amber-200 bg-amber-50 text-amber-700",
  BALANCED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NO_TARGETS: "border-slate-200 bg-slate-50 text-slate-500",
  NO_DATA: "border-slate-200 bg-slate-50 text-slate-400",
};

function KindIcon({ kind }: { kind: TeamGuidanceKind }) {
  if (kind === "BELOW_TARGET")
    return <TrendingDown className="h-3 w-3 shrink-0" />;
  if (kind === "DOMINANCE") return <TrendingUp className="h-3 w-3 shrink-0" />;
  if (kind === "BALANCED")
    return <CheckCircle2 className="h-3 w-3 shrink-0" />;
  return null;
}

export default function TeamsGuidanceSummary({
  teams,
  summaries,
  seasonKey,
}: Props) {
  const attentionTeams = teams.filter((t) => {
    const s = summaries.get(t.id);
    return s && (s.kind === "BELOW_TARGET" || s.kind === "DOMINANCE" || s.nextFocusMissing);
  });

  const balancedTeams = teams.filter((t) => {
    const s = summaries.get(t.id);
    return s?.kind === "BALANCED";
  });

  if (teams.length === 0) return null;

  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-semibold text-slate-900">
            Trainings-Schwerpunkt-Übersicht
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Alle Teams · aktive Saison
          </p>
        </div>
        <div className="flex gap-1.5">
          {attentionTeams.length > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
              {attentionTeams.length} Achtung
            </span>
          )}
          {balancedTeams.length > 0 && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
              {balancedTeams.length} OK
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const summary = summaries.get(team.id);
          const href = `/dashboard/teams/${team.id}`;

          return (
            <Link
              key={team.id}
              href={href}
              className="group flex items-center justify-between gap-3 rounded-[16px] border border-slate-200/80 bg-slate-50 px-3 py-2.5 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-900 group-hover:text-[#0b4aa2]">
                  {team.name}
                </p>
                {summary?.nextFocusMissing && (
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
                    <Lightbulb className="h-2.5 w-2.5" />
                    Nächstes Training: kein Schwerpunkt
                  </span>
                )}
              </div>

              {summary ? (
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLES[summary.kind]}`}
                >
                  <KindIcon kind={summary.kind} />
                  {summary.label}
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-400">
                  Keine Daten
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
