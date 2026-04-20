import { FileText, NotebookPen } from "lucide-react";

type VereinsleitungMeetingAgendaCardProps = {
  title: string;
  subtitle: string | null;
  description: string | null;
};

export default function VereinsleitungMeetingAgendaCard({
  title,
  subtitle,
  description,
}: VereinsleitungMeetingAgendaCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <FileText className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
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
      </div>
    </section>
  );
}
