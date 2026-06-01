"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RegistrationStatus } from "@prisma/client";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import type { RegistrationListItem } from "@/lib/registrations/queries";

type RegistrationsInboxTableProps = {
  tenantSlug: string;
  initialRegistrations: RegistrationListItem[];
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

function RoutingSuggestionBadge({ birthYear }: { birthYear: number | null }) {
  const suggestion = getRoutingSuggestion(birthYear);

  if (!suggestion) {
    return <span className="fca-pill">Keine Angabe</span>;
  }

  return (
    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0b4aa2]">
      {suggestion}
    </span>
  );
}

export default function RegistrationsInboxTable({
  tenantSlug,
  initialRegistrations,
  canEdit,
}: RegistrationsInboxTableProps) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const statusCounts = useMemo(() => {
    return registrations.reduce<Record<string, number>>((accumulator, registration) => {
      accumulator[registration.status] = (accumulator[registration.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [registrations]);

  async function updateStatus(registrationId: string, status: RegistrationStatus) {
    setUpdatingId(registrationId);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}`,
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

      setRegistrations((current) =>
        current.map((registration) =>
          registration.id === registrationId ? payload.registration : registration
        )
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Status konnte nicht aktualisiert werden.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminSurfaceCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="fca-eyebrow">Inbox</p>
            <h3 className="fca-subheading mt-2">Registrierungen nach Status</h3>
            <p className="mt-3 text-sm text-slate-600">
              Tenant-scoped Eingang mit berechneter Routing-Vorschau ohne automatische Zuweisung.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <span key={status} className="fca-pill">
                {STATUS_LABELS[status]}: {statusCounts[status] ?? 0}
              </span>
            ))}
          </div>
        </div>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Typ</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">E-Mail</th>
                <th className="px-5 py-3">Jahrgang</th>
                <th className="px-5 py-3">Routing Suggestion</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Eingang</th>
                <th className="px-5 py-3">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {registrations.map((registration) => (
                <tr key={registration.id} className="align-top">
                  <td className="px-5 py-4 font-medium text-slate-700">
                    {TYPE_LABELS[registration.type] ?? registration.type}
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    {registration.firstName} {registration.lastName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{registration.email}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {registration.birthYear ?? "-"}
                  </td>
                  <td className="px-5 py-4">
                    <RoutingSuggestionBadge birthYear={registration.birthYear} />
                  </td>
                  <td className="px-5 py-4">
                    {canEdit ? (
                      <select
                        value={registration.status}
                        disabled={updatingId === registration.id}
                        onChange={(event) =>
                          updateStatus(registration.id, event.target.value as RegistrationStatus)
                        }
                        className="fca-select min-w-[150px]"
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
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(registration.submittedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/tenant/${tenantSlug}/cockpit/registrations/${registration.id}`}
                      className="fca-button-secondary"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {registrations.length === 0 ? (
          <div className="border-t border-slate-100 p-6 text-sm text-slate-600">
            Keine Registrierungen für diesen Tenant gefunden.
          </div>
        ) : null}
      </AdminSurfaceCard>
    </div>
  );
}
