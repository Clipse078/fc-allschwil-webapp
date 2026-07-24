/**
 * components/infoboard/admin/InfoboardTodayList.tsx
 *
 * Admin event list for "Heute auf Display 1".
 *
 * Renders the events included in the Screen 1 feed, grouped by temporal
 * bucket (Jetzt / Als Nächstes / Später heute). Uses the existing feed
 * grouping — no second grouping algorithm is applied.
 *
 * Empty state: shows a neutral message matching the public Screen 1
 * empty-state meaning.
 *
 * Design constraints:
 *   - Uses only established SportClubEvo dashboard design tokens.
 *   - Pure presentation — no data fetching, no client state.
 *   - German UI copy throughout.
 *   - Shows only data available from the Screen 1 feed/presentation layer.
 *   - Inputs are never mutated.
 */

import { CalendarDays, Dumbbell, Trophy, Volleyball, Monitor } from "lucide-react";
import type { Screen1AdminEventEntry } from "@/lib/publishing/infoboard/screen1-admin-summary";
import type { TemporalBucket } from "@/lib/publishing/event-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfoboardTodayListProps = {
  readonly events: readonly Screen1AdminEventEntry[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<TemporalBucket, string> = {
  current: "Jetzt",
  next: "Als Nächstes",
  later: "Später heute",
};

const BUCKET_BADGE_CLASS: Record<TemporalBucket, string> = {
  current: "border-emerald-200 bg-emerald-50 text-emerald-700",
  next: "border-blue-200 bg-blue-50 text-blue-700",
  later: "border-amber-200 bg-amber-50 text-amber-700",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: Screen1AdminEventEntry }) {
  const Icon = TYPE_ICONS[event.type] ?? CalendarDays;

  return (
    <div className="flex items-start gap-4 px-5 py-3.5">
      {/* Type icon */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
        <Icon className="h-4 w-4 text-[var(--muted)]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          {/* Time */}
          <span className="font-mono text-sm font-semibold tabular-nums text-[var(--foreground)]">
            {formatTime(event.startAt)}
          </span>
          {event.endAt ? (
            <span className="font-mono text-[0.72rem] text-[var(--muted)]">
              – {formatTime(event.endAt)}
            </span>
          ) : null}
          {/* Title */}
          <span className="text-sm font-medium text-[var(--foreground)]">
            {event.displayTitle}
          </span>
          {/* Opponent */}
          {event.opponentDisplayName ? (
            <span className="text-[0.72rem] text-[var(--muted)]">
              vs. {event.opponentDisplayName}
            </span>
          ) : null}
        </div>

        {/* Metadata row */}
        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[0.72rem] text-[var(--muted)]">
          {event.teamDisplayName ? <span>{event.teamDisplayName}</span> : null}
          {event.competitionLabel ? <span>{event.competitionLabel}</span> : null}
          {event.pitchLabel ? (
            <span className="font-medium">{event.pitchLabel}</span>
          ) : null}
          {event.homeDressingRoomLabel ? (
            <span>{event.homeDressingRoomLabel}</span>
          ) : null}
          {event.awayDressingRoomLabel ? (
            <span>{event.awayDressingRoomLabel}</span>
          ) : null}
        </div>
      </div>

      {/* Type badge */}
      <span className="hidden shrink-0 self-center text-[0.65rem] font-medium text-[var(--muted)] sm:block">
        {TYPE_LABELS[event.type] ?? event.type}
      </span>
    </div>
  );
}

// ── Bucket section ─────────────────────────────────────────────────────────────

function BucketSection({
  bucket,
  events,
}: {
  bucket: TemporalBucket;
  events: Screen1AdminEventEntry[];
}) {
  if (events.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-2">
        <span
          className={`inline-flex h-5 items-center rounded-full border px-2 text-[0.65rem] font-semibold ${BUCKET_BADGE_CLASS[bucket]}`}
        >
          {BUCKET_LABELS[bucket]}
        </span>
        <span className="text-[0.72rem] text-[var(--muted)]">
          {events.length} {events.length === 1 ? "Event" : "Events"}
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// ── InfoboardTodayList ────────────────────────────────────────────────────────

export function InfoboardTodayList({ events }: InfoboardTodayListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <Monitor className="h-10 w-10 text-[var(--muted)]" />
        <p className="max-w-xs text-sm text-[var(--muted)]">
          Heute sind keine Trainings, Heimspiele oder Turniere für Display 1 geplant.
        </p>
      </div>
    );
  }

  const current = events.filter((e) => e.temporalBucket === "current");
  const next = events.filter((e) => e.temporalBucket === "next");
  const later = events.filter((e) => e.temporalBucket === "later");

  return (
    <div className="divide-y divide-[var(--border)]">
      <BucketSection bucket="current" events={current} />
      <BucketSection bucket="next" events={next} />
      <BucketSection bucket="later" events={later} />
    </div>
  );
}
