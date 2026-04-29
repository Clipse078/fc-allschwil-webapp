"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import PeoplePicker, { PeoplePickerPerson } from "@/components/admin/shared/people-picker/PeoplePicker";
import { getCanonicalSeasonLabel } from "@/lib/teams/jahrgang-rules";

type TrainerQualification = {
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
};

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
    trainerQualifications?: TrainerQualification[];
  };
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

function getTrainerQualificationLabel(qualification: TrainerQualification) {
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
    return getCanonicalSeasonLabel(teamSeason.season.startDate) ?? teamSeason.season.name;
  }, [teamSeason.season.startDate, teamSeason.season.name]);

  const [selectedPerson, setSelectedPerson] = useState<PeoplePickerPerson | null>(null);
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

  const [expandedQualificationPersonId, setExpandedQualificationPersonId] = useState<string | null>(null);

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
    setRemoveMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/trainer-members",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personId: selectedPerson.id,
            status: assignStatus,
            roleLabel,
            isWebsiteVisible,
            sortOrder: sortOrder.trim(),
            remarks,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer konnte nicht dem Trainerteam hinzugefügt werden.");
      }

      setAssignMessage(data?.message ?? "Trainer erfolgreich dem Trainerteam hinzugefügt.");
      setSelectedPerson(null);
      setRoleLabel("");
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

  async function handleInlineUpdate(member: TrainerMember, updates: Partial<Pick<TrainerMember, "isWebsiteVisible" | "roleLabel">>) {
    if (!canManage) return;

    setRemoveError(null);
    setRemoveMessage(null);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/trainer-members/" + member.id,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainerteam-Eintrag konnte nicht aktualisiert werden.");
      }

      router.refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    }
  }

  async function handleRemove(member: TrainerMember) {
    if (!canManage) return;

    const confirmed = window.confirm(
      'Trainer "' + getPersonName(member.person) + '" wirklich aus diesem Trainerteam entfernen?',
    );

    if (!confirmed) return;

    setRemovingMemberId(member.id);
    setRemoveError(null);
    setRemoveMessage(null);

    try {
      const response = await fetch(
        "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id + "/trainer-members/" + member.id,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer konnte nicht aus dem Trainerteam entfernt werden.");
      }

      setRemoveMessage(data?.message ?? "Trainer erfolgreich aus dem Trainerteam entfernt.");
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
              Neue Personen werden nur im Personenmodul angelegt. Die Suche zeigt nur zuweisbare Trainer.
            </p>
          </div>

          <div className="mt-4">
            <PeoplePicker
              selected={selectedPerson}
              onSelect={setSelectedPerson}
              searchMode="trainer"
              teamSeasonId={teamSeason.id}
              placeholder="Trainer suchen..."
              emptyText="Keine passenden Trainer gefunden."
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
                      {[selectedPerson.functionLabel, selectedPerson.teamLabel].filter(Boolean).join(" • ") || "Trainer"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="fca-label">Status</span>
                  <select value={assignStatus} onChange={(event) => setAssignStatus(event.target.value)} className="fca-select">
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="fca-label">Rolle</span>
                  <input type="text" value={roleLabel} onChange={(event) => setRoleLabel(event.target.value)} className="fca-input" placeholder="z. B. Cheftrainer" />
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

              <Toggle label="Website sichtbar" value={isWebsiteVisible} onChange={setIsWebsiteVisible} />

              {assignError ? <div className="fca-status-box fca-status-box-error">{assignError}</div> : null}
              {assignMessage ? <div className="fca-status-box fca-status-box-success">{assignMessage}</div> : null}

              <div className="flex justify-end">
                <button type="button" onClick={handleAssign} disabled={assignLoading || !selectedPerson} className="fca-button-primary">
                  {assignLoading ? "Hinzufügen..." : "Trainer hinzufügen"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {removeError ? <div className="fca-status-box fca-status-box-error mt-4">{removeError}</div> : null}
      {removeMessage ? <div className="fca-status-box fca-status-box-success mt-4">{removeMessage}</div> : null}

      {teamSeason.trainerTeamMembers.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-5">
          Noch keine Trainer im Trainerteam dieser Team-Saison.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {teamSeason.trainerTeamMembers.map((member) => {
            const qualifications = member.person.trainerQualifications ?? [];

            return (
              <AdminListItem
                key={member.id}
                avatar={<AdminAvatar name={getPersonName(member.person)} size="md" />}
                title={getPersonName(member.person)}
                subtitle={[
                  canManage ? (
                    <label className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                      <span className="text-[11px] font-semibold text-slate-400">Rolle</span>
                      <input
                        type="text"
                        defaultValue={member.roleLabel ?? ""}
                        onBlur={(event) => handleInlineUpdate(member, { roleLabel: event.target.value.trim() || null })}
                        className="w-32 bg-transparent text-xs font-semibold text-slate-700 outline-none"
                      />
                    </label>
                  ) : member.roleLabel ?? "Keine Rolle hinterlegt",
                  qualifications.length > 0
                    ? "Diplome: " + qualifications.map(getTrainerQualificationLabel).join(" | ")
                    : "Keine Diplome hinterlegt",
                ].join(" • ")}
                meta={
                  <>
                    <AdminStatusPill label={member.status} tone={member.status === "ACTIVE" ? "success" : "muted"} />
                    <button type="button" onClick={() => handleInlineUpdate(member, { isWebsiteVisible: !member.isWebsiteVisible })} disabled={!canManage} className="fca-pill">Website: {member.isWebsiteVisible ? "Ja" : "Nein"}</button>
                    <button type="button" onClick={() => setExpandedQualificationPersonId(expandedQualificationPersonId === member.person.id ? null : member.person.id)} className="fca-pill">Diplome: {qualifications.length}</button>
                    <Link href={`/dashboard/persons/${member.person.id}`} className="fca-pill">Profil öffnen</Link>
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
                } />
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

