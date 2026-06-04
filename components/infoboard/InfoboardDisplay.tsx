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
  DoorOpen,
  LayoutGrid,
  Star,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedEvent = {
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
  pitchLabel: string | null;
  homeDressingRoomLabel: string | null;
  awayDressingRoomLabel: string | null;
};

type DayGroup = {
  date: string;
  label: string;
  events: FeedEvent[];
};

// ── Static lookup tables ───────────────────────────────────────────────────────

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

// ── Screen rotation config ─────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 60_000;
const SCREEN_DURATION_MS = 30_000;

type ScreenId = "schedule" | "navigation" | "sponsors";

const SCREEN_SEQUENCE: ScreenId[] = ["schedule", "navigation", "sponsors"];

// ── Placeholder sponsor data ───────────────────────────────────────────────────
// Will be replaced by Business Club / Admin-configured data in a future release.

type Sponsor = {
  id: string;
  name: string;
  tier: "gold" | "silver" | "partner";
  tagline: string | null;
};

const PLACEHOLDER_SPONSORS: Sponsor[] = [
  { id: "s1", name: "Hauptsponsor", tier: "gold", tagline: "Ihr Partner für FC Allschwil" },
  { id: "s2", name: "Sponsor B", tier: "silver", tagline: null },
  { id: "s3", name: "Sponsor C", tier: "silver", tagline: null },
  { id: "s4", name: "Partner D", tier: "partner", tagline: null },
  { id: "s5", name: "Partner E", tier: "partner", tagline: null },
  { id: "s6", name: "Partner F", tier: "partner", tagline: null },
];

// ── Utility functions ─────────────────────────────────────────────────────────

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

function isTodayOrSoon(dateKey: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return dateKey === today || dateKey === tomorrow;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

/** Shared header bar shown on every screen. */
function InfoboardHeader({
  activeScreen,
  lastRefresh,
}: {
  activeScreen: ScreenId;
  lastRefresh: Date | null;
}) {
  const today = new Date().toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const screenLabel: Record<ScreenId, string> = {
    schedule: "Spielplan & Events",
    navigation: "Feldübersicht",
    sponsors: "Unsere Sponsoren",
  };

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/40">
          FC Allschwil
        </p>
        <h1
          className="mt-0.5 text-3xl font-bold tracking-tight text-white"
          style={{ fontFamily: "var(--font-display, system-ui)" }}
        >
          {screenLabel[activeScreen]}
        </h1>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Clock24 className="text-4xl font-bold tabular-nums text-white" />
        <p className="text-[0.75rem] text-white/50">{today}</p>
        {lastRefresh && (
          <p className="text-[0.6rem] text-white/25 flex items-center gap-1">
            <RefreshCw className="h-2 w-2" />
            {lastRefresh.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
    </header>
  );
}

/** Screen indicator dots shown in the footer. */
function ScreenDots({
  screens,
  active,
}: {
  screens: ScreenId[];
  active: ScreenId;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {screens.map((s) => (
        <div
          key={s}
          className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${
            s === active ? "w-4 bg-white/60" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}

/** Allocation badge showing pitch and/or dressing room. */
function AllocationBadges({
  event,
}: {
  event: Pick<
    FeedEvent,
    "type" | "pitchLabel" | "homeDressingRoomLabel" | "awayDressingRoomLabel"
  >;
}) {
  const isMatch = event.type === "MATCH";

  return (
    <>
      {event.pitchLabel && (
        <span className="flex items-center gap-1 text-cyan-300/80">
          <LayoutGrid className="h-2.5 w-2.5" />
          {event.pitchLabel}
        </span>
      )}

      {isMatch ? (
        <>
          {event.homeDressingRoomLabel && (
            <span className="flex items-center gap-1 text-emerald-300/80">
              <DoorOpen className="h-2.5 w-2.5" />
              Heim&nbsp;{event.homeDressingRoomLabel}
            </span>
          )}
          {event.awayDressingRoomLabel && (
            <span className="flex items-center gap-1 text-amber-300/70">
              <DoorOpen className="h-2.5 w-2.5" />
              Gast&nbsp;{event.awayDressingRoomLabel}
            </span>
          )}
        </>
      ) : (
        event.homeDressingRoomLabel && (
          <span className="flex items-center gap-1 text-emerald-300/80">
            <DoorOpen className="h-2.5 w-2.5" />
            Garderobe&nbsp;{event.homeDressingRoomLabel}
          </span>
        )
      )}
    </>
  );
}

// ── Screen 1: Event Schedule ──────────────────────────────────────────────────

function ScheduleScreen({
  groups,
  loading,
  error,
  variantBadge,
}: {
  groups: DayGroup[];
  loading: boolean;
  error: string | null;
  /** Active plan variant label, e.g. "KW 23 | Schlechtwetter-Wochenplan aktiv" */
  variantBadge?: string | null;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-amber-400/60" />
        <p className="text-lg font-semibold text-white/60">{error}</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <CalendarDays className="h-16 w-16 text-white/20" />
        <p className="text-xl font-semibold text-white/40">
          Keine Events in den nächsten 14 Tagen
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active plan variant banner */}
      {variantBadge ? (
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-5 py-1.5 text-sm font-semibold tracking-wide text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {variantBadge}
          </span>
        </div>
      ) : null}

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
                      vs.{" "}
                      <strong className="font-semibold text-white/80">
                        {ev.opponentName}
                      </strong>
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

                  <AllocationBadges event={ev} />
                </div>

                <p className="mt-1.5 text-[0.65rem] font-medium uppercase tracking-[0.1em] text-white/25">
                  {TYPE_LABELS[ev.type] ?? ev.type}
                </p>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}

// ── Screen 2: Navigation / Facility Overview ──────────────────────────────────

function NavigationScreen({
  groups,
  loading,
}: {
  groups: DayGroup[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  // Show today + tomorrow events with allocation context
  const today = new Date().toISOString().slice(0, 10);
  const relevantGroups = groups.filter((g) => isTodayOrSoon(g.date)).slice(0, 2);

  // Collect events that have at least one allocation field set
  const allocationEvents = relevantGroups.flatMap((g) =>
    g.events.filter(
      (ev) =>
        ev.pitchLabel || ev.homeDressingRoomLabel || ev.awayDressingRoomLabel,
    ).map((ev) => ({ ...ev, dateLabel: g.label })),
  );

  const todayDateKey = today;
  const todayLabel = toDayLabel(todayDateKey);

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Facility orientation banner */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: LayoutGrid, title: "Stadion", desc: "Naturrasen · Hauptfeld" },
          { icon: LayoutGrid, title: "Kunstrasen 2", desc: "Kunstrasen · Trainingsfeld" },
          { icon: LayoutGrid, title: "Kunstrasen 3", desc: "Kunstrasen · Trainingsfeld" },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
                <f.icon className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{f.title}</p>
                <p className="text-[0.68rem] text-white/40">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dressing room orientation */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/40">
            Garderoben Eingang (E)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {["E1", "E2", "E3", "E4"].map((code) => (
              <div
                key={code}
                className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/70"
              >
                {code}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/40">
            Garderoben Obergeschoss (O)
          </p>
          <div className="grid grid-cols-4 gap-2">
            {["O1", "O2", "O3", "O4"].map((code) => (
              <div
                key={code}
                className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-bold text-white/70"
              >
                {code}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current / next events with allocation */}
      {allocationEvents.length > 0 ? (
        <div>
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/40">
            Heute & Morgen — Feldzuteilung
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {allocationEvents.slice(0, 6).map((ev) => {
              const Icon = TYPE_ICONS[ev.type] ?? CalendarDays;
              const isMatch = ev.type === "MATCH";

              return (
                <div
                  key={ev.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon className="h-4 w-4 text-white/70" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {ev.title}
                        </p>
                        <span className="shrink-0 text-[0.68rem] font-semibold tabular-nums text-white/50">
                          {formatTime(ev.startAt)}
                        </span>
                      </div>
                      {ev.teamName && (
                        <p className="text-[0.68rem] text-white/40">{ev.teamName}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[0.72rem]">
                        <AllocationBadges event={ev} />
                        {isMatch && ev.opponentName && (
                          <span className="text-white/50">
                            vs. {ev.opponentName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <LayoutGrid className="h-12 w-12 text-white/15" />
          <p className="text-sm font-semibold text-white/30">
            Keine Feldzuteilungen für heute & morgen
          </p>
        </div>
      )}
    </div>
  );
}

// ── Screen 3: Sponsor Screen ──────────────────────────────────────────────────

function SponsorScreen() {
  const goldSponsors = PLACEHOLDER_SPONSORS.filter((s) => s.tier === "gold");
  const silverSponsors = PLACEHOLDER_SPONSORS.filter((s) => s.tier === "silver");
  const partnerSponsors = PLACEHOLDER_SPONSORS.filter((s) => s.tier === "partner");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
      <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-white/30">
        Unsere Sponsoren & Partner
      </p>

      {/* Gold sponsors */}
      {goldSponsors.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          {goldSponsors.map((s) => (
            <div key={s.id} className="text-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-8 py-5">
                <Star className="h-6 w-6 text-amber-300" />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{s.name}</p>
                  {s.tagline && (
                    <p className="mt-0.5 text-sm text-amber-200/60">{s.tagline}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Silver sponsors */}
      {silverSponsors.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4">
          {silverSponsors.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-4"
            >
              <p className="text-lg font-bold text-white/80">{s.name}</p>
              {s.tagline && (
                <p className="mt-0.5 text-xs text-white/40">{s.tagline}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Partner grid */}
      {partnerSponsors.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {partnerSponsors.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="text-sm font-semibold text-white/60">{s.name}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[0.6rem] text-white/20">
        Business Club FC Allschwil · Sponsoring-Anfragen: info@fc-allschwil.ch
      </p>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

/** ISO week identifier "YYYY-WN" for the current week. */
function getCurrentWeekId(): string {
  const now = new Date();
  // ISO week: Mon–Sun
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum}`;
}

export default function InfoboardDisplay() {
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenId>("schedule");
  /** Active variant badge text, e.g. "KW 23 | Schlechtwetter-Wochenplan aktiv" */
  const [variantBadge, setVariantBadge] = useState<string | null>(null);

  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  async function fetchVariantBadge() {
    try {
      const weekId = getCurrentWeekId();
      const res = await fetch(`/api/public/wochenplan?weekId=${weekId}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setVariantBadge(data?.publication?.variantBadge ?? null);
    } catch {
      // Non-critical — badge simply won't show if fetch fails.
    }
  }

  function advanceScreen() {
    setActiveScreen((current) => {
      const idx = SCREEN_SEQUENCE.indexOf(current);
      return SCREEN_SEQUENCE[(idx + 1) % SCREEN_SEQUENCE.length];
    });
  }

  useEffect(() => {
    fetchFeed();
    fetchVariantBadge();
    fetchTimerRef.current = setInterval(fetchFeed, REFRESH_INTERVAL_MS);
    // Refresh variant badge every 5 minutes (it changes rarely)
    const variantTimerRef = setInterval(fetchVariantBadge, 5 * 60_000);

    screenTimerRef.current = setInterval(advanceScreen, SCREEN_DURATION_MS);

    return () => {
      if (fetchTimerRef.current) clearInterval(fetchTimerRef.current);
      if (screenTimerRef.current) clearInterval(screenTimerRef.current);
      clearInterval(variantTimerRef);
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <InfoboardHeader activeScreen={activeScreen} lastRefresh={lastRefresh} />

      <main className="flex-1 overflow-hidden px-8 py-6">
        {activeScreen === "schedule" && (
          <ScheduleScreen groups={groups} loading={loading} error={error} variantBadge={variantBadge} />
        )}
        {activeScreen === "navigation" && (
          <NavigationScreen groups={groups} loading={loading} />
        )}
        {activeScreen === "sponsors" && <SponsorScreen />}
      </main>

      <footer className="flex items-center justify-between border-t border-white/10 px-8 py-3">
        <p className="text-[0.65rem] text-white/25">sportclubevo.ch · Infoboard</p>
        <ScreenDots screens={SCREEN_SEQUENCE} active={activeScreen} />
      </footer>
    </div>
  );
}
