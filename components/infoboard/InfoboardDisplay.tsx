"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Clock,
  Dumbbell,
  MapPin,
  RefreshCw,
  Trophy,
  Volleyball,
  AlertCircle,
} from "lucide-react";

type FeedEvent = {
  id: string;
  type: string;
  title: string;
  teamName: string | null;
  teamSlug: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  meetingTime: string | null;
  resultLabel: string | null;
  status: string;
  seasonKey: string;
  seasonName: string;
};

type DayGroup = {
  date: string;
  label: string;
  events: FeedEvent[];
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  MATCH: Volleyball,
  TOURNAMENT: Trophy,
  TRAINING: Dumbbell,
  OTHER: CalendarDays,
  VACATION_PERIOD: CalendarDays,
};

const TYPE_LABELS: Record<string, string> = {
  MATCH: "Match",
  TOURNAMENT: "Turnier",
  TRAINING: "Training",
  OTHER: "Event",
  VACATION_PERIOD: "Ferien",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  POSTPONED: "Verschoben",
};

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "bg-blue-500/20 text-blue-200 border-blue-400/30",
  LIVE: "bg-emerald-500/30 text-emerald-200 border-emerald-400/30",
  COMPLETED: "bg-white/10 text-white/50 border-white/20",
  POSTPONED: "bg-amber-500/20 text-amber-200 border-amber-400/30",
};

const HOMEAWAY_LABEL: Record<string, string> = {
  HOME: "Heimspiel",
  AWAY: "Auswärtsspiel",
};

const REFRESH_INTERVAL_MS = 60_000;

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function toDayLabel(dateKey: string) {
  const d = new Date(dateKey + "T12:00:00Z");
  return d.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function groupByDay(events: FeedEvent[]): DayGroup[] {
  const map = new Map<string, FeedEvent[]>();
  for (const ev of events) {
    const key = toDateKey(ev.startAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => ({ date, label: toDayLabel(date), events: evs }));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Clock24({ className }: { className?: string }) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={className}>{time}</span>;
}

export default function InfoboardDisplay() {
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchFeed() {
    try {
      const now = new Date();
      const dateFrom = now.toISOString().slice(0, 10);
      const dateTo = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      const res = await fetch(
        `/api/public/infoboard?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=100`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Feed konnte nicht geladen werden.");
      const data = await res.json();
      setGroups(groupByDay(data.events ?? []));
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeed();
    timerRef.current = setInterval(fetchFeed, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const today = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">
            FC Allschwil
          </p>
          <h1
            className="mt-0.5 text-3xl font-bold tracking-tight text-white"
            style={{ fontFamily: "var(--font-display, system-ui)" }}
          >
            Spielplan & Events
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Clock24 className="text-4xl font-bold tabular-nums text-white" />
          <p className="text-[0.75rem] text-white/50">{today}</p>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-hidden px-8 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-white/30" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="h-12 w-12 text-amber-400/60" />
            <p className="text-lg font-semibold text-white/60">{error}</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <CalendarDays className="h-16 w-16 text-white/20" />
            <p className="text-xl font-semibold text-white/40">
              Keine Events in den nächsten 14 Tagen
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Day header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {group.label}
                  </p>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* Events */}
                {group.events.map((ev) => {
                  const Icon = TYPE_ICONS[ev.type] ?? CalendarDays;
                  const statusClass =
                    STATUS_CLASS[ev.status] ?? "bg-white/10 text-white/50 border-white/20";

                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                            <Icon className="h-4 w-4 text-white/70" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-white">
                              {ev.title}
                            </p>
                            {ev.teamName ? (
                              <p className="text-[0.7rem] text-white/50">{ev.teamName}</p>
                            ) : null}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 inline-flex h-5 items-center rounded-full border px-2 text-[0.6rem] font-semibold ${statusClass}`}
                        >
                          {STATUS_LABELS[ev.status] ?? ev.status}
                        </span>
                      </div>

                      {/* Match details */}
                      <div className="mt-2.5 flex flex-wrap gap-3 text-[0.72rem] text-white/50">
                        <span className="flex items-center gap-1 font-semibold text-white/80">
                          <Clock className="h-3 w-3" />
                          {formatTime(ev.startAt)}
                          {ev.meetingTime ? (
                            <span className="text-white/40">
                              &nbsp;(Treff {formatTime(ev.meetingTime)})
                            </span>
                          ) : null}
                        </span>

                        {ev.opponentName ? (
                          <span>
                            vs. <strong className="font-semibold text-white/80">{ev.opponentName}</strong>
                          </span>
                        ) : null}

                        {ev.homeAway ? (
                          <span>{HOMEAWAY_LABEL[ev.homeAway] ?? ev.homeAway}</span>
                        ) : null}

                        {ev.competitionLabel ? (
                          <span>{ev.competitionLabel}</span>
                        ) : null}

                        {ev.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {ev.location}
                          </span>
                        ) : null}

                        {ev.resultLabel ? (
                          <span className="font-semibold text-emerald-300">
                            {ev.resultLabel}
                          </span>
                        ) : null}
                      </div>

                      {/* Type badge */}
                      <p className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/25">
                        {TYPE_LABELS[ev.type] ?? ev.type}
                      </p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-white/10 px-8 py-3">
        <p className="text-[0.65rem] text-white/25">
          sportclubevo.ch · Infoboard
        </p>
        <div className="flex items-center gap-2 text-[0.65rem] text-white/25">
          <RefreshCw className="h-2.5 w-2.5" />
          {lastRefresh
            ? `Zuletzt aktualisiert ${lastRefresh.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`
            : "Lädt…"}
        </div>
      </footer>
    </div>
  );
}
