"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { formatParticipationSummaryLine } from "@/lib/participation/labels";
import type {
  EventParticipationData,
  TeamUpcomingParticipation,
  UpcomingParticipationEvent,
} from "@/lib/participation/types";

type Props = {
  teamId: string;
  teamSeasonId: string;
  initialUpcoming: TeamUpcomingParticipation;
};

function eventKey(event: UpcomingParticipationEvent): string {
  return event.eventKind === "TRAINING"
    ? `TRAINING:${event.trainingSessionId}`
    : `${event.eventKind}:${event.eventId}`;
}

function buildEventQuery(event: UpcomingParticipationEvent): string {
  const params = new URLSearchParams({ eventKind: event.eventKind });
  if (event.eventKind === "TRAINING" && event.trainingSessionId) {
    params.set("trainingSessionId", event.trainingSessionId);
  } else if (event.eventId) {
    params.set("eventId", event.eventId);
  }
  return params.toString();
}

export default function TeamParticipationSection({
  teamId,
  teamSeasonId,
  initialUpcoming,
}: Props) {
  const upcoming = initialUpcoming;
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(
    initialUpcoming.events[0] ? eventKey(initialUpcoming.events[0]) : null,
  );
  const [eventData, setEventData] = useState<EventParticipationData | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedEvent = useMemo(
    () => upcoming.events.find((event) => eventKey(event) === selectedEventKey) ?? null,
    [upcoming.events, selectedEventKey],
  );

  const loadEventData = useCallback(
    async (event: UpcomingParticipationEvent) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/teams/${teamId}/team-seasons/${teamSeasonId}/participation/events?${buildEventQuery(event)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as EventParticipationData;
        setEventData(data);
      } finally {
        setLoading(false);
      }
    },
    [teamId, teamSeasonId],
  );

  useEffect(() => {
    if (selectedEvent) {
      void loadEventData(selectedEvent);
    } else {
      setEventData(null);
    }
  }, [selectedEvent, loadEventData]);

  const summaryLine = eventData
    ? formatParticipationSummaryLine(eventData.summary)
    : null;

  return (
    <SectionCard
      title="Teilnahmen"
      description="Rückmeldungen der Spieler und Eltern zu anstehenden Events."
      noPadding
    >
      <div data-testid="team-participation-section">
        {upcoming.events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--muted)]">
            Keine anstehenden Events für Teilnahme-Rückmeldungen.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-3">
              {upcoming.events.map((event) => {
                const key = eventKey(event);
                const isSelected = key === selectedEventKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedEventKey(key)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                      isSelected
                        ? "border-[var(--sce-primary)] bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                    }`}
                    data-testid={`team-participation-event-${key}`}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>
                      {event.eventKindLabel} · {event.date}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedEvent ? (
              <div className="px-4 pb-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    {selectedEvent.eventKindLabel} · {selectedEvent.date}
                  </p>
                  {summaryLine ? (
                    <p
                      className="mt-1 text-xs text-[var(--muted)]"
                      data-testid="team-participation-summary"
                    >
                      {summaryLine}
                    </p>
                  ) : null}
                </div>

                {loading ? (
                  <p className="text-sm text-[var(--muted)]">Lade Teilnahmen…</p>
                ) : eventData && eventData.players.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm" data-testid="team-participation-table">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/60 text-left text-[11px] uppercase tracking-[0.04em] text-[var(--muted)]">
                          <th className="px-3 py-2.5 font-medium">Spieler</th>
                          <th className="px-3 py-2.5 font-medium">Status</th>
                          <th className="px-3 py-2.5 font-medium">Rückmeldung</th>
                          <th className="px-3 py-2.5 font-medium">Hinweis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventData.players.map((player) => (
                          <tr
                            key={player.personId}
                            className="border-b border-[var(--border)]/70"
                            data-testid={`team-participation-player-${player.personId}`}
                          >
                            <td className="px-3 py-2.5 font-medium">
                              {player.shirtNumber != null ? `#${player.shirtNumber} ` : ""}
                              {player.displayName}
                            </td>
                            <td className="px-3 py-2.5">{player.statusLabel}</td>
                            <td className="px-3 py-2.5 text-[var(--muted)]">
                              {player.responseSourceLabel ?? "—"}
                            </td>
                            <td className="px-3 py-2.5 text-[var(--muted)]">
                              {player.note ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Kein Spielerkader für die aktuelle Saison vorhanden.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
