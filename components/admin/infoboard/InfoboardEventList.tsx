"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Loader2,
  Monitor,
  Trophy,
  Volleyball,
  Dumbbell,
} from "lucide-react";

type InfoboardEventItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  startAt: string;
  endAt: string | null;
  opponentName: string | null;
  location: string | null;
  infoboardVisible: boolean;
  teamName: string | null;
  seasonName: string;
};

type Props = {
  events: InfoboardEventItem[];
  canToggle: boolean;
  /** Label shown at top of section */
  emptyLabel?: string;
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
  OTHER: "Anderes",
  VACATION_PERIOD: "Ferien",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  POSTPONED: "Verschoben",
  DRAFT: "Entwurf",
  CANCELLED: "Abgesagt",
  ARCHIVED: "Archiviert",
};

const STATUS_CLASS: Record<string, string> = {
  SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPLETED: "border-slate-200 bg-slate-50 text-slate-500",
  POSTPONED: "border-amber-200 bg-amber-50 text-amber-700",
  DRAFT: "border-slate-200 bg-slate-50 text-slate-400",
  CANCELLED: "border-red-200 bg-red-50 text-red-500",
  ARCHIVED: "border-slate-200 bg-slate-50 text-slate-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InfoboardEventList({ events: initial, canToggle, emptyLabel }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState(initial);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleVisible(eventId: string, newValue: boolean) {
    setTogglingId(eventId);
    try {
      const res = await fetch(`/api/infoboard/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ infoboardVisible: newValue }),
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, infoboardVisible: newValue } : e)),
        );
        router.refresh();
      }
    } finally {
      setTogglingId(null);
    }
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Monitor className="h-10 w-10 text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">
          {emptyLabel ?? "Keine Events gefunden."}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {events.map((event) => {
        const Icon = TYPE_ICONS[event.type] ?? CalendarDays;
        const isToggling = togglingId === event.id;

        return (
          <div
            key={event.id}
            className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-2)]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
              <Icon className="h-4 w-4 text-[var(--muted)]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {event.title}
                </span>
                {event.opponentName ? (
                  <span className="text-[0.72rem] text-[var(--muted)]">
                    vs. {event.opponentName}
                  </span>
                ) : null}
                <span
                  className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${STATUS_CLASS[event.status] ?? "border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  {STATUS_LABELS[event.status] ?? event.status}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)]">
                <span>{formatDate(event.startAt)}</span>
                {event.teamName ? <span>{event.teamName}</span> : null}
                {event.location ? <span>{event.location}</span> : null}
                <span className="text-[0.65rem]">{event.seasonName}</span>
              </div>
            </div>

            {/* Type badge */}
            <span className="hidden shrink-0 text-[0.65rem] font-medium text-[var(--muted)] sm:block">
              {TYPE_LABELS[event.type] ?? event.type}
            </span>

            {/* Toggle */}
            {canToggle ? (
              <button
                type="button"
                onClick={() => toggleVisible(event.id, !event.infoboardVisible)}
                disabled={isToggling}
                title={event.infoboardVisible ? "Vom Infoboard entfernen" : "Auf Infoboard setzen"}
                className="shrink-0 transition disabled:opacity-50"
              >
                {isToggling ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
                ) : event.infoboardVisible ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 hover:text-emerald-700" />
                ) : (
                  <Circle className="h-5 w-5 text-[var(--muted)] hover:text-[var(--blue)]" />
                )}
              </button>
            ) : (
              <div className="shrink-0">
                {event.infoboardVisible ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-[var(--muted)]" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
