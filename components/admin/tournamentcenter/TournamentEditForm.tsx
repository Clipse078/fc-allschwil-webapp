"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SectionCard } from "@/components/ui/page/SectionCard";
import type { TournamentDto } from "@/lib/tournaments/types";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import TournamentParticipantsEditor from "@/components/admin/tournamentcenter/TournamentParticipantsEditor";
import TournamentResourceAllocationEditor from "@/components/admin/tournamentcenter/TournamentResourceAllocationEditor";
import { useFacilityAvailability } from "@/hooks/use-facility-availability";
import PlanningWorkflowBadge from "@/components/admin/shared/PlanningWorkflowBadge";
import PlanningWorkflowActionsClient from "@/components/admin/shared/PlanningWorkflowActionsClient";
import {
  utcInstantToDateTimeLocalValue,
} from "@/lib/events/tenant-local-datetime";

type DeletionImpact = { key: string; label: string; count: number };

type TeamItem = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
  isActive: boolean;
};

function toDateTimeLocalValue(iso: string | null, timezone: string): string {
  return utcInstantToDateTimeLocalValue(iso, timezone);
}

function formatTeamLabel(team: TeamItem): string {
  const suffix = [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ");
  return suffix ? `${team.name} · ${suffix}` : team.name;
}

type TournamentEditFormProps = {
  tournament: TournamentDto;
  canManage: boolean;
  /**
   * ADMIN-DELETE-02A: effective PERMISSIONS.TOURNAMENTS_DELETE authority.
   * Deliberately independent of canManage/events.manage — permanent
   * deletion is a separate authority from cancel/restore/edit.
   */
  canDelete?: boolean;
  /** Non-archived FULL_PITCH/HALF_PITCH resources, grouped by facility — for the tournament-level Spielfeld/Halle editor. */
  pitchHallFacilityGroups: FacilityGroup[];
  /** Non-archived DRESSING_ROOM resources, grouped by facility — for the per-participant Garderobe editor. */
  dressingRoomFacilityGroups: FacilityGroup[];
  /**
   * ORG-ACCESS-03: planning workflow flags.
   * isCoordinatorForPlanning: true when user holds tenant-wide events.manage.
   * isProtectedSource: true for SFV/provider records — no workflow UI.
   */
  isCoordinatorForPlanning?: boolean;
  isProtectedSource?: boolean;
  /** Tenant IANA timezone for datetime-local round-trip (e.g. Europe/Zurich). */
  timezone: string;
};

export default function TournamentEditForm({
  tournament,
  canManage,
  canDelete = false,
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
  isCoordinatorForPlanning = false,
  isProtectedSource = false,
  timezone,
}: TournamentEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(tournament.title);
  const [organizerName, setOrganizerName] = useState(tournament.organizerName ?? "");
  const [competitionLabel, setCompetitionLabel] = useState(tournament.competitionLabel ?? "");
  const [location, setLocation] = useState(tournament.location ?? "");
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(tournament.startAt, timezone));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(tournament.endAt, timezone));
  const [meetingTime, setMeetingTime] = useState(toDateTimeLocalValue(tournament.meetingTime, timezone));
  const [description, setDescription] = useState(tournament.description ?? "");
  const [resultLabel, setResultLabel] = useState(tournament.resultLabel ?? "");
  const [remarks, setRemarks] = useState(tournament.remarks ?? "");
  const [teamId, setTeamId] = useState(tournament.team?.id ?? "");
  const [homeAway, setHomeAway] = useState(tournament.homeAway);

  const [websiteVisible, setWebsiteVisible] = useState(tournament.visibility.websiteVisible);
  const [infoboardVisible, setInfoboardVisible] = useState(tournament.visibility.infoboardVisible);
  const [homepageVisible, setHomepageVisible] = useState(tournament.visibility.homepageVisible);
  const [wochenplanVisible, setWochenplanVisible] = useState(tournament.visibility.wochenplanVisible);
  const [teamPageVisible, setTeamPageVisible] = useState(tournament.visibility.teamPageVisible);

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<DeletionImpact[] | null>(null);

  const isCancelled = tournament.status === "CANCELLED";
  const isEditable = canManage && tournament.status !== "ARCHIVED" && tournament.status !== "COMPLETED";

  // RESOURCE-AVAILABILITY-UX-01 — live Frei/Belegt availability for the
  // CURRENT (possibly unsaved) Start/Ende form values, reusing the EXISTING
  // PLANNING-CREATION-UX-01A foundation. HOME-only, mirroring the Spielfeld/
  // Halle section's own visibility below. This tournament's own existing
  // allocations are excluded server-side (excludeEventId) so editing never
  // flags its own resources as a conflict with itself.
  const { pitchAvailability, dressingRoomAvailability } = useFacilityAvailability({
    enabled: homeAway === "HOME" && !!startAt,
    startAt,
    endAt,
    excludeEventId: tournament.id,
  });

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      setTeamsLoading(true);
      try {
        const res = await fetch("/api/teams", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as TeamItem[] | { error?: string } | null;
        if (!active) return;
        setTeams(Array.isArray(data) ? data.filter((t) => t.isActive) : []);
      } finally {
        if (active) setTeamsLoading(false);
      }
    }

    if (canManage) {
      loadTeams();
    }

    return () => {
      active = false;
    };
  }, [canManage]);

  async function handleSave() {
    if (!title.trim()) {
      toast.danger("Titel ist erforderlich.");
      return;
    }
    if (!startAt) {
      toast.danger("Startdatum ist erforderlich.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          organizerName: organizerName.trim() || null,
          competitionLabel: competitionLabel.trim() || null,
          location: location.trim() || null,
          startAt,
          endAt: endAt || null,
          meetingTime: meetingTime || null,
          description: description.trim() || null,
          resultLabel: resultLabel.trim() || null,
          remarks: remarks.trim() || null,
          teamId: teamId || null,
          homeAway,
          websiteVisible,
          infoboardVisible,
          homepageVisible,
          wochenplanVisible,
          teamPageVisible,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Änderungen konnten nicht gespeichert werden.");
      }

      toast.success("Turnier aktualisiert.");
      router.refresh();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Änderungen konnten nicht gespeichert werden.", {
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleLifecycleToggle() {
    setLifecycleLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isCancelled ? "SCHEDULED" : "CANCELLED" }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Aktion fehlgeschlagen.");
      }

      toast.success(isCancelled ? "Turnier wiederhergestellt." : "Turnier storniert.");
      router.refresh();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Aktion fehlgeschlagen.", { duration: 6000 });
    } finally {
      setLifecycleLoading(false);
    }
  }

  async function openDeleteConfirmation() {
    setDeleteConfirming(true);
    setDeleteError(null);
    setDeleteImpact(null);
    setDeleteImpactLoading(true);

    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; impact?: DeletionImpact[] }
        | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Löschen nicht möglich.");
      }

      setDeleteImpact(Array.isArray(data?.impact) ? data.impact : []);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setDeleteImpactLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteBusy(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournament.id}?confirm=true`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }

      setDeleteConfirming(false);
      setDeleteImpact(null);
      toast.success("Turnier endgültig gelöscht.");
      router.push("/dashboard/tournamentcenter");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Grunddaten" description="Turniername, Organisator und Zeitrahmen">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Titel</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Heim / Auswärts</span>
            <select
              value={homeAway}
              onChange={(e) => setHomeAway(e.target.value === "AWAY" ? "AWAY" : "HOME")}
              disabled={!isEditable || saving}
              className="fca-select"
              data-testid="tournament-home-away-select"
            >
              <option value="HOME">Heim (FC Allschwil ausrichtend)</option>
              <option value="AWAY">Auswärts (extern ausgerichtet)</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Hauptteam (Teamseite / Wochenplan)</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={!isEditable || teamsLoading || saving}
              className="fca-select"
              data-testid="tournament-team-select"
            >
              <option value="">{teamsLoading ? "Teams laden..." : "— Kein Hauptteam zugeordnet —"}</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {formatTeamLabel(team)}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Organisator</span>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              placeholder="z. B. FC Aesch"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Wettbewerb / Label</span>
            <input
              type="text"
              value={competitionLabel}
              onChange={(e) => setCompetitionLabel(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              placeholder="z. B. Hallenturnier"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              placeholder="z. B. Turnhalle Binningen"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Resultat / Rang</span>
            <input
              type="text"
              value={resultLabel}
              onChange={(e) => setResultLabel(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              placeholder="z. B. 2. Platz"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Treffpunkt Zeit</span>
            <input
              type="datetime-local"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Beschreibung</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-textarea min-h-[100px]"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Bemerkungen</span>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-input"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Teilnehmende Teams"
        description="FC Allschwil Teams und externe Vereine aus dem Vereinsverzeichnis — beliebig viele, in beliebiger Mischung."
      >
        <TournamentParticipantsEditor
          tournamentId={tournament.id}
          canManage={isEditable}
          homeAway={homeAway}
          initialParticipants={tournament.participants}
          dressingRoomFacilityGroups={dressingRoomFacilityGroups}
          dressingRoomAvailability={dressingRoomAvailability}
        />
      </SectionCard>

      {homeAway === "HOME" && (
        <SectionCard
          title="Ressourcen · Spielfeld / Halle"
          description="Ein Heimturnier kann mehr als ein Spielfeld bzw. mehr als eine Halle belegen. Verfügbarkeit wird live für Start–Ende angezeigt."
        >
          <TournamentResourceAllocationEditor
            tournamentId={tournament.id}
            canManage={isEditable}
            initialAllocations={tournament.resourceAllocations}
            facilityGroups={pitchHallFacilityGroups}
            availabilityByResourceId={pitchAvailability}
          />
        </SectionCard>
      )}

      <SectionCard title="Veröffentlichung" description="Ausgabekanäle für dieses Turnier">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Toggle label="Website" value={websiteVisible} onChange={setWebsiteVisible} disabled={!isEditable || saving} />
          <Toggle label="Infoboard" value={infoboardVisible} onChange={setInfoboardVisible} disabled={!isEditable || saving} />
          <Toggle label="Homepage" value={homepageVisible} onChange={setHomepageVisible} disabled={!isEditable || saving} />
          <Toggle label="Wochenplan" value={wochenplanVisible} onChange={setWochenplanVisible} disabled={!isEditable || saving} />
          <Toggle label="Teamseite" value={teamPageVisible} onChange={setTeamPageVisible} disabled={!isEditable || saving} />
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {isEditable && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-testid="tournament-save"
              className="fca-button-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Änderungen speichern
                </>
              )}
            </button>
          )}
        </div>

        {canManage && tournament.status !== "ARCHIVED" && tournament.status !== "COMPLETED" && (
          <button
            type="button"
            onClick={handleLifecycleToggle}
            disabled={lifecycleLoading}
            data-testid="tournament-lifecycle-toggle"
            className={
              isCancelled
                ? "inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                : "inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {lifecycleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCancelled ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {isCancelled ? "Turnier wiederherstellen" : "Turnier absagen"}
          </button>
        )}

        {/*
          ADMIN-DELETE-02A: permanent delete requires effective
          tournaments.delete authority, independent of canManage/
          events.manage — this button is gated on `canDelete` alone.
        */}
        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 className="h-4 w-4" />}
            onClick={openDeleteConfirmation}
            data-testid="tournament-delete-button"
          >
            Endgültig löschen
          </Button>
        )}

        {/* ORG-ACCESS-03: planning workflow actions for manual tournaments */}
        {!isProtectedSource && (
          <div className="flex items-center gap-2 border-l border-[var(--border)] pl-3">
            <PlanningWorkflowBadge stage={tournament.reviewStage} size="sm" />
            <PlanningWorkflowActionsClient
              recordId={tournament.id}
              domain="tournament"
              planningStage={tournament.reviewStage}
              isCoordinator={isCoordinatorForPlanning}
              isProtectedSource={isProtectedSource}
            />
          </div>
        )}
      </div>

      <Dialog
        open={deleteConfirming}
        onClose={() => {
          setDeleteConfirming(false);
          setDeleteImpact(null);
          setDeleteError(null);
        }}
        title={`„${tournament.title}" endgültig löschen?`}
        description="Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteConfirming(false);
                setDeleteImpact(null);
                setDeleteError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={deleteBusy}
              disabled={deleteImpactLoading}
              onClick={handleDelete}
              data-testid="tournament-delete-confirm"
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {deleteError ? (
            <p className="text-sm font-medium text-[var(--sce-danger)]">{deleteError}</p>
          ) : null}

          {deleteImpactLoading ? (
            <p className="text-sm text-[var(--text-2)]">Auswirkungen werden geprüft…</p>
          ) : deleteImpact && deleteImpact.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)] p-3 text-[var(--sce-warning)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">
                  Folgende verknüpfte Daten werden ebenfalls unwiderruflich entfernt. Teilnehmende
                  Vereine, Teams und Ressourcen selbst bleiben erhalten.
                </p>
              </div>
              <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-2)]">
                {deleteImpact.map((item) => (
                  <li key={item.key}>
                    {item.label}: {item.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : deleteImpact ? (
            <p className="text-sm text-[var(--text-2)]">
              Keine Teilnehmer, Ressourcen-Zuordnungen oder Historie vorhanden.
            </p>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fca-toggle-row">
      <span className="fca-label">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="fca-toggle-checkbox"
      />
    </div>
  );
}
