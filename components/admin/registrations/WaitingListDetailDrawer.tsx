"use client";

/**
 * components/admin/registrations/WaitingListDetailDrawer.tsx
 *
 * REG-WAIT-01D / REG-WAIT-01E: Premium operational inspector for a WaitingListEntry.
 * Phase 01E: Tabbed layout (Überblick / Verlauf), avatar header, context-sensitive
 * actions, improved information hierarchy.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flag,
  Loader2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { WaitingListEntryItem } from "@/lib/registrations/waiting-list-queries";
import type { WaitingListTimelineEntry } from "@/lib/registrations/waiting-list-timeline";
import type { AssignableUser, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import {
  WAITING_LIST_PRIORITY_COLORS,
  WAITING_LIST_PRIORITY_LABELS,
  WAITING_LIST_STATUS_COLORS,
  WAITING_LIST_STATUS_LABELS,
  formatWaitingListDate,
  formatWaitingListDateTime,
  getPersonInitials,
  isTerminalWaitingListStatus,
  waitingListDuration,
} from "@/lib/registrations/waiting-list-ui";
import { WaitingListCoordinatorPicker } from "./WaitingListCoordinatorPicker";
import { TeamSeasonScopePicker } from "./WaitingListScopePickers";
import { WaitingListWorkflowSteps } from "./WaitingListWorkflowSteps";
import {
  REGISTRATION_DRAWER_TAB_CONTENT_CLASS,
  RegistrationCommunicationTabPlaceholder,
  RegistrationDrawerTabBody,
  RegistrationDrawerTabStrip,
  type RegistrationDrawerTab,
} from "./RegistrationDrawerTabShell";
import type { WaitingListPriority } from "@prisma/client";

// ── Section helper ────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
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
      <span className="w-36 flex-shrink-0 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--foreground)]">{value ?? "—"}</span>
    </div>
  );
}

// ── Applicant avatar ──────────────────────────────────────────────────────────

function ApplicantAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = getPersonInitials(name) || name.slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br from-[color-mix(in_srgb,var(--tenant-primary)_10%,white)] to-[color-mix(in_srgb,var(--tenant-primary)_20%,white)] font-bold uppercase tracking-wide text-[var(--tenant-primary)]",
        "border-[color-mix(in_srgb,var(--tenant-primary)_20%,white)]",
        size === "md" ? "h-10 w-10 text-sm" : "h-7 w-7 text-[0.65rem]",
      )}
    >
      {initials}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  entry: WaitingListEntryItem;
  tenantSlug: string;
  canEdit: boolean;
  canDelete: boolean;
  eligibleCoordinators: AssignableUser[];
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
  eligibleCoordinators,
  onClose,
  onUpdate,
  onDelete,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPlacePanel, setShowPlacePanel] = useState(false);
  const [placeTeamSeasonId, setPlaceTeamSeasonId] = useState("");
  const [teamSeasonOptions, setTeamSeasonOptions] = useState<TeamSeasonOption[]>([]);
  const [teamSeasonOptionsLoading, setTeamSeasonOptionsLoading] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [activeTab, setActiveTab] = useState<RegistrationDrawerTab>("overview");
  const [timeline, setTimeline] = useState<WaitingListTimelineEntry[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const terminal = isTerminalWaitingListStatus(entry.status);

  useEffect(() => {
    if (!showPlacePanel) return;

    let cancelled = false;
    setTeamSeasonOptionsLoading(true);

    fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/scope-options`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Team-Saisons konnten nicht geladen werden.");
        if (!cancelled) setTeamSeasonOptions(Array.isArray(payload.teamSeasons) ? payload.teamSeasons : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Team-Saisons konnten nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) setTeamSeasonOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showPlacePanel, tenantSlug]);

  useEffect(() => {
    if (entry.scopeType === "TEAM_SEASON" && entry.teamSeasonId) {
      setPlaceTeamSeasonId(entry.teamSeasonId);
    }
  }, [entry.scopeType, entry.teamSeasonId]);

  useEffect(() => {
    if (activeTab !== "history") return;

    let cancelled = false;
    setTimelineLoading(true);

    fetch(
      `/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/${encodeURIComponent(entry.id)}/timeline`,
      { cache: "no-store" },
    )
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Verlauf konnte nicht geladen werden.");
        if (!cancelled) setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, entry.id, entry.updatedAt, tenantSlug]);

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
    ? entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
        <ApplicantAvatar name={personName} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--foreground)]">{personName}</h2>
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
                WAITING_LIST_STATUS_COLORS[entry.status],
              )}
            >
              {WAITING_LIST_STATUS_LABELS[entry.status]}
            </span>
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold",
                WAITING_LIST_PRIORITY_COLORS[entry.priority],
              )}
            >
              {WAITING_LIST_PRIORITY_LABELS[entry.priority]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Warteliste · seit {formatWaitingListDate(entry.addedAt)} ({waitingListDuration(entry.addedAt)})
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)]"
          aria-label="Schließen"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <RegistrationDrawerTabStrip activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Tab content ────────────────────────────────────────────────────── */}
      <RegistrationDrawerTabBody>

        {error ? (
          <div className="mx-5 mt-4 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {/* ── ÜBERBLICK tab ─────────────────────────────────────────────── */}
        {activeTab === "overview" ? (
          <div className={cn("space-y-4", REGISTRATION_DRAWER_TAB_CONTENT_CLASS)}>

            {/* Workflow & Status */}
            <WaitingListWorkflowSteps entry={entry} />

            {/* Bewerber/in — compact card */}
            <Section title="Bewerber/in" icon={User}>
              <div className="flex items-start gap-3">
                <ApplicantAvatar name={personName} size="sm" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-semibold text-[var(--foreground)]">{personName}</p>
                  {entry.registration.email ? (
                    <a
                      href={`mailto:${entry.registration.email}`}
                      className="block text-xs text-[var(--tenant-primary)] hover:underline"
                    >
                      {entry.registration.email}
                    </a>
                  ) : null}
                  {birthYear ? (
                    <p className="text-xs text-[var(--muted)]">Jahrgang {birthYear}</p>
                  ) : null}
                  {entry.person ? (
                    <a
                      href={`/dashboard/persons/${entry.person.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden />
                      Person verknüpft — öffnen
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    <p className="text-xs italic text-[var(--muted)]">Noch keine Person verknüpft</p>
                  )}
                </div>
              </div>
            </Section>

            {/* Wartelisten-Eintrag */}
            <Section title="Wartelisten-Eintrag" icon={ClipboardList}>
              <div className="space-y-1.5">
                <DataRow
                  label="Scope / Ziel"
                  value={
                    <span>
                      {entry.scopeType === "TARGET_GROUP"
                        ? "Zielgruppe"
                        : entry.scopeType === "ORG_UNIT"
                          ? "Abteilung"
                          : "Team"}
                      {": "}
                      {scopeLabel}
                    </span>
                  }
                />
                <DataRow label="Seit" value={formatWaitingListDate(entry.addedAt)} />
                <DataRow label="Wartezeit" value={waitingListDuration(entry.addedAt)} />
                <DataRow label="Priorität" value={WAITING_LIST_PRIORITY_LABELS[entry.priority]} />
                {entry.reason ? <DataRow label="Grund" value={entry.reason} /> : null}
                {entry.internalNote ? <DataRow label="Interne Notiz" value={entry.internalNote} /> : null}
              </div>

              {/* Priority & Responsible coordination — editable when active */}
              {canEdit && !terminal ? (
                <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <div>
                    <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Priorität ändern
                    </label>
                    <div className="flex gap-2">
                      {(["NORMAL", "HIGH", "URGENT"] as WaitingListPriority[]).map((priority) => (
                        <button
                          key={priority}
                          type="button"
                          disabled={busy === "priority" || entry.priority === priority}
                          onClick={() => patch({ priority }, "priority")}
                          className={cn(
                            "flex-1 rounded-[var(--radius-md)] border px-2 py-1.5 text-center text-xs font-semibold transition-colors disabled:opacity-50",
                            entry.priority === priority
                              ? WAITING_LIST_PRIORITY_COLORS[priority]
                              : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]",
                          )}
                        >
                          {WAITING_LIST_PRIORITY_LABELS[priority]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Verantwortliche Koordination
                    </label>
                    <WaitingListCoordinatorPicker
                      eligibleCoordinators={eligibleCoordinators}
                      selectedUserId={entry.responsibleUserId}
                      onSelect={(userId) => patch({ responsibleUserId: userId }, "responsible")}
                      disabled={busy === "responsible"}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
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
                      className="fca-input w-full resize-none text-xs"
                      placeholder="Grund eingeben…"
                      aria-label="Grund oder Bemerkung"
                    />
                  </div>
                </div>
              ) : null}
            </Section>

            {/* Context-sensitive actions */}
            {canEdit && !terminal ? (
              <Section title="Aktionen" icon={CheckCircle2}>
                <div className="space-y-2">
                  {/* Primary action — dominant call to action for current state */}
                  {entry.status === "WAITING" ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => patch({ status: "CONTACTED" }, "status")}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--tenant-primary)] bg-[var(--tenant-primary)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === "status" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Kontaktiert
                    </button>
                  ) : null}
                  {entry.status === "CONTACTED" ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => patch({ status: "OFFERED" }, "status")}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-purple-300 bg-purple-600 px-3 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {busy === "status" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Flag className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Angebot gemacht
                    </button>
                  ) : null}
                  {entry.status === "OFFERED" ? (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => setShowPlacePanel(true)}
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <UserCheck className="h-3.5 w-3.5" aria-hidden />
                      Platzieren
                    </button>
                  ) : null}

                  {/* Secondary actions */}
                  <div className="flex flex-wrap gap-2">
                    {entry.status !== "CONTACTED" && entry.status !== "WAITING" ? (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => patch({ status: "CONTACTED" }, "status-contacted")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                      >
                        Kontaktiert
                      </button>
                    ) : null}
                    {entry.status !== "OFFERED" && entry.status !== "WAITING" && entry.status !== "CONTACTED" ? (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => patch({ status: "OFFERED" }, "status-offered")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
                      >
                        Angebot gemacht
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => patch({ status: "WITHDRAWN" }, "withdraw")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      Zurückgezogen
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => patch({ status: "REJECTED" }, "reject")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Abgelehnt
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => patch({ status: "ARCHIVED" }, "archive")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                      Archivieren
                    </button>
                  </div>
                </div>
              </Section>
            ) : null}

            {/* Anmeldung reference — compact */}
            <Section title="Anmeldung" icon={ClipboardList}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--muted)]">Typ:</span>
                  <span className="font-medium text-[var(--foreground)]">{entry.registration.type}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--muted)]">Eingegangen:</span>
                  <span className="text-[var(--foreground)]">{formatWaitingListDateTime(entry.registration.submittedAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--muted)]">Status:</span>
                  <span className="text-[var(--foreground)]">{entry.registration.status}</span>
                </div>
              </div>
              <div className="mt-3">
                <a
                  href={`/tenant/${tenantSlug}/cockpit/registrations/${entry.registrationId}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Anmeldung öffnen
                </a>
              </div>
            </Section>

            {/* Placement panel */}
            {canEdit && !terminal ? (
              <Section title="Platzierung" icon={UserCheck}>
                {entry.status === "PLACED" ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Erfolgreich platziert</p>
                      {entry.resolvedAt ? (
                        <p className="text-xs text-[var(--muted)]">Am {formatWaitingListDateTime(entry.resolvedAt)}</p>
                      ) : null}
                    </div>
                  </div>
                ) : entry.person ? (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--muted)]">
                      Person{" "}
                      <strong>
                        {entry.person.displayName || `${entry.person.firstName} ${entry.person.lastName}`}
                      </strong>{" "}
                      ist verknüpft.
                      {entry.scopeType === "TEAM_SEASON" && entry.teamSeason
                        ? ` Ziel: ${entry.teamSeason.team.name} — ${entry.teamSeason.displayName}.`
                        : " Bitte Team / Saison für Platzierung wählen."}
                    </p>
                    {!showPlacePanel ? (
                      <button
                        type="button"
                        onClick={() => setShowPlacePanel(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        Platzieren
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {entry.scopeType !== "TEAM_SEASON" ? (
                          <div>
                            <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--muted)]">
                              Team / Saison
                            </label>
                            {teamSeasonOptionsLoading ? (
                              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Team-Saisons werden geladen…
                              </div>
                            ) : (
                              <TeamSeasonScopePicker
                                teamSeasons={teamSeasonOptions}
                                value={placeTeamSeasonId}
                                onChange={setPlaceTeamSeasonId}
                                placeholder="— Team / Saison wählen —"
                              />
                            )}
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!!busy || (entry.scopeType !== "TEAM_SEASON" && !placeTeamSeasonId)}
                            onClick={handlePlace}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {busy === "place" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" aria-hidden />
                            )}
                            Platzierung bestätigen
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPlacePanel(false)}
                            className="inline-flex h-8 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                          >
                            Abbrechen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" aria-hidden />
                    <p>Keine Person verknüpft. Bitte zuerst über die Anmeldung eine Person anlegen oder verknüpfen.</p>
                  </div>
                )}
              </Section>
            ) : null}

            {/* Placed terminal state */}
            {entry.status === "PLACED" && (
              <Section title="Platzierung" icon={UserCheck}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Erfolgreich platziert</p>
                    {entry.resolvedAt ? (
                      <p className="text-xs text-[var(--muted)]">Am {formatWaitingListDateTime(entry.resolvedAt)}</p>
                    ) : null}
                  </div>
                </div>
              </Section>
            )}

            {/* Permanent delete — bottom of page */}
            {canDelete ? (
              <div className="pt-2 pb-4">
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
                        className="inline-flex h-7 items-center gap-1 rounded-md bg-rose-600 px-2.5 text-[0.72rem] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                        Endgültig löschen
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirming(false)}
                        className="inline-flex h-7 items-center rounded-md border border-[var(--border)] bg-white px-2.5 text-[0.72rem] font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── VERLAUF tab ──────────────────────────────────────────────────── */}
        {activeTab === "history" ? (
          <div className={REGISTRATION_DRAWER_TAB_CONTENT_CLASS}>
            {timelineLoading && !timeline ? (
              <p className="text-sm text-[var(--muted)]">Wird geladen…</p>
            ) : timeline && timeline.length > 0 ? (
              <ol className="space-y-0">
                {timeline.map((event, idx) => (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
                      </span>
                      {idx < timeline.length - 1 ? (
                        <span className="my-1 flex-1 w-px bg-[var(--border)]" aria-hidden />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      <p className="text-sm font-medium text-[var(--foreground)]">{event.label}</p>
                      <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
                        {formatWaitingListDateTime(event.occurredAt)}
                        {event.actorName ? ` · ${event.actorName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-[var(--muted)]">Kein Verlauf vorhanden.</p>
            )}
          </div>
        ) : null}

        {activeTab === "communication" ? <RegistrationCommunicationTabPlaceholder /> : null}
      </RegistrationDrawerTabBody>
    </div>
  );
}
