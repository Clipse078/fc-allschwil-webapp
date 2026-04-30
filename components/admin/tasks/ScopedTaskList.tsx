import Link from "next/link";
import type { ScopedTaskPreviewItem } from "@/lib/tasks/scoped-task-types";

function formatDate(value: string | null) {
  if (!value) return "Keine Frist";
  return new Intl.DateTimeFormat("de-CH").format(new Date(value));
}

export default function ScopedTaskList({
  tasks,
  emptyLabel = "Keine offenen Aufgaben 🎉",
}: {
  tasks: ScopedTaskPreviewItem[];
  emptyLabel?: string;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Link
          key={`${task.source}-${task.id}`}
          href={task.href}
          className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">
                {task.sourceLabel}
              </p>
              <p className="mt-1 font-black text-slate-950">{task.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{task.personLabel}</p>
              {task.scopeLabel ? (
                <p className="mt-2 text-xs font-bold text-slate-400">
                  {task.scopeType ?? "Scope"} · {task.scopeLabel}
                </p>
              ) : null}
            </div>

            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
              task.isOverdue
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}>
              {formatDate(task.dueDate)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
