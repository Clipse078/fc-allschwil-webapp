"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { getPitchOptionsForEventType } from "@/lib/facilities/pitches";
import { FCA_DRESSING_ROOMS } from "@/lib/facilities/dressing-rooms";
import type { TournamentDto } from "@/lib/tournaments/types";

type TeamItem = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
  isActive: boolean;
};

const TOURNAMENT_PITCH_OPTIONS = getPitchOptionsForEventType("TOURNAMENT");

function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function formatTeamLabel(team: TeamItem): string {
  const suffix = [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ");
  return suffix ? `${team.name} · ${suffix}` : team.name;
}

type TournamentEditFormProps = {
  tournament: TournamentDto;
  canManage: boolean;
};

export default function TournamentEditForm({ tournament, canManage }: TournamentEditFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(tournament.title);
  const [organizerName, setOrganizerName] = useState(tournament.organizerName ?? "");
  const [competitionLabel, setCompetitionLabel] = useState(tournament.competitionLabel ?? "");
  const [location, setLocation] = useState(tournament.location ?? "");
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(tournament.startAt));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(tournament.endAt));
  const [meetingTime, setMeetingTime] = useState(toDateTimeLocalValue(tournament.meetingTime));
  const [description, setDescription] = useState(tournament.description ?? "");
  const [resultLabel, setResultLabel] = useState(tournament.resultLabel ?? "");
  const [remarks, setRemarks] = useState(tournament.remarks ?? "");
  const [teamId, setTeamId] = useState(tournament.team?.id ?? "");

  const [websiteVisible, setWebsiteVisible] = useState(tournament.visibility.websiteVisible);
  const [infoboardVisible, setInfoboardVisible] = useState(tournament.visibility.infoboardVisible);
  const [homepageVisible, setHomepageVisible] = useState(tournament.visibility.homepageVisible);
  const [wochenplanVisible, setWochenplanVisible] = useState(tournament.visibility.wochenplanVisible);
  const [teamPageVisible, setTeamPageVisible] = useState(tournament.visibility.teamPageVisible);

  const [pitchCode, setPitchCode] = useState(tournament.allocation.pitchCode ?? "");
  const [homeDressingRoomCode, setHomeDressingRoomCode] = useState(
    tournament.allocation.homeDressingRoomCode ?? "",
  );
  const [awayDressingRoomCode, setAwayDressingRoomCode] = useState(
    tournament.allocation.awayDressingRoomCode ?? "",
  );

  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);

  const isCancelled = tournament.status === "CANCELLED";
  const isEditable = canManage && tournament.status !== "ARCHIVED" && tournament.status !== "COMPLETED";

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
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : null,
          meetingTime: meetingTime ? new Date(meetingTime).toISOString() : null,
          description: description.trim() || null,
          resultLabel: resultLabel.trim() || null,
          remarks: remarks.trim() || null,
          teamId: teamId || null,
          websiteVisible,
          infoboardVisible,
          homepageVisible,
          wochenplanVisible,
          teamPageVisible,
          pitchCode: pitchCode.trim() || null,
          homeDressingRoomCode: homeDressingRoomCode.trim() || null,
          awayDressingRoomCode: awayDressingRoomCode.trim() || null,
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
            <span className="fca-label">Team</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={!isEditable || teamsLoading || saving}
              className="fca-select"
              data-testid="tournament-team-select"
            >
              <option value="">{teamsLoading ? "Teams laden..." : "— Kein Team zugeordnet —"}</option>
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
        title="Sportanlage und Garderoben"
        description="Optional — nur relevant, wenn FC Allschwil das Turnier auf einer eigenen Anlage austrägt."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
            <span className="fca-label">Spielfeld</span>
            <select
              value={pitchCode}
              onChange={(e) => setPitchCode(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-select"
              data-testid="tournament-pitch-select"
            >
              <option value="">— Kein Spielfeld zugeordnet —</option>
              {TOURNAMENT_PITCH_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Garderobe Heim</span>
            <select
              value={homeDressingRoomCode}
              onChange={(e) => setHomeDressingRoomCode(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-select"
            >
              <option value="">— Keine Garderobe zugeordnet —</option>
              {FCA_DRESSING_ROOMS.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Garderobe Gast</span>
            <select
              value={awayDressingRoomCode}
              onChange={(e) => setAwayDressingRoomCode(e.target.value)}
              disabled={!isEditable || saving}
              className="fca-select"
            >
              <option value="">— Keine Garderobe zugeordnet —</option>
              {FCA_DRESSING_ROOMS.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

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
      </div>
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
