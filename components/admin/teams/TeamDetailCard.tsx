"use client";

import type { ChangeEvent, DragEvent, ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  Edit3,
  Eye,
  EyeOff,
  ImageIcon,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TeamRosterOverviewCard from "@/components/admin/teams/TeamRosterOverviewCard";
import TeamHealthCard from "@/components/admin/teams/TeamHealthCard";
import TeamSettingsCard from "@/components/admin/teams/TeamSettingsCard";

type TeamSeasonStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type PersonMember = {
  id: string;
  status: string;
  roleLabel?: string | null;
  shirtNumber?: number | null;
  positionLabel?: string | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWebsiteVisible?: boolean;
  sortOrder?: number;
  remarks?: string | null;
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

type TeamSeasonItem = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: TeamSeasonStatus;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  squadWebsiteVisible?: boolean;
  trainerTeamWebsiteVisible?: boolean;
  trainingsWebsiteVisible?: boolean;
  upcomingMatchesWebsiteVisible?: boolean;
  resultsWebsiteVisible?: boolean;
  standingsWebsiteVisible?: boolean;
  teamPhotoUrl?: string | null;
  teamPhotoX?: number;
  teamPhotoY?: number;
  teamPhotoZoom?: number;
  teamPhotoRotate?: number;
  teamPhotoVisible?: boolean;
  season: {
    id: string;
    key: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
  playerSquadMembers?: PersonMember[];
  trainerTeamMembers?: PersonMember[];
};

type Team = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  teamSeasons: TeamSeasonItem[];
};

type SeasonOption = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date | string;
  endDate: Date | string;
};

type Props = {
  initialTeam: Team;
  availableSeasons: SeasonOption[];
  canManage: boolean;
};

function formatGenderGroup(value: string | null) {
  const normalized = String(value ?? "").toUpperCase();

  if (normalized === "MEN" || normalized === "MALE" || normalized === "MÃ„NNER" || normalized === "MANNER") return "MÃ¤nner";
  if (normalized === "WOMEN" || normalized === "FEMALE" || normalized === "FRAUEN") return "Frauen";
  if (normalized === "MIXED" || normalized === "GEMISCHT") return "Mixed";

  return "â€“";
}

function getDiplomaRequirementForTeam(category: string | null, ageGroup: string | null) {
  const normalizedCategory = String(category ?? "").toUpperCase();
  const normalizedAgeGroup = String(ageGroup ?? "").toUpperCase();

  if (["G", "F", "E"].includes(normalizedAgeGroup) || normalizedCategory.includes("KINDERFUSSBALL")) {
    return "D-Diplom" as const;
  }

  if (["C", "B", "A"].includes(normalizedAgeGroup) || normalizedCategory.includes("JUNIOREN")) {
    return "C-Diplom" as const;
  }

  if (normalizedCategory.includes("AKTIVE") || normalizedAgeGroup.includes("AKTIVE")) {
    return "B-Diplom" as const;
  }

  return null;
}

function VisibilityTile({
  icon,
  title,
  active,
  onToggle,
}: {
  icon: ReactNode;
  title: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex min-h-[168px] flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[#0b4aa2] shadow-sm group-hover:bg-red-50 group-hover:text-[#d62839]">
        {icon}
      </div>
      <div className="mt-5 text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-5 flex items-center gap-3">
        <span className={`relative h-7 w-12 rounded-full transition ${active ? "bg-emerald-500" : "bg-slate-300"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${active ? "left-6" : "left-1"}`} />
        </span>
        <span className={`text-xs font-semibold ${active ? "text-green-600" : "text-slate-900"}`}>{active ? "Sichtbar auf Website" : "Nicht sichtbar"}</span>
      </div>
    </button>
  );
}

export default function TeamDetailCard({ initialTeam, canManage }: Props) {
  const router = useRouter();
  const [team, setTeam] = useState<Team>(initialTeam);
  const [teamDetailsOpen, setTeamDetailsOpen] = useState(false);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState<string | null>(null);
  const [teamPhotoFile, setTeamPhotoFile] = useState<File | null>(null);
  const [teamPhotoVisible, setTeamPhotoVisible] = useState(false);
  const [teamPhotoX, setTeamPhotoX] = useState(50);
  const [teamPhotoY, setTeamPhotoY] = useState(50);
  const [teamPhotoZoom, setTeamPhotoZoom] = useState(100);
  const [teamPhotoRotate, setTeamPhotoRotate] = useState(0);
  const [teamPhotoSaved, setTeamPhotoSaved] = useState(false);
  const [teamPhotoDrag, setTeamPhotoDrag] = useState<{ startX: number; startY: number; photoX: number; photoY: number } | null>(null);
  const [trainerDiplomaCounts, setTrainerDiplomaCounts] = useState<{ label: string; count: number }[]>([]);

  useEffect(() => {
    setTeam(initialTeam);
  }, [initialTeam]);

  const activeTeamSeason = useMemo(() => {
    return team.teamSeasons.find((entry) => entry.season.isActive) ?? team.teamSeasons[0] ?? null;
  }, [team.teamSeasons]);

  const playerBirthYearCounts = useMemo(() => {
    const counts = new Map<number, number>();

    for (const member of activeTeamSeason?.playerSquadMembers ?? []) {
      const value = member.person.dateOfBirth;
      if (!value) continue;

      const year = new Date(value).getUTCFullYear();
      if (!Number.isFinite(year)) continue;

      counts.set(year, (counts.get(year) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a - b)
      .map(([year, count]) => ({ year, count }));
  }, [activeTeamSeason?.playerSquadMembers]);
  const [visibility, setVisibility] = useState({
    trainings: activeTeamSeason?.trainingsWebsiteVisible ?? true,
    upcoming: activeTeamSeason?.upcomingMatchesWebsiteVisible ?? true,
    standings: activeTeamSeason?.standingsWebsiteVisible ?? true,
    results: activeTeamSeason?.resultsWebsiteVisible ?? true,
    trainerstaff: activeTeamSeason?.trainerTeamWebsiteVisible ?? true,
    playersquad: activeTeamSeason?.squadWebsiteVisible ?? true,
    teamPage: team.websiteVisible,
  });

  useEffect(() => {
    setVisibility({
      trainings: activeTeamSeason?.trainingsWebsiteVisible ?? true,
      upcoming: activeTeamSeason?.upcomingMatchesWebsiteVisible ?? true,
      standings: activeTeamSeason?.standingsWebsiteVisible ?? true,
      results: activeTeamSeason?.resultsWebsiteVisible ?? true,
      trainerstaff: activeTeamSeason?.trainerTeamWebsiteVisible ?? true,
      playersquad: activeTeamSeason?.squadWebsiteVisible ?? true,
      teamPage: team.websiteVisible,
    });

    if (activeTeamSeason?.teamPhotoUrl) {
      setTeamPhotoPreview(activeTeamSeason.teamPhotoUrl);
      setTeamPhotoX(activeTeamSeason.teamPhotoX ?? 50);
      setTeamPhotoY(activeTeamSeason.teamPhotoY ?? 50);
      setTeamPhotoZoom(activeTeamSeason.teamPhotoZoom ?? 100);
      setTeamPhotoRotate(activeTeamSeason.teamPhotoRotate ?? 0);
      setTeamPhotoVisible(activeTeamSeason.teamPhotoVisible ?? true);
      setTeamPhotoSaved(true);
    }
  }, [activeTeamSeason, team.websiteVisible]);

  useEffect(() => {
    const teamSeasonId = activeTeamSeason?.id;
    if (!teamSeasonId) {
      setTrainerDiplomaCounts([]);
      return;
    }

    async function loadTrainerDiplomas() {
      try {
        const response = await fetch(`/api/teams/${team.id}/team-seasons/${teamSeasonId}/trainer-members`);
        const data = await response.json().catch(() => []);

        if (!Array.isArray(data)) {
          setTrainerDiplomaCounts([]);
          return;
        }

        const counts = new Map<string, number>();

        for (const trainer of data) {
          const subline = String(trainer.subline ?? "").trim();
          if (!subline) continue;

          const diploma = subline.split("•")[0]?.trim();
          if (!diploma) continue;

          counts.set(diploma, (counts.get(diploma) ?? 0) + 1);
        }

        setTrainerDiplomaCounts(
          Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, count]) => ({ label, count })),
        );
      } catch {
        setTrainerDiplomaCounts([]);
      }
    }

    void loadTrainerDiplomas();
  }, [activeTeamSeason?.id, team.id]);
  async function toggleWebsiteVisibility(
    key: "trainings" | "upcoming" | "standings" | "results" | "trainerstaff" | "playersquad" | "teamPage",
    value: boolean,
    dbKey:
      | "trainingsWebsiteVisible"
      | "upcomingMatchesWebsiteVisible"
      | "standingsWebsiteVisible"
      | "resultsWebsiteVisible"
      | "trainerTeamWebsiteVisible"
      | "squadWebsiteVisible"
      | "teamPageWebsiteVisible"
  ) {
    if (!activeTeamSeason?.id) return;

    setVisibility((current) => ({
      ...current,
      [key]: value,
    }));

    await fetch(`/api/team-seasons/${activeTeamSeason.id}/website-visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: team.id,
        [dbKey]: value,
      }),
    });
  }

  function handleTeamSaved(updatedTeamBase: {
    id: string;
    name: string;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
    sortOrder: number;
    isActive: boolean;
    websiteVisible: boolean;
    infoboardVisible: boolean;
  }) {
    setTeam((current) => ({
      ...current,
      ...updatedTeamBase,
    }));
    setTeamDetailsOpen(false);
  }
  function clampPhotoPosition(value: number) {
    return Math.max(0, Math.min(100, value));
  }

  function handleTeamPhotoPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!teamPhotoDrag) return;

    const deltaX = event.clientX - teamPhotoDrag.startX;
    const deltaY = event.clientY - teamPhotoDrag.startY;

    setTeamPhotoX(clampPhotoPosition(teamPhotoDrag.photoX - deltaX / 6));
    setTeamPhotoY(clampPhotoPosition(teamPhotoDrag.photoY - deltaY / 6));
    setTeamPhotoSaved(false);
  }

  function handleTeamPhotoPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setTeamPhotoDrag(null);
  }

  function handleTeamPhotoFile(file: File) {
    setTeamPhotoFile(file);
    setTeamPhotoPreview(URL.createObjectURL(file));
    setTeamPhotoSaved(false);
  }

  function handleTeamPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    handleTeamPhotoFile(file);
  }

  function handleTeamPhotoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    handleTeamPhotoFile(file);
  }

  async function saveTeamPhotoDraft() {
    if (!activeTeamSeason) return;

    const formData = new FormData();
    if (teamPhotoFile) formData.append("file", teamPhotoFile);
    formData.append("teamSeasonId", activeTeamSeason.id);
    formData.append("x", String(teamPhotoX));
    formData.append("y", String(teamPhotoY));
    formData.append("zoom", String(teamPhotoZoom));
    formData.append("rotate", String(teamPhotoRotate));
    formData.append("visible", String(teamPhotoVisible));

    const res = await fetch(`/api/teams/${team.id}/team-photo`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) setTeamPhotoSaved(true);
  }

  return (
    <div className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="space-y-7 p-6 lg:p-8"><div>
          <p className="fca-eyebrow">Team Management</p>
          <h1 className="fca-heading mt-2">Team Verwaltung</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Verwalte die wichtigsten Informationen, Website-Sichtbarkeit, Teamfoto, Trainerstaff und Kader fÃ¼r die Ã¶ffentliche Teamseite.
          </p>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-6">
              <div className="flex h-48 w-48 shrink-0 items-center justify-center">
                <img src="/images/logos/fc-allschwil.png" alt="FC Allschwil" className="h-full w-full object-contain" />
              </div>

              <div>
                <p className="fca-eyebrow">Teamdetails</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">{team.name}</h2>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {team.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                  {activeTeamSeason && (
                    <span className="rounded-full bg-[#0b4aa2] px-3 py-1 text-xs font-bold text-white">
                      {activeTeamSeason.season.name}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-slate-500">
                  <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{team.category}</span>
                  {team.ageGroup && <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{team.ageGroup}</span>}
                </div>

                <div className="mt-5 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-400">TeamkÃ¼rzel</div>
                    <div className="mt-1 font-semibold text-slate-900">{team.slug}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400">Geschlechtergruppe</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatGenderGroup(team.genderGroup)}
                    </div>
                  </div>

                </div>
                {activeTeamSeason && (
                  <TeamHealthCard
                    seasonLabel={activeTeamSeason.season.name}
                    playerCount={activeTeamSeason.playerSquadMembers?.length ?? 0}
                    trainerCount={activeTeamSeason.trainerTeamMembers?.length ?? 0}
                    birthYears={playerBirthYearCounts}
                    diplomas={trainerDiplomaCounts}
                    diplomaRequirement={getDiplomaRequirementForTeam(team.category, team.ageGroup)}
                  />
                )}              </div>
            </div>

            {canManage && (
              <button type="button" onClick={() => setTeamDetailsOpen((current) => !current)} className={`relative z-20 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-sm font-black shadow-[0_14px_30px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.18)] ${teamDetailsOpen ? "border border-[#0b4aa2] bg-[#0b4aa2] text-white hover:bg-[#083875]" : "border border-[#0b4aa2]/20 bg-gradient-to-r from-white to-blue-50 text-[#0b4aa2] hover:border-[#0b4aa2] hover:from-blue-50 hover:to-white"}`}>
                <Edit3 className="h-4 w-4" />{teamDetailsOpen ? "Schliessen" : "Bearbeiten"}
              </button>
            )}
          </div>
        </section>

        {teamDetailsOpen && (
          <TeamSettingsCard
            team={{
              id: team.id,
              name: team.name,
              slug: team.slug,
              category: team.category,
              genderGroup: team.genderGroup,
              ageGroup: team.ageGroup,
              sortOrder: team.sortOrder,
              isActive: team.isActive,
              websiteVisible: team.websiteVisible,
              infoboardVisible: team.infoboardVisible,
              teamSeasons: team.teamSeasons.map((entry) => ({
                id: entry.id,
                season: entry.season,
              })),
            }}
            canManage={canManage}
            onSaved={handleTeamSaved}
          />
        )}
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />
          <div className="p-6">
            <p className="fca-eyebrow">Website Darstellung steuern</p>
            <p className="mt-3 text-sm text-slate-500">Diese Einstellungen bestimmen, was auf der öffentlichen Teamseite sichtbar ist.</p>

            <div className="mt-6 space-y-6">
              <div>
                <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Inhalte</div>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  <VisibilityTile icon={<ImageIcon className="h-6 w-6" />} title="Teamfoto" active={teamPhotoVisible} onToggle={() => { setTeamPhotoVisible((current) => !current); setTeamPhotoSaved(false); }} />
                  <VisibilityTile icon={<Users className="h-6 w-6" />} title="Trainerstaff" active={visibility.trainerstaff} onToggle={() => toggleWebsiteVisibility("trainerstaff", !visibility.trainerstaff, "trainerTeamWebsiteVisible")} />
                  <VisibilityTile icon={<Users className="h-6 w-6" />} title="Spielerkader" active={visibility.playersquad} onToggle={() => toggleWebsiteVisibility("playersquad", !visibility.playersquad, "squadWebsiteVisible")} />
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Spielbetrieb</div>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <VisibilityTile icon={<CalendarDays className="h-6 w-6" />} title="Trainingszeiten" active={visibility.trainings} onToggle={() => toggleWebsiteVisibility("trainings", !visibility.trainings, "trainingsWebsiteVisible")} />
                  <VisibilityTile icon={<Trophy className="h-6 w-6" />} title="Nächste Spiele" active={visibility.upcoming} onToggle={() => toggleWebsiteVisibility("upcoming", !visibility.upcoming, "upcomingMatchesWebsiteVisible")} />
                  <VisibilityTile icon={<Check className="h-6 w-6" />} title="Resultate" active={visibility.results} onToggle={() => toggleWebsiteVisibility("results", !visibility.results, "resultsWebsiteVisible")} />
                  <VisibilityTile icon={<BarChart3 className="h-6 w-6" />} title="Rangliste" active={visibility.standings} onToggle={() => toggleWebsiteVisibility("standings", !visibility.standings, "standingsWebsiteVisible")} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="fca-eyebrow">Teamfoto</p>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div onDragOver={(event) => event.preventDefault()} onDrop={handleTeamPhotoDrop} className="overflow-hidden rounded-[26px] border border-dashed border-slate-300 bg-slate-50">
              {teamPhotoPreview ? (
                <div>
                  <div
                    className={`relative aspect-[16/9] w-full touch-none overflow-hidden bg-slate-100 ${teamPhotoDrag ? "cursor-grabbing" : "cursor-grab"}`}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setTeamPhotoDrag({ startX: event.clientX, startY: event.clientY, photoX: teamPhotoX, photoY: teamPhotoY });
                    }}
                    onPointerMove={handleTeamPhotoPointerMove}
                    onPointerUp={handleTeamPhotoPointerUp}
                    onPointerCancel={handleTeamPhotoPointerUp}
                  >
                    <img
                      src={teamPhotoPreview}
                      alt="Teamfoto Vorschau"
                      draggable={false}
                      className="h-full w-full select-none object-cover"
                      style={{
                        objectPosition: `${teamPhotoX}% ${teamPhotoY}%`,
                        transform: `scale(${teamPhotoZoom / 100}) rotate(${teamPhotoRotate}deg)`,
                        transformOrigin: `${teamPhotoX}% ${teamPhotoY}%`,
                      }}
                    />
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="text-xs font-bold text-slate-500">Horizontal<input type="range" min="0" max="100" value={teamPhotoX} onChange={(event) => { setTeamPhotoX(Number(event.target.value)); setTeamPhotoSaved(false); }} className="mt-2 w-full" /></label>
                      <label className="text-xs font-bold text-slate-500">Vertikal<input type="range" min="0" max="100" value={teamPhotoY} onChange={(event) => { setTeamPhotoY(Number(event.target.value)); setTeamPhotoSaved(false); }} className="mt-2 w-full" /></label>
                      <label className="text-xs font-bold text-slate-500">Zoom<input type="range" min="100" max="160" value={teamPhotoZoom} onChange={(event) => { setTeamPhotoZoom(Number(event.target.value)); setTeamPhotoSaved(false); }} className="mt-2 w-full" /></label>
                      <label className="text-xs font-bold text-slate-500">Neigung<input type="range" min="-8" max="8" step="0.5" value={teamPhotoRotate} onChange={(event) => { setTeamPhotoRotate(Number(event.target.value)); setTeamPhotoSaved(false); }} className="mt-2 w-full" /></label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label htmlFor="team-photo-upload" className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                        <Camera className="h-4 w-4" />Foto ersetzen
                      </label>
                      <button type="button" onClick={saveTeamPhotoDraft} className="inline-flex h-11 items-center justify-center rounded-full bg-[#0b4aa2] px-5 text-sm font-bold text-white hover:bg-[#083875]">
                        {teamPhotoSaved ? "Gespeichert" : "Speichern"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
                    <ImageIcon className="h-7 w-7" />
                  </div>
                  <p className="mt-5 text-sm font-bold text-slate-900">Noch kein Teamfoto hinterlegt</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Foto auswÃ¤hlen oder direkt hier hineinziehen.</p>
                  <label htmlFor="team-photo-upload" className="mt-5 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                    <Camera className="h-4 w-4" />Foto hochladen
                  </label>
                </div>
              )}
              <input id="team-photo-upload" type="file" accept="image/*" onChange={handleTeamPhotoSelected} className="sr-only" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">Tipps fÃ¼r das perfekte Teamfoto</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-500">
                <p className="flex gap-3"><Check className="h-4 w-4 text-[#0b4aa2]" />Bild im Querformat wÃ¤hlen</p>
                <p className="flex gap-3"><Check className="h-4 w-4 text-[#0b4aa2]" />Gute Beleuchtung und ruhiger Hintergrund</p>
                <p className="flex gap-3"><Check className="h-4 w-4 text-[#0b4aa2]" />Alle Personen gut sichtbar</p>
                <p className="flex gap-3"><Check className="h-4 w-4 text-[#0b4aa2]" />Empfohlene Mindestbreite: 2000px</p>
              </div>
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-[#0b4aa2]">
                Nach dem Upload kannst du das Bild zuschneiden und auf der Teamseite verÃ¶ffentlichen.
              </div>
            </div>
          </div>
        </section>

        <TeamRosterOverviewCard teamId={team.id} teamAgeGroup={team.ageGroup} canManage={canManage} trainerSectionVisible={visibility.trainerstaff} playerSectionVisible={visibility.playersquad} onTrainerSectionVisibilityChange={(value) => setVisibility((current) => ({ ...current, trainerstaff: value }))} onPlayerSectionVisibilityChange={(value) => setVisibility((current) => ({ ...current, playersquad: value }))} teamSeasons={activeTeamSeason ? [activeTeamSeason as any] : []} />
      </div>
    </div>
  );
}







