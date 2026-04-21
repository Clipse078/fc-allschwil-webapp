import { CheckCircle2, Clock3, FileCheck2, Info, ListTodo } from "lucide-react";
import { getDecisionTypeLabel, type MeetingDecisionItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingDecisionsCardProps = {
  decisions: MeetingDecisionItem[];
};

function getDecisionIcon(type: string) {
  switch (type) {
    case "TASK":
      return ListTodo;
    case "APPROVAL":
      return FileCheck2;
    case "INFO":
      return Info;
    default:
      return CheckCircle2;
  }
}

function getDecisionBadgeClass(type: string) {
  switch (type) {
    case "TASK":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "APPROVAL":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "INFO":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

export default function VereinsleitungMeetingDecisionsCard({
  decisions,
}: VereinsleitungMeetingDecisionsCardProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Entscheidungen
          </p>
          <h2 className="text-xl font-semibold text-slate-900">
            Beschlüsse & Aufträge
          </h2>
          <p className="text-sm text-slate-600">
            Dieser Bereich ist für die nächste Protokoll- und Ausführungsstufe vorbereitet.
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
          {decisions.length} Einträge
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
          Noch keine Entscheidungen erfasst.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {decisions.map((decision) => {
            const Icon = getDecisionIcon(decision.decisionType);

            return (
              <article
                key={decision.id}
                className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-2xl border border-slate-200 bg-white p-2 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                            getDecisionBadgeClass(decision.decisionType),
                          ].join(" ")}
                        >
                          {getDecisionTypeLabel(decision.decisionType)}
                        </span>

                        {decision.agendaItemTitle ? (
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            {decision.agendaItemTitle}
                          </span>
                        ) : null}

                        {decision.createMatter ? (
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            Für Pendenz vorbereitet
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm font-medium leading-6 text-slate-900">
                        {decision.decisionText}
                      </p>
                    </div>
                  </div>

                  {decision.dueDateLabel ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      Fällig bis {decision.dueDateLabel}
                    </div>
                  ) : null}
                </div>

                {(decision.responsibleDisplayName || decision.remarks) ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Verantwortlich
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {decision.responsibleDisplayName ?? "Noch offen"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Bemerkung
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {decision.remarks ?? "—"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
