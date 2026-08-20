"use client";

/**
 * components/admin/registrations/WaitingListDetailDrawer.tsx
 *
 * REG-WAIT-01: Right-side inspector for a WaitingListEntry.
 *
 * Groups information as specified:
 *   Bewerber/in — applicant info from registration + linked person
 *   Warteliste   — operational waiting list state
 *   Anmeldung    — source registration summary
 *   Platzierung  — placement actions
 *   Verlauf      — key timestamps
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  Flag,
  Loader2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { WaitingListEntryItem } from "@/lib/registrations/waiting-list-queries";
import type { AssignableUser } from "@/lib/registrations/workflow-types";
import type { WaitingListStatus, WaitingListPriority } from "@prisma/client";

// ── Status / priority display ─────────────────────────────────────────────────

const STATUS_LABELS: Record<WaitingListStatus, string> = {
  WAITING: "Wartend",
  CONTACTED: "Kontaktiert",
  OFFERED: "Angebot gemacht",
  PLACED: "Platziert",
  WITHDRAWN: "Zurückgezogen",
  REJECTED: "Abgelehnt",
  ARCHIVED: "Archiviert",
};

const STATUS_COLORS: Record<WaitingListStatus, string> = {
  WAITING: "border-amber-200 bg-amber-50 text-amber-800",
  CONTACTED: "border-blue-200 bg-blue-50 text-blue-800",
  OFFERED: "border-purple-200 bg-purple-50 text-purple-800",
  PLACED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  WITHDRAWN: "border-slate-200 bg-slate-50 text-slate-600",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-700",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-500",
};

const PRIORITY_LABELS: Record<WaitingListPriority, string> = {
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

const PRIORITY_COLORS: Record<WaitingListPriority, string> = {
  NORMAL: "border-slate-200 bg-slate-50 text-slate-600",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  URGENT: "border-rose-200 bg-rose-50 text-rose-700",
};

// ── Type helpers ─────────────────────────────────────────────────────────────

const TERMINAL: WaitingListStatus[] = ["PLACED", "WITHDRAWN", "REJECTED", "ARCHIVED"];

function isTerminal(status: WaitingListStatus) {
  return TERMINAL.includes(status);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function waitingDuration(addedAt: string) {
  const ms = Date.now() - new Date(addedAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `${days} Tage`;
  if (days < 30) return `${Math.floor(days / 7)} Woche(n)`;
  return `${Math.floor(days / 30)} Monat(e)`;
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--muted)]" aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{title}</p>
        </div>
      </div>
      <div className="sce-detail-section-body">{children}</div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <span className="w-36 flex-shrink-0 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="text-sm text-[var(--foreground)]">{value ?? "—"}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  entry: WaitingListEntryItem;
  tenantSlug: string;
  canEdit: boolean;
  canDelete: boolean;
  assignableUsers: AssignableUser[];
  onClose: () => void;
  onUpdate: (updated: WaitingListEntryItem) => void;
  onDelete: () => void;
};

// ── Main component ────────────────────────────────────────────────────────────

export function WaitingListDetailDrawer({
  entry,
  tenantSlug,
  canEdit,
  canDelete,
  assignableUsers,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPlacePanel, setShowPlacePanel] = useState(false);
  const [placeTeamSeasonId, setPlaceTeamSeasonId] = useState("");
  const [deleteConfirming, setDeleteConfirming] = useState(false);

  const terminal = isTerminal(entry.status);

  const patch = async (body: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/${encodeURIComponent(entry.id)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Fehler beim Speichern.");
      onUpdate(payload.entry as WaitingListEntryItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern.");
    } finally {
      setBusy(null);
    }
  };

  const handlePlace = async () => {
    setBusy("place");
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/${encodeURIComponent(entry.id)}/place`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamSeasonId: placeTeamSeasonId || null }),
        },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Platzierung fehlgeschlagen.");
      onUpdate(payload.entry as WaitingListEntryItem);
      setShowPlacePanel(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Platzierung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (confirmed: boolean) => {
    if (!confirmed) {
      setDeleteConfirming(true);
      return;
    }
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/${encodeURIComponent(entry.id)}/permanent?confirm=true`,
        { method: "DELETE" },
      );
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Löschen fehlgeschlagen.");
      onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
      setDeleteConfirming(false);
    } finally {
      setBusy(null);
    }
  };

  const personName = entry.person
    ? (entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`)
    : `${entry.registration.firstName} ${entry.registration.lastName}`;

  const birthYear = entry.person?.dateOfBirth
    ? new Date(entry.person.dateOfBirth).getFullYear()
    : entry.registration.birthYear;

  const scopeLabel =
    entry.targetGroup?.name ??
    entry.orgUnit?.name ??
    (entry.teamSeason ? `${entry.teamSeason.team.name} — ${entry.teamSeason.displayName}` : "—");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-[var(--foreground)] truncate">{personName}</h2>
            <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold", STATUS_COLORS[entry.status])}>
              {STATUS_LABELS[entry.status]}
            </span>
            <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold", PRIORITY_COLORS[entry.priority])}>
              {PRIORITY_LABELS[entry.priority]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Warteliste · seit {formatDate(entry.addedAt)}</p>
        </div>
        <button type="button" onClick={onClose} className="flex-shrink-0 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Bewerber/in */}
        <Section title="Bewerber/in" icon={User}>
          <div className="space-y-1.5">
            <DataRow label="Name" value={personName} />
            {birthYear && <DataRow label="Jahrgang" value={birthYear} />}
            <DataRow label="E-Mail" value={
              entry.registration.email
                ? <a href={`mailto:${entry.registration.email}`} className="text-[var(--tenant-primary)] hover:underline">{entry.registration.email}</a>
                : null
            } />
            {entry.person ? (
              <DataRow
                label="Person"
                value={
                  <a href={`/dashboard/persons/${entry.person.id}`} className="inline-flex items-center gap-1 text-[var(--tenant-primary)] hover:underline">
                    Person öffnen <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                }
              />
            ) : (
              <DataRow label="Person" value={<span className="text-[var(--muted)] italic text-xs">Noch keine Person verknüpft</span>} />
            )}
          </div>
        </Section>

        {/* Warteliste */}
        <Section title="Warteliste" icon={ClipboardList}>
          <div className="space-y-1.5">
            <DataRow label="Seit" value={formatDate(entry.addedAt)} />
            <DataRow label="Wartezeit" value={waitingDuration(entry.addedAt)} />
            <DataRow label="Scope" value={
              <span>{entry.scopeType === "TARGET_GROUP" ? "Zielgruppe" : entry.scopeType === "ORG_UNIT" ? "Abteilung" : "Team"}: {scopeLabel}</span>
            } />
            {entry.reason && <DataRow label="Grund" value={entry.reason} />}
            {entry.internalNote && <DataRow label="Interne Notiz" value={entry.internalNote} />}
            <DataRow label="Verantwortlich" value={
              entry.responsibleUser
                ? `${entry.responsibleUser.firstName} ${entry.responsibleUser.lastName}`
                : <span className="text-[var(--muted)] italic text-xs">Nicht zugewiesen</span>
            } />
          </div>

          {/* Editable fields */}
          {canEdit && !terminal && (
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
              <div>
                <label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Priorität ändern
                </label>
                <div className="flex gap-2">
                  {(["NORMAL", "HIGH", "URGENT"] as WaitingListPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={busy === "priority" || entry.priority === p}
                      onClick={() => patch({ priority: p }, "priority")}
                      className={cn(
                        "flex-1 rounded-[var(--radius-md)] border px-2 py-1.5 text-xs font-semibold text-center transition-colors disabled:opacity-50",
                        entry.priority === p ? PRIORITY_COLORS[p] : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                      )}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Verantwortliche Koordination
                </label>
                <select
                  disabled={busy === "responsible"}
                  value={entry.responsibleUserId ?? ""}
                  onChange={(e) => patch({ responsibleUserId: e.target.value || null }, "responsible")}
                  className="fca-select text-xs w-full"
                >
                  <option value="">— Nicht zugewiesen —</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                  Grund / Bemerkung
                </label>
                <textarea
                  rows={2}
                  disabled={busy === "note"}
                  defaultValue={entry.reason ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (entry.reason ?? "")) {
                      patch({ reason: e.target.value || null }, "note");
                    }
                  }}
                  className="fca-input text-xs w-full resize-none"
                  placeholder="Grund eingeben…"
                />
              </div>
            </div>
          )}
        </Section>

        {/* Workflow actions */}
        {canEdit && !terminal && (
          <Section title="Aktionen" icon={CheckCircle2}>
            <div className="flex flex-wrap gap-2">
              {entry.status !== "CONTACTED" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => patch({ status: "CONTACTED" }, "status")}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--border)] bg-white text-xs font-semibold text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                >
                  {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                  Kontaktiert
                </button>
              )}
              {entry.status !== "OFFERED" && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => patch({ status: "OFFERED" }, "status")}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-purple-200 bg-purple-50 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                >
                  {busy === "status" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Flag className="h-3.5 w-3.5" aria-hidden />}
                  Angebot gemacht
                </button>
              )}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => patch({ status: "WITHDRAWN" }, "withdraw")}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                {busy === "withdraw" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                Zurückgezogen
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => patch({ status: "REJECTED" }, "reject")}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                Abgelehnt
              </button>
            </div>
          </Section>
        )}

        {/* Anmeldung */}
        <Section title="Anmeldung" icon={ClipboardList}>
          <div className="space-y-1.5">
            <DataRow label="Typ" value={entry.registration.type} />
            <DataRow label="Eingegangen" value={formatDateTime(entry.registration.submittedAt)} />
            <DataRow label="Status" value={entry.registration.status} />
          </div>
          <div className="mt-3">
            <a
              href={`/tenant/${tenantSlug}/cockpit/registrations/${entry.registrationId}`}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-[var(--border)] bg-white text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Anmeldung öffnen
            </a>
          </div>
        </Section>

        {/* Platzierung */}
        {canEdit && !terminal && (
          <Section title="Platzierung" icon={UserCheck}>
            {entry.person ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--muted)]">
                  Person <strong>{entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`}</strong> ist verknüpft.
                  {entry.scopeType === "TEAM_SEASON" && entry.teamSeason
                    ? ` Ziel: ${entry.teamSeason.team.name} — ${entry.teamSeason.displayName}.`
                    : " Bitte TeamSeason für Platzierung angeben."}
                </p>
                {!showPlacePanel ? (
                  <button
                    type="button"
                    onClick={() => setShowPlacePanel(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <UserCheck className="h-3.5 w-3.5" aria-hidden />
                    Platzieren
                  </button>
                ) : (
                  <div className="space-y-2">
                    {entry.scopeType !== "TEAM_SEASON" && (
                      <div>
                        <label className="block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)] mb-1">
                          TeamSeason-ID (optional)
                        </label>
                        <input
                          type="text"
                          value={placeTeamSeasonId}
                          onChange={(e) => setPlaceTeamSeasonId(e.target.value)}
                          placeholder="ID des Teams eingeben…"
                          className="fca-input text-xs w-full"
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={handlePlace}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {busy === "place" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <UserCheck className="h-3.5 w-3.5" aria-hidden />}
                        Platzierung bestätigen
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPlacePanel(false)}
                        className="inline-flex items-center h-8 px-3 rounded-lg border border-[var(--border)] bg-white text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" aria-hidden />
                <p>Keine Person verknüpft. Bitte zuerst über die Anmeldung eine Person anlegen oder verknüpfen.</p>
              </div>
            )}
          </Section>
        )}

        {/* Placed state */}
        {entry.status === "PLACED" && (
          <Section title="Platzierung" icon={UserCheck}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Erfolgreich platziert</p>
                {entry.resolvedAt && (
                  <p className="text-xs text-[var(--muted)]">Am {formatDateTime(entry.resolvedAt)}</p>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* Verlauf */}
        <Section title="Verlauf" icon={Clock}>
          <div className="space-y-1.5">
            <DataRow label="Hinzugefügt" value={formatDateTime(entry.addedAt)} />
            {entry.lastContactedAt && <DataRow label="Kontaktiert" value={formatDateTime(entry.lastContactedAt)} />}
            {entry.offeredAt && <DataRow label="Angebot" value={formatDateTime(entry.offeredAt)} />}
            {entry.resolvedAt && (
              <DataRow label="Abgeschlossen" value={`${formatDateTime(entry.resolvedAt)}${entry.resolvedByUser ? ` · ${entry.resolvedByUser.firstName} ${entry.resolvedByUser.lastName}` : ""}`} />
            )}
          </div>
        </Section>

        {/* Permanent delete */}
        {canDelete && (
          <div className="pt-2">
            {!deleteConfirming ? (
              <button
                type="button"
                onClick={() => handleDelete(false)}
                className="text-[0.7rem] font-medium text-rose-600 hover:text-rose-800 hover:underline"
              >
                Eintrag endgültig löschen
              </button>
            ) : (
              <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-3">
                <p className="text-xs font-semibold text-rose-800">Wirklich endgültig löschen?</p>
                <p className="mt-0.5 text-xs text-rose-700">Die Anmeldung und die Person bleiben unberührt.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === "delete"}
                    onClick={() => handleDelete(true)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-rose-600 text-white text-[0.72rem] font-semibold hover:bg-rose-700 disabled:opacity-50"
                  >
                    {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                    Endgültig löschen
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirming(false)}
                    className="inline-flex items-center h-7 px-2.5 rounded-md border border-[var(--border)] bg-white text-[0.72rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
