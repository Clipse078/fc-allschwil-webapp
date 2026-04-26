"use client";

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

const QUALIFICATION_TYPE_OPTIONS = [
  { value: "DIPLOMA", label: "Diplom" },
  { value: "CERTIFICATE", label: "Zertifikat" },
  { value: "COURSE", label: "Kurs" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "FIRST_AID", label: "Erste Hilfe" },
  { value: "OTHER", label: "Sonstiges" },
];

const QUALIFICATION_STATUS_OPTIONS = [
  { value: "UNKNOWN", label: "Unbekannt" },
  { value: "VALID", label: "Gültig" },
  { value: "IN_PROGRESS", label: "In Ausbildung" },
  { value: "EXPIRED", label: "Abgelaufen" },
  { value: "PLANNED", label: "Geplant" },
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

  const [qualificationPersonId, setQualificationPersonId] = useState<string | null>(null);
  const [expandedQualificationPersonId, setExpandedQualificationPersonId] = useState<string | null>(null);
  const [qualificationTitle, setQualificationTitle] = useState("");
  const [qualificationType, setQualificationType] = useState("DIPLOMA");
  const [qualificationStatus, setQualificationStatus] = useState("UNKNOWN");
  const [qualificationIssuer, setQualificationIssuer] = useState("");
  const [qualificationLoading, setQualificationLoading] = useState(false);
  const [deletingQualificationId, setDeletingQualificationId] = useState<string | null>(null);
  const [qualificationMessage, setQualificationMessage] = useState<string | null>(null);
  const [qualificationError, setQualificationError] = useState<string | null>(null);

  const [editingQualificationId, setEditingQualificationId] = useState<string | null>(null);
  const [editQualificationTitle, setEditQualificationTitle] = useState("");
  const [editQualificationType, setEditQualificationType] = useState("DIPLOMA");
  const [editQualificationStatus, setEditQualificationStatus] = useState("UNKNOWN");
  const [editQualificationIssuer, setEditQualificationIssuer] = useState("");
  const [editQualificationVerified, setEditQualificationVerified] = useState(false);
  const [updatingQualificationId, setUpdatingQualificationId] = useState<string | null>(null);

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

  async function handleCreateQualification(personId: string) {
    if (!canManage) return;

    if (!qualificationTitle.trim()) {
      setQualificationError("Bitte einen Diplom- oder Kursnamen erfassen.");
      setQualificationMessage(null);
      return;
    }

    setQualificationLoading(true);
    setQualificationError(null);
    setQualificationMessage(null);

    try {
      const response = await fetch("/api/people/" + personId + "/trainer-qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: qualificationTitle,
          type: qualificationType,
          status: qualificationStatus,
          issuer: qualificationIssuer,
          isClubVerified: false,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer-Diplom konnte nicht gespeichert werden.");
      }

      setQualificationMessage(data?.message ?? "Trainer-Diplom erfolgreich hinterlegt.");
      setQualificationTitle("");
      setQualificationType("DIPLOMA");
      setQualificationStatus("UNKNOWN");
      setQualificationIssuer("");
      setQualificationPersonId(null);
      router.refresh();
    } catch (err) {
      setQualificationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setQualificationLoading(false);
    }
  }

  function startEditQualification(qualification: TrainerQualification) {
    setEditingQualificationId(qualification.id);
    setEditQualificationTitle(qualification.title);
    setEditQualificationType(qualification.type);
    setEditQualificationStatus(qualification.status);
    setEditQualificationIssuer(qualification.issuer ?? "");
    setEditQualificationVerified(qualification.isClubVerified);
    setQualificationError(null);
    setQualificationMessage(null);
  }

  function cancelEditQualification() {
    setEditingQualificationId(null);
    setEditQualificationTitle("");
    setEditQualificationType("DIPLOMA");
    setEditQualificationStatus("UNKNOWN");
    setEditQualificationIssuer("");
    setEditQualificationVerified(false);
  }

  async function handleUpdateQualification(personId: string, qualificationId: string) {
    if (!canManage) return;

    if (!editQualificationTitle.trim()) {
      setQualificationError("Bitte einen Diplom- oder Kursnamen erfassen.");
      setQualificationMessage(null);
      return;
    }

    setUpdatingQualificationId(qualificationId);
    setQualificationError(null);
    setQualificationMessage(null);

    try {
      const response = await fetch(
        "/api/people/" + personId + "/trainer-qualifications/" + qualificationId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editQualificationTitle,
            type: editQualificationType,
            status: editQualificationStatus,
            issuer: editQualificationIssuer,
            isClubVerified: editQualificationVerified,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer-Diplom konnte nicht aktualisiert werden.");
      }

      setQualificationMessage(data?.message ?? "Trainer-Diplom erfolgreich aktualisiert.");
      cancelEditQualification();
      router.refresh();
    } catch (err) {
      setQualificationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setUpdatingQualificationId(null);
    }
  }

  async function handleDeleteQualification(personId: string, qualification: TrainerQualification) {
    if (!canManage) return;

    const confirmed = window.confirm('Diplom "' + qualification.title + '" wirklich löschen?');
    if (!confirmed) return;

    setDeletingQualificationId(qualification.id);
    setQualificationError(null);
    setQualificationMessage(null);

    try {
      const response = await fetch(
        "/api/people/" + personId + "/trainer-qualifications/" + qualification.id,
        { method: "DELETE" },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Trainer-Diplom konnte nicht gelöscht werden.");
      }

      setQualificationMessage(data?.message ?? "Trainer-Diplom erfolgreich gelöscht.");
      router.refresh();
    } catch (err) {
      setQualificationError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setDeletingQualificationId(null);
    }
  }

  async function handleInlineUpdate(member: TrainerMember, updates: Partial<Pick<TrainerMember, "isWebsiteVisible">>) {
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
              Neue Personen werden nur im People-Modul angelegt. Die Suche zeigt nur zuweisbare Trainer.
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

      {qualificationError ? <div className="fca-status-box fca-status-box-error mt-4">{qualificationError}</div> : null}
      {qualificationMessage ? <div className="fca-status-box fca-status-box-success mt-4">{qualificationMessage}</div> : null}
      {removeError ? <div className="fca-status-box fca-status-box-error mt-4">{removeError}</div> : null}
      {removeMessage ? <div className="fca-status-box fca-status-box-success mt-4">{removeMessage}</div> : null}

      {teamSeason.trainerTeamMembers.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-5">
          Noch keine Trainer im Trainerteam dieser Team-Saison.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {teamSeason.trainerTeamMembers.map((member) => (
            <AdminListItem
              key={member.id}
              avatar={<AdminAvatar name={getPersonName(member.person)} size="md" />}
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
                  <button type="button" onClick={() => handleInlineUpdate(member, { isWebsiteVisible: !member.isWebsiteVisible })} disabled={!canManage} className="fca-pill">Website: {member.isWebsiteVisible ? "Ja" : "Nein"}</button>
                  <button type="button" onClick={() => setExpandedQualificationPersonId(expandedQualificationPersonId === member.person.id ? null : member.person.id)} className="fca-pill">Diplome: {member.person.trainerQualifications?.length ?? 0}</button>
                </>
              }
              actions={
                canManage ? (
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQualificationPersonId(qualificationPersonId === member.person.id ? null : member.person.id)}
                      className="fca-button-secondary"
                    >
                      Diplom erfassen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(member)}
                      disabled={removingMemberId === member.id}
                      className="fca-button-primary"
                    >
                      {removingMemberId === member.id ? "Entfernen..." : "Entfernen"}
                    </button>

                    {expandedQualificationPersonId === member.person.id ? (
                      <div className="mt-2 w-full min-w-[320px] rounded-[22px] border border-blue-100 bg-blue-50/60 p-4 text-left shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="fca-label">Interne Diplome / Zertifikate</div>
                          <span className="fca-pill">Intern</span>
                        </div>
                        {member.person.trainerQualifications && member.person.trainerQualifications.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {member.person.trainerQualifications.map((qualification) => (
                              <div key={qualification.id} className="rounded-[18px] border border-blue-100 bg-white px-3 py-2">
                                {editingQualificationId === qualification.id ? (
                                  <div className="grid gap-3">
                                    <input className="fca-input" value={editQualificationTitle} onChange={(event) => setEditQualificationTitle(event.target.value)} />
                                    <input className="fca-input" value={editQualificationIssuer} onChange={(event) => setEditQualificationIssuer(event.target.value)} placeholder="Aussteller" />
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <select className="fca-select" value={editQualificationType} onChange={(event) => setEditQualificationType(event.target.value)}>
                                        {QUALIFICATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </select>
                                      <select className="fca-select" value={editQualificationStatus} onChange={(event) => setEditQualificationStatus(event.target.value)}>
                                        {QUALIFICATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                      </select>
                                    </div>
                                    <Toggle label="Vom Club geprüft" value={editQualificationVerified} onChange={setEditQualificationVerified} />
                                    <div className="flex flex-wrap justify-end gap-2">
                                      <button type="button" onClick={cancelEditQualification} className="fca-button-secondary">Abbrechen</button>
                                      <button type="button" onClick={() => handleUpdateQualification(member.person.id, qualification.id)} disabled={updatingQualificationId === qualification.id} className="fca-button-primary">
                                        {updatingQualificationId === qualification.id ? "Speichern..." : "Speichern"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-semibold text-slate-900">{qualification.title}</div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {[qualification.issuer, qualification.status, qualification.isClubVerified ? "geprüft" : null].filter(Boolean).join(" · ") || "Keine Zusatzdaten"}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                      <button type="button" onClick={() => startEditQualification(qualification)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50">Edit</button>
                                      <button type="button" onClick={() => handleDeleteQualification(member.person.id, qualification)} disabled={deletingQualificationId === qualification.id} className="rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
                                        {deletingQualificationId === qualification.id ? "Löschen..." : "Löschen"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="fca-status-box fca-status-box-muted mt-3">Noch keine Diplome hinterlegt.</div>
                        )}
                      </div>
                    ) : null}

                    {qualificationPersonId === member.person.id ? (
                      <div className="mt-2 w-full min-w-[280px] rounded-[22px] border border-slate-200 bg-white p-4 text-left shadow-sm">
                        <div className="fca-label">Internes Diplom / Zertifikat</div>
                        <div className="mt-3 grid gap-3">
                          <input className="fca-input" value={qualificationTitle} onChange={(event) => setQualificationTitle(event.target.value)} placeholder="z. B. SFV Kinderfussball-Diplom" />
                          <input className="fca-input" value={qualificationIssuer} onChange={(event) => setQualificationIssuer(event.target.value)} placeholder="Aussteller, z. B. SFV / FVNWS" />
                          <div className="grid gap-3 md:grid-cols-2">
                            <select className="fca-select" value={qualificationType} onChange={(event) => setQualificationType(event.target.value)}>
                              {QUALIFICATION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            <select className="fca-select" value={qualificationStatus} onChange={(event) => setQualificationStatus(event.target.value)}>
                              {QUALIFICATION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                          </div>
                          <button type="button" onClick={() => handleCreateQualification(member.person.id)} disabled={qualificationLoading} className="fca-button-primary">
                            {qualificationLoading ? "Speichern..." : "Intern speichern"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
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

