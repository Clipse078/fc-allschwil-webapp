"use client";

/**
 * components/admin/registrations/AddToWaitingListDialog.tsx
 *
 * REG-WAIT-01D: Dialog for placing a Registration on the Waiting List.
 */

import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { RegistrationListItem } from "@/lib/registrations/queries";
import type { AssignableUser, OrgUnitOption, TargetGroupOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";
import { WAITING_LIST_PRIORITY_COLORS } from "@/lib/registrations/waiting-list-ui";
import { WaitingListCoordinatorPicker } from "./WaitingListCoordinatorPicker";
import { OrgUnitScopePicker, TeamSeasonScopePicker } from "./WaitingListScopePickers";
import type { WaitingListPriority, WaitingListScopeType } from "@prisma/client";

type Props = {
  open: boolean;
  onClose: () => void;
  registration: RegistrationListItem;
  tenantSlug: string;
  eligibleCoordinators: AssignableUser[];
  targetGroups: TargetGroupOption[];
  orgUnits?: OrgUnitOption[];
  teamSeasons?: TeamSeasonOption[];
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

export function AddToWaitingListDialog({
  open,
  onClose,
  registration,
  tenantSlug,
  eligibleCoordinators,
  targetGroups,
  orgUnits: initialOrgUnits = [],
  teamSeasons: initialTeamSeasons = [],
  onSuccess,
}: Props) {
  const [scopeType, setScopeType] = useState<WaitingListScopeType>("TARGET_GROUP");
  const [targetGroupId, setTargetGroupId] = useState<string>(registration.targetGroupId ?? "");
  const [orgUnitId, setOrgUnitId] = useState<string>("");
  const [teamSeasonId, setTeamSeasonId] = useState<string>("");
  const [priority, setPriority] = useState<WaitingListPriority>("NORMAL");
  const [responsibleUserId, setResponsibleUserId] = useState<string>(registration.assignedToUserId ?? "");
  const [reason, setReason] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>(initialOrgUnits);
  const [teamSeasons, setTeamSeasons] = useState<TeamSeasonOption[]>(initialTeamSeasons);
  const [scopeOptionsLoading, setScopeOptionsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialOrgUnits.length > 0 && initialTeamSeasons.length > 0) {
      setOrgUnits(initialOrgUnits);
      setTeamSeasons(initialTeamSeasons);
      return;
    }

    let cancelled = false;
    setScopeOptionsLoading(true);

    fetch(`/api/tenants/${encodeURIComponent(tenantSlug)}/waiting-list/scope-options`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Auswahloptionen konnten nicht geladen werden.");
        if (cancelled) return;
        setOrgUnits(Array.isArray(payload.orgUnits) ? payload.orgUnits : []);
        setTeamSeasons(Array.isArray(payload.teamSeasons) ? payload.teamSeasons : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Auswahloptionen konnten nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) setScopeOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, tenantSlug, initialOrgUnits, initialTeamSeasons]);

  const handleSubmit = async () => {
    setError(null);

    if (scopeType === "TARGET_GROUP" && !targetGroupId) {
      setError("Bitte eine Zielgruppe auswählen.");
      return;
    }
    if (scopeType === "ORG_UNIT" && !orgUnitId) {
      setError("Bitte eine Abteilung auswählen.");
      return;
    }
    if (scopeType === "TEAM_SEASON" && !teamSeasonId) {
      setError("Bitte ein Team / eine Saison auswählen.");
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

      onSuccess({ ...registration, status: "WAITING" });
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
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-white px-4 text-sm font-medium text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || scopeOptionsLoading}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--tenant-primary)] bg-[var(--tenant-primary)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ClipboardList className="h-4 w-4" aria-hidden />}
            Auf Warteliste setzen
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Wartelisten-Ebene
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setScopeType(opt.value)}
                className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
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

        {scopeType === "TARGET_GROUP" ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Zielgruppe <span className="text-rose-500">*</span>
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="fca-select text-sm"
            >
              <option value="">— Zielgruppe wählen —</option>
              {targetGroups.map((targetGroup) => (
                <option key={targetGroup.id} value={targetGroup.id}>
                  {targetGroup.name}
                </option>
              ))}
            </select>
            {targetGroups.length === 0 ? (
              <p className="mt-1 text-xs italic text-[var(--muted)]">
                Keine aktiven Zielgruppen für diesen Mandanten hinterlegt.
              </p>
            ) : null}
          </div>
        ) : null}

        {scopeType === "ORG_UNIT" ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Abteilung <span className="text-rose-500">*</span>
            </label>
            {scopeOptionsLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Abteilungen werden geladen…
              </div>
            ) : (
              <OrgUnitScopePicker orgUnits={orgUnits} value={orgUnitId} onChange={setOrgUnitId} />
            )}
          </div>
        ) : null}

        {scopeType === "TEAM_SEASON" ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              Team / Saison <span className="text-rose-500">*</span>
            </label>
            {scopeOptionsLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Team-Saisons werden geladen…
              </div>
            ) : (
              <TeamSeasonScopePicker
                teamSeasons={teamSeasons}
                value={teamSeasonId}
                onChange={setTeamSeasonId}
              />
            )}
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Priorität
          </label>
          <div className="flex gap-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-center text-xs font-semibold transition-colors ${
                  priority === opt.value
                    ? WAITING_LIST_PRIORITY_COLORS[opt.value]
                    : "border-[var(--border)] bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Verantwortliche Koordination
          </label>
          <WaitingListCoordinatorPicker
            eligibleCoordinators={eligibleCoordinators}
            selectedUserId={responsibleUserId || null}
            onSelect={(userId) => setResponsibleUserId(userId ?? "")}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Grund / Bemerkung
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Warum wartet diese Person? (optional)"
            className="fca-input w-full resize-none text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Interne Notiz
          </label>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={2}
            placeholder="Interne Anmerkungen (nur für Koordination sichtbar, optional)"
            className="fca-input w-full resize-none text-sm"
          />
        </div>
      </div>
    </Dialog>
  );
}
