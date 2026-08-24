"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { PeoplePicker, type PersonPickerResult } from "@/components/shared/PeoplePicker";
import { Button } from "@/components/ui/Button";
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
  sectionId?: string;
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

const fieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30";
const labelClass = "block text-xs font-medium text-[var(--text-2)] mb-1.5";

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || `${person.firstName} ${person.lastName}`;
}

function getBirthYear(dateOfBirth?: string | null) {
  if (!dateOfBirth) {
    return null;
  }

  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getUTCFullYear();
}

function formatBirthDate(dateOfBirth?: string | null) {
  if (!dateOfBirth) {
    return null;
  }

  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("de-CH");
}

export default function TeamSquadManagementCard({
  teamId,
  canManage,
  sectionId,
  teamSeason,
}: Props) {
  const router = useRouter();
  const playerCount = teamSeason.playerSquadMembers.length;

  const saisonLabel = useMemo(() => {
    return getCanonicalSeasonLabel(teamSeason.season.startDate) ?? teamSeason.season.name;
  }, [teamSeason.season.startDate, teamSeason.season.name]);

  const allowedBirthYears = useMemo(() => {
    return getAllowedBirthYearsForSeason(teamSeason.teamAgeGroup, teamSeason.season.startDate);
  }, [teamSeason.teamAgeGroup, teamSeason.season.startDate]);

  const [showAddForm, setShowAddForm] = useState(false);
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
    () => teamSeason.playerSquadMembers.map((member) => member.person.id),
    [teamSeason.playerSquadMembers],
  );

  function resetAddForm() {
    setShowAddForm(false);
    setSelectedPerson(null);
    setShirtNumber("");
    setPositionLabel("");
    setIsCaptain(false);
    setIsViceCaptain(false);
    setIsWebsiteVisible(true);
    setSortOrder("0");
    setRemarks("");
    setAssignError(null);
    setAssignMessage(null);
  }

  async function handleAssign() {
    if (!canManage || !selectedPerson) {
      setAssignError("Bitte zuerst eine Person auswählen.");
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
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Spieler konnte dem Team-Saison-Kader nicht hinzugefügt werden.",
        );
      }

      setAssignMessage(data?.message ?? "Spieler erfolgreich hinzugefügt.");
      resetAddForm();
      router.refresh();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleRemove(member: SquadMember) {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(
      `Spieler "${getPersonName(member.person)}" wirklich aus diesem Kader entfernen?`,
    );

    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.id);
    setRemoveError(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeason.id}/squad-members/${member.id}`,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden.",
        );
      }

      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <section
      id={sectionId}
      className={
        sectionId
          ? "scroll-mt-20 target:ring-2 target:ring-inset target:ring-[var(--sce-primary)]"
          : undefined
      }
      data-testid="team-squad-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">Kader</h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {playerCount} Spieler · {saisonLabel}
          </p>
        </div>

        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setShowAddForm((current) => !current)}
            data-testid="team-squad-add-button"
          >
            Spieler
          </Button>
        ) : null}
      </div>

      {allowedBirthYears.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {allowedBirthYears.map((year) => (
            <span
              key={year}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-2)]"
            >
              {year}
            </span>
          ))}
        </div>
      ) : null}

      {showAddForm && canManage ? (
        <div className="mt-4 space-y-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Spieler hinzufügen</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Neue Personen werden im People-Modul angelegt.
            </p>
          </div>

          <PeoplePicker
            mode="player"
            teamSeasonId={teamSeason.id}
            excludeIds={existingSquadPersonIds}
            selected={selectedPerson}
            onSelect={setSelectedPerson}
            onClearSelected={() => setSelectedPerson(null)}
            placeholder="Spieler suchen nach Name, E-Mail…"
          />

          {selectedPerson ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-3">
                <AdminAvatar name={getPersonName(selectedPerson)} size="md" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {getPersonName(selectedPerson)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Geburtsdatum: {formatBirthDate(selectedPerson.dateOfBirth) ?? "nicht gesetzt"}
                    {getBirthYear(selectedPerson.dateOfBirth)
                      ? ` · ${getBirthYear(selectedPerson.dateOfBirth)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className={labelClass}>Status</span>
                  <select
                    value={assignStatus}
                    onChange={(event) => setAssignStatus(event.target.value)}
                    className={fieldClass}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClass}>Rückennummer</span>
                  <input
                    type="number"
                    value={shirtNumber}
                    onChange={(event) => setShirtNumber(event.target.value)}
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Position</span>
                  <input
                    type="text"
                    value={positionLabel}
                    onChange={(event) => setPositionLabel(event.target.value)}
                    className={fieldClass}
                  />
                </label>

                <label className="block">
                  <span className={labelClass}>Sortierung</span>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Bemerkungen</span>
                <input
                  type="text"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className={fieldClass}
                />
              </label>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />
                  Captain
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isViceCaptain}
                    onChange={(e) => setIsViceCaptain(e.target.checked)}
                  />
                  Vice-Captain
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isWebsiteVisible}
                    onChange={(e) => setIsWebsiteVisible(e.target.checked)}
                  />
                  Website sichtbar
                </label>
              </div>

              {assignError ? (
                <p className="text-sm font-medium text-[var(--sce-danger)]">{assignError}</p>
              ) : null}
              {assignMessage ? (
                <p className="text-sm font-medium text-emerald-600">{assignMessage}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={resetAddForm}>
                  Abbrechen
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={assignLoading}
                  disabled={!selectedPerson}
                  onClick={handleAssign}
                >
                  Spieler hinzufügen
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {removeError ? (
        <p className="mt-3 text-sm font-medium text-[var(--sce-danger)]">{removeError}</p>
      ) : null}

      {playerCount === 0 ? (
        <div className="mt-4" data-testid="team-squad-empty">
          <p className="text-sm text-[var(--muted)]">Noch keine Spieler im Kader.</p>
          {canManage && !showAddForm ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              iconLeft={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowAddForm(true)}
            >
              Spieler hinzufügen
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[var(--border)]" data-testid="team-squad-list">
          {teamSeason.playerSquadMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AdminAvatar name={getPersonName(member.person)} size="md" />
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/persons/${member.person.id}`}
                    className="truncate text-sm font-semibold text-[var(--foreground)] hover:text-[var(--blue)]"
                  >
                    {getPersonName(member.person)}
                  </Link>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {[
                      getBirthYear(member.person.dateOfBirth)?.toString() ?? null,
                      member.positionLabel ?? null,
                      member.shirtNumber ? `Nr. ${member.shirtNumber}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Keine Zusatzdaten"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusPill
                  label={member.status}
                  tone={member.status === "ACTIVE" ? "success" : "muted"}
                />
                {member.isCaptain ? (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-2)]">
                    Captain
                  </span>
                ) : null}
                {member.isViceCaptain ? (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-2)]">
                    Vice-Captain
                  </span>
                ) : null}
                {canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={removingMemberId === member.id}
                    onClick={() => handleRemove(member)}
                  >
                    Entfernen
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
