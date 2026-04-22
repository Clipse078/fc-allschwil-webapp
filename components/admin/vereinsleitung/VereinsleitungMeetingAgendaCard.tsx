import { FileText, GripVertical, NotebookPen } from "lucide-react";
import type { MeetingAgendaItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingAgendaCardProps = {
  title: string;
  subtitle: string | null;
  description: string | null;
  agendaItems: MeetingAgendaItem[];
};

export default function VereinsleitungMeetingAgendaCard({
  title,
  subtitle,
  description,
  agendaItems,
}: VereinsleitungMeetingAgendaCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-[#0b4aa2]" />
            <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Kontext, Kurzbeschreibung und strukturierte Traktanden für dieses Meeting.
          </p>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {agendaItems.length} Traktanden
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {subtitle ? (
          <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[#0b4aa2]">
                <NotebookPen className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-[1rem] font-semibold text-slate-900">Kurzbeschreibung</h4>
                <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                  {subtitle}
                </div>
              </div>
            </div>
          </article>
        ) : null}

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <h4 className="text-[1rem] font-semibold text-slate-900">Notizen / Kontext</h4>
          <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            {description ?? "Für dieses Meeting wurden noch keine erweiterten Notizen oder Traktanden hinterlegt."}
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h4 className="text-[1rem] font-semibold text-slate-900">Traktandenliste</h4>
              <p className="mt-2 text-sm text-slate-500">
                Die Reihenfolge entspricht der geplanten Meeting-Struktur.
              </p>
            </div>
          </div>

          {agendaItems.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
              Noch keine Traktanden hinterlegt. Ergänze sie im Bearbeitungsmodus, damit Entscheidungen und Protokoll sauber entlang der Agenda geführt werden können.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {agendaItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          Traktand {index + 1}
                        </div>
                        <div className="text-xs text-slate-500">
                          Geplanter Reihenfolgepunkt
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Titel
                      </div>
                      <div className="mt-2 rounded-[16px] bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                        {item.title}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Beschreibung
                      </div>
                      <div className="mt-2 rounded-[16px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                        {item.description ?? "Keine zusätzliche Beschreibung hinterlegt."}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
