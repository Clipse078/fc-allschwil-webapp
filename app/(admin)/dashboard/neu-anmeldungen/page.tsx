import Link from "next/link";
import RegistrationCreateForm from "@/components/admin/registrations/RegistrationCreateForm";
import { prisma } from "@/lib/db/prisma";

const statusLabels: Record<string, string> = {
  NEW: "Neu",
  IN_REVIEW: "In Prüfung",
  APPROVED: "Freigegeben",
  REJECTED: "Abgelehnt",
  WITHDRAWN: "Zurückgezogen",
  CONVERTED: "Konvertiert",
};

const typeLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Mitarbeiter",
  EXTERNAL: "Extern",
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default async function NeueAnmeldungenPage() {
  const registrations = await prisma.registration.findMany({
    orderBy: { submittedAt: "desc" },
    take: 50,
    include: {
      workflowSteps: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedPerson: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          assignedRole: { select: { id: true, name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="fca-eyebrow">Neue Anmeldungen</p>
          <h1 className="text-2xl font-black text-slate-950">Eingänge</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Neue Spieler, Trainer, Staff und externe Kontakte prüfen, routen und übernehmen.
          </p>
        </div>
      </div>

      <RegistrationCreateForm />

      <div className="grid gap-3">
        {registrations.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">
            Aktuell sind keine neuen Anmeldungen vorhanden.
          </div>
        ) : (
          registrations.map((registration) => {
            const activeStep =
              registration.workflowSteps.find((step) => step.status === "IN_PROGRESS") ??
              registration.workflowSteps.find((step) => step.status === "OPEN");

            const assignedName =
              activeStep?.assignedPerson?.displayName ??
              (activeStep?.assignedPerson
                ? `${activeStep.assignedPerson.firstName} ${activeStep.assignedPerson.lastName}`.trim()
                : activeStep?.assignedRole?.name ?? registration.assignedTo ?? "—");

            return (
              <Link
                key={registration.id}
                href={`/dashboard/neu-anmeldungen/${registration.id}`}
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900">
                      {registration.displayName || `${registration.firstName} ${registration.lastName}`.trim()}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {typeLabels[registration.type] ?? registration.type} · Eingegangen am {formatDate(registration.submittedAt)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Nächster Schritt: <span className="text-slate-900">{activeStep?.title ?? "—"}</span> · Zuständig: <span className="text-slate-900">{assignedName}</span>
                    </p>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
                    {statusLabels[registration.status] ?? registration.status}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
