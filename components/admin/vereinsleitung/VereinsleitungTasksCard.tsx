import Link from "next/link";
import { CalendarDays, Circle, MoreHorizontal } from "lucide-react";

type MatterStatus = "OPEN" | "IN_PROGRESS" | "DONE";
type MatterPriority = "LOW" | "MEDIUM" | "HIGH";

type MatterCardItem = {
  id: string;
  title: string;
  ownerName: string | null;
  ownerInitials: string;
  dueLabel: string | null;
  priority: MatterPriority;
  status: MatterStatus;
};

type VereinsleitungTasksCardProps = {
  matters: MatterCardItem[];
};

function getPriorityClass(priority: MatterPriority) {
  switch (priority) {
    case "HIGH":
      return "border-rose-200 bg-rose-50 text-rose-600";
    case "LOW":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getPriorityLabel(priority: MatterPriority) {
  switch (priority) {
    case "HIGH":
      return "High Prio";
    case "LOW":
      return "Low Prio";
    default:
      return "Medium Prio";
  }
}

function getStatusClass(status: MatterStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "DONE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function getStatusLabel(status: MatterStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return "In Arbeit";
    case "DONE":
      return "Erledigt";
    default:
      return "Offen";
  }
}

export default function VereinsleitungTasksCard({
  matters,
}: VereinsleitungTasksCardProps) {
  const openMatters = matters.filter((matter) => matter.status !== "DONE");

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-7 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[1.08rem] font-semibold text-slate-900">
            Offene Aufgaben
          </h3>
        </div>

        <Link
          href="/vereinsleitung/cockpit"
          className="text-sm font-semibold text-[#0b4aa2] transition hover:text-[#08357a]"
        >
          Alle Pendenzen
        </Link>
      </div>

      {openMatters.length === 0 ? (
        <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Aktuell sind keine offenen Pendenzen vorhanden.
        </div>
      ) : (
        <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)]">
          {openMatters.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-4 px-4 py-4 transition hover:bg-slate-50/70"
            >
              <div className="pt-0.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-400">
                  <Circle className="h-3.5 w-3.5" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-slate-900">
                  {task.title}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500">
                  {task.ownerName ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                        {task.ownerInitials}
                      </span>
                      {task.ownerName}
                    </span>
                  ) : null}

                  {task.dueLabel ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {task.dueLabel}
                    </span>
                  ) : null}

                  <span
                    className={`rounded-full border px-2.5 py-1 font-semibold ${getPriorityClass(
                      task.priority,
                    )}`}
                  >
                    {getPriorityLabel(task.priority)}
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 font-semibold ${getStatusClass(
                      task.status,
                    )}`}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                </div>
              </div>

              <Link
                href="/vereinsleitung/cockpit"
                aria-label="Zur Pendenzen-Verwaltung"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
