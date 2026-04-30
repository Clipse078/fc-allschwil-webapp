"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import type { MyTaskPreviewItem } from "@/lib/tasks/get-my-task-preview";

function formatDate(value: string | null) {
  if (!value) return "Keine Frist";
  return new Intl.DateTimeFormat("de-CH").format(new Date(value));
}

export default function AdminHeaderNotificationBell({
  count,
  tasks,
}: {
  count: number;
  tasks: MyTaskPreviewItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white"
      >
        <Bell className="h-5 w-5" />

        {count > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 w-[360px] rounded-xl border bg-white shadow-xl">
          <div className="p-4 font-bold">
            {count > 0 ? `${count} Aufgaben` : "Keine Aufgaben"}
          </div>

          <div className="max-h-[300px] overflow-auto p-2">
            {tasks.map((task) => (
              <Link key={task.id} href={task.href} className="block p-3 hover:bg-slate-50">
                <div className="text-xs text-red-600">{task.sourceLabel}</div>
                <div className="font-semibold">{task.title}</div>
                <div className="text-sm text-slate-500">{task.personLabel}</div>
                <div className="text-xs">{formatDate(task.dueDate)}</div>
              </Link>
            ))}
          </div>

          <Link
            href="/dashboard/tasks"
            className="block border-t p-3 text-center font-bold text-blue-600"
          >
            Alle öffnen
          </Link>
        </div>
      )}
    </div>
  );
}
