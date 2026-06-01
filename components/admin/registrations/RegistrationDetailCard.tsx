"use client";

import { useState } from "react";
import { RegistrationStatus } from "@prisma/client";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import type { RegistrationDetail } from "@/lib/registrations/queries";

type RegistrationDetailCardProps = {
  tenantSlug: string;
  initialRegistration: RegistrationDetail;
  canEdit: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  PROBETRAINING: "Probetraining",
  SPIELERANMELDUNG: "Spieleranmeldung",
  TRAINERANMELDUNG: "Traineranmeldung",
  SPONSORANFRAGE: "Sponsoranfrage",
  KONTAKTANFRAGE: "Kontaktanfrage",
  OTHER: "Andere",
};

const STATUS_LABELS: Record<RegistrationStatus, string> = {
  NEW: "Neu",
  REVIEWING: "In Prüfung",
  CONTACTED: "Kontaktiert",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

const STATUS_OPTIONS = Object.values(RegistrationStatus);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getContactName(payloadJson: unknown) {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    return null;
  }

  const contactName = (payloadJson as { contactName?: unknown }).contactName;
  return typeof contactName === "string" && contactName.trim() ? contactName : null;
}

export default function RegistrationDetailCard({
  tenantSlug,
  initialRegistration,
  canEdit,
}: RegistrationDetailCardProps) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isUpdating, setIsUpdating] = useState(false);
  const routingSuggestion = getRoutingSuggestion(registration.birthYear);
  const contactName = getContactName(registration.payloadJson);

  async function updateStatus(status: RegistrationStatus) {
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registration.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Status konnte nicht aktualisiert werden.");
      }

      setRegistration(payload.registration);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Status konnte nicht aktualisiert werden.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <AdminSurfaceCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="fca-eyebrow">{TYPE_LABELS[registration.type] ?? registration.type}</p>
            <h3 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold uppercase tracking-[-0.04em] text-[#0b4aa2]">
              {registration.firstName} {registration.lastName}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Eingegangen am {formatDate(registration.submittedAt)}
            </p>
          </div>

          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0b4aa2]">
            Routing Suggestion: {routingSuggestion ?? "Keine Angabe"}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <dt className="fca-label">E-Mail</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{registration.email}</dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <dt className="fca-label">Telefon</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {registration.phone ?? "-"}
            </dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <dt className="fca-label">Jahrgang</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {registration.birthYear ?? "-"}
            </dd>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <dt className="fca-label">Kontaktperson</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {contactName ?? "-"}
            </dd>
          </div>
        </dl>

        {registration.message ? (
          <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4">
            <p className="fca-label">Nachricht</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {registration.message}
            </p>
          </div>
        ) : null}
      </AdminSurfaceCard>

      <AdminSurfaceCard className="p-6">
        <p className="fca-eyebrow">Bearbeitung</p>
        <h3 className="fca-subheading mt-2">Inbox Status</h3>
        <p className="mt-3 text-sm text-slate-600">
          Statusänderungen werden tenant-scoped gespeichert und im Audit Log protokolliert.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="fca-label">Status</span>
            {canEdit ? (
              <select
                value={registration.status}
                disabled={isUpdating}
                onChange={(event) => updateStatus(event.target.value as RegistrationStatus)}
                className="fca-select"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="fca-pill">{STATUS_LABELS[registration.status]}</span>
            )}
          </label>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="fca-label">Zugewiesen an</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {registration.assignedToUser
                ? `${registration.assignedToUser.firstName} ${registration.assignedToUser.lastName}`
                : "Nicht zugewiesen"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="fca-label">Quelle</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {registration.source ?? "-"}
            </p>
          </div>
        </div>
      </AdminSurfaceCard>
    </div>
  );
}
