"use client";

import { GripVertical, Search, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";


type RawMember = {
  id: string;
  status?: string;
  roleLabel?: string | null;
  shirtNumber?: number | null;
  positionLabel?: string | null;
  sortOrder?: number;
  person?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    email: string | null;
    phone: string | null;
    dateOfBirth?: string | null;
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
  name: string;
  subline?: string;
  meta?: string;
  imageUrl?: string | null;
};

type Props = {
  teamId: string;
  teamSeason?: TeamSeason;
  teamSeasons?: TeamSeason[];
  canManage: boolean;
  teamAgeGroup?: string | null;
};

function personName(member: RawMember) {
  if (member.name) return member.name;
  const person = member.person;
  if (!person) return "Unbekannt";
  return person.displayName || `${person.firstName} ${person.lastName}`.trim();
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function normalizeTrainer(member: RawMember): Person {
  return {
    id: member.person?.id ?? member.id,
    name: personName(member),
    subline: member.person?.email ?? "",
    meta: member.roleLabel ?? "Trainer",
    imageUrl: member.imageUrl ?? null,
  };
}

function normalizePlayer(member: RawMember): Person {
  return {
    id: member.person?.id ?? member.id,
    name: personName(member),
    subline: [member.shirtNumber, member.person?.dateOfBirth ? new Date(member.person.dateOfBirth).toLocaleDateString("de-CH") : ""].filter(Boolean).join(" Â· "),
    meta: member.positionLabel ?? "",
    imageUrl: member.imageUrl ?? null,
  };
}


function normalizeSearchPerson(item: any): Person {
  const name = item.name ?? item.displayName ?? [item.firstName, item.lastName].filter(Boolean).join(" ") ?? "Unbekannt";

  return {
    id: item.id,
    name,
    subline: item.email ?? item.phone ?? "",
    meta: item.functionLabel ?? (item.isTrainer ? "Trainer" : item.isPlayer ? "Spieler" : "Person"),
    imageUrl: item.imageUrl ?? item.imageSrc ?? null,
    currentTeam: item.currentTeam ?? item.teamLabel ?? null,
  } as Person & { currentTeam?: string | null };
}

function InlinePeoplePicker({
  query,
  setQuery,
  results,
  loading,
  emptyLabel,
  placeholder,
  onAssign,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: Array<Person & { currentTeam?: string | null }>;
  loading: boolean;
  emptyLabel: string;
  placeholder: string;
  onAssign: (personId: string) => void;
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
            Suche lÃ¤uft...
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          results.map((person) => (
            <div key={person.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b4aa2] to-[#d62839] text-sm font-black text-white">
                  {person.imageUrl ? <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" /> : initials(person.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-900">{person.name}</p>
                    {person.meta && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0b4aa2]">{person.meta}</span>}
                    {person.currentTeam && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">Bereits bei {person.currentTeam}</span>}
                  </div>
                  {person.subline && <p className="mt-0.5 truncate text-xs text-slate-500">{person.subline}</p>}
                </div>
              </div>

              <button type="button" onClick={() => onAssign(person.id)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-[#0b4aa2] hover:border-[#0b4aa2] hover:bg-blue-50">
                HinzufÃ¼gen
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}function reorder(list: Person[], draggedId: string, targetId: string) {
  if (draggedId === targetId) return list;
  const draggedIndex = list.findIndex((item) => item.id === draggedId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return list;
  const next = [...list];
  const [draggedItem] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, draggedItem);
  return next;
}

function PersonRow({
  person,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  person: Person;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={`flex cursor-grab items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600">
          {person.imageUrl ? <img src={person.imageUrl} alt={person.name} className="h-full w-full object-cover" /> : initials(person.name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-slate-900">{person.name}</p>
            {person.meta && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0b4aa2]">{person.meta}</span>}
          </div>
          {person.subline && <p className="mt-0.5 truncate text-xs text-slate-500">{person.subline}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-slate-300" />
        <button type="button" onClick={onRemove} className="rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
          Entfernen
        </button>
      </div>
    </div>
  );
}

export default function TeamRosterOverviewCard({ teamId, teamSeason, teamSeasons, canManage }: Props) {
  const resolvedTeamSeason = teamSeason ?? teamSeasons?.[0] ?? null;
  const [trainerOpen, setTrainerOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [trainerQuery, setTrainerQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [trainerResults, setTrainerResults] = useState<Array<Person & { currentTeam?: string | null }>>([]);
  const [playerResults, setPlayerResults] = useState<Array<Person & { currentTeam?: string | null }>>([]);
  const [trainerSearchLoading, setTrainerSearchLoading] = useState(false);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [trainers, setTrainers] = useState<Person[]>([]);
  const [players, setPlayers] = useState<Person[]>([]);
  const [dragging, setDragging] = useState<{ type: "trainer" | "player"; id: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      const [trainerResponse, playerResponse] = await Promise.all([
        fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`),
        fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/squad-members`),
      ]);

      if (trainerResponse.ok) setTrainers(await trainerResponse.json());
      if (playerResponse.ok) setPlayers(await playerResponse.json());
    }

    load();
  }, [refreshKey, teamId, resolvedTeamSeason?.id]);


  useEffect(() => {
    if (!resolvedTeamSeason?.id || trainerQuery.trim().length < 2) {
      setTrainerResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setTrainerSearchLoading(true);
      try {
        const response = await fetch(`/api/people/search?mode=trainer&teamSeasonId=${resolvedTeamSeason.id}&q=${encodeURIComponent(trainerQuery)}`);
        const data = await response.json();
        setTrainerResults(Array.isArray(data) ? data.map(normalizeSearchPerson) : []);
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
        const data = await response.json();
        setPlayerResults(Array.isArray(data) ? data.map(normalizeSearchPerson) : []);
      } finally {
        setPlayerSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [playerQuery, resolvedTeamSeason?.id]);  if (!resolvedTeamSeason) return null;

  const refresh = () => setRefreshKey((current) => current + 1);

  async function persistOrder(type: "trainer" | "player", list: Person[]) {
    if (!resolvedTeamSeason?.id) return;

    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, items: list.map((person, index) => ({ personId: person.id, sortOrder: index })) }),
    });
  }


  async function assignTrainer(personId: string) {
    if (!resolvedTeamSeason?.id) return;

    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/trainer-members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    setTrainerQuery("");
    setTrainerResults([]);
    refresh();
  }

  async function assignPlayer(personId: string) {
    if (!resolvedTeamSeason?.id) return;

    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/squad-members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    });
    setPlayerQuery("");
    setPlayerResults([]);
    refresh();
  }  async function removeTrainer(personId: string) {
    if (!resolvedTeamSeason?.id) return;

    setTrainers((current) => current.filter((person) => person.id !== personId));
    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/trainer-members/${personId}`, { method: "DELETE" });
    refresh();
  }

  async function removePlayer(personId: string) {
    if (!resolvedTeamSeason?.id) return;

    setPlayers((current) => current.filter((person) => person.id !== personId));
    await fetch(`/api/teams/${teamId}/team-seasons/${resolvedTeamSeason.id}/squad-members/${personId}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-7">
      {actionError ? <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</div> : null}
      {actionError ? <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{actionError}</div> : null}
      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_320px]">
        <div>
          <p className="fca-eyebrow">Trainerstaff</p>
          <div className="mt-5 space-y-3">
            {trainers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Noch keine Trainer im Trainerstaff.</div>
            ) : (
              trainers.map((trainer) => (
                <PersonRow
                  key={trainer.id}
                  person={trainer}
                  isDragging={dragging?.type === "trainer" && dragging.id === trainer.id}
                  onDragStart={() => setDragging({ type: "trainer", id: trainer.id })}
                  onDragOver={() => {
                    if (dragging?.type !== "trainer") return;
                    setTrainers((current) => reorder(current, dragging.id, trainer.id));
                  }}
                  onDrop={() => {
                    setDragging(null);
                    persistOrder("trainer", trainers);
                  }}
                  onRemove={() => removeTrainer(trainer.id)}
                />
              ))
            )}
          </div>{canManage && (
            <InlinePeoplePicker
              query={trainerQuery}
              setQuery={setTrainerQuery}
              results={trainerResults}
              loading={trainerSearchLoading}
              placeholder="Trainer suchen..."
              emptyLabel="Keine passenden Trainer gefunden."
              onAssign={assignTrainer}
            />
          )}
        </div>

        <div className="flex flex-col justify-center border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]"><Users className="h-6 w-6" /></div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Trainer verwalten</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">FÃ¼ge Trainer und Betreuer hinzu und pflege die Reihenfolge fÃ¼r die Teamseite.</p>
        </div>
      </section>

      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_320px]">
        <div>
          <p className="fca-eyebrow">Spielerkader</p>
          <div className="mt-5 space-y-3">
            {players.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">Noch keine Spieler im Kader.</div>
            ) : (
              players.map((player) => (
                <PersonRow
                  key={player.id}
                  person={player}
                  isDragging={dragging?.type === "player" && dragging.id === player.id}
                  onDragStart={() => setDragging({ type: "player", id: player.id })}
                  onDragOver={() => {
                    if (dragging?.type !== "player") return;
                    setPlayers((current) => reorder(current, dragging.id, player.id));
                  }}
                  onDrop={() => {
                    setDragging(null);
                    persistOrder("player", players);
                  }}
                  onRemove={() => removePlayer(player.id)}
                />
              ))
            )}
          </div>{canManage && (
            <InlinePeoplePicker
              query={playerQuery}
              setQuery={setPlayerQuery}
              results={playerResults}
              loading={playerSearchLoading}
              placeholder="Spieler suchen..."
              emptyLabel="Keine passenden Spieler gefunden."
              onAssign={assignPlayer}
            />
          )}
        </div>

        <div className="flex flex-col justify-center border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0b4aa2]"><Users className="h-6 w-6" /></div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">Kader verwalten</h3>
          <p className="mt-3 text-sm leading-6 text-slate-500">FÃ¼ge Spieler hinzu, verwalte die Reihenfolge und stelle sicher, dass der Kader aktuell ist.</p>
        </div>
      </section>
    </div>
  );
}



