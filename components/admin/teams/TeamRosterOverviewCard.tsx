"use client";

import { GripVertical, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TrainerQualification = {
  title: string;
  issuer: string | null;
  status: string;
  isClubVerified: boolean;
};

type RawMember = {
  id: string;
  personId?: string;
  status?: string;
  roleLabel?: string | null;
  shirtNumber?: number | null;
  positionLabel?: string | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWebsiteVisible?: boolean;
  sortOrder?: number;
  subline?: string;
  meta?: string;
  currentTeam?: string | null;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth?: string | null;
    trainerQualifications?: TrainerQualification[];
  };
  name?: string;
  imageUrl?: string | null;
};

type TeamSeason = {
  id: string;
  trainerTeamMembers?: RawMember[];
  playerSquadMembers?: RawMember[];
};

type Person = {
  id: string;
  personId: string;
  name: string;
  subline?: string;
  meta?: string;
  imageUrl?: string | null;
  currentTeam?: string | null;
  roleLabel?: string | null;
  shirtNumber?: number | null;
  positionLabel?: string | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isWebsiteVisible?: boolean;
};

type Props = {
  teamId: string;
  teamSeason?: TeamSeason;
  teamSeasons?: TeamSeason[];
  canManage: boolean;
  teamAgeGroup?: string | null;
  trainerSectionVisible?: boolean;
  playerSectionVisible?: boolean;
  onTrainerSectionVisibilityChange?: (value: boolean) => void;
  onPlayerSectionVisibilityChange?: (value: boolean) => void;
};

function personName(member: RawMember) {
  if (member.name) return member.name;
  const person = member.person;
  if (!person) return "Unbekannt";
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getBestQualificationLabel(qualifications?: TrainerQualification[]) {
  if (!qualifications || qualifications.length === 0) return null;

  const priority = ["VALID", "IN_PROGRESS", "PLANNED", "UNKNOWN", "EXPIRED"];
  const best = [...qualifications].sort((a, b) => {
    const statusDiff = priority.indexOf(a.status) - priority.indexOf(b.status);
    if (statusDiff !== 0) return statusDiff;
    if (a.isClubVerified !== b.isClubVerified) return a.isClubVerified ? -1 : 1;
    return a.title.localeCompare(b.title);
  })[0];

  return [best.title, best.issuer, best.status === "VALID" ? "gültig" : null]
    .filter(Boolean)
    .join(" • ");
}

function buildPlayerSubline(person: Person) {
  return [person.shirtNumber ? "Nr. " + person.shirtNumber : "", person.subline?.includes("Jahrgang") ? person.subline : ""]
    .filter(Boolean)
    .join(" • ");
}

function normalizeTrainer(member: RawMember): Person {
  return {
    id: member.id,
    personId: member.personId ?? member.person?.id ?? member.id,
    name: personName(member),
    subline: member.subline ?? getBestQualificationLabel(member.person?.trainerQualifications) ?? member.person?.email ?? "",
    meta: member.meta ?? member.roleLabel ?? "Trainer",
    roleLabel: member.roleLabel ?? member.meta ?? "Trainer",
    imageUrl: member.imageUrl ?? null,
    isWebsiteVisible: member.isWebsiteVisible ?? true,
  };
}

function normalizePlayer(member: RawMember): Person {
  const yearLabel = member.person?.dateOfBirth ? "Jahrgang " + new Date(member.person.dateOfBirth).getUTCFullYear() : "";

  return {
    id: member.id,
    personId: member.personId ?? member.person?.id ?? member.id,
    name: personName(member),
    subline: member.subline ?? [member.shirtNumber ? "Nr. " + member.shirtNumber : "", yearLabel].filter(Boolean).join(" • "),
    meta: member.meta ?? member.positionLabel ?? "",
    shirtNumber: member.shirtNumber ?? null,
    positionLabel: member.positionLabel ?? member.meta ?? "",
    isCaptain: Boolean(member.isCaptain),
    isViceCaptain: Boolean(member.isViceCaptain),
    isWebsiteVisible: member.isWebsiteVisible ?? true,
    imageUrl: member.imageUrl ?? null,
  };
}

function normalizeSearchPerson(item: any): Person {
  const name =
    item.name ??
    item.displayName ??
    [item.firstName, item.lastName].filter(Boolean).join(" ") ??
    "Unbekannt";

  return {
    id: item.id,
    personId: item.id,
    name,
    subline: item.isPlayer
      ? item.dateOfBirth
        ? "Jahrgang " + new Date(item.dateOfBirth).getUTCFullYear()
        : "Jahrgang fehlt"
      : item.teamLabel ?? item.email ?? item.phone ?? "",
    meta: item.isTrainer ? "Trainer" : item.isPlayer ? "Spieler" : item.functionLabel ?? "Person",
    imageUrl: item.imageUrl ?? item.imageSrc ?? null,
    currentTeam: item.currentTeam ?? null,
    isWebsiteVisible: true,
  };
}

function InlinePeoplePicker({
  query,
  setQuery,
  results,
  loading,
  emptyLabel,
  placeholder,
  onAssign,
  assigningPersonId,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Person[];
  loading: boolean;
  emptyLabel: string;
  placeholder: string;
  onAssign: (person: Person) => void;
  assigningPersonId: string | null;
}) {
  return (
    <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#0b4aa2] focus:ring-4 focus:ring-blue-100"
        />
      </div>

      <div className="mt-3 space-y-2">
        {query.trim().length < 2 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            Mindestens 2 Zeichen eingeben.
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            Suche läuft...
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          results.map((person) => (
            <div key={person.personId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b4aa2] to-[#d62839] text-sm font-black text-white">
                  {person.imageUrl ? <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" /> : initials(person.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-900">{person.name}</p>
                    {person.meta ? <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#0b4aa2]">{person.meta}</span> : null}
                  </div>
                  {person.subline ? <p className="mt-1 truncate text-xs font-bold text-slate-500">{person.subline}</p> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAssign(person)}
                disabled={assigningPersonId === person.personId}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#0b4aa2] transition hover:border-[#0b4aa2] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assigningPersonId === person.personId ? "Wird hinzugefügt..." : "Hinzufügen"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function reorder(list: Person[], draggedId: string, targetId: string) {
  if (draggedId === targetId) return list;
  const draggedIndex = list.findIndex((item) => item.id === draggedId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return list;
  const next = [...list];
  const [draggedItem] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedItem);
  return next;
}

function InlineEdit({
  value,
  placeholder,
  onSave,
  type = "text",
}: {
  value: string;
  placeholder: string;
  onSave: (value: string) => void;
  type?: "text" | "number";
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-[#0b4aa2] focus:ring-4 focus:ring-blue-100"
    />
  );
}

function PersonRow({
  person,
  type,
  canManage,
  onRemove,
  onPatch,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  person: Person;
  type: "trainer" | "player";
  canManage: boolean;
  onRemove: () => void;
  onPatch: (updates: Partial<Person>) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable={canManage}
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={`group rounded-[22px] border border-slate-200 bg-white/95 px-5 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#0b4aa2]/20 hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)] ${canManage ? "cursor-grab" : ""} ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#0b4aa2]/10 bg-gradient-to-br from-blue-50 to-slate-50 text-sm font-black text-[#0b4aa2] shadow-sm">
            {person.imageUrl ? <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" /> : initials(person.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-black tracking-tight text-slate-950">{person.name}</p>
              {person.meta ? <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#0b4aa2]">{person.meta}</span> : null}
              {type === "player" && person.isCaptain ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-700">Captain</span> : null}
              {type === "player" && person.isViceCaptain ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600">Vice</span> : null}
              {person.isWebsiteVisible === false ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-500">Nicht auf Website</span> : <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-700">Auf Website</span>}
            </div>
            {person.subline ? <p className="mt-1 truncate text-xs font-bold text-slate-500">{person.subline}</p> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canManage ? <GripVertical className="h-4 w-4 text-slate-300 transition group-hover:text-[#0b4aa2]" /> : null}
          {canManage ? (
            <button type="button" onClick={onRemove} className="rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-black text-red-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 disabled:opacity-60">
              Entfernen
            </button>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {type === "trainer" ? (
            <InlineEdit
              value={person.roleLabel ?? ""}
              placeholder="Rolle"
              onSave={(value) => onPatch({ roleLabel: value, meta: value || "Trainer" })}
            />
          ) : (
            <>
              <InlineEdit
                type="number"
                value={person.shirtNumber ? String(person.shirtNumber) : ""}
                placeholder="Nr."
                onSave={(value) => onPatch({ shirtNumber: value.trim() ? Number(value) : null })}
              />
              <InlineEdit
                value={person.positionLabel ?? ""}
                placeholder="Position / Rolle"
                onSave={(value) => onPatch({ positionLabel: value, meta: value })}
              />
              <button
                type="button"
                onClick={() => onPatch({ isCaptain: !person.isCaptain })}
                className={`h-9 rounded-full border px-3 text-xs font-black transition ${person.isCaptain ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                Captain
              </button>
              <button
                type="button"
                onClick={() => onPatch({ isViceCaptain: !person.isViceCaptain })}
                className={`h-9 rounded-full border px-3 text-xs font-black transition ${person.isViceCaptain ? "border-slate-300 bg-slate-100 text-slate-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                Vice
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function TeamRosterOverviewCard({ teamId, teamSeason, teamSeasons, canManage, trainerSectionVisible = true, playerSectionVisible = true, onTrainerSectionVisibilityChange, onPlayerSectionVisibilityChange }: Props) {
  const resolvedTeamSeason = teamSeason ?? teamSeasons?.[0] ?? null;
  const [trainerQuery, setTrainerQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [trainerResults, setTrainerResults] = useState<Person[]>([]);
  const [playerResults, setPlayerResults] = useState<Person[]>([]);
  const [trainerSearchLoading, setTrainerSearchLoading] = useState(false);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [trainers, setTrainers] = useState<Person[]>([]);
  const [players, setPlayers] = useState<Person[]>([]);
  const [dragging, setDragging] = useState<{ type: "trainer" | "player"; id: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assigningPersonId, setAssigningPersonId] = useState<string | null>(null);

  const initialTrainers = useMemo(() => (resolvedTeamSeason?.trainerTeamMembers ?? []).map(normalizeTrainer), [resolvedTeamSeason?.trainerTeamMembers]);
  const initialPlayers = useMemo(() => (resolvedTeamSeason?.playerSquadMembers ?? []).map(normalizePlayer), [resolvedTeamSeason?.playerSquadMembers]);

  useEffect(() => {
    setTrainers(initialTrainers);
    setPlayers(initialPlayers);
  }, [initialTrainers, initialPlayers]);

  useEffect(() => {
    const teamSeasonId = resolvedTeamSeason?.id;
    if (!teamSeasonId) return;

    async function load() {
      try {
        const [trainerResponse, playerResponse] = await Promise.all([
          fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`),
          fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/squad-members`),
        ]);

        if (trainerResponse.ok) setTrainers((await trainerResponse.json()).map(normalizeTrainer));
        if (playerResponse.ok) setPlayers((await playerResponse.json()).map(normalizePlayer));
      } catch {
        setActionError("Kaderdaten konnten nicht geladen werden. Bitte Seite neu laden.");
      }
    }

    void load();
  }, [teamId, resolvedTeamSeason?.id]);

  useEffect(() => {
    if (!resolvedTeamSeason?.id || trainerQuery.trim().length < 2) {
      setTrainerResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setTrainerSearchLoading(true);
      try {
        const response = await fetch(`/api/people/search?mode=trainer&teamSeasonId=${resolvedTeamSeason.id}&q=${encodeURIComponent(trainerQuery)}`);
        const data = await response.json().catch(() => null);
        setTrainerResults(Array.isArray(data) ? data.map(normalizeSearchPerson) : []);
      } catch {
        setTrainerResults([]);
      } finally {
        setTrainerSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [trainerQuery, resolvedTeamSeason?.id]);

  useEffect(() => {
    if (!resolvedTeamSeason?.id || playerQuery.trim().length < 2) {
      setPlayerResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setPlayerSearchLoading(true);
      try {
        const response = await fetch(`/api/people/search?mode=player&teamSeasonId=${resolvedTeamSeason.id}&q=${encodeURIComponent(playerQuery)}`);
        const data = await response.json().catch(() => null);
        setPlayerResults(Array.isArray(data) ? data.map(normalizeSearchPerson) : []);
      } catch {
        setPlayerResults([]);
      } finally {
        setPlayerSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [playerQuery, resolvedTeamSeason?.id]);

  if (!resolvedTeamSeason) return null;

  async function persistOrder(type: "trainer" | "player", list: Person[]) {
    if (!resolvedTeamSeason?.id) return;

    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, items: list.map((person, index) => ({ personId: person.personId, sortOrder: index })) }),
    });
  }

  async function assignTrainer(person: Person) {
    if (!resolvedTeamSeason?.id) return;

    setActionError(null);
    setAssigningPersonId(person.personId);

    try {
      const response = await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/trainer-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.personId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setActionError(data?.error ?? "Trainer konnte nicht hinzugefügt werden.");
        return;
      }

      setTrainers((current) => [...current, normalizeTrainer({ ...data, subline: data?.subline ?? person.subline })]);
      setTrainerQuery("");
      setTrainerResults([]);
    } catch {
      setActionError("Trainer konnte nicht hinzugefügt werden.");
    } finally {
      setAssigningPersonId(null);
    }
  }

  async function assignPlayer(person: Person) {
    if (!resolvedTeamSeason?.id) return;

    setActionError(null);
    setAssigningPersonId(person.personId);

    try {
      const response = await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/squad-members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.personId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setActionError(data?.error ?? "Spieler konnte nicht hinzugefügt werden.");
        return;
      }

      setPlayers((current) => [...current, normalizePlayer({ ...data, subline: data?.subline ?? person.subline })]);
      setPlayerQuery("");
      setPlayerResults([]);
    } catch {
      setActionError("Spieler konnte nicht hinzugefügt werden.");
    } finally {
      setAssigningPersonId(null);
    }
  }

  async function patchTrainer(memberId: string, updates: Partial<Person>) {
    if (!resolvedTeamSeason?.id) return;

    setTrainers((current) => current.map((person) => (person.id === memberId ? { ...person, ...updates } : person)));

    const response = await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/trainer-members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleLabel: updates.roleLabel, isWebsiteVisible: updates.isWebsiteVisible }),
    });

    if (!response.ok) setActionError("Trainerrolle konnte nicht gespeichert werden.");
  }

  async function patchPlayer(memberId: string, updates: Partial<Person>) {
    if (!resolvedTeamSeason?.id) return;

    setPlayers((current) =>
      current.map((person) => {
        if (person.id !== memberId) return person;
        const next = { ...person, ...updates };
        return {
          ...next,
          subline: buildPlayerSubline(next),
          meta: next.positionLabel ?? "",
        };
      }),
    );

    const response = await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/squad-members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shirtNumber: updates.shirtNumber,
        positionLabel: updates.positionLabel,
        isCaptain: updates.isCaptain,
        isViceCaptain: updates.isViceCaptain,
        isWebsiteVisible: updates.isWebsiteVisible,
      }),
    });

    if (!response.ok) setActionError("Spielerdaten konnten nicht gespeichert werden.");
  }

  async function patchTrainerSectionVisibility(value: boolean) {
    if (!resolvedTeamSeason?.id) return;

    onTrainerSectionVisibilityChange?.(value);

    const response = await fetch(`/api/team-seasons/${resolvedTeamSeason.id}/website-visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        trainerTeamWebsiteVisible: value,
      }),
    });

    if (!response.ok) {
      onTrainerSectionVisibilityChange?.(!value);
      setActionError("Trainerstaff-Sichtbarkeit konnte nicht gespeichert werden.");
    }
  }

  async function patchPlayerSectionVisibility(value: boolean) {
    if (!resolvedTeamSeason?.id) return;

    onPlayerSectionVisibilityChange?.(value);

    const response = await fetch(`/api/team-seasons/${resolvedTeamSeason.id}/website-visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        squadWebsiteVisible: value,
      }),
    });

    if (!response.ok) {
      onPlayerSectionVisibilityChange?.(!value);
      setActionError("Kader-Sichtbarkeit konnte nicht gespeichert werden.");
    }
  }
  async function removeTrainer(memberId: string) {
    if (!resolvedTeamSeason?.id) return;

    setTrainers((current) => current.filter((person) => person.id !== memberId));
    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/trainer-members/${memberId}`, { method: "DELETE" });
  }

  async function removePlayer(memberId: string) {
    if (!resolvedTeamSeason?.id) return;

    setPlayers((current) => current.filter((person) => person.id !== memberId));
    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/squad-members/${memberId}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-7">
      {actionError ? <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</div> : null}

      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_320px]">
        <div>
          <p className="fca-eyebrow">Trainerstaff <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{trainers.length} Trainer</span></p>
          <div className="mt-5 space-y-3">
            {trainers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Noch keine Trainer im Trainerstaff.</div>
            ) : (
              trainers.map((trainer) => (
                <PersonRow
                  key={trainer.id}
                  type="trainer"
                  canManage={canManage}
                  person={trainer}
                  isDragging={dragging?.type === "trainer" && dragging.id === trainer.id}
                  onDragStart={() => setDragging({ type: "trainer", id: trainer.id })}
                  onDragOver={() => {
                    if (dragging?.type !== "trainer") return;
                    setTrainers((current) => reorder(current, dragging.id, trainer.id));
                  }}
                  onDrop={() => {
                    setDragging(null);
                    void persistOrder("trainer", trainers);
                  }}
                  onPatch={(updates) => void patchTrainer(trainer.id, updates)}
                  onRemove={() => void removeTrainer(trainer.id)}
                />
              ))
            )}
          </div>

          {canManage ? (
            <InlinePeoplePicker
              query={trainerQuery}
              setQuery={setTrainerQuery}
              results={trainerResults}
              loading={trainerSearchLoading}
              placeholder="Trainer suchen..."
              emptyLabel="Keine passenden Trainer gefunden."
              onAssign={assignTrainer}
              assigningPersonId={assigningPersonId}
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-center border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]"><Users className="h-6 w-6" /></div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Trainer verwalten</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">Füge Trainer und Betreuer hinzu und pflege die Reihenfolge für die Teamseite.</p>
        </div>
      </section>

      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_320px]">
        <div>
          <p className="fca-eyebrow">Spielerkader <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{players.length} Spieler</span></p>
          <div className="mt-5 space-y-3">
            {players.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Noch keine Spieler im Kader.</div>
            ) : (
              players.map((player) => (
                <PersonRow
                  key={player.id}
                  type="player"
                  canManage={canManage}
                  person={player}
                  isDragging={dragging?.type === "player" && dragging.id === player.id}
                  onDragStart={() => setDragging({ type: "player", id: player.id })}
                  onDragOver={() => {
                    if (dragging?.type !== "player") return;
                    setPlayers((current) => reorder(current, dragging.id, player.id));
                  }}
                  onDrop={() => {
                    setDragging(null);
                    void persistOrder("player", players);
                  }}
                  onPatch={(updates) => void patchPlayer(player.id, updates)}
                  onRemove={() => void removePlayer(player.id)}
                />
              ))
            )}
          </div>

          {canManage ? (
            <InlinePeoplePicker
              query={playerQuery}
              setQuery={setPlayerQuery}
              results={playerResults}
              loading={playerSearchLoading}
              placeholder="Spieler suchen..."
              emptyLabel="Keine passenden Spieler gefunden."
              onAssign={assignPlayer}
              assigningPersonId={assigningPersonId}
            />
          ) : null}
        </div>

        <div className="flex flex-col justify-center border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]"><Users className="h-6 w-6" /></div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Kader verwalten</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">Füge Spieler hinzu, verwalte die Reihenfolge und stelle sicher, dass der Kader aktuell ist.</p>
        </div>
      </section>
    </div>
  );
}













