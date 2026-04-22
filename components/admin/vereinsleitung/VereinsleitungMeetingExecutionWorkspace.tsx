"use client";

import { useMemo } from "react";
import { CheckCircle2, FileText, ListChecks } from "lucide-react";
import type {
  MeetingAgendaItem,
  MeetingDecisionItem,
  MeetingProtocolEntryItem,
} from "@/lib/vereinsleitung/meeting-utils";
import { groupByAgendaItems } from "@/lib/vereinsleitung/meeting-grouping";

type VereinsleitungMeetingExecutionWorkspaceProps = {
  meetingId: string;
  agendaItems: MeetingAgendaItem[];
  protocolEntries: MeetingProtocolEntryItem[];
  decisions: MeetingDecisionItem[];
  isDone: boolean;
};

export default function VereinsleitungMeetingExecutionWorkspace({
  agendaItems,
  protocolEntries,
  decisions,
  isDone,
}: VereinsleitungMeetingExecutionWorkspaceProps) {
  const groupedAgenda = useMemo(
    () => groupByAgendaItems(agendaItems, protocolEntries, decisions),
    [agendaItems, protocolEntries, decisions],
  );

  const unassignedProtocolEntries = useMemo(
    () => protocolEntries.filter((entry) => !entry.agendaItemId),
    [protocolEntries],
  );

  const unassignedDecisions = useMemo(
    () => decisions.filter((decision) => !decision.agendaItemId),
    [decisions],
  );

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Execution Workspace
          </p>
          <h2 className="mt-2 text-[1.2rem] font-semibold text-slate-900">
            Meeting-Ausführung nach Traktanden
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Protokoll und Beschlüsse werden entlang der Agenda sichtbar gemacht.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {groupedAgenda.length} Traktanden
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {protocolEntries.length} Protokolleinträge
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {decisions.length} Beschlüsse
          </span>
          {isDone ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Meeting abgeschlossen
            </span>
          ) : null}
        </div>
      </div>

      {groupedAgenda.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Für dieses Meeting wurden noch keine Traktanden hinterlegt. Ergänze zuerst die Agenda, damit Protokoll und Beschlüsse sauber strukturiert geführt werden können.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groupedAgenda.map((item, index) => (
            <article
              key={item.id}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Traktand {index + 1}
                  </div>
                  <h3 className="mt-2 text-[1.02rem] font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description ?? "Keine zusätzliche Beschreibung hinterlegt."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.protocolEntries.length} Notizen
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {item.decisions.length} Beschlüsse
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#0b4aa2]" />
                    <h4 className="text-sm font-semibold text-slate-900">Protokoll</h4>
                  </div>

                  {item.protocolEntries.length === 0 ? (
                    <div className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      Noch keine Protokolleinträge zu diesem Traktand.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.protocolEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-[16px] bg-white px-4 py-4 text-sm leading-6 text-slate-600"
                        >
                          {entry.notes}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#0b4aa2]" />
                    <h4 className="text-sm font-semibold text-slate-900">Beschlüsse</h4>
                  </div>

                  {item.decisions.length === 0 ? (
                    <div className="mt-4 rounded-[16px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      Noch keine Beschlüsse zu diesem Traktand.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {item.decisions.map((decision) => (
                        <div
                          key={decision.id}
                          className="rounded-[16px] bg-white px-4 py-4"
                        >
                          <div className="text-sm font-semibold text-slate-900">
                            {decision.decisionTypeLabel}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">
                            {decision.decisionText}
                          </div>
                          {decision.responsibleDisplayName || decision.dueDateLabel ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              {decision.responsibleDisplayName ? (
                                <span>Verantwortlich: {decision.responsibleDisplayName}</span>
                              ) : null}
                              {decision.dueDateLabel ? (
                                <span>Fällig: {decision.dueDateLabel}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {unassignedProtocolEntries.length > 0 || unassignedDecisions.length > 0 ? (
        <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-amber-700" />
            <h3 className="text-sm font-semibold text-amber-900">
              Nicht zugeordnete Inhalte
            </h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Einige Protokolleinträge oder Beschlüsse sind noch keinem Traktand zugeordnet.
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[18px] bg-white/80 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Offene Protokolleinträge
              </div>
              {unassignedProtocolEntries.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Keine offenen Einträge.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {unassignedProtocolEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[14px] bg-white px-3 py-3 text-sm leading-6 text-slate-600"
                    >
                      {entry.notes}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[18px] bg-white/80 p-4">
              <div className="text-sm font-semibold text-slate-900">
                Offene Beschlüsse
              </div>
              {unassignedDecisions.length === 0 ? (
                <div className="mt-3 text-sm text-slate-500">Keine offenen Beschlüsse.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {unassignedDecisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="rounded-[14px] bg-white px-3 py-3 text-sm leading-6 text-slate-600"
                    >
                      <div className="font-semibold text-slate-900">
                        {decision.decisionTypeLabel}
                      </div>
                      <div className="mt-1">{decision.decisionText}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
