"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
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

type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth?: string | null;
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

function getJahrgangExplanation(allowedBirthYears: number[]) {
  if (allowedBirthYears.length === 0) {
    return "Für diese Team-Saison ist keine automatische Jahrgangslogik verfügbar.";
  }

  return "Erlaubt für diese Team-Saison: " + allowedBirthYears.join(", ");
}

export default function TeamSquadManagementCard({
  teamId,
  canManage,
  teamSeason,
}: Props) {
  const router = useRouter();

  const saisonLabel = useMemo(() => {
    return (
      getCanonicalSeasonLabel(teamSeason.season.key) ??
      teamSeason.season.name
    );
  }, [teamSeason.season.key, teamSeason.season.name]);

  const allowedBirthYears = useMemo(() => {
    return getAllowedBirthYearsForSeason(
      teamSeason.teamAgeGroup ?? teamSeason.displayName ?? teamSeason.shortName,
      teamSeason.season.key
    );
  }, [teamSeason.teamAgeGroup, teamSeason.displayName, teamSeason.shortName, teamSeason.season.key]);

  const [searchQuery, setSearchQuery] = useState("");
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [showInvalidPlayers, setShowInvalidPlayers] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);

  const [selectedPersonId, setSelectedPersonId] = useState("");
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

  const validSearchResults = useMemo(() => {
    if (allowedBirthYears.length === 0) {
      return searchResults;
    }

    return searchResults.filter((person) => {
      const birthYear = getBirthYear(person.dateOfBirth);
      return birthYear !== null && allowedBirthYears.includes(birthYear);
    });
  }, [allowedBirthYears, searchResults]);

  const invalidSearchResults = useMemo(() => {
    if (allowedBirthYears.length === 0) {
      return [];
    }

    return searchResults.filter((person) => {
      const birthYear = getBirthYear(person.dateOfBirth);
      return birthYear === null || !allowedBirthYears.includes(birthYear);
    });
  }, [allowedBirthYears, searchResults]);

  const selectedPerson = useMemo(() => {
    return validSearchResults.find((item) => item.id === selectedPersonId) ?? null;
  }, [validSearchResults, selectedPersonId]);

  const selectedBirthYear = getBirthYear(selectedPerson?.dateOfBirth);
  const selectedFitsJahrgang =
    selectedBirthYear !== null && allowedBirthYears.includes(selectedBirthYear);
  const squadJahrgangSummary = useMemo(() => {
    const total = teamSeason.playerSquadMembers.length;

    const valid = teamSeason.playerSquadMembers.filter((member) => {
      const birthYear = getBirthYear(member.person.dateOfBirth);

      return (
        allowedBirthYears.length === 0 ||
        (birthYear !== null && allowedBirthYears.includes(birthYear))
      );
    }).length;

    return {
      total,
      valid,
      warnings: total - valid,
    };
  }, [allowedBirthYears, teamSeason.playerSquadMembers]);

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchError("Bitte mindestens 2 Zeichen eingeben.");
      setSearchResults([]);
      setSelectedPersonId("");
      setHasSearched(false);
      setLastSearchQuery("");
      setShowInvalidPlayers(false);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setAssignError(null);
    setAssignMessage(null);
    setShowInvalidPlayers(false);
    setLastSearchQuery(trimmedQuery);

    try {
      const response = await fetch(
        "/api/people/search?q=" +
          encodeURIComponent(trimmedQuery) +
          "&mode=player&teamSeasonId=" +
          encodeURIComponent(teamSeason.id),
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Spielersuche konnte nicht geladen werden.");
      }

      const results = Array.isArray(data) ? (data as PersonSearchResult[]) : [];
      const validResults =
        allowedBirthYears.length === 0
          ? results
          : results.filter((person) => {
              const birthYear = getBirthYear(person.dateOfBirth);
              return birthYear !== null && allowedBirthYears.includes(birthYear);
            });

      setSearchResults(results);
      setSelectedPersonId(validResults[0]?.id ?? "");
      setHasSearched(true);
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
      setSearchResults([]);
      setSelectedPersonId("");
      setHasSearched(true);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAssign() {
    if (!canManage) {
      return;
    }

    if (!selectedPersonId) {
      setAssignError("Bitte zuerst einen gültigen Spieler aus dem erlaubten Jahrgang auswählen.");
      setAssignMessage(null);
      return;
    }

    if (!selectedFitsJahrgang) {
      setAssignError(
        "Zuweisung blockiert: Der ausgewählte Spieler passt nicht zur Jahrgangslogik dieser Team-Saison."
      );
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
            personId: selectedPersonId,
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
      setSelectedPersonId("");
      setSearchQuery("");
      setLastSearchQuery("");
      setHasSearched(false);
      setSearchResults([]);
      setShowInvalidPlayers(false);
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
              Neue Personen werden nur im People-Modul angelegt. Die Suche zeigt zuerst nur Spieler, die zur Jahrgangslogik passen.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Aktiven Spieler suchen nach Name, E-Mail oder Telefon"
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

          {hasSearched && !searchLoading && !searchError && searchResults.length === 0 ? (
            <div className="fca-status-box fca-status-box-muted mt-4">
              Keine aktiven Spieler zu «{lastSearchQuery}» gefunden. Bitte prüfe die Schreibweise oder lege neue Personen im People-Modul an.
            </div>
          ) : null}

          {hasSearched && !searchLoading && !searchError && searchResults.length > 0 && validSearchResults.length === 0 ? (
            <div className="fca-status-box fca-status-box-warn mt-4">
              Es wurden Spieler zu «{lastSearchQuery}» gefunden, aber keiner passt zur Jahrgangslogik dieser Team-Saison. Die Zuweisungsfelder bleiben deshalb ausgeblendet. {getJahrgangExplanation(allowedBirthYears)}
            </div>
          ) : null}

          {validSearchResults.length > 0 ? (
            <div className="mt-4 grid gap-4">
              <label className="block space-y-2">
                <span className="fca-label">Gültige Spieler für diese Team-Saison</span>
                <select
                  value={selectedPersonId}
                  onChange={(event) => setSelectedPersonId(event.target.value)}
                  className="fca-select"
                >
                  {validSearchResults.map((person) => (
                    <option key={person.id} value={person.id}>
                      {getPersonName(person)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPerson ? (
                <div className="fca-card p-4">
                  <div className="flex items-center gap-4">
                    <AdminAvatar
                      name={getPersonName(selectedPerson)}
                      size="md"
                    />
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
                        Geburtsjahr: {selectedBirthYear ?? "-"}
                      </div>

                      {selectedBirthYear !== null && selectedFitsJahrgang ? (
                        <div className="fca-status-box fca-status-box-success mt-4">
                          Jahrgang passt zu dieser Team-Saison.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

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
                  disabled={assignLoading || !selectedPersonId || !selectedFitsJahrgang}
                  className="fca-button-primary"
                >
                  {assignLoading ? "Hinzufügen..." : "Spieler hinzufügen"}
                </button>
              </div>
            </div>
          ) : null}

          {invalidSearchResults.length > 0 ? (
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50/60 p-4">
              <button
                type="button"
                onClick={() => setShowInvalidPlayers((current) => !current)}
                className="flex w-full items-center justify-between gap-4 text-left"
              >
                <span className="text-sm font-semibold text-amber-900">
                  ⚠ Spieler ausserhalb Jahrgang anzeigen ({invalidSearchResults.length})
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  {showInvalidPlayers ? "Ausblenden" : "Anzeigen"}
                </span>
              </button>

              {showInvalidPlayers ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-amber-900">
                    Diese Spieler wurden gefunden, passen aber nicht zur Jahrgangslogik und können hier nicht zugewiesen werden. {getJahrgangExplanation(allowedBirthYears)}
                  </p>

                  {invalidSearchResults.map((person) => {
                    const birthYear = getBirthYear(person.dateOfBirth);

                    return (
                      <div
                        key={person.id}
                        className="rounded-[20px] border border-amber-200 bg-white/80 p-4"
                      >
                        <div className="flex items-center gap-4">
                          <AdminAvatar name={getPersonName(person)} size="md" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900">
                              {getPersonName(person)}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {[person.email, person.phone].filter(Boolean).join(" • ") || "Keine Kontaktdaten"}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              Geburtsdatum: {formatBirthDate(person.dateOfBirth) ?? "nicht gesetzt"} · Geburtsjahr: {birthYear ?? "-"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            Nicht zuweisbar
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
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
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Kader</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{squadJahrgangSummary.total}</div>
            </div>
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Jahrgang OK</div>
              <div className="mt-1 text-2xl font-bold text-emerald-900">{squadJahrgangSummary.valid}</div>
            </div>
            <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Prüfen</div>
              <div className="mt-1 text-2xl font-bold text-amber-900">{squadJahrgangSummary.warnings}</div>
            </div>
          </div>

          {squadJahrgangSummary.warnings > 0 ? (
            <div className="fca-status-box fca-status-box-warn">
              ⚠ Im aktuellen Kader gibt es Spieler, deren Jahrgang nicht zur Team-Saison passt oder deren Geburtsdatum fehlt.
            </div>
          ) : null}

          <div className="space-y-3">
          {teamSeason.playerSquadMembers.map((member) => {
            const memberBirthYear = getBirthYear(member.person.dateOfBirth);
            const memberFitsJahrgang =
              allowedBirthYears.length === 0 ||
              (memberBirthYear !== null && allowedBirthYears.includes(memberBirthYear));

            return (
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
                  memberBirthYear ? "Jahrgang " + memberBirthYear : "Jahrgang fehlt",
                  member.positionLabel ?? null,
                  member.shirtNumber ? "Nr. " + member.shirtNumber : null,
                ]
                  .filter(Boolean)
                  .join(" • ") || "Keine Zusatzdaten"}
                meta={
                  <>
                    <AdminStatusPill label={member.status} tone={member.status === "ACTIVE" ? "success" : "muted"} />
                    <span className={memberFitsJahrgang ? "fca-pill" : "rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"}>
                      {memberFitsJahrgang ? "Jahrgang OK" : "⚠ Jahrgang prüfen"}
                    </span>
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
                      className={memberFitsJahrgang ? "fca-button-primary" : "rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"}
                    >
                      {removingMemberId === member.id ? "Entfernen..." : "Entfernen"}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Nur lesen</span>
                  )
                }
              />
            );
          })}
          </div>
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



