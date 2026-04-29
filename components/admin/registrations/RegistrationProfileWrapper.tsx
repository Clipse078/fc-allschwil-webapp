import { Registration } from "@prisma/client";
import RegistrationActions from "./RegistrationActions";
import { CareerTimelinePlaceholder, ProfileCard } from "@/components/admin/persons/profile/PersonProfileLayout";

const statusMeta: Record<string, { label: string; className: string }> = {
  NEW: {
    label: "Neu eingegangen",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  IN_REVIEW: {
    label: "In Prüfung",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  APPROVED: {
    label: "Freigegeben",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  REJECTED: {
    label: "Abgelehnt",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

const typeLabels: Record<string, string> = {
  PLAYER: "Spieler",
  TRAINER: "Trainer",
  STAFF: "Mitarbeiter",
  EXTERNAL: "Extern",
};

function getDisplayName(registration: Registration) {
  return registration.displayName || `${registration.firstName} ${registration.lastName}`.trim() || "Neue Anmeldung";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function RegistrationProfileWrapper({
  registration,
}: {
  registration: Registration;
}) {
  const meta = statusMeta[registration.status] ?? statusMeta.NEW;
  const name = getDisplayName(registration);

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

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
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
          </dl>
        </ProfileCard>

        <ProfileCard eyebrow="Workflow" title="Bearbeitung">
          <div className="space-y-3 text-sm font-semibold text-slate-600">
            <p>Status: <span className="font-black text-slate-900">{meta.label}</span></p>
            <p>Zugewiesen an: <span className="font-black text-slate-900">{registration.assignedTo || "—"}</span></p>
            <p>Verknüpfte Person: <span className="font-black text-slate-900">{registration.linkedPersonId || "—"}</span></p>
          </div>
        </ProfileCard>
      </div>

      <CareerTimelinePlaceholder
        title="Anmeldeverlauf"
        text="Hier wird später der vollständige Verlauf sichtbar: Eingang, Zuweisung, Prüfung, Freigabe, Ablehnung und Verknüpfung mit einer Person."
      />
    </div>
  );
}
