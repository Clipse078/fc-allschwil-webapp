"use client";

import { useEffect, useMemo, useState } from "react";
import type { AttendanceEventKind, AttendanceStatus } from "@prisma/client";
import { Sheet } from "@/components/ui/Sheet";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/attendance/labels";
import type { AttendanceEventOption } from "@/lib/attendance/queries";
import type { EventAttendanceEntry } from "@/lib/attendance/types";

type Props = {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamSeasonId: string;
  onSaved: () => Promise<void> | void;
};

const STATUS_OPTIONS: AttendanceStatus[] = [
  "OPEN",
  "PRESENT",
  "ABSENT",
  "EXCUSED",
  "INJURED",
];

export default function TeamAttendanceEventSheet({
  open,
  onClose,
  teamId,
  teamSeasonId,
  onSaved,
}: Props) {
  const [events, setEvents] = useState<AttendanceEventOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [entries, setEntries] = useState<EventAttendanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEvent = useMemo(() => {
    if (!selectedKey) {
      return null;
    }
    return events.find((event) => eventKey(event) === selectedKey) ?? null;
  }, [events, selectedKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/teams/${teamId}/team-seasons/${teamSeasonId}/attendance/events`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("events fetch failed");
        }
        const data = (await response.json()) as { events: AttendanceEventOption[] };
        if (!cancelled) {
          setEvents(data.events);
          setSelectedKey(data.events[0] ? eventKey(data.events[0]) : "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setError("Events konnten nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, teamId, teamSeasonId]);

  useEffect(() => {
    if (!open || !selectedEvent) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ eventKind: selectedEvent.eventKind });
    if (selectedEvent.trainingSessionId) {
      params.set("trainingSessionId", selectedEvent.trainingSessionId);
    }
    if (selectedEvent.eventId) {
      params.set("eventId", selectedEvent.eventId);
    }

    fetch(
      `/api/teams/${teamId}/team-seasons/${teamSeasonId}/attendance/events/sheet?${params.toString()}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("sheet fetch failed");
        }
        const data = (await response.json()) as { entries: EventAttendanceEntry[] };
        if (!cancelled) {
          setEntries(data.entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
          setError("Anwesenheitsliste konnte nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedEvent, teamId, teamSeasonId]);

  async function handleSave() {
    if (!selectedEvent) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/teams/${teamId}/team-seasons/${teamSeasonId}/attendance/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventKind: selectedEvent.eventKind,
            trainingSessionId: selectedEvent.trainingSessionId,
            eventId: selectedEvent.eventId,
            entries: entries.map((entry) => ({
              personId: entry.personId,
              status: entry.status,
              note: entry.note,
            })),
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Speichern fehlgeschlagen.");
      }

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Anwesenheit erfassen"
      description="Status pro Spieler für ein Event festhalten."
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedEvent || entries.length === 0}
            className="rounded-md bg-[var(--sce-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="team-attendance-save-button"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      }
    >
      <div data-testid="team-attendance-event-sheet" className="space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--muted)]">
            Event
          </span>
          <select
            value={selectedKey}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            data-testid="team-attendance-event-select"
          >
            {events.length === 0 ? <option value="">Keine Events verfügbar</option> : null}
            {events.map((event) => (
              <option key={eventKey(event)} value={eventKey(event)}>
                {event.date} · {event.eventKindLabel} · {event.title}
              </option>
            ))}
          </select>
        </label>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">Lade Spieler…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Kein Kader für dieses Event verfügbar.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60 text-left text-[11px] uppercase tracking-[0.04em] text-[var(--muted)]">
                  <th className="px-3 py-2 font-medium">Spieler</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.personId} className="border-b border-[var(--border)]/70">
                    <td className="px-3 py-2 font-medium">
                      {entry.shirtNumber != null ? `#${entry.shirtNumber} ` : ""}
                      {entry.displayName}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={entry.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as AttendanceStatus;
                          setEntries((current) =>
                            current.map((row) =>
                              row.personId === entry.personId
                                ? { ...row, status: nextStatus }
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                        data-testid={`attendance-entry-status-${entry.personId}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function eventKey(event: AttendanceEventOption): string {
  if (event.eventKind === "TRAINING") {
    return `TRAINING:${event.trainingSessionId}`;
  }
  return `${event.eventKind}:${event.eventId}`;
}
