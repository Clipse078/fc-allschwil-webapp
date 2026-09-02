/**
 * components/infoboard/screen2/Screen2TransportSlide.tsx
 *
 * INFOBOARD-TRANSPORT-02 — normalized transport departures presentation.
 */

import type { ReactElement } from "react";
import type { TransportDeparture, TransportResult } from "@/lib/transport/transport-types";
import styles from "./Screen2TransportSlide.module.css";

export type Screen2TransportSlideProps = {
  transport: TransportResult | null | undefined;
  timezone: string;
  nowIso?: string;
};

function formatMinutesUntil(
  departure: TransportDeparture,
  nowMs: number,
  timezone: string,
): { minutesLabel: string; absoluteTime: string } {
  const effectiveIso = departure.realtimeDeparture ?? departure.plannedDeparture;
  const effectiveMs = Date.parse(effectiveIso);
  const diffMinutes = Math.max(0, Math.round((effectiveMs - nowMs) / 60_000));
  const minutesLabel = diffMinutes <= 0 ? "Jetzt" : `${diffMinutes} min`;

  const absoluteTime = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(effectiveIso));

  return { minutesLabel, absoluteTime };
}

function resolveDepartures(transport: TransportResult | null | undefined): {
  departures: TransportDeparture[];
  stationDisplayName: string;
  isStale: boolean;
  hasRealtimeData: boolean;
  unavailable: boolean;
  empty: boolean;
} {
  if (!transport) {
    return {
      departures: [],
      stationDisplayName: "",
      isStale: false,
      hasRealtimeData: false,
      unavailable: true,
      empty: false,
    };
  }

  if (transport.isAvailable) {
    return {
      departures: transport.departures,
      stationDisplayName: transport.stationDisplayName,
      isStale: transport.isStale,
      hasRealtimeData: transport.hasRealtimeData,
      unavailable: false,
      empty: transport.departures.length === 0,
    };
  }

  const cached = transport.cachedDepartures ?? [];
  if (cached.length > 0) {
    return {
      departures: cached,
      stationDisplayName: transport.stationDisplayName,
      isStale: true,
      hasRealtimeData: cached.some((departure) => departure.hasRealtime),
      unavailable: false,
      empty: false,
    };
  }

  return {
    departures: [],
    stationDisplayName: transport.stationDisplayName,
    isStale: false,
    hasRealtimeData: false,
    unavailable: true,
    empty: false,
  };
}

export function Screen2TransportSlide({
  transport,
  timezone,
  nowIso,
}: Screen2TransportSlideProps): ReactElement {
  const nowMs = Date.parse(nowIso ?? new Date().toISOString());
  const resolved = resolveDepartures(transport);

  return (
    <div className={styles.slide} data-testid="screen2-transport-slide">
      <div className={styles.header}>
        <div className={styles.eyebrow}>ÖV-ABFAHRTEN</div>
        <div className={styles.station}>{resolved.stationDisplayName || "—"}</div>
        <div className={styles.subtitle}>
          {resolved.hasRealtimeData ? "Live-Abfahrten" : "Abfahrten"}
        </div>
        {resolved.isStale ? (
          <div className={styles.staleHint} data-testid="screen2-transport-stale">
            Aktualisierung verzögert
          </div>
        ) : null}
      </div>

      {resolved.unavailable ? (
        <div className={styles.unavailableState} data-testid="screen2-transport-unavailable">
          Abfahrten vorübergehend nicht verfügbar
        </div>
      ) : resolved.empty ? (
        <div className={styles.emptyState} data-testid="screen2-transport-empty">
          Keine nächsten Verbindungen verfügbar
        </div>
      ) : (
        <div className={styles.rows} data-testid="screen2-transport-rows">
          {resolved.departures.map((departure, index) => {
            const timing = formatMinutesUntil(departure, nowMs, timezone);
            return (
              <div
                key={`${departure.line}-${departure.destination}-${departure.plannedDeparture}-${index}`}
                className={styles.row}
                data-testid="screen2-transport-row"
              >
                <div className={styles.lineBlock}>
                  <span className={styles.category}>{departure.categoryLabel}</span>
                  <span className={styles.line}>{departure.line}</span>
                </div>
                <div className={styles.destination}>{departure.destination}</div>
                <div className={styles.departureBlock}>
                  <span className={styles.minutes}>{timing.minutesLabel}</span>
                  <span className={styles.absoluteTime}>{timing.absoluteTime}</span>
                  {departure.delayMinutes && departure.delayMinutes > 0 ? (
                    <span className={styles.delay}>+{departure.delayMinutes}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
