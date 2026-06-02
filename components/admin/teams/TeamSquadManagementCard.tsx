"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
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

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || person.firstName + " " + person.lastName;
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
  teamSeason,
}: Props) {
  const router = useRouter();

  const saisonLabel = useMemo(() => {
    return (
      getCanonicalSeasonLabel(teamSeason.season.startDate) ??
      teamSeason.season.name
    );
  }, [teamSeason.season.startDate, teamSeason.season.name]);

  const allowedBirthYears = useMemo(() => {
    return getAllowedBirthYearsForSeason(
      teamSeason.teamAgeGroup,
      teamSeason.season.startDate
    );
  }, [teamSeason.teamAgeGroup, teamSeason.season.startDate]);

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
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);

  const existingSquadPersonIds = useMemo(
    () => teamSeason.playerSquadMembers.map((m) => m.person.id),
    [teamSeason.playerSquadMembers]
  );

  async function handleAssign() {
    if (!canManage) {
      return;
    }

    if (!selectedPerson) {
      setAssignError("Bitte zuerst eine Person auswählen.");
      setAssignMessage(null);
      return;
    }

    setAssignLoading(true);
    setAssignError(null);
    setAssignMessage(null);
    setRemoveError(null);
    setRemoveMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/squad-members",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        throw new Error(
          data?.error ?? "Spieler konnte dem Team-Saison-Kader nicht hinzugefügt werden."
        );
      }

      setAssignMessage(
        data?.message ?? "Spieler erfolgreich dem Team-Saison-Kader hinzugefügt."
      );
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
      setAssignError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleRemove(member: SquadMember) {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(
      'Spieler "' +
        getPersonName(member.person) +
        '" wirklich aus diesem Team-Saison-Kader entfernen?'
    );

    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.id);
    setRemoveError(null);
    setRemoveMessage(null);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" +
          teamId +
          "/team-seasons/" +
          teamSeason.id +
          "/squad-members/" +
          member.id,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden."
        );
      }

      setRemoveMessage(
        data?.message ?? "Spieler erfolgreich aus dem Team-Saison-Kader entfernt."
      );
      router.refresh();
    } catch (err) {
      setRemoveError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setRemovingMemberId(null);
    }
  }

  return (
    <div className="fca-section-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="fca-eyebrow">Spielerkader</p>
          <h4 className="fca-subheading mt-2">{saisonLabel}</h4>
          <p className="fca-body-muted mt-3">
            Suche, Zuordnung und Verwaltung der Spieler dieser Team-Saison.
          </p>
        </div>

        <span className="fca-pill">
          Kader Website: {teamSeason.squadWebsiteVisible ? "An" : "Aus"}
        </span>
      </div>

      <div className="fca-section-card mt-5 px-4 py-4">
        <div className="fca-label">Erlaubte Jahrgänge für diese Team-Saison</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {allowedBirthYears.length === 0 ? (
            <span className="fca-body-muted">
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

      {!canManage ? (
        <div className="fca-status-box fca-status-box-warn mt-5">
          Diese Kaderübersicht ist aktuell nur lesbar.
        </div>
      ) : (
        <div className="fca-section-card mt-5 p-5">
          <div>
            <h5 className="fca-eyebrow">Spieler zuweisen</h5>
            <p className="fca-body-muted mt-2">
              Neue Personen werden nur im People-Modul angelegt.
            </p>
          </div>

          <div className="mt-4">
            <label className="fca-label mb-2 block">Spieler suchen</label>
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
            <div className="mt-4 grid gap-4">
              <div className="fca-card p-4">
                <div className="flex items-center gap-4">
                  <AdminAvatar name={getPersonName(selectedPerson)} size="md" />
                  <div>
                    <div className="font-semibold text-slate-900">
                      {getPersonName(selectedPerson)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {[selectedPerson.email, selectedPerson.phone]
                        .filter(Boolean)
                        .join(" • ") || "Keine Kontaktdaten"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Geburtsdatum: {formatBirthDate(selectedPerson.dateOfBirth) ?? "nicht gesetzt"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Geburtsjahr: {getBirthYear(selectedPerson.dateOfBirth) ?? "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block space-y-2">
                  <span className="fca-label">Status</span>
                  <select
                    value={assignStatus}
                    onChange={(event) => setAssignStatus(event.target.value)}
                    className="fca-select"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Rückennummer</span>
                  <input
                    type="number"
                    value={shirtNumber}
                    onChange={(event) => setShirtNumber(event.target.value)}
                    className="fca-input"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Position</span>
                  <input
                    type="text"
                    value={positionLabel}
                    onChange={(event) => setPositionLabel(event.target.value)}
                    className="fca-input"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Sortierung</span>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="fca-input"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="fca-label">Bemerkungen</span>
                <input
                  type="text"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="fca-input"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <Toggle label="Captain" value={isCaptain} onChange={setIsCaptain} />
                <Toggle label="Vice-Captain" value={isViceCaptain} onChange={setIsViceCaptain} />
                <Toggle label="Website sichtbar" value={isWebsiteVisible} onChange={setIsWebsiteVisible} />
              </div>

              {assignError ? (
                <div className="fca-status-box fca-status-box-error">
                  {assignError}
                </div>
              ) : null}

              {assignMessage ? (
                <div className="fca-status-box fca-status-box-success">
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
                  {assignLoading ? "Hinzufügen..." : "Spieler hinzufügen"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {removeError ? (
        <div className="fca-status-box fca-status-box-error mt-4">
          {removeError}
        </div>
      ) : null}

      {removeMessage ? (
        <div className="fca-status-box fca-status-box-success mt-4">
          {removeMessage}
        </div>
      ) : null}

      {teamSeason.playerSquadMembers.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-5">
          Noch keine Spieler im Kader dieser Team-Saison.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {teamSeason.playerSquadMembers.map((member) => (
            <AdminListItem
              key={member.id}
              avatar={
                <AdminAvatar
                  name={getPersonName(member.person)}
                  size="md"
                />
              }
              title={getPersonName(member.person)}
              subtitle={[
                getBirthYear(member.person.dateOfBirth)?.toString() ?? null,
                member.positionLabel ?? null,
                member.shirtNumber ? "Nr. " + member.shirtNumber : null,
              ]
                .filter(Boolean)
                .join(" • ") || "Keine Zusatzdaten"}
              meta={
                <>
                  <AdminStatusPill label={member.status} tone={member.status === "ACTIVE" ? "success" : "muted"} />
                  <span className="fca-pill">
                    Website: {member.isWebsiteVisible ? "Ja" : "Nein"}
                  </span>
                  {member.isCaptain ? <span className="fca-pill">Captain</span> : null}
                  {member.isViceCaptain ? <span className="fca-pill">Vice-Captain</span> : null}
                </>
              }
              actions={
                canManage ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(member)}
                    disabled={removingMemberId === member.id}
                    className="fca-button-primary"
                  >
                    {removingMemberId === member.id ? "Entfernen..." : "Entfernen"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Nur lesen</span>
                )
              }
            />
          ))}
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
      <span className="fca-label">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="fca-toggle-checkbox"
      />
    </div>
  );
}
