"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";
import {
  getAllowedBirthYearsForSeason,
  getCanonicalSeasonLabel,
} from "@/lib/teams/jahrgang-rules";

type SquadMember = {
  id: string;
  status: string;
  shirtNumber: number | null;
  positionLabel: string | null;
  isCaptain: boolean;
  isViceCaptain: boolean;
  isWebsiteVisible: boolean;
  sortOrder: number;
  remarks: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth?: string | null;
  };
};


type Props = {
  teamId: string;
  canManage: boolean;
  teamSeason: {
    id: string;
    displayName: string;
    shortName: string | null;
    status: string;
    squadWebsiteVisible: boolean;
    season: {
      id: string;
      key: string;
      name: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    };
    teamAgeGroup?: string | null;
    playerSquadMembers: SquadMember[];
  };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "INJURED", label: "Verletzt" },
  { value: "ABSENT", label: "Abwesend" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  INJURED: "Verletzt",
  ABSENT: "Abwesend",
  ARCHIVED: "Archiviert",
};

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || person.firstName + " " + person.lastName;
}

function getBirthYear(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCFullYear();
}

function formatBirthDate(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("de-CH");
}

export default function TeamSquadManagementCard({
  teamId,
  canManage,
  teamSeason,
}: Props) {
  const router = useRouter();

  const saisonLabel = useMemo(
    () => getCanonicalSeasonLabel(teamSeason.season.startDate) ?? teamSeason.season.name,
    [teamSeason.season.startDate, teamSeason.season.name]
  );

  const allowedBirthYears = useMemo(
    () => getAllowedBirthYearsForSeason(teamSeason.teamAgeGroup, teamSeason.season.startDate),
    [teamSeason.teamAgeGroup, teamSeason.season.startDate]
  );

  const [selectedPerson, setSelectedPerson] = useState<PersonPickerResult | null>(null);
  const [assignStatus, setAssignStatus] = useState("ACTIVE");
  const [shirtNumber, setShirtNumber] = useState("");
  const [positionLabel, setPositionLabel] = useState("");
  const [isCaptain, setIsCaptain] = useState(false);
  const [isViceCaptain, setIsViceCaptain] = useState(false);
  const [isWebsiteVisible, setIsWebsiteVisible] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [remarks, setRemarks] = useState("");

  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const existingSquadPersonIds = useMemo(
    () => teamSeason.playerSquadMembers.map((m) => m.person.id),
    [teamSeason.playerSquadMembers]
  );

  async function handleAssign() {
    if (!canManage) return;
    if (!selectedPerson) {
      setAssignError("Bitte zuerst eine Person auswählen.");
      setAssignMessage(null);
      return;
    }

    setAssignLoading(true);
    setAssignError(null);
    setAssignMessage(null);
    setRemoveError(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeason.id}/squad-members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: selectedPerson.id,
            status: assignStatus,
            shirtNumber: shirtNumber.trim(),
            positionLabel,
            isCaptain,
            isViceCaptain,
            isWebsiteVisible,
            sortOrder: sortOrder.trim(),
            remarks,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Spieler konnte dem Team-Saison-Kader nicht hinzugefügt werden.");
      }

      setAssignMessage(data?.message ?? "Spieler erfolgreich dem Team-Saison-Kader hinzugefügt.");
      setSelectedPerson(null);
      setShirtNumber("");
      setPositionLabel("");
      setIsCaptain(false);
      setIsViceCaptain(false);
      setIsWebsiteVisible(true);
      setSortOrder("0");
      setRemarks("");
      router.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleRemove(member: SquadMember) {
    if (!canManage) return;
    if (!window.confirm(`Spieler "${getPersonName(member.person)}" wirklich aus diesem Team-Saison-Kader entfernen?`)) return;

    setRemovingMemberId(member.id);
    setRemoveError(null);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeason.id}/squad-members/${member.id}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden.");
      }
      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <div className="sce-detail-section">
      {/* Header */}
      <div className="sce-detail-section-header">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Spielerkader
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">
            {saisonLabel}
          </p>
        </div>
        <span
          className={`inline-flex h-5 items-center rounded-full border px-2.5 text-[0.65rem] font-semibold ${
            teamSeason.squadWebsiteVisible
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
          }`}
        >
          Website: {teamSeason.squadWebsiteVisible ? "An" : "Aus"}
        </span>
      </div>

      {/* Allowed birth years */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          Erlaubte Jahrgänge
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allowedBirthYears.length === 0 ? (
            <span className="text-xs text-[var(--muted)]">
              Keine automatische Jahrgangslogik verfügbar.
            </span>
          ) : (
            allowedBirthYears.map((year) => (
              <span key={year} className="fca-pill-year">
                {year}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Add player section */}
      {!canManage ? (
        <div className="px-5 py-4">
          <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Diese Kaderübersicht ist aktuell nur lesbar.
          </div>
        </div>
      ) : (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-5">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Spieler zuweisen
          </p>
          <p className="mb-4 text-xs text-[var(--muted)]">
            Neue Personen werden nur im People-Modul angelegt.
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Spieler suchen</label>
              <PeoplePicker
                mode="player"
                teamSeasonId={teamSeason.id}
                excludeIds={existingSquadPersonIds}
                selected={selectedPerson}
                onSelect={setSelectedPerson}
                onClearSelected={() => setSelectedPerson(null)}
                placeholder="Aktiven Spieler suchen nach Name, E-Mail…"
              />
            </div>

            {selectedPerson ? (
              <>
                {/* Selected person summary */}
                <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3">
                  <AdminAvatar name={getPersonName(selectedPerson)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {getPersonName(selectedPerson)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {[selectedPerson.email, selectedPerson.phone].filter(Boolean).join(" · ") || "Keine Kontaktdaten"}
                      {selectedPerson.dateOfBirth
                        ? ` · ${formatBirthDate(selectedPerson.dateOfBirth)} (Jg. ${getBirthYear(selectedPerson.dateOfBirth) ?? "—"})`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={assignStatus}
                      onChange={(e) => setAssignStatus(e.target.value)}
                      className="fca-select"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Rückennummer</label>
                    <input
                      type="number"
                      value={shirtNumber}
                      onChange={(e) => setShirtNumber(e.target.value)}
                      className="fca-input"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Position</label>
                    <input
                      type="text"
                      value={positionLabel}
                      onChange={(e) => setPositionLabel(e.target.value)}
                      className="fca-input"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Sortierung</label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="fca-input"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Bemerkungen</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="fca-input"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Toggle label="Captain" value={isCaptain} onChange={setIsCaptain} />
                  <Toggle label="Vice-Captain" value={isViceCaptain} onChange={setIsViceCaptain} />
                  <Toggle label="Website sichtbar" value={isWebsiteVisible} onChange={setIsWebsiteVisible} />
                </div>

                {assignError ? (
                  <div className="rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {assignError}
                  </div>
                ) : null}

                {assignMessage ? (
                  <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {assignMessage}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={assignLoading || !selectedPerson}
                    className="fca-button-primary"
                  >
                    {assignLoading ? "Hinzufügen…" : "Spieler hinzufügen"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Remove error */}
      {removeError ? (
        <div className="mx-5 mt-4 rounded-[var(--radius-lg)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {removeError}
        </div>
      ) : null}

      {/* Member list */}
      {teamSeason.playerSquadMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <Users className="h-5 w-5 text-[var(--muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Noch keine Spieler
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Spieler über das Suchfeld oben zuordnen.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {teamSeason.playerSquadMembers.map((member) => {
            const name = getPersonName(member.person);
            const birthYear = getBirthYear(member.person.dateOfBirth);

            return (
              <div key={member.id} className="flex items-start gap-4 px-5 py-4">
                <AdminAvatar name={name} size="sm" />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{name}</p>
                    {member.isCaptain ? (
                      <span className="sce-role-badge sce-role-badge-player">C</span>
                    ) : null}
                    {member.isViceCaptain ? (
                      <span className="sce-role-badge sce-role-badge-player">VC</span>
                    ) : null}
                  </div>

                  <p className="text-xs text-[var(--muted)]">
                    {[
                      birthYear ? `Jg. ${birthYear}` : null,
                      member.positionLabel ?? null,
                      member.shirtNumber ? `Nr. ${member.shirtNumber}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Keine Zusatzdaten"}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <AdminStatusPill
                      label={STATUS_LABELS[member.status] ?? member.status}
                      tone={member.status === "ACTIVE" ? "success" : "muted"}
                    />
                    <span
                      className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${
                        member.isWebsiteVisible
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      Web: {member.isWebsiteVisible ? "Ja" : "Nein"}
                    </span>
                  </div>
                </div>

                {canManage ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(member)}
                    disabled={removingMemberId === member.id}
                    className="fca-button-danger mt-0.5 flex-shrink-0"
                  >
                    {removingMemberId === member.id ? "Entfernen…" : "Entfernen"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="fca-toggle-row">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="fca-toggle-checkbox"
      />
    </div>
  );
}
