"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type ReservationType = "TRAINING" | "MATCH" | "TOURNAMENT" | "OTHER";

type ReservationOption = {
  id: string;
  key: string;
  name: string;
  type?: string;
};

type PitchReservationFormProps = {
  seasons: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
  teams: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  pitches: ReservationOption[];
  dressingRooms: ReservationOption[];
};

const eventTypes: Array<{ value: ReservationType; label: string; description: string }> = [
  {
    value: "TRAINING",
    label: "Training",
    description: "Trainingseinheit mit Platzreservation.",
  },
  {
    value: "MATCH",
    label: "Testspiel",
    description: "Freundschaftsspiel mit Gegner und Garderoben.",
  },
  {
    value: "TOURNAMENT",
    label: "Turnier",
    description: "Turnier oder Spielfest mit Platzbelegung.",
  },
  {
    value: "OTHER",
    label: "Sonstiger Event",
    description: "Jeder andere Event, der Platzkapazität beansprucht.",
  },
];

function formatTeamLabel(team: { name: string; category: string }) {
  return `${team.name} · ${team.category}`;
}

function defaultTitle(type: ReservationType, teamName?: string, opponentName?: string) {
  if (type === "MATCH") {
    return `${teamName || "Team"} vs ${opponentName || "Gegner"}`;
  }

  if (type === "TOURNAMENT") {
    return `${teamName || "Team"} Turnier`;
  }

  if (type === "TRAINING") {
    return `${teamName || "Team"} Training`;
  }

  return "Platzreservation";
}

export default function PitchReservationForm({
  seasons,
  teams,
  pitches,
  dressingRooms,
}: PitchReservationFormProps) {
  const router = useRouter();
  const [type, setType] = useState<ReservationType>("MATCH");
  const [seasonId, setSeasonId] = useState(seasons.find((season) => season.isActive)?.id ?? seasons[0]?.id ?? "");
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [opponentName, setOpponentName] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [titleOverride, setTitleOverride] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [selectedPitchKeys, setSelectedPitchKeys] = useState<string[]>([]);
  const [homeRoomKey, setHomeRoomKey] = useState("");
  const [awayRoomKey, setAwayRoomKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTeam = useMemo(() => {
    return teams.find((team) => team.id === teamId) ?? null;
  }, [teamId, teams]);

  const computedTitle = titleOverride.trim()
    ? titleOverride.trim()
    : defaultTitle(type, selectedTeam?.name, opponentName);

  function togglePitch(key: string) {
    setSelectedPitchKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  async function submitReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/events/reserve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          seasonId,
          teamId: teamId || null,
          title: computedTitle,
          opponentName: type === "MATCH" ? opponentName : null,
          organizerName: type === "TOURNAMENT" || type === "OTHER" ? organizerName : null,
          startAt,
          endAt: endAt || null,
          pitchResourceKeys: selectedPitchKeys,
          dressingRoomHomeKey: homeRoomKey || null,
          dressingRoomAwayKey: awayRoomKey || null,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Reservation konnte nicht eingereicht werden.");
      }

      setMessage("Reservation wurde in den Wochenplan eingereicht und wartet auf Freigabe.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <form onSubmit={submitReservation} className="space-y-6">
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            Workflow
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
            Jede Platzreservation wird als Antrag in den Wochenplan eingereicht. Sichtbar auf Website
            und Infoboard wird sie erst nach Freigabe durch die fussballorganisatorische Leitung.
          </p>
        </div>

        <section className="grid gap-4 xl:grid-cols-4">
          {eventTypes.map((option) => {
            const selected = option.value === type;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={[
                  "rounded-[24px] border p-5 text-left transition",
                  selected
                    ? "border-blue-300 bg-blue-50 text-[#0b4aa2] shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <p className="text-sm font-black uppercase tracking-[0.16em]">{option.label}</p>
                <p className="mt-2 text-sm font-medium leading-5 opacity-75">{option.description}</p>
              </button>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Saison</span>
            <select
              value={seasonId}
              onChange={(event) => setSeasonId(event.target.value)}
              className="fca-select"
              required
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.isActive ? " (aktuell)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Team</span>
            <select
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="fca-select"
            >
              <option value="">Kein Team / allgemein</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {formatTeamLabel(team)}
                </option>
              ))}
            </select>
          </label>

          {type === "MATCH" ? (
            <label className="block space-y-2">
              <span className="fca-label">Gegner</span>
              <input
                value={opponentName}
                onChange={(event) => setOpponentName(event.target.value)}
                className="fca-input"
                placeholder="z.B. FC Binningen"
                required={type === "MATCH"}
              />
            </label>
          ) : null}

          {type === "TOURNAMENT" || type === "OTHER" ? (
            <label className="block space-y-2">
              <span className="fca-label">Organisator / Kontext</span>
              <input
                value={organizerName}
                onChange={(event) => setOrganizerName(event.target.value)}
                className="fca-input"
                placeholder="optional"
              />
            </label>
          ) : null}

          <label className="block space-y-2">
            <span className="fca-label">Titel überschreiben</span>
            <input
              value={titleOverride}
              onChange={(event) => setTitleOverride(event.target.value)}
              className="fca-input"
              placeholder={computedTitle}
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              className="fca-input"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              className="fca-input"
            />
          </label>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
            Spielfeld
          </p>
          <h2 className="mt-1 text-xl font-black uppercase text-[#0b4aa2]">
            Feld A / Feld B / ganzer Platz
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Wähle ein Feld oder mehrere Felder, wenn ein ganzer Platz blockiert werden soll.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pitches.map((pitch) => {
              const selected = selectedPitchKeys.includes(pitch.key);

              return (
                <button
                  key={pitch.id}
                  type="button"
                  onClick={() => togglePitch(pitch.key)}
                  className={[
                    "rounded-[20px] border px-4 py-3 text-left text-sm font-bold transition",
                    selected
                      ? "border-blue-300 bg-blue-50 text-[#0b4aa2]"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white",
                  ].join(" ")}
                >
                  {pitch.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Garderobe Team / Heim</span>
            <select
              value={homeRoomKey}
              onChange={(event) => setHomeRoomKey(event.target.value)}
              className="fca-select"
            >
              <option value="">Noch keine Garderobe</option>
              {dressingRooms.map((room) => (
                <option key={room.id} value={room.key}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Garderobe Gegner</span>
            <select
              value={awayRoomKey}
              onChange={(event) => setAwayRoomKey(event.target.value)}
              className="fca-select"
            >
              <option value="">Nicht nötig / offen</option>
              {dressingRooms.map((room) => (
                <option key={room.id} value={room.key}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {message ? <div className="fca-status-box fca-status-box-success">{message}</div> : null}
        {error ? <div className="fca-status-box fca-status-box-error">{error}</div> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !seasonId || !startAt || selectedPitchKeys.length === 0}
            className="fca-button-primary"
          >
            {submitting ? "Wird eingereicht..." : "Platzreservation einreichen"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/planner/week")}
            className="fca-button-secondary"
          >
            Zum Wochenplan
          </button>
        </div>
      </form>
    </AdminSurfaceCard>
  );
}
