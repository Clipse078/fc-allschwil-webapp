import { Prisma, Registration } from "@prisma/client";
import RegistrationActions from "./RegistrationActions";
import RegistrationWorkflowStepCompleteButton from "./RegistrationWorkflowStepCompleteButton";
import { ProfileCard } from "@/components/admin/persons/profile/PersonProfileLayout";

type RegistrationWithWorkflow = Prisma.RegistrationGetPayload<{
  include: {
    workflowSteps: {
      include: {
        assignedRole: true;
        assignedPerson: true;
      };
    };
    linkedPerson: true;
  };
}>;

const statusMeta: Record<string, { label: string; className: string }> = {
  NEW: { label: "Neu eingegangen", className: "border-amber-200 bg-amber-50 text-amber-700" },
  IN_REVIEW: { label: "In Prüfung", className: "border-blue-200 bg-blue-50 text-blue-700" },
  APPROVED: { label: "Freigegeben", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Abgelehnt", className: "border-red-200 bg-red-50 text-red-700" },
  WITHDRAWN: { label: "Zurückgezogen", className: "border-slate-200 bg-slate-50 text-slate-600" },
  CONVERTED: { label: "Konvertiert", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

const typeLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Mitarbeiter",
  EXTERNAL: "Extern",
};

const targetGroupLabels: Record<string, string> = {
  KINDERFUSSBALL: "Kinderfussball",
  JUNIOREN: "Junioren",
  FRAUEN: "Frauen",
  AKTIVE: "Aktive",
  TRAININGSGRUPPE: "Trainingsgruppe",
  TRAINERSTAFF: "Trainerstaff",
  OTHER: "Andere",
};

const conversionRoleLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Funktion / Staff",
  MEMBER: "Mitglied",
  OTHER: "Andere Funktion",
};

const stepStatusLabels: Record<string, string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Arbeit",
  DONE: "Erledigt",
  SKIPPED: "Übersprungen",
  BLOCKED: "Blockiert",
};

function getDisplayName(registration: Registration) {
  return registration.displayName || `${registration.firstName} ${registration.lastName}`.trim() || "Neue Anmeldung";
}

function getPersonName(person?: { firstName: string; lastName: string; displayName?: string | null } | null) {
  if (!person) return "—";
  return person.displayName || `${person.firstName} ${person.lastName}`.trim() || "—";
}

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function isOverdue(date?: Date | null) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export default function RegistrationProfileWrapper({
  registration,
}: {
  registration: RegistrationWithWorkflow;
}) {
  const meta = statusMeta[registration.status] ?? statusMeta.NEW;
  const name = getDisplayName(registration);
  const activeStep =
    registration.workflowSteps.find((step) => step.status === "IN_PROGRESS") ??
    registration.workflowSteps.find((step) => step.status === "OPEN");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="fca-eyebrow">Anmeldung</p>
          <h1 className="text-2xl font-black text-slate-950">{name}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {typeLabels[registration.type] ?? registration.type} · Eingegangen am {formatDate(registration.submittedAt)}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
            {meta.label}
          </span>
          <RegistrationActions registrationId={registration.id} status={registration.status} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ProfileCard eyebrow="Daten" title="Anmeldedaten">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Vorname</dt>
              <dd className="mt-1 font-bold text-slate-900">{registration.firstName || "—"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Nachname</dt>
              <dd className="mt-1 font-bold text-slate-900">{registration.lastName || "—"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">E-Mail</dt>
              <dd className="mt-1 font-bold text-slate-900">{registration.email || "—"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Telefon</dt>
              <dd className="mt-1 font-bold text-slate-900">{registration.phone || "—"}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Geburtsdatum</dt>
              <dd className="mt-1 font-bold text-slate-900">{formatDate(registration.dateOfBirth)}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Geschlecht</dt>
              <dd className="mt-1 font-bold text-slate-900">{registration.gender || "—"}</dd>
            </div>
          </dl>
        </ProfileCard>

        <ProfileCard eyebrow="Routing" title="Zielgruppe & Zuständigkeit">
          <div className="space-y-3 text-sm font-semibold text-slate-600">
            <p>Zielgruppe: <span className="font-black text-slate-900">{targetGroupLabels[registration.targetGroup] ?? registration.targetGroup}</span></p>
            <p>Konvertieren als: <span className="font-black text-slate-900">{registration.conversionRole ? conversionRoleLabels[registration.conversionRole] ?? registration.conversionRole : "—"}</span></p>
            <p>Nächster Schritt: <span className="font-black text-slate-900">{activeStep?.title ?? "—"}</span></p>
            <p>Zuständig: <span className="font-black text-slate-900">{getPersonName(activeStep?.assignedPerson) || activeStep?.assignedRole?.name || registration.assignedTo || "—"}</span></p>
            <p>Fällig bis: <span className={`font-black ${isOverdue(activeStep?.dueDate) ? "text-red-600" : "text-slate-900"}`}>{formatDate(activeStep?.dueDate)}</span></p>
            <p>Verknüpfte Person: <span className="font-black text-slate-900">{getPersonName(registration.linkedPerson)}</span></p>
          </div>
        </ProfileCard>
      </div>

      <ProfileCard eyebrow="Workflow" title="Anmeldeverlauf">
        <div className="space-y-3">
          {registration.workflowSteps.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold leading-6 text-slate-600">
                Für diese Anmeldung wurden noch keine Workflow-Schritte erstellt.
              </p>
            </div>
          ) : (
            registration.workflowSteps.map((step, index) => {
              const overdue = isOverdue(step.dueDate) && step.status !== "DONE";
              const isActiveStep = activeStep?.id === step.id;

              return (
                <div
                  key={step.id}
                  className={`flex gap-4 rounded-[24px] border p-4 shadow-sm ${
                    isActiveStep
                      ? "border-blue-200 bg-blue-50/40"
                      : step.status === "DONE"
                        ? "border-emerald-100 bg-emerald-50/30"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black ${step.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : overdue ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>
                      {index + 1}
                    </div>
                    {index < registration.workflowSteps.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-950">{step.title}</h3>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{step.description || "—"}</p>
                      </div>

                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${overdue ? "border-red-200 bg-red-50 text-red-700" : isActiveStep ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {isActiveStep ? "Aktuell" : stepStatusLabels[step.status] ?? step.status}
                        </span>

                        {isActiveStep && registration.status !== "APPROVED" && registration.status !== "CONVERTED" ? (
                          <RegistrationWorkflowStepCompleteButton registrationId={registration.id} stepId={step.id} />
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-4">
                      <p>Fällig: <span className={overdue ? "text-red-600" : "text-slate-800"}>{formatDate(step.dueDate)}</span></p>
                      <p>Rolle: <span className="text-slate-800">{step.assignedRole?.name ?? "—"}</span></p>
                      <p>Person: <span className="text-slate-800">{getPersonName(step.assignedPerson)}</span></p>
                      <p>Erledigt: <span className="text-slate-800">{formatDate(step.completedAt)}</span></p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ProfileCard>
    </div>
  );
}
