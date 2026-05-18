/**
 * TODO: MeetingAgendaItem model (Phase 2) — NOW IMPLEMENTED.
 * CRUD available via /api/meetings/[id]/agenda routes.
 * Drag-and-drop reorder: use orderIndex field.
 */

import { Clock3, FileText } from "lucide-react";

type AgendaItemShape = {
  id: string;
  title: string;
  notes?: string | null;
  owner?: string | null;
  durationMin?: number | null;
  orderIndex: number;
  status: "OPEN" | "DISCUSSED" | "SKIPPED";
};

type VereinsleitungMeetingAgendaCardProps = {
  isDbBacked?: boolean;
  agendaItems?: AgendaItemShape[];
};

const STATUS_CLASSES: Record<AgendaItemShape["status"], string> = {
  OPEN: "bg-slate-50 text-slate-600 border-slate-200",
  DISCUSSED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SKIPPED: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<AgendaItemShape["status"], string> = {
  OPEN: "Offen",
  DISCUSSED: "Besprochen",
  SKIPPED: "Übersprungen",
};

const MOCK_ITEMS = [
  { number: 1, title: "Genehmigung Protokoll letzte Sitzung", owner: "David Keller", ownerInitials: "DK", duration: "5 Min", notes: "Das Protokoll der März-Sitzung wurde im Voraus verteilt. Keine Einwände aus dem Gremium. Es wird einstimmig verdankt und genehmigt." },
  { number: 2, title: "Website Relaunch Update", owner: "Michael Weber", ownerInitials: "MW", duration: "20 Min", notes: "Agentur hat erste Design-Entwürfe präsentiert. Fokus liegt auf Mobile-First und einfacherer Navigation für Vereinsmitglieder." },
  { number: 3, title: "Trainerplanung Saison 25/26", owner: "Thomas Schmid", ownerInitials: "TS", duration: "30 Min", notes: "Für die 1. Mannschaft gibt es eine mündliche Zusage für eine Vertragsverlängerung. Bei den A-Junioren suchen wir noch nach einem Co-Trainer." },
];

export default function VereinsleitungMeetingAgendaCard({ isDbBacked, agendaItems }: VereinsleitungMeetingAgendaCardProps) {
  if (isDbBacked) {
    return (
      <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Traktanden & Protokoll</h3>
        </div>

        {agendaItems && agendaItems.length > 0 ? (
          <div className="mt-6 space-y-4">
            {agendaItems.map((item, idx) => (
              <article key={item.id} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-sm font-semibold text-[#0b4aa2]">{idx + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[1rem] font-semibold text-slate-900">{item.title}</p>
                      <div className="flex items-center gap-2">
                        {item.durationMin ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" />{item.durationMin} Min
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_CLASSES[item.status]}`}>{STATUS_LABELS[item.status]}</span>
                      </div>
                    </div>
                    {item.owner ? <p className="mt-1 text-[11px] text-slate-500">Verantwortlich: {item.owner}</p> : null}
                    {item.notes ? <div className="mt-3 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{item.notes}</div> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-5 text-center">
            <p className="text-sm text-slate-500">Traktanden noch nicht erfasst.</p>
            <p className="mt-1 text-[11px] text-slate-400">POST /api/meetings/[id]/agenda</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#0b4aa2]" />
          <h3 className="text-[1.08rem] font-semibold text-slate-900">Traktanden & Protokoll</h3>
        </div>
        <button type="button" className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]">Alle einklappen</button>
      </div>
      <div className="mt-6 space-y-4">
        {MOCK_ITEMS.map((item) => (
          <article key={item.number} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-sm font-semibold text-[#0b4aa2]">{item.number}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-[1rem] font-semibold text-slate-900">{item.title}</h4>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">{item.ownerInitials}</div>
                      <p className="text-xs text-slate-500">{item.owner}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{item.duration}</span>
                </div>
                <div className="mt-4 rounded-[18px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{item.notes}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
