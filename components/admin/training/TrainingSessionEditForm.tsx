"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, RotateCcw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  sessionId: string;
  canManage: boolean;
  isRescheduled: boolean;
  /** Effective (currently displayed/used) values — reflect any existing override. */
  effectiveDate: string;
  effectiveStartTime: string;
  effectiveEndTime: string;
  /** Canonical TrainingSeries-derived defaults, shown as reference. */
  originalDate: string;
  originalStartTime: string;
  originalEndTime: string;
  timezone: string;
  locale: string;
};

function formatDateLabel(date: string, locale: string, timezone: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: timezone,
  }).format(parsed);
}

/**
 * TRAININGCENTER-02 — occurrence-level date/time editor for ONE canonical
 * TrainingSession. Submits the full effective schedule to
 * PATCH /api/training-sessions/[sessionId]/reschedule, which sets (or, when
 * it matches the series default exactly, clears) this occurrence's
 * override. The parent TrainingSeries recurrence is never touched.
 */
export default function TrainingSessionEditForm({
  sessionId,
  canManage,
  isRescheduled,
  effectiveDate,
  effectiveStartTime,
  effectiveEndTime,
  originalDate,
  originalStartTime,
  originalEndTime,
  timezone,
  locale,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [date, setDate] = useState(effectiveDate);
  const [startTime, setStartTime] = useState(effectiveStartTime);
  const [endTime, setEndTime] = useState(effectiveEndTime);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!startTime || !endTime) {
      toast.danger("Start- und Endzeit sind erforderlich.");
      return;
    }
    if (startTime >= endTime) {
      toast.danger("Die Startzeit muss vor der Endzeit liegen.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/training-sessions/${sessionId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startsAt: startTime, endsAt: endTime }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(data?.error ?? "Änderungen konnten nicht gespeichert werden.");
      }

      toast.success("Training aktualisiert.");
      router.refresh();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Änderungen konnten nicht gespeichert werden.", {
        duration: 6000,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleUseSeriesDefault() {
    setDate(originalDate);
    setStartTime(originalStartTime);
    setEndTime(originalEndTime);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <CalendarClock size={18} className="text-gray-400" aria-hidden />
          Datum &amp; Zeit
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Serienstandard: {formatDateLabel(originalDate, locale, timezone)}, {originalStartTime}–{originalEndTime} (
          {timezone}).
        </p>
        {isRescheduled && (
          <p className="mt-1 text-sm font-medium text-blue-700" data-testid="training-session-edit-rescheduled-note">
            Dieses Training wurde für diesen Termin bereits angepasst.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Datum</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!canManage || saving}
            data-testid="training-session-edit-date"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Beginn</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={!canManage || saving}
            data-testid="training-session-edit-start-time"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Ende</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={!canManage || saving}
            data-testid="training-session-edit-end-time"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="training-session-edit-save"
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

          <button
            type="button"
            onClick={handleUseSeriesDefault}
            disabled={saving}
            data-testid="training-session-edit-use-default"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Serien-Standard verwenden
          </button>
        </div>
      )}
    </div>
  );
}
