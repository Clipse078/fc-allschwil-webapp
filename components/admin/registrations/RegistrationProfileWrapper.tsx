import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, FileText, UserRoundCheck } from "lucide-react";
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

const statusMeta: Record<string, { label: string; className: string; dotClassName: string }> = {
  NEW: { label: "Neu eingegangen", className: "border-amber-200 bg-amber-50 text-amber-700", dotClassName: "bg-amber-500" },
  IN_REVIEW: { label: "In Prüfung", className: "border-blue-200 bg-blue-50 text-blue-700", dotClassName: "bg-blue-500" },
  APPROVED: { label: "Freigegeben", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClassName: "bg-emerald-500" },
  REJECTED: { label: "Abgelehnt", className: "border-red-200 bg-red-50 text-red-700", dotClassName: "bg-red-500" },
  WITHDRAWN: { label: "Zurückgezogen", className: "border-slate-200 bg-slate-50 text-slate-600", dotClassName: "bg-slate-400" },
  CONVERTED: { label: "Konvertiert", className: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClassName: "bg-emerald-500" },
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

function getPersonName(person?: { firstName: string; lastName: string; displayName?: string | null; email?: string | null } | null) {
  if (!person) return null;
  return person.displayName || `${person.firstName} ${person.lastName}`.trim() || person.email || null;
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

function getAssignedLabel(step?: RegistrationWithWorkflow["workflowSteps"][number] | null, fallback?: string | null) {
  if (!step) return fallback || "—";
  return getPersonName(step.assignedPerson) || step.assignedRole?.name || fallback || "—";
}

function getFormDataEntries(formData: unknown) {
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) return [];
  return Object.entries(formData as Record<string, unknown>).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

export default function RegistrationProfileWrapper({
  registration,
}: {
  registration: RegistrationWithWorkflow;
}) {
  const meta = statusMeta[registration.status] ?? statusMeta.NEW;
  const name = getDisplayName(registration);
  const completedSteps = registration.workflowSteps.filter((step) => step.status === "DONE").length;
  const totalSteps = registration.workflowSteps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const activeStep =
    registration.workflowSteps.find((step) => step.status === "IN_PROGRESS") ??
    registration.workflowSteps.find((step) => step.status === "OPEN");

  const formDataEntries = getFormDataEntries(registration.formData);
  const linkedPersonName = getPersonName(registration.linkedPerson);
  const canShowConvertHint = registration.status === "APPROVED" && !registration.linkedPersonId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/neu-anmeldungen"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zu Eingängen
        </Link>

        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${meta.className}`}>
          <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} />
          {meta.label}
        </span>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="relative p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0b4aa2] via-blue-400 to-red-500" />

          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="fca-eyebrow">Anmeldung</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{name}</h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {typeLabels[registration.type] ?? registration.type} · Eingegangen am {formatDate(registration.submittedAt)}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Zielgruppe</p>
                  <p className="mt-1 font-black text-slate-950">{targetGroupLabels[registration.targetGroup] ?? registration.targetGroup}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Aktueller Schritt</p>
                  <p className="mt-1 font-black text-slate-950">{activeStep?.title ?? "—"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Zuständig</p>
                  <p className="mt-1 font-black text-slate-950">{getAssignedLabel(activeStep, registration.assignedTo)}</p>
                </div>
              </div>
            </div>

            <div className="w-full rounded-[28px] border border-slate-200 bg-slate-50 p-5 xl:max-w-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Fortschritt</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{progress}%</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#0b4aa2] shadow-sm">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#0b4aa2]" style={{ width: `${progress}%` }} />
              </div>

              <p className="mt-3 text-sm font-bold text-slate-500">
                {completedSteps} von {totalSteps} Schritten erledigt
              </p>

              <div className="mt-5">
                <RegistrationActions registrationId={registration.id} status={registration.status} linkedPersonId={registration.linkedPersonId} />
              </div>

              {canShowConvertHint ? (
                <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-700">
                  Anmeldung ist freigegeben und kann jetzt als Person übernommen werden.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
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
                  const isDone = step.status === "DONE";

                  return (
                    <div
                      key={step.id}
                      className={`flex gap-4 rounded-[26px] border p-5 shadow-sm ${
                        isActiveStep
                          ? "border-blue-200 bg-blue-50/50"
                          : isDone
                            ? "border-emerald-100 bg-emerald-50/40"
                            : overdue
                              ? "border-red-200 bg-red-50/30"
                              : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black ${
                          isDone
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : overdue
                              ? "border-red-200 bg-red-50 text-red-700"
                              : isActiveStep
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-500"
                        }`}>
                          {isDone ? <CheckCircle2 className="h-5 w-5" /> : index + 1}
                        </div>
                        {index < registration.workflowSteps.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-slate-950">{step.title}</h3>
                              <span className={`rounded-full border px-3 py-1 text-xs font-black ${
                                overdue
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : isActiveStep
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : isDone
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}>
                                {isActiveStep ? "Aktuell" : stepStatusLabels[step.status] ?? step.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{step.description || "—"}</p>
                          </div>

                          {isActiveStep && registration.status !== "APPROVED" && registration.status !== "CONVERTED" ? (
                            <RegistrationWorkflowStepCompleteButton registrationId={registration.id} stepId={step.id} />
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 md:grid-cols-4">
                          <p className="rounded-2xl bg-white/70 p-3">Fällig<br /><span className={overdue ? "text-red-600" : "text-slate-900"}>{formatDate(step.dueDate)}</span></p>
                          <p className="rounded-2xl bg-white/70 p-3">Rolle<br /><span className="text-slate-900">{step.assignedRole?.name ?? "—"}</span></p>
                          <p className="rounded-2xl bg-white/70 p-3">Person<br /><span className="text-slate-900">{getPersonName(step.assignedPerson) ?? "—"}</span></p>
                          <p className="rounded-2xl bg-white/70 p-3">Erledigt<br /><span className="text-slate-900">{formatDate(step.completedAt)}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ProfileCard>
        </div>

        <div className="space-y-6">
          <ProfileCard eyebrow="Daten" title="Anmeldedaten">
            <dl className="grid gap-3">
              {[
                ["Vorname", registration.firstName || "—"],
                ["Nachname", registration.lastName || "—"],
                ["E-Mail", registration.email || "—"],
                ["Telefon", registration.phone || "—"],
                ["Geburtsdatum", formatDate(registration.dateOfBirth)],
                ["Geschlecht", registration.gender || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</dt>
                  <dd className="mt-1 break-words font-bold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </ProfileCard>

          <ProfileCard eyebrow="Routing" title="Zielgruppe & Übernahme">
            <div className="space-y-3 text-sm font-semibold text-slate-600">
              <p>Zielgruppe: <span className="font-black text-slate-900">{targetGroupLabels[registration.targetGroup] ?? registration.targetGroup}</span></p>
              <p>Konvertieren als: <span className="font-black text-slate-900">{registration.conversionRole ? conversionRoleLabels[registration.conversionRole] ?? registration.conversionRole : "—"}</span></p>
              <p>Verknüpfte Person: <span className="font-black text-slate-900">{linkedPersonName ?? "—"}</span></p>
              {registration.linkedPersonId ? (
                <Link href={`/dashboard/persons/${registration.linkedPersonId}`} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
                  <UserRoundCheck className="h-4 w-4" />
                  Person öffnen
                </Link>
              ) : null}
            </div>
          </ProfileCard>

          <ProfileCard eyebrow="Notizen" title="Interne Hinweise">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{registration.notes || "Keine Notizen vorhanden."}</p>
            </div>
          </ProfileCard>

          <ProfileCard eyebrow="Formular" title="Rohdaten">
            {formDataEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                Keine zusätzlichen Formularfelder vorhanden.
              </div>
            ) : (
              <div className="space-y-2">
                {formDataEntries.map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{key}</p>
                    <p className="mt-1 break-words text-sm font-bold text-slate-900">
                      {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </ProfileCard>
        </div>
      </div>
    </div>
  );
}
