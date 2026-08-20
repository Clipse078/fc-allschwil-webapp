"use client";

/**
 * components/admin/registrations/AddToWaitingListDialog.tsx
 *
 * REG-WAIT-01: Focused dialog for placing a Registration on the Waiting List.
 *
 * Collects:
 *   - scope (TARGET_GROUP | ORG_UNIT | TEAM_SEASON)
 *   - target group / OrgUnit / TeamSeason depending on scope
 *   - responsible coordinator
 *   - priority
 *   - reason
 *   - optional internal note
 *
 * On confirm:
 *   1. POST /api/tenants/{slug}/waiting-list
 *   2. Registration moves to WAITING
 *   3. WaitingListEntry is created
 *   4. Parent gets callback with updated registration
 */

import { useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { AssignableUser, TargetGroupOption } from "@/lib/registrations/workflow-types";
import type { WaitingListScopeType, WaitingListPriority } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  registration: RegistrationListItem;
  tenantSlug: string;
  assignableUsers: AssignableUser[];
  targetGroups: TargetGroupOption[];
  onSuccess: (updatedRegistration: RegistrationListItem) => void;
};

type ScopeOption = { value: WaitingListScopeType; label: string };

const SCOPE_OPTIONS: ScopeOption[] = [
  { value: "TARGET_GROUP", label: "Zielgruppe / Altersbereich" },
  { value: "ORG_UNIT", label: "Abteilung / OrgUnit" },
  { value: "TEAM_SEASON", label: "Konkretes Team (Saison)" },
];

const PRIORITY_OPTIONS: { value: WaitingListPriority; label: string; desc: string }[] = [
  { value: "NORMAL", label: "Normal", desc: "Standardpriorität" },
  { value: "HIGH", label: "Hoch", desc: "Bevorzugt behandeln" },
  { value: "URGENT", label: "Dringend", desc: "Sofortiger Handlungsbedarf" },
];

const PRIORITY_COLORS: Record<WaitingListPriority, string> = {
  NORMAL: "border-slate-200 bg-slate-50 text-slate-700",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700",
  URGENT: "border-rose-200 bg-rose-50 text-rose-700",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AddToWaitingListDialog({
  open,
  onClose,
  registration,
  tenantSlug,
  assignableUsers,
  targetGroups,
  onSuccess,
}: Props) {
  const [scopeType, setScopeType] = useState<WaitingListScopeType>("TARGET_GROUP");
  const [targetGroupId, setTargetGroupId] = useState<string>(registration.targetGroupId ?? "");
  const [orgUnitId, setOrgUnitId] = useState<string>("");
  const [teamSeasonId, setTeamSeasonId] = useState<string>("");
  const [priority, setPriority] = useState<WaitingListPriority>("NORMAL");
  const [responsibleUserId, setResponsibleUserId] = useState<string>(
    registration.assignedToUserId ?? "",
  );
  const [reason, setReason] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    // Client-side scope validation
    if (scopeType === "TARGET_GROUP" && !targetGroupId) {
      setError("Bitte eine Zielgruppe auswählen.");
      return;
    }
    if (scopeType === "ORG_UNIT" && !orgUnitId) {
      setError("Bitte eine Organisationseinheit angeben.");
      return;
    }
    if (scopeType === "TEAM_SEASON" && !teamSeasonId) {
      setError("Bitte ein Team / eine Saison angeben.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: registration.id,
          scopeType,
          targetGroupId: scopeType === "TARGET_GROUP" ? targetGroupId || null : null,
          orgUnitId: scopeType === "ORG_UNIT" ? orgUnitId || null : null,
          teamSeasonId: scopeType === "TEAM_SEASON" ? teamSeasonId || null : null,
          priority,
          responsibleUserId: responsibleUserId || null,
          reason: reason || null,
          internalNote: internalNote || null,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Unbekannter Fehler.");

      // Update the registration to reflect WAITING status
      const updatedReg: RegistrationListItem = { ...registration, status: "WAITING" };
      onSuccess(updatedReg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen des Wartelisten-Eintrags.");
    } finally {
      setBusy(false);
    }
  };

  const personName = `${registration.firstName} ${registration.lastName}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Auf Warteliste setzen"
      description={`Anmeldung von ${personName} auf die Warteliste setzen.`}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center h-9 px-4 rounded-lg border border-[var(--border)] bg-white text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[var(--tenant-primary)] bg-[var(--tenant-primary)] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ClipboardList className="h-4 w-4" aria-hidden />}
            Auf Warteliste setzen
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Scope */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            Wartelisten-Ebene
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScopeType(opt.value)}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-xs font-semibold text-left transition-colors ${
                  scopeType === opt.value
                    ? "border-[var(--tenant-primary)] bg-[var(--tenant-primary)]/10 text-[var(--tenant-primary)]"
                    : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scope-specific picker */}
        {scopeType === "TARGET_GROUP" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Zielgruppe <span className="text-rose-500">*</span>
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="fca-select text-sm"
            >
              <option value="">— Zielgruppe wählen —</option>
              {targetGroups.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.name}
                </option>
              ))}
            </select>
            {targetGroups.length === 0 && (
              <p className="mt-1 text-xs text-[var(--muted)] italic">
                Keine aktiven Zielgruppen für diesen Mandanten hinterlegt.
              </p>
            )}
          </div>
        )}

        {scopeType === "ORG_UNIT" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Abteilung / OrgUnit-ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={orgUnitId}
              onChange={(e) => setOrgUnitId(e.target.value)}
              placeholder="OrgUnit-ID eingeben"
              className="fca-input text-sm w-full"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Die ID der Organisationseinheit aus der Abteilungsverwaltung.
            </p>
          </div>
        )}

        {scopeType === "TEAM_SEASON" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              TeamSeason-ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={teamSeasonId}
              onChange={(e) => setTeamSeasonId(e.target.value)}
              placeholder="TeamSeason-ID eingeben"
              className="fca-input text-sm w-full"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">
              Die ID der Saison-Teamzuweisung aus der Teamverwaltung.
            </p>
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
            Priorität
          </label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-xs font-semibold text-center transition-colors ${
                  priority === opt.value
                    ? PRIORITY_COLORS[opt.value]
                    : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Responsible coordinator */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Verantwortliche Koordination
          </label>
          <select
            value={responsibleUserId}
            onChange={(e) => setResponsibleUserId(e.target.value)}
            className="fca-select text-sm"
          >
            <option value="">— Nicht zugewiesen —</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Grund / Bemerkung
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Warum wartet diese Person? (optional)"
            className="fca-input text-sm w-full resize-none"
          />
        </div>

        {/* Internal note */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Interne Notiz
          </label>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={2}
            placeholder="Interne Anmerkungen (nur für Koordination sichtbar, optional)"
            className="fca-input text-sm w-full resize-none"
          />
        </div>
      </div>
    </Dialog>
  );
}
