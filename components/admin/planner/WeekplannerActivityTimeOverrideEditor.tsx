"use client";

/**
 * components/admin/planner/WeekplannerActivityTimeOverrideEditor.tsx
 *
 * WEEKPLANNER-01D — compact start/end TIME override editor for ONE
 * canonical activity (TRAINING/MATCH/TOURNAMENT), within the currently
 * selected alternative WeekplannerPlan.
 *
 * Mirrors WeekplannerAllocationOverrideEditor.tsx's shape and "override by
 * presence" convention (see lib/weekplanner/plan-service.ts's
 * WeekplannerPlanActivityOverride doc comment): submitting a time replaces
 * the canonical Standardplan time for THIS plan only; "Standardzeit
 * verwenden" clears it — there is no separate reset mutation.
 *
 * Never rendered for the Standardplan — see WeekPlannerPage.tsx, which only
 * mounts this when an alternative plan is active and the caller can manage
 * plans.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import type { WeekplannerActivityType } from "@/lib/weekplanner/plan-types";

type Props = {
  planId: string;
  activityType: WeekplannerActivityType;
  activityId: string;
  /** Effective start/end (plan override, if any, else canonical) — ISO instants. */
  effectiveStartAt: string;
  effectiveEndAt: string;
  /** True when this plan currently overrides the time (either side). */
  isOverridden: boolean;
  /** IANA timezone for rendering/parsing the <input type="time"> value. */
  timeZone: string;
};

/** Formats a UTC instant as a "HH:mm" string in the given IANA timezone, for an <input type="time"> value. */
function toTimeInputValue(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Combines a "HH:mm" time-of-day with the CALENDAR DAY of `referenceIso` (in `timeZone`) into a full ISO instant — never changes the day. */
function combineTimeWithReferenceDay(time: string, referenceIso: string, timeZone: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const [, hh, mm] = match;

  const dayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(referenceIso));
  const year = dayParts.find((p) => p.type === "year")?.value;
  const month = dayParts.find((p) => p.type === "month")?.value;
  const day = dayParts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;

  // Resolve the wall-clock time in `timeZone` to a genuine UTC instant by
  // reading back the offset the browser/Intl engine already knows for that
  // zone+day — avoids a manual DST-offset table.
  const naiveUtcGuess = new Date(`${year}-${month}-${day}T${hh}:${mm}:00.000Z`);
  const zonedFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const shownAsIfUtc = zonedFormat.format(naiveUtcGuess);
  const [shownHour, shownMinute] = shownAsIfUtc.replace(/^24:/, "00:").split(":").map(Number);
  const targetMinutes = Number(hh) * 60 + Number(mm);
  const shownMinutes = shownHour * 60 + shownMinute;
  const diffMinutes = targetMinutes - shownMinutes;
  return new Date(naiveUtcGuess.getTime() + diffMinutes * 60_000).toISOString();
}

export function WeekplannerActivityTimeOverrideEditor({
  planId,
  activityType,
  activityId,
  effectiveStartAt,
  effectiveEndAt,
  isOverridden,
  timeZone,
}: Props) {
  const router = useRouter();
  const [startInput, setStartInput] = useState(() => toTimeInputValue(effectiveStartAt, timeZone));
  const [endInput, setEndInput] = useState(() => toTimeInputValue(effectiveEndAt, timeZone));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(
    async (startAt: string, endAt: string) => {
      setError(null);
      const res = await fetch(`/api/weekplanner/plans/${planId}/time-overrides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityType, activityId, startAt, endAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
      }
      startTransition(() => router.refresh());
    },
    [planId, activityType, activityId, router],
  );

  const handleSave = useCallback(() => {
    const startAt = combineTimeWithReferenceDay(startInput, effectiveStartAt, timeZone);
    const endAt = combineTimeWithReferenceDay(endInput, effectiveEndAt, timeZone);
    if (!startAt || !endAt) {
      setError("Bitte gültige Uhrzeiten angeben (HH:mm)");
      return;
    }
    startTransition(async () => {
      try {
        await submit(startAt, endAt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }, [startInput, endInput, effectiveStartAt, effectiveEndAt, timeZone, submit]);

  const handleUseStandardzeit = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${planId}/time-overrides`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activityType, activityId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Zurücksetzen");
      }
    });
  }, [planId, activityType, activityId, router]);

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Zeit anpassen</p>

      <div className="mt-1.5 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text-2)]">
          Start
          <input
            type="time"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--foreground)]"
            data-testid={`weekplanner-time-override-start-${activityId}`}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] text-[var(--text-2)]">
          Ende
          <input
            type="time"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-[12px] text-[var(--foreground)]"
            data-testid={`weekplanner-time-override-end-${activityId}`}
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex h-8 items-center rounded-lg bg-[var(--sce-primary)] px-3 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid={`weekplanner-time-override-save-${activityId}`}
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : "Speichern"}
        </button>
        {isOverridden && (
          <button
            type="button"
            onClick={handleUseStandardzeit}
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-2.5 text-[11px] font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={11} />
            Standardzeit verwenden
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-[11px] text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
