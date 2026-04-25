"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import { getCanonicalSeasonLabel } from "@/lib/teams/jahrgang-rules";

type TrainerMember = {
  id: string;
  status: string;
  roleLabel: string | null;
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
    trainerQualifications?: {
      id: string;
      type: string;
      status: string;
      title: string;
      issuer: string | null;
      licenseNumber: string | null;
      issuedAt: string | null;
      expiresAt: string | null;
      remarks: string | null;
      isClubVerified: boolean;
    }[];
  };
};

type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  teamId: string;
  canManage: boolean;
  teamSeason: {
    id: string;
    displayName: string;
    trainerTeamWebsiteVisible: boolean;
    season: {
      id: string;
      key: string;
      name: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    };
    trainerTeamMembers: TrainerMember[];
  };
};

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "ARCHIVED", label: "Archiviert" },
];

function getPersonName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return person.displayName || person.firstName + " " + person.lastName;
}

function getTrainerQualificationLabel(qualification: {
  title: string;
  issuer: string | null;
  status: string;
  isClubVerified: boolean;
}) {
  const parts = [
    qualification.title,
    qualification.issuer,
    qualification.status === "VALID" ? "gültig" : null,
    qualification.isClubVerified ? "geprüft" : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export default function TeamTrainerManagementCard({
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");

  const [assignStatus, setAssignStatus] = useState("ACTIVE");
  const [roleLabel, setRoleLabel] = useState("");
  const [isWebsiteVisible, setIsWebsiteVisible] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [remarks, setRemarks] = useState("");

  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);

  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeMessage, setRemoveMessage] = useState<string | null>(null);

  async function handleSearch() {
    if (searchQuery.trim().length < 2) {
      setSearchError("Bitte mindestens 2 Zeichen eingeben.");
      setSearchResults([]);
      setSelectedPersonId("");
      return;
    }

    setSearchLoading(true);
    setSearchError(null);

    try {
      const response = await fetch(
        "/api/people/search?q=" +
          encodeURIComponent(searchQuery.trim()) +
          "&mode=trainer&teamSeasonId=" +
          encodeURIComponent(teamSeason.id),
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainersuche konnte nicht geladen werden.");
      }

      const results = Array.isArray(data) ? (data as PersonSearchResult[]) : [];
      setSearchResults(results);
      setSelectedPersonId(results[0]?.id ?? "");
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
      setSearchResults([]);
      setSelectedPersonId("");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAssign() {
    if (!canManage) {
      return;
    }

    if (!selectedPersonId) {
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
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/trainer-members",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personId: selectedPersonId,
            status: assignStatus,
            roleLabel,
            isWebsiteVisible,
            sortOrder: sortOrder.trim(),
            remarks,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Trainer konnte nicht dem Trainerteam hinzugefügt werden."
        );
      }

      setAssignMessage(
        data?.message ?? "Trainer erfolgreich dem Trainerteam hinzugefügt."
      );
      setSelectedPersonId("");
      setSearchQuery("");
      setSearchResults([]);
      setRoleLabel("");
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

  async function handleRemove(member: TrainerMember) {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(
      'Trainer "' +
        getPersonName(member.person) +
        '" wirklich aus diesem Trainerteam entfernen?'
    );

    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.id);
    setRemoveError(null);
    setRemoveMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" +
          teamId +
          "/team-seasons/" +
          teamSeason.id +
          "/trainer-members/" +
          member.id,
        {
          method: "DELETE",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Trainer konnte nicht aus dem Trainerteam entfernt werden."
        );
      }

      setRemoveMessage(
        data?.message ?? "Trainer erfolgreich aus dem Trainerteam entfernt."
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
          <p className="fca-eyebrow">Trainerteam</p>
          <h4 className="fca-subheading mt-2">{saisonLabel}</h4>
          <p className="fca-body-muted mt-3">
            Suche, Zuordnung und Verwaltung des Trainerteams dieser Team-Saison.
          </p>
        </div>

        <span className="fca-pill">
          Trainer Website: {teamSeason.trainerTeamWebsiteVisible ? "An" : "Aus"}
        </span>
      </div>

      {!canManage ? (
        <div className="fca-status-box fca-status-box-warn mt-5">
          Diese Trainerübersicht ist aktuell nur lesbar.
        </div>
      ) : (
        <div className="fca-section-card mt-5 p-5">
          <div>
            <h5 className="fca-eyebrow">Trainer zuweisen</h5>
            <p className="fca-body-muted mt-2">
              Neue Personen werden nur im People-Modul angelegt.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Aktiven Trainer suchen nach Name, E-Mail oder Telefon"
              className="fca-input"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading}
              className="fca-button-primary"
            >
              {searchLoading ? "Suche..." : "Suchen"}
            </button>
          </div>

          {searchError ? (
            <div className="fca-status-box fca-status-box-error mt-4">
              {searchError}
            </div>
          ) : null}

          {searchResults.length === 0 ? (
            <div className="fca-status-box fca-status-box-muted mt-4">
              Keine passenden aktiven Trainer gefunden. Neue Personen bitte im People-Modul anlegen.
            </div>
          ) : null}

          {searchResults.length > 0 ? (
            <div className="mt-4 grid gap-4">
              <label className="block space-y-2">
                <span className="fca-label">Trainer</span>
                <select
                  value={selectedPersonId}
                  onChange={(event) => setSelectedPersonId(event.target.value)}
                  className="fca-select"
                >
                  {searchResults.map((person) => (
                    <option key={person.id} value={person.id}>
                      {getPersonName(person)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-3">
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
                  <span className="fca-label">Rolle</span>
                  <input
                    type="text"
                    value={roleLabel}
                    onChange={(event) => setRoleLabel(event.target.value)}
                    className="fca-input"
                    placeholder="z. B. Cheftrainer"
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

              <Toggle
                label="Website sichtbar"
                value={isWebsiteVisible}
                onChange={setIsWebsiteVisible}
              />

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
                  disabled={assignLoading || !selectedPersonId}
                  className="fca-button-primary"
                >
                  {assignLoading ? "Hinzufügen..." : "Trainer hinzufügen"}
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

      {teamSeason.trainerTeamMembers.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-5">
          Noch keine Trainer im Trainerteam dieser Team-Saison.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {teamSeason.trainerTeamMembers.map((member) => (
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
                member.roleLabel ?? "Keine Rolle hinterlegt",
                member.person.trainerQualifications && member.person.trainerQualifications.length > 0
                  ? "Diplome: " + member.person.trainerQualifications.map(getTrainerQualificationLabel).join(" | ")
                  : "Keine Diplome hinterlegt",
              ].join(" • ")}
              meta={
                <>
                  <AdminStatusPill label={member.status} tone={member.status === "ACTIVE" ? "success" : "muted"} />
                  <span className="fca-pill">
                    Website: {member.isWebsiteVisible ? "Ja" : "Nein"}
                  </span>
                  <span className="fca-pill">
                    Diplome: {member.person.trainerQualifications?.length ?? 0}
                  </span>
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
