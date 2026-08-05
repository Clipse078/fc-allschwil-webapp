"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RegistrationStatus } from "@prisma/client";
import { Calendar, ChevronRight, Mail, Search, UserCheck, UserX } from "lucide-react";
import { getRoutingSuggestion } from "@/lib/registrations/routing-suggestion";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import { formatDateShort } from "@/lib/tenant-runtime/formatters";
import { EmptyState } from "@/components/ui/page";
import {
  STATUS_ORDER,
  STATUS_LABELS as SHARED_STATUS_LABELS,
  STATUS_BADGE_CLASS as SHARED_STATUS_BADGE_CLASS,
} from "@/lib/registrations/status";

type RegistrationsInboxTableProps = {
  tenantSlug: string;
  initialRegistrations: RegistrationListItem[];
  canEdit: boolean;
  /** Tenant locale (e.g. "de-CH"). Falls back to "de-CH" when absent. */
  locale?: string;
};

const TYPE_LABELS: Record<string, string> = {
  PROBETRAINING: "Probetraining",
  SPIELERANMELDUNG: "Spieleranmeldung",
  TRAINERANMELDUNG: "Traineranmeldung",
  SPONSORANFRAGE: "Sponsoranfrage",
  KONTAKTANFRAGE: "Kontaktanfrage",
  OTHER: "Andere",
  // Website-integration types
  MITGLIEDSCHAFT: "Mitgliedschaft",
  FREIWILLIGENMELDUNG: "Freiwilligenmeldung",
  SCHIEDSRICHTERANMELDUNG: "Schiedsrichteranmeldung",
  CAMP_ANMELDUNG: "Camp-Anmeldung",
  VERANSTALTUNGSANMELDUNG: "Veranstaltungsanmeldung",
};

// REGISTRATION-01F — Goal 8: status metadata now lives in one shared module.
const STATUS_LABELS = SHARED_STATUS_LABELS;
const STATUS_BADGE_CLASS = SHARED_STATUS_BADGE_CLASS;

const TYPE_BADGE_CLASS: Record<string, string> = {
  PROBETRAINING: "border-blue-200 bg-blue-50 text-blue-700",
  SPIELERANMELDUNG: "border-indigo-200 bg-indigo-50 text-indigo-700",
  TRAINERANMELDUNG: "border-violet-200 bg-violet-50 text-violet-700",
  SPONSORANFRAGE: "border-amber-200 bg-amber-50 text-amber-700",
  KONTAKTANFRAGE: "border-slate-200 bg-slate-50 text-slate-600",
  OTHER: "border-slate-200 bg-slate-50 text-slate-400",
};

const STATUS_OPTIONS = STATUS_ORDER;


function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function RoutingSuggestionBadge({ birthYear }: { birthYear: number | null }) {
  const suggestion = getRoutingSuggestion(birthYear);
  if (!suggestion) {
    return (
      <span className="hidden lg:inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-[0.65rem] font-semibold text-slate-400">
        Kein Jahrgang
      </span>
    );
  }
  return (
    <span className="hidden lg:inline-flex h-5 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-[0.65rem] font-semibold text-[var(--blue)]">
      {suggestion}
    </span>
  );
}


export default function RegistrationsInboxTable({
  tenantSlug,
  initialRegistrations,
  canEdit,
  locale = "de-CH",
}: RegistrationsInboxTableProps) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const cfg = { locale };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter(
      (r) =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (TYPE_LABELS[r.type] ?? r.type).toLowerCase().includes(q) ||
        STATUS_LABELS[r.status].toLowerCase().includes(q),
    );
  }, [registrations, query]);

  const newCount = registrations.filter((r) => r.status === "NEW").length;
  const pendingCount = registrations.filter((r) =>
    (["REVIEWING", "CONTACTED"] as RegistrationStatus[]).includes(r.status),
  ).length;
  const processedCount = registrations.filter((r) =>
    (["ACCEPTED", "REJECTED", "ARCHIVED"] as RegistrationStatus[]).includes(
      r.status,
    ),
  ).length;

  async function updateStatus(
    registrationId: string,
    status: RegistrationStatus,
  ) {
    setUpdatingId(registrationId);

    try {
      const response = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Status konnte nicht aktualisiert werden.",
        );
      }

      setRegistrations((current) =>
        current.map((r) =>
          r.id === registrationId ? payload.registration : r,
        ),
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Status konnte nicht aktualisiert werden.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="sce-kpi-card">
          <p className="sce-data-label">Eingang</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--foreground)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {registrations.length}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Total</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Neu</p>
          <p
            className="mt-1.5 text-2xl font-bold text-[var(--blue)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {newCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">unbearbeitet</p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">In Bearbeitung</p>
          <p
            className="mt-1.5 text-2xl font-bold text-amber-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            In Prüfung · Kontaktiert
          </p>
        </div>
        <div className="sce-kpi-card">
          <p className="sce-data-label">Abgeschlossen</p>
          <p
            className="mt-1.5 text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {processedCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Angenommen · Abgelehnt
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="sce-page-search">
        <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Suche nach Name, E-Mail, Typ oder Status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="flex-shrink-0 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Löschen
          </button>
        ) : null}
      </div>

      {/* Result count */}
      {query.trim() ? (
        <p className="text-sm text-[var(--muted)]">
          {filtered.length} von {registrations.length} Registrierungen
        </p>
      ) : null}

      {/* List */}
      {registrations.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-10 w-10" />}
          heading="Keine Registrierungen"
          description="Noch keine Einträge für diesen Tenant eingegangen."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          heading="Keine Treffer"
          description={`Für „${query}" wurden keine Registrierungen gefunden.`}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          {filtered.map((reg, idx) => {
            const isLast = idx === filtered.length - 1;
            const detailHref = `/tenant/${tenantSlug}/cockpit/registrations/${reg.id}`;
            const initials = getInitials(reg.firstName, reg.lastName);
            const typeBadgeClass =
              TYPE_BADGE_CLASS[reg.type] ?? TYPE_BADGE_CLASS.OTHER;
            const typeLabel = TYPE_LABELS[reg.type] ?? reg.type;
            const isUpdating = updatingId === reg.id;

            return (
              <div
                key={reg.id}
                className={`flex items-center gap-3 px-5 py-4 transition hover:bg-[var(--surface-2)] ${
                  !isLast ? "border-b border-[var(--border)]" : ""
                }`}
              >
                {/* Initials avatar */}
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-sm font-bold uppercase text-[var(--blue)]">
                  {initials}
                </div>

                {/* Name + meta — navigable link area */}
                <Link href={detailHref} className="group/row min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)] group-hover/row:text-[var(--blue)]">
                      {reg.firstName} {reg.lastName}
                    </span>
                    <span
                      className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${typeBadgeClass}`}
                    >
                      {typeLabel}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Mail className="h-3 w-3" />
                      {reg.email}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Calendar className="h-3 w-3" />
                      {formatDateShort(reg.submittedAt, cfg)}
                    </span>
                  </div>
                </Link>

                {/* Routing suggestion */}
                <RoutingSuggestionBadge birthYear={reg.birthYear} />

                {/* Assignee — show if set */}
                {reg.assignedToUser ? (
                  <span className="hidden xl:inline-flex items-center gap-1 text-[0.65rem] font-semibold text-[var(--muted)] border border-[var(--border)] rounded-full px-2 py-0.5">
                    <UserCheck className="h-3 w-3" />
                    {reg.assignedToUser.firstName} {reg.assignedToUser.lastName}
                  </span>
                ) : null}

                {/* Status — interactive, not inside a link */}
                {canEdit ? (
                  <select
                    value={reg.status}
                    disabled={isUpdating}
                    onChange={(e) =>
                      updateStatus(reg.id, e.target.value as RegistrationStatus)
                    }
                    className="fca-select hidden flex-shrink-0 text-xs sm:block"
                    style={{ minWidth: "130px" }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`hidden flex-shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold sm:inline-flex ${STATUS_BADGE_CLASS[reg.status]}`}
                  >
                    {STATUS_LABELS[reg.status]}
                  </span>
                )}

                {/* Chevron → detail */}
                <Link
                  href={detailHref}
                  className="flex-shrink-0 text-[var(--muted)] transition hover:text-[var(--blue)]"
                  aria-label="Details anzeigen"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
