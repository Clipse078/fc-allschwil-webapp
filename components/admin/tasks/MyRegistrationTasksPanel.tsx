"use client";

import Link from "next/link";

export default function MyRegistrationTasksPanel({ steps }: { steps: any[] }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">
            Meine Aufgaben
          </p>
          <h2 className="text-xl font-black text-[#0b4aa2]">
            Offene Workflow-Schritte
          </h2>
        </div>

        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
          {steps.length} offen
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {steps.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
            Keine offenen Aufgaben 🎉
          </div>
        ) : (
          steps.map((step) => {
            const overdue =
              step.dueDate && new Date(step.dueDate) < new Date();

            return (
              <Link
                key={step.id}
                href={`/dashboard/neu-anmeldungen/${step.registrationId}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition"
              >
                <div>
                  <p className="font-black text-slate-900">
                    {step.title}
                  </p>
                  <p className="text-sm text-slate-500">
                    {step.registration?.firstName} {step.registration?.lastName}
                  </p>
                </div>

                <div className="text-right text-xs font-bold">
                  <p
                    className={
                      overdue
                        ? "text-red-600"
                        : "text-slate-500"
                    }
                  >
                    {step.dueDate
                      ? new Date(step.dueDate).toLocaleDateString("de-CH")
                      : "Keine Frist"}
                  </p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
