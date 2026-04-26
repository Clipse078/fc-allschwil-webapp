"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";
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

  const saisonLabel = useMemo(() => {
    return getCanonicalSeasonLabel(teamSeason.season.key) ?? teamSeason.season.name;
  }, [teamSeason.season.key, teamSeason.season.name]);

  const allowedBirthYears = useMemo(() => {
    return getAllowedBirthYearsForSeason(
      teamSeason.teamAgeGroup ?? teamSeason.displayName ?? teamSeason.shortName,
      teamSeason.season.key,
    );
  }, [
    teamSeason.teamAgeGroup,
    teamSeason.displayName,
    teamSeason.shortName,
    teamSeason.season.key,
  ]);

  const [selectedPerson, setSelectedPerson] = useState<PeoplePickerPerson | null>(null);
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

  const selectedBirthYear = getBirthYear(selectedPerson?.dateOfBirth);
  const selectedFitsJahrgang =
    allowedBirthYears.length === 0 ||
    (selectedBirthYear !== null && allowedBirthYears.includes(selectedBirthYear));

  const squadJahrgangSummary = useMemo(() => {
    const total = teamSeason.playerSquadMembers.length;
    const valid = teamSeason.playerSquadMembers.filter((member) => {
      const birthYear = getBirthYear(member.person.dateOfBirth);
      return (
        allowedBirthYears.length === 0 ||
        (birthYear !== null && allowedBirthYears.includes(birthYear))
      );
    }).length;

    return { total, valid, warnings: total - valid };
  }, [allowedBirthYears, teamSeason.playerSquadMembers]);

  async function handleAssign() {
    if (!canManage) return;

    if (!selectedPerson) {
      setAssignError("Bitte zuerst einen gültigen Spieler auswählen.");
      setAssignMessage(null);
      return;
    }

    if (!selectedFitsJahrgang) {
      setAssignError("Zuweisung blockiert: Der ausgewählte Spieler passt nicht zur Jahrgangslogik dieser Team-Saison.");
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

  async function handleInlineUpdate(member: SquadMember, updates: Partial<Pick<SquadMember, "isWebsiteVisible" | "isCaptain" | "isViceCaptain">>) {
    if (!canManage) return;

    setRemoveError(null);
    setRemoveMessage(null);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/squad-members/" + member.id,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Kader-Eintrag konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    }
  }
  async function handleRemove(member: SquadMember) {
    if (!canManage) return;

    const confirmed = window.confirm(
      'Spieler "' + getPersonName(member.person) + '" wirklich aus diesem Team-Saison-Kader entfernen?',
    );

    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setRemoveError(null);
    setRemoveMessage(null);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/squad-members/" + member.id,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Spieler konnte nicht aus dem Team-Saison-Kader entfernt werden.");
      }

      setRemoveMessage(data?.message ?? "Spieler erfolgreich aus dem Team-Saison-Kader entfernt.");
      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
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
            <span className="fca-body-muted">Keine automatische Jahrgangslogik verfügbar.</span>
          ) : (
            allowedBirthYears.map((year) => (
              <span key={year} className="fca-pill-year">{year}</span>
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
              Neue Personen werden nur im People-Modul angelegt. Die Suche zeigt nur zuweisbare Spieler.
            </p>
          </div>

          <div className="mt-4">
            <PeoplePicker
              selected={selectedPerson}
              onSelect={setSelectedPerson}
              searchMode="player"
              teamSeasonId={teamSeason.id}
              placeholder="Spieler suchen..."
              emptyText="Keine passenden Spieler gefunden."
            />
          </div>

          {selectedPerson ? (
            <div className="mt-4 grid gap-4">
              <div className="fca-card p-4">
                <div className="flex items-center gap-4">
                  <AdminAvatar name={selectedPerson.displayName} imageSrc={selectedPerson.imageSrc} size="md" />
                  <div>
                    <div className="font-semibold text-slate-900">{selectedPerson.displayName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {[selectedPerson.email, selectedPerson.phone].filter(Boolean).join(" • ") || "Keine Kontaktdaten"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Geburtsdatum: {formatBirthDate(selectedPerson.dateOfBirth) ?? "nicht gesetzt"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Geburtsjahr: {selectedBirthYear ?? "-"}
                    </div>

                    {selectedFitsJahrgang ? (
                      <div className="fca-status-box fca-status-box-success mt-4">
                        Jahrgang passt zu dieser Team-Saison.
                      </div>
                    ) : (
                      <div className="fca-status-box fca-status-box-error mt-4">
                        Jahrgang passt nicht zu dieser Team-Saison.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block space-y-2">
                  <span className="fca-label">Status</span>
                  <select value={assignStatus} onChange={(event) => setAssignStatus(event.target.value)} className="fca-select">
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Rückennummer</span>
                  <input type="number" value={shirtNumber} onChange={(event) => setShirtNumber(event.target.value)} className="fca-input" />
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Position</span>
                  <input type="text" value={positionLabel} onChange={(event) => setPositionLabel(event.target.value)} className="fca-input" />
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Sortierung</span>
                  <input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="fca-input" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="fca-label">Bemerkungen</span>
                <input type="text" value={remarks} onChange={(event) => setRemarks(event.target.value)} className="fca-input" />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <Toggle label="Captain" value={isCaptain} onChange={setIsCaptain} />
                <Toggle label="Vice-Captain" value={isViceCaptain} onChange={setIsViceCaptain} />
                <Toggle label="Website sichtbar" value={isWebsiteVisible} onChange={setIsWebsiteVisible} />
              </div>

              {assignError ? <div className="fca-status-box fca-status-box-error">{assignError}</div> : null}
              {assignMessage ? <div className="fca-status-box fca-status-box-success">{assignMessage}</div> : null}

              <div className="flex justify-end">
                <button type="button" onClick={handleAssign} disabled={assignLoading || !selectedPerson || !selectedFitsJahrgang} className="fca-button-primary">
                  {assignLoading ? "Hinzufügen..." : "Spieler hinzufügen"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {removeError ? <div className="fca-status-box fca-status-box-error mt-4">{removeError}</div> : null}
      {removeMessage ? <div className="fca-status-box fca-status-box-success mt-4">{removeMessage}</div> : null}

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
                  avatar={<AdminAvatar name={getPersonName(member.person)} size="md" />}
                  title={getPersonName(member.person)}
                  subtitle={[
                    memberBirthYear ? "Jahrgang " + memberBirthYear : "Jahrgang fehlt",
                    member.positionLabel ?? null,
                    member.shirtNumber ? "Nr. " + member.shirtNumber : null,
                  ].filter(Boolean).join(" • ") || "Keine Zusatzdaten"}
                  meta={
                    <>
                      <AdminStatusPill label={member.status} tone={member.status === "ACTIVE" ? "success" : "muted"} />
                      <span className={memberFitsJahrgang ? "fca-pill" : "rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"}>
                        {memberFitsJahrgang ? "Jahrgang OK" : "⚠ Jahrgang prüfen"}
                      </span>
                      <button type="button" onClick={() => handleInlineUpdate(member, { isWebsiteVisible: !member.isWebsiteVisible })} disabled={!canManage} className="fca-pill">Website: {member.isWebsiteVisible ? "Ja" : "Nein"}</button>
                      <button type="button" onClick={() => handleInlineUpdate(member, { isCaptain: !member.isCaptain })} disabled={!canManage} className={member.isCaptain ? "fca-pill" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"}>{member.isCaptain ? "Captain" : "Captain setzen"}</button>
                      <button type="button" onClick={() => handleInlineUpdate(member, { isViceCaptain: !member.isViceCaptain })} disabled={!canManage} className={member.isViceCaptain ? "fca-pill" : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"}>{member.isViceCaptain ? "Vice-Captain" : "Vice setzen"}</button>
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

