import { CalendarDays, Link2, ListChecks } from "lucide-react";
import type { MeetingMatterItem } from "@/lib/vereinsleitung/meeting-utils";

type VereinsleitungMeetingActionsCardProps = {
  title: string;
  linkedMatters: MeetingMatterItem[];
};

function getStatusClass(status: string) {
  switch (status) {
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getPriorityClass(priority: string) {
  switch (priority) {
    case "HIGH":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "MEDIUM":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungMeetingActionsCard({
  title,
  linkedMatters,
}: VereinsleitungMeetingActionsCardProps) {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4.5 w-4.5 text-[#0b4aa2]" />
        <h3 className="text-[1.08rem] font-semibold text-slate-900">{title}</h3>
      </div>

      {linkedMatters.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Für dieses Meeting sind noch keine Pendenzen verknüpft.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {linkedMatters.map((matter) => (
            <article
              key={matter.linkId}
              className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-[1rem] font-semibold text-slate-900">{matter.title}</h4>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {matter.ownerName ? <span>Verantwortlich: {matter.ownerName}</span> : null}
                    {matter.dueDateLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Fällig: {matter.dueDateLabel}
                      </span>
                    ) : null}
                    {matter.sourceMeetingTitle ? (
                      <span className="inline-flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5" />
                        Übernommen aus: {matter.sourceMeetingTitle}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPriorityClass(
                      matter.priority,
                    )}`}
                  >
                    {matter.priorityLabel}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusClass(
                      matter.status,
                    )}`}
                  >
                    {matter.statusLabel}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
